import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { saveProfile, useProfile } from '../lib/data'
import { capabilities } from '../lib/platform'
import { requestSync, useSyncStatus } from '../lib/syncRunner'
import { Button, Card, Icon, Label, RoundButton, cx, icons } from '../components/ui'
import { SyncBadge } from '../components/SyncBadge'

export function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const profile = useProfile(user!.id)
  const sync = useSyncStatus()
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState(false)
  useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name])
  const target = profile?.weekly_target ?? 4

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <h1 className="font-display text-xl font-bold">Settings</h1>
      </header>

      <Card className="flex flex-col gap-3">
        <Label>Profile</Label>
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== profile?.display_name && void saveProfile(user!.id, { display_name: name.trim() })}
            className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Workouts per week</span>
          <div className="grid grid-cols-2 gap-2">
            {[3, 4].map((n) => (
              <button
                key={n}
                aria-pressed={target === n}
                onClick={() => void saveProfile(user!.id, { weekly_target: n })}
                className={cx('num h-11 rounded-control border text-base font-semibold', target === n ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-muted">{user!.email}</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <Label>Sync</Label>
        <SyncBadge />
        <span className="text-[13px] text-muted">
          {sync.lastSynced ? `Last synced ${new Date(sync.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not synced yet this session'}
          {sync.pending > 0 && ` · ${sync.pending} change${sync.pending === 1 ? '' : 's'} waiting to upload`}
        </span>
        {sync.state === 'auth' && <span className="text-[13px] text-danger">Your sign-in expired. Everything is still saved on this phone. Sign out and back in when you have signal to resume syncing.</span>}
        <Button onClick={() => requestSync(0)}>Sync now</Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <Label>This phone</Label>
        {capabilities().map((c) => (
          <div key={c.name} className="flex items-start gap-2.5">
            <span className={cx('mt-0.5', c.ok ? 'text-accent' : 'text-warn')}>
              <Icon d={c.ok ? icons.check : 'M12 8v5M12 17h.01'} size={18} />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-xs text-muted">{c.detail}</span>
            </div>
          </div>
        ))}
      </Card>

      <Card className="flex flex-col gap-3">
        <Label>Account</Label>
        {confirming ? (
          <>
            <span className="text-[13px] text-muted">
              {sync.pending > 0
                ? `${sync.pending} change${sync.pending === 1 ? ' has' : 's have'} not uploaded yet and will be lost if you sign out now.`
                : 'Signing out removes the copy of your data on this phone. Everything synced stays in your account.'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setConfirming(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          </>
        ) : (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Sign out
          </Button>
        )}
      </Card>

      <p className="num text-center text-xs text-muted">
        Version {__APP_VERSION__} · build {__APP_BUILD__}
      </p>
    </div>
  )
}
