/** What this phone can do. Used for the install guide and the Settings checks. */

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function iosVersion(): number | null {
  const m = navigator.userAgent.match(/OS (\d+)[._](\d+)/)
  return m && isIOS() ? Number(`${m[1]}.${m[2]}`) : null
}

export interface Capability {
  name: string
  ok: boolean
  detail: string
}

export function capabilities(): Capability[] {
  const v = iosVersion()
  const push = 'PushManager' in window && 'Notification' in window
  const wake = 'wakeLock' in navigator
  return [
    {
      name: 'Installed to Home Screen',
      ok: isStandalone(),
      detail: isStandalone() ? 'Running as an app' : 'Open from the Home Screen icon for the full app',
    },
    {
      name: 'Notifications',
      ok: push,
      detail: push ? 'Available' : v && v < 16.4 ? 'Needs iOS 16.4 or later' : 'Available once installed to the Home Screen',
    },
    {
      name: 'Keep screen awake in workouts',
      ok: wake,
      detail: wake ? 'Available' : 'Needs a newer iOS version',
    },
    { name: 'Offline storage', ok: 'indexedDB' in window, detail: 'indexedDB' in window ? 'Available' : 'Not available' },
  ]
}
