import { useState } from 'react'
import type { Goal } from '../lib/db'
import { localDate, parseLocal } from '../lib/dates'
import { addGoal, deleteGoal, liftSeries, liftsWithHistory, type DoneSession } from '../lib/progressData'
import { goalProgress, movingAverage, projectedDate, type Point } from '../lib/stats'
import { Button, Card, Label, NumberPad, Sheet, cx } from './ui'

const nice = (date: string) => parseLocal(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function goalView(goal: Goal, weights: Point[], sessions: DoneSession[]) {
  const series = goal.kind === 'body_weight' ? movingAverage(weights) : liftSeries(sessions, goal.exercise_key ?? '').map((p) => ({ date: p.date, value: p.weight }))
  const current = series.length ? series[series.length - 1].value : null
  const start = goal.start_value ?? series[0]?.value ?? null
  return {
    current,
    progress: current !== null && start !== null ? goalProgress(start, current, goal.target_value) : 0,
    projected: projectedDate(series, goal.target_value, localDate()),
  }
}

export function GoalsCard({ userId, goals, weights, sessions, compact }: { userId: string; goals: Goal[]; weights: Point[]; sessions: DoneSession[]; compact?: boolean }) {
  const [adding, setAdding] = useState(false)
  const [kind, setKind] = useState<'body_weight' | 'lift'>('body_weight')
  const [lift, setLift] = useState<string | null>(null)
  const [target, setTarget] = useState<number | null>(null)
  const [date, setDate] = useState('')
  const [pad, setPad] = useState(false)
  const lifts = liftsWithHistory(sessions)
  const name = (g: Goal) => (g.kind === 'body_weight' ? 'Body weight' : (lifts.find((l) => l.key === g.exercise_key)?.name ?? 'Lift'))
  if (compact && goals.length === 0) return null

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label>Goals</Label>
        {!compact && (
          <button className="h-9 px-1 text-sm font-semibold text-accent" onClick={() => setAdding(true)}>
            + Add goal
          </button>
        )}
      </div>
      {goals.length === 0 && <span className="text-sm text-muted">Set a target body weight or a target for any lift you have logged.</span>}
      {goals.map((g) => {
        const v = goalView(g, weights, sessions)
        return (
          <div key={g.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">
                {name(g)}: {g.target_value} lb
              </span>
              <span className="num text-[13px] text-muted">{v.current !== null ? `${Number(v.current.toFixed(1))} now` : 'no data yet'}</span>
            </div>
            <span className="h-2.5 overflow-hidden rounded-full bg-raised">
              <span className="block h-full rounded-full bg-coach" style={{ width: `${Math.round(v.progress * 100)}%` }} />
            </span>
            <div className="flex items-center justify-between gap-3 text-xs text-muted">
              <span>
                {v.progress >= 1 ? 'Reached' : v.projected ? `At this pace: ${nice(v.projected)}` : 'No clear trend yet'}
                {g.target_date ? ` · aiming for ${nice(g.target_date)}` : ''}
              </span>
              {!compact && (
                <button className="h-8 shrink-0 text-danger" onClick={() => window.confirm('Remove this goal?') && void deleteGoal(g)}>
                  Remove
                </button>
              )}
            </div>
          </div>
        )
      })}

      <Sheet open={adding} onClose={() => setAdding(false)}>
        <div className="flex flex-col gap-3.5 pb-3">
          <span className="font-display text-[22px] font-bold">New goal</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['body_weight', 'Body weight'],
                ['lift', 'A lift'],
              ] as const
            ).map(([k, text]) => (
              <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={cx('h-11 rounded-control border text-sm font-semibold', kind === k ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}>
                {text}
              </button>
            ))}
          </div>
          {kind === 'lift' &&
            (lifts.length === 0 ? (
              <span className="text-sm text-muted">Log a workout first, then you can set a goal for any lift in it.</span>
            ) : (
              <div className="scroll-y flex max-h-44 flex-col overflow-hidden rounded-control border border-line">
                {lifts.map((l) => (
                  <button key={l.key} aria-pressed={lift === l.key} onClick={() => setLift(l.key)} className={cx('min-h-[44px] border-b border-line px-3.5 text-left text-sm last:border-b-0', lift === l.key ? 'bg-accent-dim font-semibold text-accent' : 'bg-raised')}>
                    {l.name}
                  </button>
                ))}
              </div>
            ))}
          <button onClick={() => setPad(true)} className="flex h-14 items-center justify-between rounded-control border border-line bg-raised px-3.5">
            <span className="text-sm text-muted">Target</span>
            <span className={cx('num text-xl font-bold', target === null && 'text-faint')}>{target === null ? 'Tap to set' : `${target} lb`}</span>
          </button>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            By when (optional)
            <input type="date" value={date} min={localDate()} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none" />
          </label>
          <Button
            variant="primary"
            disabled={target === null || (kind === 'lift' && !lift)}
            onClick={() => {
              const series = kind === 'body_weight' ? movingAverage(weights) : liftSeries(sessions, lift!).map((p) => ({ date: p.date, value: p.weight }))
              void addGoal(userId, { kind, exercise_key: kind === 'lift' ? lift : null, target_value: target!, target_date: date || null, start_value: series.length ? series[series.length - 1].value : null })
              setAdding(false)
              setTarget(null)
              setDate('')
            }}
          >
            Save goal
          </Button>
        </div>
      </Sheet>
      <NumberPad open={pad} title="Target" unit="lb" initial={target} step={kind === 'body_weight' ? 1 : 5} decimals={1} onClose={() => setPad(false)} onDone={(v) => (setTarget(v), setPad(false))} />
    </Card>
  )
}
