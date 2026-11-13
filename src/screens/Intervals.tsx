import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { localDate } from '../lib/dates'
import { intervalAt, intervalTotal, type Plan } from '../lib/intervals'
import { saveCardio } from '../lib/progressData'
import { beep, clock, unlockSound, useWakeLock } from '../lib/rest'
import { Button, Card, Label, RoundButton, cx, icons } from '../components/ui'

const presets: [string, Plan][] = [
  ['30 / 30 × 8', { work: 30, rest: 30, rounds: 8 }],
  ['40 / 20 × 8', { work: 40, rest: 20, rounds: 8 }],
  ['20 / 10 × 8', { work: 20, rest: 10, rounds: 8 }],
  ['60 / 60 × 6', { work: 60, rest: 60, rounds: 6 }],
]
const load = (): Plan => {
  try {
    return { work: 30, rest: 30, rounds: 8, ...JSON.parse(localStorage.getItem('gg.intervals') ?? '{}') }
  } catch {
    return { work: 30, rest: 30, rounds: 8 }
  }
}

/** Interval timer for conditioning: work, rest, rounds. Keeps the screen on and beeps at each change. */
export function Intervals() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<Plan>(load)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [, tick] = useState(0)
  const [logged, setLogged] = useState(false)
  const last = useRef('')
  useWakeLock(startedAt !== null)

  useEffect(() => localStorage.setItem('gg.intervals', JSON.stringify(plan)), [plan])
  useEffect(() => {
    if (startedAt === null || pausedAt !== null) return
    const id = setInterval(() => tick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [startedAt, pausedAt])

  const elapsed = startedAt === null ? 0 : ((pausedAt ?? Date.now()) - startedAt) / 1000
  const now = startedAt === null ? null : intervalAt(plan, elapsed)

  // A sound at every change of phase, and a higher one at the end.
  useEffect(() => {
    if (!now) return
    const key = `${now.phase}-${now.round}`
    if (key === last.current) return
    const first = last.current === ''
    last.current = key
    if (!first) beep(now.phase === 'done' ? 'record' : 'rest')
  })

  const step = (field: keyof Plan, by: number, min: number, max: number) => setPlan((p) => ({ ...p, [field]: Math.max(min, Math.min(max, p[field] + by)) }))
  const minutes = Math.max(1, Math.round(intervalTotal(plan) / 60))
  const stepper = 'num flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-raised text-lg font-semibold'

  if (now) {
    const tone = now.phase === 'work' ? 'text-accent' : now.phase === 'rest' ? 'text-coach' : 'text-ink'
    return (
      <div className="flex min-h-full flex-col gap-4 px-5 pt-3 pb-6">
        <header className="flex items-center gap-2.5">
          <RoundButton
            label="Stop"
            d={icons.back}
            onClick={() => {
              if (now.phase !== 'done' && !window.confirm('Stop the timer?')) return
              last.current = ''
              setStartedAt(null)
              setPausedAt(null)
              setLogged(false)
            }}
          />
          <h1 className="font-display text-xl font-bold">Intervals</h1>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-3" role="timer" aria-live="off">
          <Label tone={now.phase === 'work' ? 'accent' : now.phase === 'rest' ? 'coach' : undefined}>
            {now.phase === 'ready' ? 'Get ready' : now.phase === 'work' ? 'Work' : now.phase === 'rest' ? 'Rest' : 'Finished'}
          </Label>
          <span className={cx('num text-[112px] leading-none font-bold tracking-[-4px]', tone)}>{now.phase === 'done' ? clock(intervalTotal(plan)) : now.left}</span>
          <span className="num text-lg font-semibold text-muted">{now.phase === 'done' ? `${plan.rounds} rounds done` : `Round ${now.round} of ${plan.rounds}`}</span>
          {pausedAt !== null && <span className="text-sm text-warn">Paused</span>}
        </div>
        {now.phase === 'done' ? (
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              disabled={logged}
              onClick={() => {
                void saveCardio(user!.id, { date: localDate(), kind: 'Intervals', minutes, distance: null })
                setLogged(true)
              }}
            >
              {logged ? `Logged ${minutes} minutes of cardio` : `Log ${minutes} minutes as cardio`}
            </Button>
            <Button onClick={() => navigate(-1)}>Done</Button>
          </div>
        ) : (
          <Button
            variant={pausedAt === null ? undefined : 'primary'}
            onClick={() => {
              if (pausedAt === null) return setPausedAt(Date.now())
              setStartedAt((s) => (s ?? 0) + (Date.now() - pausedAt))
              setPausedAt(null)
            }}
          >
            {pausedAt === null ? 'Pause' : 'Resume'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">Intervals</h1>
          <span className="text-[13px] text-muted">For conditioning days. No equipment needed.</span>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {presets.map(([label, p]) => {
          const on = p.work === plan.work && p.rest === plan.rest && p.rounds === plan.rounds
          return (
            <button key={label} aria-pressed={on} onClick={() => setPlan(p)} className={cx('num h-12 rounded-control border text-sm font-semibold', on ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}>
              {label}
            </button>
          )
        })}
      </div>
      <Card className="flex flex-col gap-3">
        {(
          [
            ['work', 'Work', 5, 5, 600],
            ['rest', 'Rest', 5, 0, 600],
            ['rounds', 'Rounds', 1, 1, 40],
          ] as const
        ).map(([field, label, by, min, max]) => (
          <div key={field} className="flex min-h-[44px] items-center justify-between gap-3">
            <span className="text-[15px] font-medium">{label}</span>
            <span className="flex items-center gap-2">
              <button aria-label={`Less ${label.toLowerCase()}`} className={stepper} onClick={() => step(field, -by, min, max)}>
                −
              </button>
              <span className="num w-16 text-center text-lg font-semibold">{field === 'rounds' ? plan.rounds : clock(plan[field])}</span>
              <button aria-label={`More ${label.toLowerCase()}`} className={stepper} onClick={() => step(field, by, min, max)}>
                +
              </button>
            </span>
          </div>
        ))}
      </Card>
      <span className="text-center text-sm text-muted">Total {clock(intervalTotal(plan))}. The screen stays on while it runs.</span>
      <Button
        variant="primary"
        onClick={() => {
          unlockSound()
          last.current = ''
          setStartedAt(Date.now())
        }}
      >
        Start
      </Button>
      <span className="text-center text-xs text-muted">Ideas: jumping jacks, mountain climbers, burpees, dumbbell swings, high knees. Pick two or three and alternate rounds.</span>
    </div>
  )
}
