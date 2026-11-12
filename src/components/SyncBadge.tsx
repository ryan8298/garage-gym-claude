import { useSyncStatus } from '../lib/syncRunner'

const copy = {
  idle: ['bg-accent', 'Saved and synced'],
  syncing: ['bg-coach', 'Syncing'],
  offline: ['bg-warn', 'Saved on this phone'],
  error: ['bg-warn', 'Saved on this phone, will retry'],
  auth: ['bg-danger', 'Sign in again to sync'],
} as const

/** Small always-visible indicator of whether everything has reached the server. */
export function SyncBadge({ withText = true }: { withText?: boolean }) {
  const { state, pending } = useSyncStatus()
  const [dot, text] = copy[state]
  const label = state === 'idle' && pending > 0 ? 'Saving' : text
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted" role="status" aria-label={label}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {withText && label}
      {withText && pending > 0 && state !== 'idle' && <span className="num">· {pending} waiting</span>}
    </span>
  )
}
