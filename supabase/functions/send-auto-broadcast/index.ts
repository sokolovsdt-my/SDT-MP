// send-auto-broadcast — отправка авторассылок (пока только 'birthday').
//
// Принимает: { type: 'birthday' }.
//
// Алгоритм:
//   1. Читает строку auto_broadcasts WHERE type=type AND is_active=true.
//   2. Находит клиентов у которых день рождения через days_before дней (по МСК),
//      сравнивая ТОЛЬКО месяц+день. Edge case 29 февраля → 28 февраля в
//      невисокосный год.
//   3. Для каждого делает INSERT в auto_broadcast_runs с UNIQUE(auto_id, recipient_id, run_date).
//      ON CONFLICT DO NOTHING — если эта рассылка уже шла этому человеку сегодня,
//      пропускаем (anti-spam при повторных запусках cron'a).
//   4. Реально отправляет через FCM (push) и/или Resend (email).
//   5. Обновляет channels_sent / error в строке runs и инкрементит sent_count.
//   6. Возврат: { ok, sent }.
//
// Авторизация: либо cron-secret (vault.service_role_key, передаётся как Bearer
// из pg_cron), либо user JWT с ролью admin/manager/owner. verify_jwt=false
// на gateway — cron-secret не JWT.
//
// Env: те же что у send-broadcast (FCM_SERVICE_ACCOUNT_JSON, RESEND_API_KEY, RESEND_FROM).

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import xss from "npm:xss@^1"

// ─── CORS ──────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── FCM HTTP v1 (одна и та же реализация что в send-broadcast) ─────────────
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
    'pkcs8', pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
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
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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
// HTML-санитайз для email-канала. npm:xss — без DOM-зависимостей (jsdom
// в Deno edge runtime не работает). Whitelist синхронизирован с send-broadcast.
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
    css:                   false,
  })
}
function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

// ─── Авторизация ─────────────────────────────────────────────────────────────
async function authorize(req: Request, sb: any): Promise<{ ok: true, mode: 'cron' | 'admin', userId?: string } | { ok: false, error: string, status: number }> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return { ok: false, error: 'missing_auth', status: 401 }
  const token = authHeader.slice(7).trim()
  if (!token) return { ok: false, error: 'missing_auth', status: 401 }

  // 1. Cron-secret из vault через RPC
  const { data: cronSecret } = await sb.rpc('_get_cron_secret')
  if (cronSecret && cronSecret === token) {
    return { ok: true, mode: 'cron' }
  }

  // 2. User JWT — auth.getUser проверяет подпись, потом проверяем роль
  const { data: userResp, error: uErr } = await sb.auth.getUser(token)
  const user = userResp?.user
  if (uErr || !user) return { ok: false, error: 'invalid_jwt', status: 401 }
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'manager', 'owner'].includes(profile.role)) {
    return { ok: false, error: 'forbidden', status: 403 }
  }
  return { ok: true, mode: 'admin', userId: user.id }
}

// ─── Main ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ ok: false, error: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const FCM_SA_RAW   = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')
  const RESEND_KEY   = Deno.env.get('RESEND_API_KEY')
  const RESEND_FROM  = Deno.env.get('RESEND_FROM') || 'SDT <noreply@example.com>'

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  const auth = await authorize(req, sb)
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status)

  let payload: any
  try { payload = await req.json() } catch { return json({ ok: false, error: 'invalid_json' }, 400) }
  const type = payload?.type
  if (!type) return json({ ok: false, error: 'no_type' }, 400)

  // 1. Настройки
  const { data: auto, error: aErr } = await sb
    .from('auto_broadcasts')
    .select('id, is_active, channel, title, content, days_before')
    .eq('type', type)
    .maybeSingle()
  if (aErr)        return json({ ok: false, error: aErr.message }, 500)
  if (!auto)       return json({ ok: false, error: 'auto_not_found' }, 404)
  if (!auto.is_active) return json({ ok: true, sent: 0, skipped_reason: 'inactive' })

  // 2. Целевая дата (МСК)
  const nowMsk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
  const target = new Date(nowMsk)
  target.setDate(target.getDate() + (auto.days_before || 0))
  const targetMonth = target.getMonth() + 1
  const targetDay   = target.getDate()
  const targetYear  = target.getFullYear()
  const includeFeb29 = (targetMonth === 2 && targetDay === 28 && !isLeap(targetYear))

  const channels  = (auto.channel || 'push').split('+').filter(Boolean)
  const wantPush  = channels.includes('push')
  const wantEmail = channels.includes('email')

  // 3. Клиенты с подходящим ДР
  const { data: all, error: pErr } = await sb.from('profiles')
    .select('id, full_name, email, push_token, birth_date')
    .eq('role', 'client')
    .not('birth_date', 'is', null)
  if (pErr) return json({ ok: false, error: pErr.message }, 500)
  const recipients = (all || []).filter(p => {
    const bd = new Date(p.birth_date)
    const m = bd.getMonth() + 1, d = bd.getDate()
    if (m === targetMonth && d === targetDay) return true
    if (includeFeb29 && m === 2 && d === 29)  return true
    return false
  })

  if (recipients.length === 0) return json({ ok: true, sent: 0, skipped_reason: 'no_birthdays_today' })

  // 4. FCM token (один на всех)
  let fcmToken: string | null = null
  let fcmProjectId: string | null = null
  if (wantPush && FCM_SA_RAW) {
    try {
      const sa = JSON.parse(FCM_SA_RAW)
      fcmProjectId = sa.project_id
      fcmToken = await getFcmAccessToken(sa)
    } catch (e) { console.error('FCM init failed:', (e as Error).message) }
  }

  const titleText = stripHtml(auto.title || '')
  const bodyText  = stripHtml(auto.content || '')
  const emailHtml = sanitizeEmailHtml(auto.content || '')

  let sent = 0
  let alreadyToday = 0

  for (const r of recipients) {
    // 5. ANTI-SPAM: пытаемся вставить run-row. UNIQUE-конфликт = уже шли сегодня.
    const { data: claim, error: claimErr } = await sb
      .from('auto_broadcast_runs')
      .insert({ auto_id: auto.id, recipient_id: r.id })
      .select('id').maybeSingle()
    if (claimErr || !claim) {
      alreadyToday++
      continue
    }

    const errs: string[] = []
    let okChannels: string[] = []

    if (wantPush && fcmToken && r.push_token) {
      try {
        await sendFcm(fcmToken, fcmProjectId!, r.push_token, titleText, bodyText)
        okChannels.push('push')
      } catch (e) { errs.push('push: ' + (e as Error).message) }
    }
    if (wantEmail && RESEND_KEY && r.email) {
      try {
        await sendEmail(RESEND_KEY, RESEND_FROM, r.email, titleText, emailHtml)
        okChannels.push('email')
      } catch (e) { errs.push('email: ' + (e as Error).message) }
    }

    if (okChannels.length > 0) {
      sent++
      await sb.from('auto_broadcast_runs').update({
        channels_sent: okChannels.join('+'),
        error: errs.length ? errs.join('; ') : null,
      }).eq('id', claim.id)
    } else {
      await sb.from('auto_broadcast_runs').update({
        error: errs.length ? errs.join('; ') : 'no_contact_channels',
      }).eq('id', claim.id)
    }
  }

  // 6. Инкремент глобального счётчика (для UI «Отправлено за всё время»).
  if (sent > 0) {
    const { data: cur } = await sb.from('auto_broadcasts').select('sent_count').eq('id', auto.id).maybeSingle()
    await sb.from('auto_broadcasts')
      .update({ sent_count: (cur?.sent_count || 0) + sent })
      .eq('id', auto.id)
  }

  return json({ ok: true, sent, already_today: alreadyToday, total_candidates: recipients.length })
})
