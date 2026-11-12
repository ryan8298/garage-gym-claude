import { useSyncExternalStore } from 'react'
import { db } from './db'
import { transport } from './supabase'
import { createSyncRunner, getSyncStatus, subscribeSync } from './sync'

let signedIn = false
export const setSignedIn = (v: boolean) => {
  signedIn = v
}

const runner = createSyncRunner(
  db,
  () => (signedIn ? transport : null),
  () => navigator.onLine,
)

let debounce: ReturnType<typeof setTimeout> | undefined
/** Ask for a sync soon. Safe to call after every write. */
export function requestSync(delay = 400) {
  clearTimeout(debounce)
  debounce = setTimeout(() => void runner.run(), delay)
}

let started = false
export function startSync() {
  if (started) return
  started = true
  window.addEventListener('online', () => requestSync(0))
  window.addEventListener('offline', () => requestSync(0))
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && requestSync(0))
  setInterval(() => document.visibilityState === 'visible' && requestSync(0), 30_000)
  requestSync(0)
}

export const useSyncStatus = () => useSyncExternalStore(subscribeSync, getSyncStatus)
