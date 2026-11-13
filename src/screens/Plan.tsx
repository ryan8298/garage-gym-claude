import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { daysBetween, localDate, weekStart } from '../lib/dates'
import { blockPosition, phaseLabel, phaseOf, planSession } from '../lib/engine'
import { equipLabels, exercises } from '../lib/exercises'
import { EQUIPMENT, activeGym, availableAt, gymsOf, hasAllMain, publicGym } from '../lib/gym'
import { defOf, nextDay, saveProgram, settingsOf, useProgram } from '../lib/programState'
import { Card, Icon, Label, cx, icons } from '../components/ui'

/** What I train and where: the program, the places, the library and the timer. */
export function Plan() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const program = useProgram(user!.id)
  const def = defOf(program)
  const gym = activeGym(program)
  const gyms = gymsOf(program)
  const { blockIndex, week } = blockPosition(program.startedOn, localDate(), weekStart, daysBetween)
  const upNext = nextDay(program)
  const doable = exercises.filter((e) => availableAt(gym, e)).length
  const row = 'flex min-h-[58px] items-center justify-between gap-3 px-4'

  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.5px]">Plan</h1>
        <Link to="/library" aria-label="Search exercises" className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm text-muted">
          <Icon d="M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-3.5-3.5" size={18} />
          {exercises.length} exercises
        </Link>
      </header>

      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Label tone="accent">My program</Label>
            <span className="font-display text-xl font-bold">{def.name}</span>
            <span className="text-[13px] text-muted">
              {def.order.length} days in rotation · up to {program.minutes ?? 70} min · {phaseLabel[phaseOf(blockIndex)]}, week {week} of 4
            </span>
          </div>
          <Link to="/settings/program/builder" className="flex h-11 shrink-0 items-center text-sm font-semibold text-accent">
            Change
          </Link>
        </div>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${def.order.length}, minmax(0, 1fr))` }}>
          {def.order.map((d) => {
            const lifts = planSession({ day: d, def, blockIndex, week, settings: settingsOf(program) }).lifts.length
            return (
              <Link key={d} to={`/settings/program?day=${d}`} className={cx('flex h-16 flex-col items-center justify-center gap-0.5 rounded-control border px-1', d === upNext ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}>
                <span className="text-sm font-semibold">{def.days[d].short}</span>
                <span className={cx('text-[11px]', d === upNext ? 'text-accent' : 'text-muted')}>{d === upNext ? 'next' : `${lifts} lifts`}</span>
              </Link>
            )
          })}
        </div>
        <span className="text-[13px] text-muted">Tap a day to change its lifts, order, sets and reps.</span>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Label>Where I train</Label>
          <button
            className="h-8 text-[13px] font-semibold text-accent"
            onClick={() => {
              const fresh = { ...publicGym(), id: crypto.randomUUID(), name: 'New gym' }
              void saveProgram(user!.id, { gyms: [...gyms, fresh] }).then(() => navigate(`/settings/gym/${fresh.id}`))
            }}
          >
            + Add a place
          </button>
        </div>
        {gyms.map((g) => {
          const here = g.id === gym.id
          const main = g.equipment.filter((e) => (EQUIPMENT as string[]).includes(e))
          const has = hasAllMain(g) ? 'Everything, including machines' : main.slice(0, 4).map((e) => equipLabels[e as keyof typeof equipLabels]).join(', ') || 'Bodyweight only'
          return (
            <div key={g.id} className={cx('flex min-h-[56px] items-center gap-2 rounded-control border pr-1.5 pl-3.5', here ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}>
              <button aria-pressed={here} onClick={() => void saveProgram(user!.id, { gym: g.id })} className="flex min-h-[56px] min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
                <span className="text-[15px] font-semibold">{g.name}</span>
                <span className="truncate text-xs text-muted">{here ? `Here now · ${has}` : has}</span>
              </button>
              <Link to={`/settings/gym/${g.id}`} className="flex h-11 shrink-0 items-center px-2.5 text-[13px] font-semibold text-muted">
                Edit
              </Link>
            </div>
          )
        })}
        <span className="text-xs text-muted">Tap a place to train there. The plan, recommendations and plate math follow it; nothing is ever hidden.</span>
      </Card>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {(
          [
            ['/library', 'Exercise library', `${doable} you can do at ${gym.name}`],
            ['/history', 'Workout history', 'Past workouts, and save any as a routine'],
            ['/classes', 'Other workouts', 'Calisthenics, mobility, pilates and yoga'],
            ['/cardio', 'Cardio', 'Track a run or walk on the map'],
            ['/timer', 'Interval timer', 'For conditioning days'],
          ] as const
        ).map(([to, title, detail], i) => (
          <Link key={to} to={to} className={cx(row, i > 0 && 'border-t border-line')}>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{title}</span>
              <span className="text-xs text-muted">{detail}</span>
            </span>
            <span className="text-muted">
              <Icon d={icons.next} size={18} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
