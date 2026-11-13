// Sends push notifications. The app calls it with the signed-in user's token
// when one of us finishes a workout or reacts to one. The database's scheduler
// calls it with a shared secret for the Sunday summary and the 4-day nudge.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = 'BI58-k8itRMA_jCC8jJ-7ziorUDBY3FYfq0VFoTGaEmuJW29lagwBFxMgFV5NIKYEyLBWjPUBd_0LpggLiN2pIA'
const APP_URL = 'https://garage-gym-claude.vercel.app'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type Admin = ReturnType<typeof createClient>
interface Message {
  user: string
  body: string
  url: string
}

/** Deliver each message to every phone its person has registered. Returns how many were sent. */
async function deliver(admin: Admin, messages: Message[]): Promise<number | null> {
  if (messages.length === 0) return 0
  const { data: secret } = await admin.from('app_secrets').select('value').eq('name', 'vapid_private_key').maybeSingle()
  if (!secret) return null
  webpush.setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, secret.value as string)
  const { data: subs } = await admin.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', messages.map((m) => m.user))
  let sent = 0
  for (const sub of subs ?? []) {
    const m = messages.find((x) => x.user === sub.user_id)
    if (!m) continue
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } }, JSON.stringify({ title: 'Garage Gym', body: m.body, url: m.url }))
      sent++
    } catch (err) {
      // The phone dropped this subscription: forget it.
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }
  return sent
}

/** The Sunday summary and the 4-day nudge, run by the database's scheduler. */
async function scheduled(admin: Admin, type: string): Promise<Message[]> {
  const { data: profiles } = await admin.from('profiles').select('id, display_name, weekly_target').eq('deleted', false)
  const { data: states } = await admin.from('program_state').select('id, data')
  const wants = (id: string, setting: string) => (states?.find((s) => s.id === id)?.data as { notify?: Record<string, boolean> } | undefined)?.notify?.[setting] !== false
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: sessions } = await admin.from('workout_sessions').select('user_id, finished_at').eq('deleted', false).not('finished_at', 'is', null).gte('finished_at', since)
  const mine = (id: string) => (sessions ?? []).filter((s) => s.user_id === id).map((s) => Date.parse(s.finished_at as string))
  const people = profiles ?? []
  const messages: Message[] = []

  if (type === 'weekly_summary') {
    const weekAgo = Date.now() - 7 * 86400000
    const count = (id: string) => mine(id).filter((t) => t >= weekAgo).length
    for (const p of people) {
      if (!wants(p.id as string, 'weekly')) continue
      const own = `You did ${count(p.id as string)} of ${p.weekly_target ?? 4} workouts this week.`
      const others = people.filter((o) => o.id !== p.id).map((o) => `${o.display_name || 'Your partner'} did ${count(o.id as string)} of ${o.weekly_target ?? 4}.`)
      messages.push({ user: p.id as string, body: [own, ...others, 'Tap for the recap.'].join(' '), url: '/us' })
    }
  } else {
    // Sent once: on the day the gap since the last workout reaches four days.
    for (const p of people) {
      if (!wants(p.id as string, 'nudge')) continue
      const times = mine(p.id as string)
      if (times.length === 0) continue
      const days = Math.floor((Date.now() - Math.max(...times)) / 86400000)
      if (days === 4) messages.push({ user: p.id as string, body: 'It has been 4 days since your last workout. Your next one is ready when you are.', url: '/' })
    }
  }
  return messages
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // The scheduler identifies itself with a secret only the database holds.
    const cronSecret = req.headers.get('x-cron-secret')
    if (cronSecret) {
      const { data: expected } = await admin.from('app_secrets').select('value').eq('name', 'cron_secret').maybeSingle()
      if (!expected || expected.value !== cronSecret) return json({ error: 'not allowed' }, 401)
      const { type } = await req.json()
      if (!['weekly_summary', 'nudge'].includes(type)) return json({ error: 'unknown type' }, 400)
      const sent = await deliver(admin, await scheduled(admin, type))
      return sent === null ? json({ error: 'push is not configured' }, 500) : json({ sent })
    }

    // Who is calling? The function checks the token itself.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await admin.auth.getUser(token)
    const sender = auth?.user
    if (!sender) return json({ error: 'not signed in' }, 401)

    const { type, sessionId } = await req.json()
    if (!['workout_finished', 'reaction', 'test'].includes(type)) return json({ error: 'unknown type' }, 400)

    const { data: me } = await admin.from('profiles').select('display_name').eq('id', sender.id).maybeSingle()
    const name = me?.display_name || 'Your partner'

    let recipients: string[] = []
    let body = ''
    if (type === 'test') {
      recipients = [sender.id]
      body = 'Notifications are working on this phone.'
    } else {
      const { data: session } = await admin.from('workout_sessions').select('id, user_id, title, finished_at, deleted').eq('id', sessionId).maybeSingle()
      if (!session || session.deleted || !session.finished_at) return json({ error: 'no such workout' }, 404)
      if (type === 'workout_finished') {
        if (session.user_id !== sender.id) return json({ error: 'not your workout' }, 403)
        const { data: others } = await admin.from('profiles').select('id').neq('id', sender.id)
        recipients = (others ?? []).map((p) => p.id)
        body = `${name} finished ${session.title}`
      } else {
        if (session.user_id === sender.id) return json({ sent: 0 })
        recipients = [session.user_id]
        body = `${name} cheered your ${session.title} workout`
      }
    }

    // Respect each person's notification switches.
    if (type !== 'test' && recipients.length) {
      const { data: states } = await admin.from('program_state').select('id, data').in('id', recipients)
      const setting = type === 'workout_finished' ? 'partnerWorkout' : 'reactions'
      recipients = recipients.filter((id) => states?.find((s) => s.id === id)?.data?.notify?.[setting] !== false)
    }
    if (recipients.length === 0) return json({ sent: 0 })

    const sent = await deliver(admin, recipients.map((user) => ({ user, body, url: type === 'test' ? '/settings' : '/us' })))
    if (sent === null) return json({ error: 'push is not configured' }, 500)
    return json({ sent })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
