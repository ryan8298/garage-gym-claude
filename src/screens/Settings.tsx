import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { saveProfile, useProfile } from '../lib/data'
import { restOf, saveProgram, useProgram } from '../lib/programState'
import { activeGym, gymsOf, publicGym } from '../lib/gym'
import { clock, setSoundMuted, soundMuted } from '../lib/rest'
import { deliver, dailyLogsCsv, exportAll, workoutsCsv } from '../lib/exportData'
import { localDate } from '../lib/dates'
import { monthUsage } from '../lib/coach'
import { enablePush, notify, pushPermission } from '../lib/push'
import { capabilities } from '../lib/platform'
import { requestSync, useSyncStatus } from '../lib/syncRunner'
import { Button, Card, Icon, Label, RoundButton, cx, icons } from '../components/ui'
import { SyncBadge } from '../components/SyncBadge'

export function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const profile = useProfile(user!.id)
  const sync = useSyncStatus()
  const program = useProgram(user!.id)
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [muted, setMuted] = useState(soundMuted)
  const [usage, setUsage] = useState<{ messages: number; cost: number } | null>(null)
  useEffect(() => {
    void monthUsage(user!.id).then(setUsage)
  }, [user])
  const rest = restOf(program)
  const gyms = gymsOf(program)
  const gym = activeGym(program)
  const steps = profile?.step_target ?? 8000
  const stepper = 'flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-raised text-lg'
  const [permission, setPermission] = useState(pushPermission)
  const [pushNote, setPushNote] = useState<string | null>(null)
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
        <Label>My program</Label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Day B pulling main lift</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['pull_up', 'Pull-ups'],
                ['lat_pulldown', 'Lat pulldown'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                aria-pressed={program.pullMain === value}
                onClick={() => void saveProgram(user!.id, { pullMain: value })}
                className={cx('h-11 rounded-control border text-sm font-semibold', program.pullMain === value ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}
              >
                {text}
              </button>
            ))}
          </div>
          <span className="text-xs text-muted">Choose pull-ups once you can do 5 or more in a set. Lat pulldown adds pull-up practice before your sets.</span>
        </div>
        {(
          [
            ['ankleStrap', 'I have an ankle strap', 'Adds cable leg curls, kickbacks and hip work'],
            ['partner', 'I usually train with a partner', 'Allows partner-assisted exercises'],
            ['shareMeasurements', 'Share my measurements', 'Lets my partner see my tape measurements'],
          ] as const
        ).map(([field, title, detail]) => (
          <label key={field} className="flex min-h-[48px] items-center justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{title}</span>
              <span className="text-xs text-muted">{detail}</span>
            </span>
            <input type="checkbox" checked={!!program[field]} onChange={(e) => void saveProgram(user!.id, { [field]: e.target.checked })} role="switch" className="switch" />
          </label>
        ))}
        <Link to="/settings/program" className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
          Edit my program
        </Link>
        {program.pins.length + program.bans.length > 0 && (
          <span className="text-xs text-muted">
            {program.pins.length} exercise{program.pins.length === 1 ? '' : 's'} always used, {program.bans.length} never used. Change these from each exercise's page in the Library.
          </span>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <Label>AI coach</Label>
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Coach switched on</span>
            <span className="text-xs text-muted">Everything else works the same with it off</span>
          </span>
          <input type="checkbox" checked={program.coach !== false} onChange={(e) => void saveProgram(user!.id, { coach: e.target.checked })} role="switch" className="switch" />
        </label>
        <span className="text-[13px] text-muted">
          {usage ? `This month: ${usage.messages} message${usage.messages === 1 ? '' : 's'}, about $${usage.cost.toFixed(2)} at most.` : 'Usage shows here when you are online.'} Limit: 30 messages a day each.
        </span>
        <span className="text-xs text-muted">Coach use is billed to the Anthropic API key, separately from any Claude subscription. The figure is an upper estimate from token counts; the Anthropic console has the exact bill.</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <Label>Rest timer</Label>
        {(
          [
            ['main', 'Main lifts'],
            ['topup', 'Strength top-ups'],
            ['accessory', 'Accessories'],
            ['finisher', 'Core finisher'],
          ] as const
        ).map(([kind, title]) => (
          <div key={kind} className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{title}</span>
            <span className="flex items-center gap-1">
              <button aria-label={`${title}: 15 seconds less`} className={stepper} onClick={() => void saveProgram(user!.id, { rest: { ...rest, [kind]: Math.max(15, rest[kind] - 15) } })}>
                −
              </button>
              <span className="num w-12 text-center text-[15px] font-semibold">{clock(rest[kind])}</span>
              <button aria-label={`${title}: 15 seconds more`} className={stepper} onClick={() => void saveProgram(user!.id, { rest: { ...rest, [kind]: Math.min(600, rest[kind] + 15) } })}>
                +
              </button>
            </span>
          </div>
        ))}
        <label className="flex min-h-[44px] items-center justify-between gap-3">
          <span className="text-sm font-medium">Sounds (timer end and records)</span>
          <input
            type="checkbox"
            checked={!muted}
            onChange={(e) => {
              setSoundMuted(!e.target.checked)
              setMuted(!e.target.checked)
            }}
            role="switch" className="switch"
          />
        </label>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <Label>Where I train</Label>
        {gyms.map((g) => (
          <Link key={g.id} to={`/settings/gym/${g.id}`} className="flex min-h-[52px] items-center justify-between gap-3 rounded-control border border-line bg-raised px-3.5 py-2">
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{g.name}</span>
              <span className="text-xs text-muted">
                {g.kind === 'home' ? 'Home' : 'Public'} · {g.equipment.length} {g.equipment.length === 1 ? 'kind' : 'kinds'} of equipment
              </span>
            </span>
            <span className="text-sm text-muted">{g.id === gym.id ? 'Here now' : 'Edit'}</span>
          </Link>
        ))}
        <Button
          onClick={() => {
            const fresh = { ...publicGym(), id: crypto.randomUUID(), name: 'New gym' }
            void saveProgram(user!.id, { gyms: [...gyms, fresh] }).then(() => navigate(`/settings/gym/${fresh.id}`))
          }}
        >
          + Add a place
        </Button>
        <span className="text-xs text-muted">Pick where you are on Today before a workout. It changes what is recommended and how plates are worked out, never what you are allowed to choose.</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <Label>Daily targets</Label>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Steps per day</span>
          <span className="flex items-center gap-1">
            <button aria-label="500 fewer steps" className={stepper} onClick={() => void saveProfile(user!.id, { step_target: Math.max(1000, steps - 500) })}>
              −
            </button>
            <span className="num w-16 text-center text-[15px] font-semibold">{steps.toLocaleString()}</span>
            <button aria-label="500 more steps" className={stepper} onClick={() => void saveProfile(user!.id, { step_target: Math.min(40000, steps + 500) })}>
              +
            </button>
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <Label>My data</Label>
        <Button onClick={() => void exportAll(user!.id).then((d) => deliver(`garage-gym-${localDate()}.json`, JSON.stringify(d, null, 2), 'application/json'))}>Export everything (JSON)</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => void workoutsCsv(user!.id).then((t) => deliver(`workouts-${localDate()}.csv`, t, 'text/csv'))}>Workouts (CSV)</Button>
          <Button onClick={() => void dailyLogsCsv(user!.id).then((t) => deliver(`daily-log-${localDate()}.csv`, t, 'text/csv'))}>Daily log (CSV)</Button>
        </div>
        <span className="text-xs text-muted">Exports are made from the copy on this phone, so they work offline. Progress photos are not included.</span>
      </Card>

      <Card className="flex flex-col gap-3">
        <Label>Notifications</Label>
        {permission === 'granted' ? (
          <>
            {(
              [
                ['partnerWorkout', 'My partner finishes a workout'],
                ['reactions', 'My partner cheers my workout'],
                ['weekly', 'Sunday summary of our week'],
                ['nudge', 'A nudge after 4 days without a workout'],
              ] as const
            ).map(([field, title]) => (
              <label key={field} className="flex min-h-[44px] items-center justify-between gap-3">
                <span className="text-sm font-medium">{title}</span>
                <input
                  type="checkbox"
                  checked={program.notify?.[field] !== false}
                  onChange={(e) => void saveProgram(user!.id, { notify: { ...program.notify, [field]: e.target.checked } })}
                  role="switch" className="switch"
                />
              </label>
            ))}
            <Button
              onClick={() => {
                setPushNote('Sending…')
                void notify('test').then((r) => setPushNote(r.error ? `Could not send: ${r.error}` : r.sent ? 'Sent. It should arrive within a few seconds.' : 'This phone is not registered yet. Close and reopen the app, then try again.'))
              }}
            >
              Send a test notification
            </Button>
          </>
        ) : (
          <Button
            onClick={() => {
              setPushNote(null)
              void enablePush(user!.id).then((err) => {
                setPushNote(err)
                setPermission(pushPermission())
              })
            }}
          >
            Enable notifications
          </Button>
        )}
        {pushNote && <span className="text-[13px] text-muted">{pushNote}</span>}
        <span className="text-xs text-muted">Rest timers do not use notifications. A weekly summary and a nudge after a few days off are not built yet.</span>
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
