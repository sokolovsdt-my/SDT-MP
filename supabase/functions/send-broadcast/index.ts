// send-broadcast — отправка пушей (FCM HTTP v1) и/или email (Resend) для указанной
// рассылки. Вызывается из клиента после INSERT (status='sent') и из pg_cron
// для scheduled рассылок (status='scheduled' AND scheduled_at <= now()).
//
// Тело: { broadcast_id: uuid }
// Ответ: { ok, sent_push, sent_email, failed, skipped_reason? }
//
// Env (выставляется в Supabase Dashboard → Edge Functions → send-broadcast → Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — авто из платформы
//   FCM_SERVICE_ACCOUNT_JSON — JSON service account Firebase (для пушей)
//   RESEND_API_KEY           — ключ Resend (для email)
//   RESEND_FROM              — адрес отправителя email (например 'SDT <noreply@sdt.ru>')

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import xss from "npm:xss@^1"

// ─── CORS ──────────────────────────────────────────────────────────────────
// supabase.functions.invoke() из браузера триггерит preflight (Vercel != Supabase
// origin). Без OPTIONS-ветки браузер получает 405 и обещание падает с
// «Failed to send a request to the Edge Function».
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── FCM HTTP v1 ───────────────────────────────────────────────────────────
function pemToDer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf.buffer
}

function b64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getFcmAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('FCM token: ' + JSON.stringify(data))
  return data.access_token as string
}

async function sendFcm(accessToken: string, projectId: string, token: string, title: string, body: string) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: { token, notification: { title, body } } }),
  })
  if (!res.ok) throw new Error(`FCM ${res.status}: ${await res.text()}`)
}

// ─── Resend ────────────────────────────────────────────────────────────────
async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim()
}

// HTML-санитайз для email-канала. Раньше тело уходило как сырое HTML из
// broadcasts.content — XSS-вектор при утечке админ-аккаунта. Используем
// npm:xss — чистый JS без DOM-зависимостей (isomorphic-dompurify тянет
// jsdom, который не работает в Deno edge runtime). Запрещаем script/style/
// iframe/object/embed/form, on*-обработчики, javascript:-URL.
function sanitizeEmailHtml(html: string): string {
  return xss(html || '', {
    whiteList: {
      a: ['href', 'title', 'target', 'rel'],
      b: [], strong: [], i: [], em: [], u: [], s: [],
      p: [], br: [], hr: [],
      h1: [], h2: [], h3: [], h4: [], h5: [], h6: [],
      ul: [], ol: [], li: [],
      blockquote: [], pre: [], code: [],
      div: [], span: [],
      img: ['src', 'alt', 'width', 'height'],
      table: [], thead: [], tbody: [], tr: [], td: ['colspan', 'rowspan'], th: ['colspan', 'rowspan'],
    },
    stripIgnoreTag:        true,
    stripIgnoreTagBody:    ['script', 'style'],
    allowCommentTag:       false,
    css:                   false, // никаких inline-style
  })
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ─── Авторизация ─────────────────────────────────────────────────────────────
// Два пути: cron-secret (для pg_cron) или user JWT с ролью admin/manager/owner.
// Cron-secret хранится в vault.service_role_key (32 случайных байта base64).
// Раньше там был anon JWT (публичный) — любой мог дёрнуть edge.
// verify_jwt=false на gateway, потому что cron-secret не JWT.
async function authorize(req: Request, sb: any): Promise<{ ok: true, mode: 'cron' | 'admin', userId?: string } | { ok: false, error: string, status: number }> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return { ok: false, error: 'missing_auth', status: 401 }
  const token = authHeader.slice(7).trim()
  if (!token) return { ok: false, error: 'missing_auth', status: 401 }

  // 1. Cron-secret: читаем из vault через RPC и сравниваем
  const { data: cronSecret } = await sb.rpc('_get_cron_secret')
  if (cronSecret && cronSecret === token) {
    return { ok: true, mode: 'cron' }
  }

  // 2. User JWT — проверка подписи через auth.getUser, потом роль через profiles
  const { data: { user }, error: uErr } = await sb.auth.getUser(token)
  if (uErr || !user) return { ok: false, error: 'invalid_jwt', status: 401 }
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'manager', 'owner'].includes(profile.role)) {
    return { ok: false, error: 'forbidden', status: 403 }
  }
  return { ok: true, mode: 'admin', userId: user.id }
}

// ─── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ ok: false, error: 'method_not_allowed' }, 405)

  const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const FCM_SA_RAW    = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  const RESEND_KEY    = Deno.env.get('RESEND_API_KEY')
  const RESEND_FROM   = Deno.env.get('RESEND_FROM') || 'SDT <noreply@example.com>'

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  // Авторизация ДО парсинга тела — чтобы 401/403 уходили без побочек.
  const auth = await authorize(req, sb)
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status)

  let payload: any
  try { payload = await req.json() } catch { return json({ ok: false, error: 'invalid_json' }, 400) }
  const broadcastId = payload?.broadcast_id
  if (!broadcastId) return json({ ok: false, error: 'no_broadcast_id' }, 400)

  // Атомарный claim: только 'scheduled'/'draft'. Уже отправленные ('sent')
  // повторно не отправляем — раньше 'sent' тоже claim'ил → replay-атака.
  const { data: claim, error: claimErr } = await sb
    .from('broadcasts')
    .update({ status: 'sending' })
    .eq('id', broadcastId)
    .in('status', ['scheduled', 'draft'])
    .select('id, title, content, channel')
    .maybeSingle()

  if (claimErr) return json({ ok: false, error: claimErr.message }, 500)
  if (!claim)   return json({ ok: false, error: 'already_sent_or_not_found' }, 409)

  const channels  = (claim.channel || '').split('+').filter(Boolean)
  const wantPush  = channels.includes('push')
  const wantEmail = channels.includes('email')

  // Получатели + контактные данные клиента
  const { data: recipients, error: rErr } = await sb
    .from('broadcast_recipients')
    .select('id, client_id, profiles:client_id(push_token, email)')
    .eq('broadcast_id', broadcastId)

  if (rErr) {
    await sb.from('broadcasts').update({ status: 'sent' }).eq('id', broadcastId)
    return json({ ok: false, error: rErr.message }, 500)
  }

  // Подготавливаем FCM access token (один на всех)
  let fcmToken: string | null = null
  let fcmProjectId: string | null = null
  if (wantPush && FCM_SA_RAW) {
    try {
      const sa = JSON.parse(FCM_SA_RAW)
      fcmProjectId = sa.project_id
      fcmToken = await getFcmAccessToken(sa)
    } catch (e) {
      console.error('FCM init failed:', (e as Error).message)
    }
  }

  if (wantPush && !fcmToken)        console.warn('Push channel requested but FCM not configured (FCM_SERVICE_ACCOUNT_JSON missing or invalid)')
  if (wantEmail && !RESEND_KEY)     console.warn('Email channel requested but RESEND_API_KEY not set')

  const titleText = stripHtml(claim.title)
  const bodyText  = stripHtml(claim.content)
  // Для email-канала отдельно санитизируем HTML — иначе сырое тело из
  // RichEditor могло бы пронести произвольный JS через утечку аккаунта.
  const emailHtml = sanitizeEmailHtml(claim.content || '')

  let sentPush = 0, sentEmail = 0, failed = 0

  for (const r of (recipients || [])) {
    const profile = (r as any).profiles
    const errs: string[] = []
    let any = false

    if (wantPush && fcmToken && profile?.push_token) {
      try {
        await sendFcm(fcmToken, fcmProjectId!, profile.push_token, titleText, bodyText)
        sentPush++; any = true
      } catch (e) { errs.push('push: ' + (e as Error).message) }
    }

    if (wantEmail && RESEND_KEY && profile?.email) {
      try {
        await sendEmail(RESEND_KEY, RESEND_FROM, profile.email, titleText, emailHtml)
        sentEmail++; any = true
      } catch (e) { errs.push('email: ' + (e as Error).message) }
    }

    const updateRow: any = any
      ? { delivered_at: new Date().toISOString(), failed_at: null, error: errs.length ? errs.join('; ') : null }
      : (errs.length
          ? { failed_at: new Date().toISOString(), error: errs.join('; ') }
          : null)
    if (!any && errs.length === 0) {
      // Не было каналов вообще для этого получателя (нет push_token и нет email).
      // Считаем как failed чтобы было видно в статистике.
      failed++
      await sb.from('broadcast_recipients').update({ failed_at: new Date().toISOString(), error: 'no_contact_channels' }).eq('id', r.id)
      continue
    }
    if (!any) failed++
    if (updateRow) await sb.from('broadcast_recipients').update(updateRow).eq('id', r.id)
  }

  await sb.from('broadcasts').update({
    status:  'sent',
    sent_at: new Date().toISOString(),
  }).eq('id', broadcastId)

  return json({ ok: true, sent_push: sentPush, sent_email: sentEmail, failed })
})
