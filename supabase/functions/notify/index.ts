// Sends a push notification to the other person when one of us finishes a
// workout or reacts to one. Called by the app with the signed-in user's token.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = 'BI58-k8itRMA_jCC8jJ-7ziorUDBY3FYfq0VFoTGaEmuJW29lagwBFxMgFV5NIKYEyLBWjPUBd_0LpggLiN2pIA'
const APP_URL = 'https://garage-gym-claude.vercel.app'
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

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

    const { data: secret } = await admin.from('app_secrets').select('value').eq('name', 'vapid_private_key').maybeSingle()
    if (!secret) return json({ error: 'push is not configured' }, 500)
    webpush.setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, secret.value)

    const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').in('user_id', recipients)
    let sent = 0
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: 'Garage Gym', body, url: type === 'test' ? '/settings' : '/us' }))
        sent++
      } catch (err) {
        // The phone dropped this subscription: forget it.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
    return json({ sent })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
