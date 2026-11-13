import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Rest timer. It stores the moment the rest ends, never a running count,
 * because iOS pauses timers when the app is in the background. Whatever
 * happens to the app, the remaining time is "end minus now".
 */

const KEY = 'gg.rest'
interface Rest {
  endsAt: number
  total: number
  /** The beep has been played for this rest. */
  rung: boolean
}

const read = (): Rest | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}
let current: Rest | null = read()
const listeners = new Set<() => void>()
const set = (r: Rest | null) => {
  current = r
  if (r) localStorage.setItem(KEY, JSON.stringify(r))
  else localStorage.removeItem(KEY)
  listeners.forEach((l) => l())
}

export const startRest = (seconds: number) => set({ endsAt: Date.now() + seconds * 1000, total: seconds, rung: false })
export const adjustRest = (seconds: number) => current && set({ ...current, endsAt: current.endsAt + seconds * 1000, total: Math.max(15, current.total + seconds), rung: false })
export const clearRest = () => set(null)

// ---- sound ----
let audio: AudioContext | null = null
/** Call from a tap. iOS only allows sound after the user has touched the screen. */
export function unlockSound() {
  try {
    audio ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* no sound available */
  }
}
export const soundMuted = () => localStorage.getItem('gg.mute') === '1'
export const setSoundMuted = (m: boolean) => localStorage.setItem('gg.mute', m ? '1' : '0')

export function beep(kind: 'rest' | 'record' = 'rest') {
  if (!audio || soundMuted()) return
  const notes = kind === 'rest' ? [880, 880] : [660, 880, 1175]
  notes.forEach((freq, i) => {
    const osc = audio!.createOscillator()
    const gain = audio!.createGain()
    const at = audio!.currentTime + i * 0.18
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.15)
    osc.connect(gain).connect(audio!.destination)
    osc.start(at)
    osc.stop(at + 0.16)
  })
}

/** Remaining seconds, updated a few times a second while a rest is running. */
export function useRest(): { remaining: number; total: number; over: boolean } | null {
  const rest = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
  const [, tick] = useState(0)
  useEffect(() => {
    if (!rest) return
    const id = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [rest])
  if (!rest) return null
  const remaining = Math.ceil((rest.endsAt - Date.now()) / 1000)
  if (remaining <= 0 && !rest.rung) {
    // Only ring if the rest ended just now, not if we are reopening long after.
    if (remaining > -3) beep('rest')
    queueMicrotask(() => current && set({ ...current, rung: true }))
  }
  // Tidy up a rest that ended a while ago.
  if (remaining < -90) queueMicrotask(clearRest)
  return { remaining: Math.max(0, remaining), total: rest.total, over: remaining <= 0 }
}

/** Keep the screen awake while mounted, and take the lock back after the app returns to the front. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const acquire = () => {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => undefined)
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      void lock?.release().catch(() => undefined)
    }
  }, [active])
}

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
