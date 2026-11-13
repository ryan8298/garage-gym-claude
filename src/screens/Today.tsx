import { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { SyncBadge } from '../components/SyncBadge'

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
        <Link to="/settings" aria-label="Settings" className="flex h-[46px] w-[46px] items-center justify-center rounded-full border border-line bg-surface text-ink">
          <Icon d={icons.gear} />
        </Link>
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
        <Link to={`/workout/${plan.day}`} className="flex h-14 items-center justify-center rounded-control bg-accent font-display text-lg font-bold text-accent-ink">
          View workout
        </Link>
        <div className="grid grid-cols-2 gap-2.5">
          <Button onClick={() => setSwapping(true)}>Swap day</Button>
          <Button onClick={() => void saveProgram(user!.id, { queueIndex: program.queueIndex + 1 })}>Skip to next</Button>
        </div>
        <span className="text-center text-xs text-muted">Starting and logging a workout arrives in phase 3.</span>
      </Card>

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

      <div className="flex justify-center pt-1">
        <SyncBadge />
      </div>
    </div>
  )
}
