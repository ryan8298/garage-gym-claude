import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { useDailyLog, useProfile } from '../lib/data'
import { localDate, longDate, partOfDay, weekDays } from '../lib/dates'
import { Button, Card, Icon, Label, Sheet, cx, icons } from '../components/ui'
import { targetText } from '../components/LiftList'
import { phaseLabel } from '../lib/engine'
import { DAY_ORDER, PROGRAM } from '../lib/program'
import { saveProgram, usePlan } from '../lib/programState'
import { startPair, startRoutine, startSession, useActiveSession } from '../lib/session'
import { usePartner } from '../lib/partner'
import { activeGym, gymsOf } from '../lib/gym'
import { unlockSound } from '../lib/rest'
import { SyncBadge } from '../components/SyncBadge'
import { GoalsCard } from '../components/Goals'
import { useGoals, useLogs, useSessions } from '../lib/progressData'

export function Today() {
  const { user } = useAuth()
  const today = localDate()
  const profile = useProfile(user!.id)
  const log = useDailyLog(user!.id, today)
  const days = weekDays(today)
  const trained = useLiveQuery(
    async () => {
      const rows = await db.workout_sessions.where('[user_id+local_date]').between([user!.id, days[0]], [user!.id, days[6]], true, true).toArray()
      return new Set(rows.filter((r) => r.finished_at && !r.deleted).map((r) => r.local_date))
    },
    [user!.id, days[0]],
    new Set<string>(),
  )
  const target = profile?.weekly_target ?? 4
  const { plan, program } = usePlan(user!.id)
  const [swapping, setSwapping] = useState(false)
  const goals = useGoals(user!.id)
  const sessions = useSessions(user!.id) ?? []
  const weights = useLogs(user!.id).filter((l) => l.body_weight !== null).map((l) => ({ date: l.log_date, value: l.body_weight as number }))
  const [starting, setStarting] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [placing, setPlacing] = useState(false)
  const gym = activeGym(program)
  const navigate = useNavigate()
  const active = useActiveSession(user!.id)
  const partner = usePartner(user!.id)
  const partnerPlan = usePlan(partner?.id ?? user!.id, plan.day)
  const partnerActive = useActiveSession(partner?.id)
  const [together, setTogether] = useState(() => localStorage.getItem('gg.together') !== '0')
  const paired = !!partner && together && !partnerActive
  const mains = plan.lifts.filter((l) => l.kind === 'main')
  const rest = plan.lifts.filter((l) => l.kind !== 'main')
  const name = profile?.display_name || user!.email.split('@')[0]

  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-muted">{longDate(today)}</span>
          <h1 className="font-display text-[28px] font-bold tracking-[-0.5px]">
            {partOfDay()}, {name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {program.coach !== false && (
            <Link to="/coach" aria-label="Open coach" className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-coach-line bg-coach-dim text-coach">
              <Icon d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
            </Link>
          )}
        <Link to="/settings" aria-label="Settings" className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line bg-surface text-ink">
          <Icon d={icons.gear} />
        </Link>
        </div>
      </header>

      <Card className="flex flex-col gap-3.5 !p-[18px]">
        <div className="flex items-center justify-between">
          <Label tone="accent">Next up · Day {plan.day}</Label>
          <span className="text-xs text-muted">
            {plan.lifts.length} lifts · about {plan.minutes} min
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.6px]">{plan.title}</h2>
          <span className="text-[13px] text-muted">
            {phaseLabel[plan.phase]} block · week {plan.week} of 4{plan.recovery ? ' · lighter week' : ''}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {mains.map((l) => (
            <div key={l.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span>{l.name}</span>
              <span className="num shrink-0 text-muted">{targetText(l)}</span>
            </div>
          ))}
          <Label>Then {rest.length} more</Label>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
            {rest.map((l) => (
              <span key={l.key} className={l.kind === 'finisher' ? 'text-muted' : ''}>
                {l.name}
              </span>
            ))}
          </div>
        </div>
        {active ? (
          <Link to="/session" className="flex h-14 items-center justify-center rounded-control bg-accent font-display text-lg font-bold text-accent-ink">
            Resume workout
          </Link>
        ) : (
          <button
            disabled={starting}
            onClick={() => {
              unlockSound()
              setStarting(true)
              const begin = paired ? startPair({ id: user!.id, plan, program }, { id: partner!.id, plan: partnerPlan.plan, program: partnerPlan.program }) : startSession(user!.id, plan, program)
              void begin.then(() => navigate('/session'))
            }}
            className="flex h-14 items-center justify-center rounded-control bg-accent font-display text-lg font-bold text-accent-ink disabled:opacity-60"
          >
            {starting ? 'Starting…' : paired ? 'Start workout together' : 'Start workout'}
          </button>
        )}
        {partner && !active && (
          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">Training with {partner.display_name || 'my partner'}</span>
              <span className="text-xs text-muted">{partnerActive ? `${partner.display_name || 'Your partner'} already has a workout open` : 'One phone logs for both of you, taking turns'}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              disabled={!!partnerActive}
              checked={paired}
              onChange={(e) => {
                localStorage.setItem('gg.together', e.target.checked ? '1' : '0')
                setTogether(e.target.checked)
              }}
            />
          </label>
        )}
        <button onClick={() => setPlacing(true)} className="flex min-h-[44px] items-center justify-between gap-3 text-left">
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">Training at {gym.name}</span>
            <span className="text-xs text-muted">Recommendations and plate math follow this</span>
          </span>
          <span className="text-sm font-semibold text-accent">Change</span>
        </button>
        <div className="grid grid-cols-3 gap-2">
          <Link to={`/workout/${plan.day}`} className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
            Preview
          </Link>
          <Button disabled={!!active} onClick={() => setSwapping(true)}>
            Swap day
          </Button>
          <Button disabled={starting} onClick={() => setChoosing(true)}>
            Other
          </Button>
        </div>
      </Card>

      <Sheet open={placing} onClose={() => setPlacing(false)}>
        <div className="flex flex-col gap-2.5 pb-3">
          <span className="text-[15px] font-semibold">Where are you training?</span>
          {gymsOf(program).map((g) => (
            <button
              key={g.id}
              aria-pressed={g.id === gym.id}
              onClick={() => {
                void saveProgram(user!.id, { gym: g.id })
                setPlacing(false)
              }}
              className={cx('flex min-h-[56px] flex-col justify-center rounded-control border px-3.5 py-2 text-left', g.id === gym.id ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}
            >
              <span className="text-[15px] font-semibold">{g.name}</span>
              <span className="text-xs text-muted">
                {g.kind === 'home' ? 'Home' : 'Public'} · {g.equipment.length} kinds of equipment
              </span>
            </button>
          ))}
          <Link to="/settings" className="flex h-11 items-center justify-center text-sm font-semibold text-muted">
            Add or edit places in Settings
          </Link>
        </div>
      </Sheet>

      <Sheet open={choosing} onClose={() => setChoosing(false)}>
        <div className="scroll-y flex max-h-[76vh] flex-col gap-2.5 pb-3">
          <span className="text-[15px] font-semibold">Something else today</span>
          <Button
            disabled={!!active || starting}
            onClick={() => {
              unlockSound()
              setStarting(true)
              void startSession(user!.id, null, program).then(() => navigate('/session'))
            }}
          >
            Freestyle workout
          </Button>
          <Link to="/timer" className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
            Interval timer
          </Link>
          <Label>My routines</Label>
          {(program.routines ?? []).length === 0 && <span className="text-sm text-muted">None yet. Open any past workout in Workout history and tap "Save as a routine".</span>}
          {(program.routines ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <button
                disabled={!!active || starting}
                onClick={() => {
                  unlockSound()
                  setStarting(true)
                  void startRoutine(user!.id, program, r).then(() => navigate('/session'))
                }}
                className="flex min-h-[52px] flex-1 flex-col justify-center rounded-control border border-line bg-raised px-3.5 py-2 text-left disabled:opacity-50"
              >
                <span className="text-[15px] font-semibold">{r.name}</span>
                <span className="text-xs text-muted">{r.lifts.length} lifts</span>
              </button>
              <button
                aria-label={`Delete routine ${r.name}`}
                className="h-11 px-2 text-sm text-danger"
                onClick={() => window.confirm(`Delete the routine "${r.name}"? Past workouts are not affected.`) && void saveProgram(user!.id, { routines: (program.routines ?? []).filter((x) => x.id !== r.id) })}
              >
                Delete
              </button>
            </div>
          ))}
          {active && <span className="text-xs text-muted">Finish the open workout before starting another.</span>}
        </div>
      </Sheet>

      <Sheet open={swapping} onClose={() => setSwapping(false)}>
        <div className="flex flex-col gap-2.5 pb-3">
          <span className="text-[15px] font-semibold">Which workout next?</span>
          {DAY_ORDER.map((d, i) => (
            <button
              key={d}
              onClick={() => {
                void saveProgram(user!.id, { queueIndex: i })
                setSwapping(false)
              }}
              className={cx('flex min-h-[56px] items-center justify-between rounded-control border px-3.5 text-left', d === plan.day ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}
            >
              <span className="text-[15px] font-semibold">{PROGRAM[d].title}</span>
              <span className="text-xs text-muted">Day {d}</span>
            </button>
          ))}
          <span className="text-xs text-muted">The rotation carries on from whichever day you pick.</span>
        </div>
      </Sheet>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">This week</span>
          <span className="text-[13px] text-muted">
            <span className="num font-semibold text-ink">{trained.size}</span> of {target} workouts
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted">
          {days.map((d) => (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span className={cx(d === today && 'font-semibold text-ink')}>{'MTWTFSS'[days.indexOf(d)]}</span>
              <span className={cx('h-7 w-7 rounded-full', trained.has(d) ? 'bg-accent' : d === today ? 'border-2 border-accent' : 'bg-raised')} />
            </div>
          ))}
        </div>
      </Card>

      <Link to="/log" className="block">
        <Card className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <Label>Body weight today</Label>
            {log?.body_weight != null ? (
              <span className="num text-[26px] font-bold">
                {log.body_weight.toFixed(1)} <span className="font-sans text-sm font-normal text-muted">lb</span>
              </span>
            ) : (
              <span className="text-[15px] font-medium text-accent">Tap to log</span>
            )}
          </div>
          <span className="text-muted">
            <Icon d={icons.next} size={20} />
          </span>
        </Card>
      </Link>

      <GoalsCard compact userId={user!.id} goals={goals} weights={weights} sessions={sessions} />

      <div className="flex justify-center pt-1">
        <SyncBadge />
      </div>
    </div>
  )
}
