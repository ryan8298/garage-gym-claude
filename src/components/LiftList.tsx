import { Link } from 'react-router-dom'
import type { PlannedLift, SessionPlan } from '../lib/engine'
import { Label } from './ui'

export function targetText(l: PlannedLift): string {
  const range = l.low === l.high ? `${l.low}` : `${l.low}–${l.high}`
  return `${l.sets} × ${range}${l.unit === 'sec' ? ' sec' : ''}${l.eachSide ? ' each' : ''}`
}

const sections: { kind: PlannedLift['kind']; title: string; tone?: 'accent' }[] = [
  { kind: 'main', title: 'Main lifts', tone: 'accent' },
  { kind: 'topup', title: 'Strength top-ups' },
  { kind: 'accessory', title: 'Accessories' },
  { kind: 'finisher', title: 'Core finisher' },
]

/** The full list of a session's lifts, grouped, each linking to its how-to. */
export function LiftList({ plan }: { plan: SessionPlan }) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map(({ kind, title, tone }) => {
        const lifts = plan.lifts.filter((l) => l.kind === kind)
        if (lifts.length === 0) return null
        return (
          <section key={kind} className="flex flex-col gap-2">
            <Label tone={tone}>{title}</Label>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              {lifts.map((l, i) => (
                <Link key={l.key} to={`/library/${l.key}`} className={`flex min-h-[56px] flex-col justify-center gap-0.5 px-3.5 py-2 ${i ? 'border-t border-line' : ''}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={kind === 'main' ? 'text-base font-semibold' : 'text-[15px] font-medium'}>{l.name}</span>
                    <span className="num shrink-0 text-[13px] text-muted">{targetText(l)}</span>
                  </div>
                  <span className="text-xs text-muted">
                    {kind === 'main' ? (l.note ?? 'Main lift') : l.role}
                    {l.superset ? ` · superset ${l.superset}` : ''}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
