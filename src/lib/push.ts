import { supabase } from './supabase'

/** The public half of our push key. Safe to ship; the private half stays on the server. */
const VAPID_PUBLIC_KEY = 'BI58-k8itRMA_jCC8jJ-7ziorUDBY3FYfq0VFoTGaEmuJW29lagwBFxMgFV5NIKYEyLBWjPUBd_0LpggLiN2pIA'

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const pushPermission = (): NotificationPermission | 'unsupported' => (pushSupported() ? Notification.permission : 'unsupported')

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=')
  const raw = atob(base64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function store(sub: PushSubscription, userId: string) {
  const j = sub.toJSON()
  if (!supabase || !j.endpoint || !j.keys) return
  await supabase.from('push_subscriptions').upsert({ endpoint: j.endpoint, user_id: userId, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
}

/** Ask for permission and subscribe this phone. Must be called from a tap. */
export async function enablePush(userId: string): Promise<string | null> {
  if (!pushSupported()) return 'This phone cannot receive notifications from the app. On iPhone it must be opened from the Home Screen icon, on iOS 16.4 or later.'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'Notifications are blocked for this app. Allow them in iPhone Settings, Notifications, Garage Gym.'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
    await store(sub, userId)
    return null
  } catch (err) {
    return `Could not turn notifications on: ${err instanceof Error ? err.message : String(err)}`
  }
}

/** iOS can drop a subscription without telling us. Check on each launch and renew quietly. */
export async function renewPush(userId: string) {
  if (!pushSupported() || Notification.permission !== 'granted' || !navigator.onLine) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }))
    await store(sub, userId)
  } catch {
    /* try again next launch */
  }
}

/** Tell the server something happened. It decides who gets a notification. Never blocks the app. */
export async function notify(type: 'workout_finished' | 'reaction' | 'test', sessionId?: string): Promise<{ sent?: number; error?: string }> {
  if (!supabase || !navigator.onLine) return { error: 'offline' }
  try {
    const { data, error } = await supabase.functions.invoke('notify', { body: { type, sessionId } })
    return error ? { error: error.message } : (data as { sent?: number; error?: string })
  } catch (err) {
    return { error: String(err) }
  }
}

/** The number on the app icon. */
export function setBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined)
  else void nav.clearAppBadge?.().catch(() => undefined)
}
