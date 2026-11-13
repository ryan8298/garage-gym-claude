import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { beatAt, calisthenics, classSeconds, classes, kindLabels, logClass, missingFor, startCalisthenics, timeline, type GymClass } from '../lib/classes'
import { exercise, hasExercise } from '../lib/exercises'
import { activeGym, equipmentName } from '../lib/gym'
import { useProgram } from '../lib/programState'
import { beep, clock, unlockSound, useWakeLock } from '../lib/rest'
import { useActiveSession } from '../lib/session'
import { Button, Card, Icon, Label, RoundButton, cx, icons } from '../components/ui'

const minutes = (c: GymClass) => Math.max(1, Math.round(classSeconds(c) / 60))

/** Workouts outside the lifting program: bodyweight strength and follow-along sessions. */
export function Classes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const program = useProgram(user!.id)
  const gym = activeGym(program)
  const active = useActiveSession(user!.id)
  const [starting, setStarting] = useState(false)
  const need = (c: { needs: string[] }) => {
    const missing = missingFor(c, gym)
    return missing.length ? `Uses ${missing.map(equipmentName).join(', ').toLowerCase()}, not listed at ${gym.name}` : c.needs.length ? `Uses ${c.needs.map(equipmentName).join(', ').toLowerCase()}` : 'No equipment'
  }
  const kinds = ['mobility', 'pilates', 'yoga'] as const

  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-[24px] font-bold tracking-[-0.5px]">Other workouts</h1>
          <span className="text-xs text-muted">For days you want something different. They do not change your program.</span>
        </div>
      </header>

      <Label tone="accent">{kindLabels.calisthenics}</Label>
      <span className="-mt-2 text-[13px] text-muted">Bodyweight strength, logged set by set like any workout.</span>
      {calisthenics.map((c) => (
        <Card key={c.id} className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">{c.title}</span>
              <span className="text-xs text-muted">
                {c.lifts.length} moves · {c.level} · {need(c)}
              </span>
            </div>
            <Button
              disabled={!!active || starting}
              className="shrink-0 px-4"
              onClick={() => {
                unlockSound()
                setStarting(true)
                void startCalisthenics(user!.id, program, c).then(() => navigate('/session'))
              }}
            >
              Start
            </Button>
          </div>
          <span className="text-[13px] leading-snug text-muted">{c.about}</span>
          <span className="text-xs text-muted">{c.lifts.filter((x) => hasExercise(x.key)).map((x) => exercise(x.key).name).join(' · ')}</span>
        </Card>
      ))}
      {active && <span className="text-xs text-muted">Finish the open workout before starting another.</span>}

      {kinds.map((kind) => {
        const list = classes.filter((c) => c.kind === kind)
        if (list.length === 0) return null
        return (
          <div key={kind} className="flex flex-col gap-3.5">
            <Label tone="accent">{kindLabels[kind]}</Label>
            <span className="-mt-2 text-[13px] text-muted">Follow along: each pose shows with a picture, a cue and a timer.</span>
            {list.map((c) => (
              <Link key={c.id} to={`/classes/${c.id}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
                <img src={c.steps[0]?.image} alt="" className="h-[72px] w-[72px] shrink-0 rounded-xl object-cover" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-semibold">{c.title}</span>
                  <span className="text-xs text-muted">
                    {minutes(c)} min · {c.steps.length} poses · {c.level}
                  </span>
                  <span className="text-xs text-muted">{need(c)}</span>
                </span>
                <span className="text-muted">
                  <Icon d={icons.next} size={18} />
                </span>
              </Link>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** A follow-along session: one pose at a time with its picture, cue and countdown. */
export function ClassPlayer() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const c = classes.find((x) => x.id === id)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [pausedAt, setPausedAt] = useState<number | null>(null)
  const [, tick] = useState(0)
  const [saving, setSaving] = useState(false)
  const began = useRef(0)
  const last = useRef('')
  useWakeLock(startedAt !== null)
  useEffect(() => {
    if (startedAt === null || pausedAt !== null) return
    const t = setInterval(() => tick((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [startedAt, pausedAt])

  const beats = c ? timeline(c) : []
  const elapsed = startedAt === null ? 0 : ((pausedAt ?? Date.now()) - startedAt) / 1000
  const now = startedAt === null ? null : beatAt(beats, elapsed)
  // A sound at each change: a pose starting, a pose ending, the session ending.
  useEffect(() => {
    if (!now) return
    const key = `${now.index}-${now.phase}`
    if (key === last.current) return
    const first = last.current === ''
    last.current = key
    if (!first) beep(now.phase === 'done' ? 'record' : 'rest')
  })
  if (!c) return <Navigate to="/classes" replace />
  // Jump to the start of another pose by shifting the clock.
  const jump = (index: number) => {
    const target = beats[Math.max(0, Math.min(beats.length - 1, index))]
    setStartedAt((pausedAt ?? Date.now()) - (target.at - 3) * 1000)
  }

  if (!now) {
    return (
      <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
        <header className="flex items-center gap-2.5">
          <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
          <div className="flex flex-col">
            <h1 className="font-display text-xl font-bold">{c.title}</h1>
            <span className="text-xs text-muted">
              {minutes(c)} min · {c.steps.length} poses · {c.level}
            </span>
          </div>
        </header>
        <p className="text-sm leading-relaxed text-muted">{c.about}</p>
        <Button
          variant="primary"
          onClick={() => {
            unlockSound()
            began.current = Date.now()
            last.current = ''
            setStartedAt(Date.now())
          }}
        >
          Start
        </Button>
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {c.steps.map((s, i) => (
            <div key={i} className={cx('flex items-center gap-3 p-2.5', i > 0 && 'border-t border-line')}>
              <img src={s.image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-medium">{s.name}</span>
                <span className="num text-xs text-muted">
                  {s.seconds} sec{s.side ? ' each side' : ''}
                </span>
              </span>
            </div>
          ))}
        </div>
        {c.steps.some((s) => s.credit) && <span className="text-xs text-muted">Photo credits: {[...new Set(c.steps.map((s) => s.credit).filter(Boolean))].join('; ')}</span>}
      </div>
    )
  }

  const beat = beats[now.index]
  const upcoming = beats[now.index + 1]
  return (
    <div className="flex min-h-[calc(100dvh-110px)] flex-col gap-3 px-5 pt-3 pb-4">
      <header className="flex items-center justify-between gap-3">
        <span className="num text-[13px] text-muted">
          {now.phase === 'done' ? 'Finished' : `Pose ${now.index + 1} of ${beats.length}`} · {clock(Math.min(Math.floor(elapsed), classSeconds(c)))} of {clock(classSeconds(c))}
        </span>
        <button
          className="h-11 px-2 text-sm font-semibold text-danger"
          onClick={() => {
            if (now.phase !== 'done' && !window.confirm('Stop this session? It will not be saved.')) return
            navigate(-1)
          }}
        >
          Stop
        </button>
      </header>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (elapsed / classSeconds(c)) * 100)}%` }} />
      </div>

      {now.phase === 'done' ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Label tone="accent">Session complete</Label>
          <h1 className="font-display text-[30px] leading-tight font-bold">{c.title}</h1>
          <span className="text-sm text-muted">{minutes(c)} minutes. It will show in your history and count toward this week.</span>
        </div>
      ) : (
        <>
          <img src={beat.step.image} alt={beat.step.name} className="aspect-[4/3] w-full rounded-card border border-line object-cover" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Label tone={now.phase === 'hold' ? 'accent' : undefined}>
                {now.phase === 'ready' ? 'Get into position' : 'Hold'}
                {beat.side ? ` · ${beat.side} side` : ''}
              </Label>
              <h1 className="font-display text-[26px] leading-[1.05] font-bold tracking-[-0.5px]">{beat.step.name}</h1>
            </div>
            <span role="timer" aria-live="off" className={cx('num shrink-0 text-[56px] leading-none font-bold tracking-[-2px]', now.phase === 'hold' ? 'text-accent' : 'text-muted')}>
              {now.left}
            </span>
          </div>
          <p className="text-[15px] leading-relaxed">{beat.step.cue}</p>
          {beat.step.credit && <span className="text-[11px] text-muted">Photo: {beat.step.credit}</span>}
          {pausedAt !== null && <span className="text-sm text-warn">Paused</span>}
          <span className="mt-auto text-[13px] text-muted">{upcoming ? `Next: ${upcoming.step.name}${upcoming.side ? `, ${upcoming.side} side` : ''}` : 'Last one'}</span>
        </>
      )}

      {now.phase === 'done' ? (
        <Button
          variant="primary"
          disabled={saving}
          onClick={() => {
            setSaving(true)
            void logClass(user!.id, c, began.current || Date.now() - classSeconds(c) * 1000).then((sessionId) => navigate(`/done/${sessionId}`, { replace: true }))
          }}
        >
          {saving ? 'Saving…' : 'Save to my history'}
        </Button>
      ) : (
        <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
          <Button className="!h-[58px] !rounded-2xl" aria-label="Previous pose" onClick={() => jump(now.index - 1)}>
            <Icon d="M19 5v14l-9-7zM6 5v14" size={20} />
          </Button>
          <Button
            className="!h-[58px] !rounded-2xl !text-base"
            onClick={() => {
              if (pausedAt === null) return setPausedAt(Date.now())
              setStartedAt((s) => (s ?? 0) + (Date.now() - pausedAt))
              setPausedAt(null)
            }}
          >
            {pausedAt === null ? 'Pause' : 'Resume'}
          </Button>
          <Button className="!h-[58px] !rounded-2xl" aria-label="Next pose" onClick={() => (now.index + 1 < beats.length ? jump(now.index + 1) : setStartedAt((pausedAt ?? Date.now()) - (classSeconds(c) + 1) * 1000))}>
            <Icon d="M5 5v14l9-7zM18 5v14" size={20} />
          </Button>
        </div>
      )}
    </div>
  )
}
