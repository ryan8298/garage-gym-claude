import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { saveDailyLog, useDailyLog, useProfile } from '../lib/data'
import { localDate, longDate, partOfDay, weekDays } from '../lib/dates'
import { Button, Card, Icon, Label, NumberPad, Sheet, cx, icons } from '../components/ui'
import { phaseLabel } from '../lib/engine'
import { defOf, saveProgram, usePlan } from '../lib/programState'
import { history, startPair, startRoutine, startSession, useActiveSession } from '../lib/session'
import { exercise } from '../lib/exercises'
import { loadModeFor } from '../lib/plates'
import { suggest } from '../lib/progression'
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
  const partnerPlan = usePlan(partner?.id ?? user!.id, plan.day, false, { equipment: activeGym(program).equipment, def: defOf(program) })
  const partnerActive = useActiveSession(partner?.id)
  const [together, setTogether] = useState(() => localStorage.getItem('gg.together') !== '0')
  const paired = !!partner && together && !partnerActive
  const mains = plan.lifts.filter((l) => l.kind === 'main')
  const rest = plan.lifts.filter((l) => l.kind !== 'main')
  const name = profile?.display_name || user!.email.split('@')[0]
  // Today's weight for each main lift, and why, from the last time it was done.
  const mainKeys = mains.map((l) => `${l.key}:${l.low}:${l.high}`).join()
  const targets = useLiveQuery(
    async () => {
      const out: Record<string, { weight: number | null; why: string }> = {}
      for (const l of mains) {
        const e = exercise(l.key)
        const s = suggest({ history: await history(user!.id, l.key, 2), low: l.low, high: l.high, unit: l.unit, mode: loadModeFor(e), today })
        const why = { first: 'first time: find your weight', add_weight: 'weight goes up today', add_rep: 'same weight, one more rep', longer: 'a little longer than last time', time_off: 'lighter after time off', ease_back: 'lighter to build back up' }[s.reason] ?? ''
        out[l.key] = { weight: s.weight, why }
      }
      return out
    },
    [user!.id, mainKeys, today],
    {} as Record<string, { weight: number | null; why: string }>,
  )
  const partnerTrained = useLiveQuery(
    async () => {
      if (!partner) return new Set<string>()
      const rows = await db.workout_sessions.where('[user_id+local_date]').between([partner.id, days[0]], [partner.id, days[6]], true, true).toArray()
      return new Set(rows.filter((r) => r.finished_at && !r.deleted).map((r) => r.local_date))
    },
    [partner?.id, days[0]],
    new Set<string>(),
  )
  const [pad, setPad] = useState<'body_weight' | 'steps' | 'sleep_hours' | null>(null)
  const pads = {
    body_weight: { title: 'Body weight', unit: 'lb', step: 0.2, decimals: 1 },
    steps: { title: 'Steps', unit: 'steps', step: 500, decimals: 0 },
    sleep_hours: { title: 'Sleep', unit: 'hours', step: 0.5, decimals: 1 },
  }
  const partnerName = partner?.display_name || 'Partner'
  const chip = 'flex h-11 items-center gap-2 rounded-full border border-line-strong bg-raised px-3.5 text-[13px] font-semibold'
  const avatar = 'flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-bold text-accent-ink'

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
        <div className="flex flex-col gap-1">
          <Label tone="accent">
            Next up · {phaseLabel[plan.phase]} week {plan.week}
            {plan.recovery ? ' · lighter week' : ''}
          </Label>
          <h2 className="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.6px]">{plan.title}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {partner && (
            <button
              disabled={!!active || !!partnerActive}
              aria-pressed={paired}
              aria-label={paired ? `Training with ${partnerName}. Tap to train on your own.` : `Training on your own. Tap to train with ${partnerName}.`}
              onClick={() => {
                localStorage.setItem('gg.together', paired ? '0' : '1')
                setTogether(!paired)
              }}
              className={cx(chip, '!pl-1.5 disabled:opacity-60', paired && '!border-accent')}
            >
              <span className="flex">
                <span className={cx(avatar, 'bg-accent')}>{name[0]?.toUpperCase()}</span>
                {paired && <span className={cx(avatar, '-ml-2 border-2 border-raised bg-coach')}>{partnerName[0]?.toUpperCase()}</span>}
              </span>
              {paired ? `With ${partnerName}` : 'On my own'}
            </button>
          )}
          <button onClick={() => setPlacing(true)} className={chip}>
            <Icon d={icons.today} size={16} />
            {gym.name}
          </button>
          <span className="num px-1 text-[13px] text-muted">{plan.minutes} min</span>
        </div>
        {partnerActive && !active && <span className="-mt-1.5 text-xs text-muted">{partnerName} already has a workout open, so this one is for you alone.</span>}
        {plan.adapted.length > 0 && <span className="-mt-1.5 text-xs text-muted">Adapted for {gym.name}: {plan.adapted.join('; ')}</span>}

        <div className="flex flex-col gap-2">
          {mains.map((l) => {
            const t = targets[l.key]
            return (
              <div key={l.key} className="flex items-center justify-between gap-3 rounded-control bg-raised px-3.5 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-base font-semibold">{l.name}</span>
                  <span className="text-xs text-muted">
                    {l.sets} sets of {l.low} to {l.high}
                    {l.unit === 'sec' ? ' sec' : ''}
                    {t?.why ? ` · ${t.why}` : ''}
                  </span>
                </div>
                {t?.weight ? (
                  <span className="num shrink-0 text-[22px] font-bold">
                    {t.weight}
                    <span className="font-sans text-xs font-medium text-muted"> lb</span>
                  </span>
                ) : null}
              </div>
            )
          })}
          <span className="px-0.5 text-[13px] text-muted">
            Then {rest.length} more: {rest.slice(0, 4).map((l) => l.name.replace(/^(Barbell|Dumbbell|Standing|Smith|Cable) /, '').toLowerCase()).join(', ')}
            {rest.length > 4 ? ' and more' : ''}
          </span>
        </div>

        {active ? (
          <Link to="/session" className="flex h-[58px] items-center justify-center rounded-2xl bg-accent font-display text-[19px] font-bold text-accent-ink">
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
            className="flex h-[58px] items-center justify-center rounded-2xl bg-accent font-display text-[19px] font-bold text-accent-ink disabled:opacity-60"
          >
            {starting ? 'Starting…' : paired ? 'Start workout together' : 'Start workout'}
          </button>
        )}
        <div className="-my-1 flex justify-between">
          <Link to={`/workout/${plan.day}`} className="flex h-11 items-center text-sm font-semibold text-accent">
            Preview
          </Link>
          <button disabled={!!active} onClick={() => setSwapping(true)} className="h-11 text-sm font-semibold text-accent disabled:text-faint">
            Different day
          </button>
          <button disabled={starting} onClick={() => setChoosing(true)} className="h-11 text-sm font-semibold text-accent">
            Something else
          </button>
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
                {g.kind === 'home' ? 'Home gym' : 'Public gym'}
              </span>
            </button>
          ))}
          <Link to="/plan" className="flex h-11 items-center justify-center text-sm font-semibold text-muted">
            Add or edit places in Plan
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
          <Link to="/classes" className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
            Calisthenics, mobility, pilates, yoga
          </Link>
          <Link to="/cardio" className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
            Cardio: run, walk or hike
          </Link>
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
          {defOf(program).order.map((d, i) => (
            <button
              key={d}
              onClick={() => {
                void saveProgram(user!.id, { queueIndex: i })
                setSwapping(false)
              }}
              className={cx('flex min-h-[56px] items-center justify-between rounded-control border px-3.5 text-left', d === plan.day ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}
            >
              <span className="text-[15px] font-semibold">{defOf(program).days[d].title}</span>
              <span className="text-xs text-muted">Day {d}</span>
            </button>
          ))}
          <span className="text-xs text-muted">The rotation carries on from whichever day you pick.</span>
        </div>
      </Sheet>

      <Card className="flex flex-col gap-2.5 !py-3.5">
        {(
          [
            [name, trained, target, 'bg-accent', 'text-accent'],
            ...(partner ? [[partnerName, partnerTrained, partner.weekly_target ?? 4, 'bg-coach', 'text-coach'] as const] : []),
          ] as [string, Set<string>, number, string, string][]
        ).map(([who, done, goal, fill, text]) => (
          <div key={who} className="flex items-center gap-3">
            <span className={cx('w-14 truncate text-[13px] font-semibold', text)}>{who}</span>
            <div className="grid flex-1 grid-cols-7 gap-1.5" role="img" aria-label={`${who}: ${done.size} of ${goal} workouts this week`}>
              {days.map((d) => (
                <span key={d} className={cx('h-2.5 rounded-full', done.has(d) ? fill : 'bg-line', d === today && 'ring-2 ring-ink ring-offset-1 ring-offset-surface')} />
              ))}
            </div>
            <span className="num w-11 text-right text-[13px] text-muted">
              {done.size} of {goal}
            </span>
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['body_weight', 'Weight', log?.body_weight != null ? log.body_weight.toFixed(1) : null],
            ['steps', 'Steps', log?.steps != null ? log.steps.toLocaleString() : null],
            ['sleep_hours', 'Sleep', log?.sleep_hours != null ? `${log.sleep_hours} h` : null],
          ] as const
        ).map(([field, label, value]) => (
          <button key={field} aria-label={`${label} today: ${value ?? 'not logged'}`} onClick={() => setPad(field)} className={cx('flex h-16 flex-col items-start justify-center gap-0.5 rounded-2xl border px-3.5', value ? 'border-line bg-surface' : 'border-dashed border-line-strong')}>
            <span className="text-[11px] text-muted">{label}</span>
            {value ? <span className="num text-lg font-bold">{value}</span> : <span className="text-[15px] font-semibold text-accent">+ Add</span>}
          </button>
        ))}
      </div>
      <Link to="/cardio" className="flex min-h-[56px] items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-2.5">
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">Cardio</span>
          <span className="text-xs text-muted">Track a run or walk on the map, or log one</span>
        </span>
        <span className="text-muted">
          <Icon d={icons.next} size={18} />
        </span>
      </Link>
      <Link to="/log" className="-mt-1.5 flex h-11 items-center justify-center text-[13px] font-semibold text-muted">
        Full daily log: energy, soreness, cardio, measurements
      </Link>
      <NumberPad
        open={pad !== null}
        {...pads[pad ?? 'body_weight']}
        initial={pad ? (log?.[pad] ?? null) : null}
        onClose={() => setPad(null)}
        onDone={(value) => {
          if (pad) void saveDailyLog(user!.id, today, { [pad]: value })
          setPad(null)
        }}
      />

      <GoalsCard compact userId={user!.id} goals={goals} weights={weights} sessions={sessions} />

      <div className="flex justify-center pt-1">
        <SyncBadge />
      </div>
    </div>
  )
}
