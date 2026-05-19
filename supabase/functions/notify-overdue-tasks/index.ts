// notify-overdue-tasks — эскалация просроченных задач (S15).
//
// Алгоритм:
//   1. Авторизация: cron-secret из vault (через _get_cron_secret RPC) либо
//      user JWT с ролью admin/manager/owner.
//   2. Находим просроченные задачи: deadline < now() (МСК), статус не в
//      done/closed/cancelled.
//   3. Для каждой → берём task_assignees + profiles (push_token, full_name).
//   4. INSERT в task_overdue_notifications. UNIQUE(task_id, assignee_id, run_date)
//      даёт anti-spam: каждому ответственному не больше одного пуша в день
//      про конкретную задачу.
//   5. Если запись вставилась (не было сегодня) — шлём FCM.
//   6. Возврат stats.
//
// pg_cron job notify-overdue-tasks-hourly дёргает раз в час. Если cron упал
// и перезапустился через полчаса — повторно тем же не уйдёт.

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── FCM HTTP v1 (общая с send-broadcast/send-auto-broadcast) ───────────────
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

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function authorize(req: Request, sb: any): Promise<{ ok: true } | { ok: false, error: string, status: number }> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return { ok: false, error: 'missing_auth', status: 401 }
  const token = authHeader.slice(7).trim()
  if (!token) return { ok: false, error: 'missing_auth', status: 401 }

  const { data: cronSecret } = await sb.rpc('_get_cron_secret')
  if (cronSecret && cronSecret === token) return { ok: true }

  const { data: userResp, error: uErr } = await sb.auth.getUser(token)
  const user = userResp?.user
  if (uErr || !user) return { ok: false, error: 'invalid_jwt', status: 401 }
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!profile || !['admin', 'manager', 'owner'].includes(profile.role)) {
    return { ok: false, error: 'forbidden', status: 403 }
  }
  return { ok: true }
}

function fmtDeadline(deadline: string): string {
  // deadline хранится как timestamp without time zone, MSK naive.
  // Парсим, форматируем в "ДД.ММ ЧЧ:ММ".
  const d = new Date(deadline.replace(' ', 'T') + 'Z')  // считаем MSK как пометку, без TZ-сдвига
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  return `${dd}.${mm} ${hh}:${mi}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ ok: false, error: 'method_not_allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const FCM_SA_RAW   = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)

  const auth = await authorize(req, sb)
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status)

  // 1. Просроченные задачи (МСК naive deadline vs МСК naive now)
  const nowMsk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }))
  const nowMskIso = nowMsk.toISOString().slice(0, 19).replace('T', ' ')  // 'YYYY-MM-DD HH:mm:ss'

  const { data: tasks, error: tErr } = await sb
    .from('tasks')
    .select('id, title, deadline, status, task_assignees(user_id)')
    .not('deadline', 'is', null)
    .lt('deadline', nowMskIso)
    .not('status', 'in', '(done,closed,cancelled)')
  if (tErr) return json({ ok: false, error: tErr.message }, 500)
  if (!tasks || tasks.length === 0) {
    return json({ ok: true, overdue_tasks: 0, sent: 0 })
  }

  // 2. Собираем уникальных ассайни
  const assigneeIds = new Set<string>()
  for (const t of tasks) {
    for (const a of (t.task_assignees || [])) {
      if (a.user_id) assigneeIds.add(a.user_id)
    }
  }
  if (assigneeIds.size === 0) {
    return json({ ok: true, overdue_tasks: tasks.length, sent: 0, no_assignees: true })
  }

  // 3. Получаем профили ассайни
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, push_token')
    .in('id', Array.from(assigneeIds))
  const byId = new Map<string, any>()
  for (const p of (profiles || [])) byId.set(p.id, p)

  // 4. FCM token (один на всех)
  let fcmToken: string | null = null
  let fcmProjectId: string | null = null
  if (FCM_SA_RAW) {
    try {
      const sa = JSON.parse(FCM_SA_RAW)
      fcmProjectId = sa.project_id
      fcmToken = await getFcmAccessToken(sa)
    } catch (e) { console.error('FCM init failed:', (e as Error).message) }
  }

  let sent = 0
  let alreadyToday = 0
  let noPushToken = 0
  let errors = 0

  // 5. Для каждой пары (task, assignee) — claim + send
  for (const t of tasks) {
    for (const a of (t.task_assignees || [])) {
      if (!a.user_id) continue
      const profile = byId.get(a.user_id)
      if (!profile) continue

      // ANTI-SPAM claim
      const { data: claim, error: claimErr } = await sb
        .from('task_overdue_notifications')
        .insert({ task_id: t.id, assignee_id: a.user_id, run_date: new Date().toISOString().slice(0, 10) })
        .select('id').maybeSingle()
      if (claimErr || !claim) {
        alreadyToday++
        continue
      }

      if (!profile.push_token || !fcmToken) {
        noPushToken++
        await sb.from('task_overdue_notifications').update({
          error: !fcmToken ? 'fcm_not_configured' : 'no_push_token',
        }).eq('id', claim.id)
        continue
      }

      const title = '⏰ Просроченная задача'
      const body  = `${t.title} (дедлайн ${fmtDeadline(t.deadline)})`
      try {
        await sendFcm(fcmToken, fcmProjectId!, profile.push_token, title, body)
        sent++
        await sb.from('task_overdue_notifications').update({ channels_sent: 'push' }).eq('id', claim.id)
      } catch (e) {
        errors++
        await sb.from('task_overdue_notifications').update({
          error: (e as Error).message.slice(0, 500),
        }).eq('id', claim.id)
      }
    }
  }

  return json({
    ok: true,
    overdue_tasks:  tasks.length,
    sent,
    already_today: alreadyToday,
    no_push_token: noPushToken,
    errors,
  })
})
