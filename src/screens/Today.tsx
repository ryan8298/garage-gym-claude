import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { useDailyLog, useProfile } from '../lib/data'
import { localDate, longDate, partOfDay, weekDays } from '../lib/dates'
import { Card, Icon, Label, cx, icons } from '../components/ui'
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

      <Card className="flex flex-col gap-3 !p-[18px]">
        <Label tone="accent">Next up</Label>
        <h2 className="font-display text-[26px] leading-[1.1] font-bold tracking-[-0.5px]">Your program arrives in phase 2</h2>
        <p className="text-sm leading-relaxed text-muted">
          This is where the next workout will be, with every lift listed and a Start button. For now, the foundation is in place: sign-in, offline saving and sync.
        </p>
      </Card>

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
