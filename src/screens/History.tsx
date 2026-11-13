import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { SetRow } from '../lib/db'
import { addDays, localDate, parseLocal } from '../lib/dates'
import { planSession, phaseLabel } from '../lib/engine'
import { exercise, hasExercise } from '../lib/exercises'
import { DAY_ORDER, PROGRAM, type DayKey } from '../lib/program'
import { settingsOf, useProgram } from '../lib/programState'
import { useSessions, type DoneLift } from '../lib/progressData'
import { discardSession, repeatSession, saveRoutine, startSession, useActiveSession, type LiftTarget, type LiftView } from '../lib/session'
import { unlockSound } from '../lib/rest'
import { Button, Card, Label, RoundButton, Sheet, cx, icons } from '../components/ui'
import { SetPad } from '../components/SetPad'

const day = (date: string) => parseLocal(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function setText(s: SetRow): string {
  if (s.reps === null) return `${s.weight ? `${s.weight} lb · ` : ''}${s.duration_seconds ?? 0}s`
  return `${s.weight ? `${s.weight} × ` : ''}${s.reps}`
}

export function History() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const sessions = useSessions(user!.id)
  const program = useProgram(user!.id)
  const active = useActiveSession(user!.id)
  const [logging, setLogging] = useState(false)
  const [date, setDate] = useState(addDays(localDate(), -1))
  const [which, setWhich] = useState<DayKey | 'free'>('A')

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <h1 className="font-display text-xl font-bold">Workout history</h1>
      </header>
      <Button disabled={!!active} onClick={() => setLogging(true)}>
        Log a past workout
      </Button>
      {sessions?.length === 0 && <Card className="text-sm text-muted">No finished workouts yet. They appear here as soon as you finish one.</Card>}
      {sessions?.map((s) => (
        <Link key={s.session.id} to={`/history/${s.session.id}`} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-semibold">{s.session.title}</span>
            <span className="shrink-0 text-xs text-muted">{day(s.session.local_date)}</span>
          </div>
          <span className="num text-[13px] text-muted">
            {s.lifts.length} lifts · {s.setCount} sets · {s.volume.toLocaleString()} lb{s.minutes ? ` · ${s.minutes} min` : ''}
          </span>
        </Link>
      ))}

      <Sheet open={logging} onClose={() => setLogging(false)}>
        <div className="flex flex-col gap-3.5 pb-3">
          <span className="font-display text-[22px] font-bold">Log a past workout</span>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Date
            <input type="date" value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none" />
          </label>
          <div className="flex flex-col gap-2">
            {([...DAY_ORDER, 'free'] as const).map((d) => (
              <button key={d} aria-pressed={which === d} onClick={() => setWhich(d)} className={cx('min-h-[48px] rounded-control border px-3.5 text-left text-[15px] font-semibold', which === d ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}>
                {d === 'free' ? 'Something else (empty workout)' : `Day ${d} · ${PROGRAM[d].title}`}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            disabled={!date}
            onClick={() => {
              unlockSound()
              const plan = which === 'free' ? null : planSession({ day: which, blockIndex: 0, week: 1, settings: settingsOf(program) })
              void startSession(user!.id, plan, program, { date }).then(() => navigate('/session'))
            }}
          >
            Enter the sets
          </Button>
          <span className="text-xs text-muted">Tick off the sets you did, then tap Finish. It is saved on the date you chose.</span>
        </div>
      </Sheet>
    </div>
  )
}

export function HistoryDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const sessions = useSessions(user!.id)
  const program = useProgram(user!.id)
  const active = useActiveSession(user!.id)
  const [editing, setEditing] = useState<{ lift: DoneLift; set: SetRow } | null>(null)
  if (sessions === undefined) return null
  const found = sessions.find((s) => s.session.id === id)
  if (!found) return <Navigate to="/history" replace />
  const { session } = found
  const view = (l: DoneLift): LiftView => ({ lift: l.lift, target: l.lift.target as LiftTarget, exercise: hasExercise(l.lift.exercise_key) ? exercise(l.lift.exercise_key) : null, sets: l.sets })

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">{session.title}</h1>
          <span className="text-xs text-muted">
            {day(session.local_date)}
            {session.block_phase ? ` · ${phaseLabel[session.block_phase as keyof typeof phaseLabel] ?? session.block_phase} week ${session.block_week}` : ''}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {[
          [found.minutes ? `${found.minutes}` : '—', 'minutes'],
          [found.volume.toLocaleString(), 'lb lifted'],
          [`${found.setCount}`, 'sets'],
        ].map(([n, label]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-3">
            <span className="num text-2xl font-bold">{n}</span>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>

      {(session.effort || session.note) && (
        <Card className="flex flex-col gap-1">
          {session.effort && <span className="text-sm">Effort {session.effort} of 5</span>}
          {session.note && <span className="text-sm text-muted">{session.note}</span>}
        </Card>
      )}

      {found.lifts.map((l) => (
        <Card key={l.lift.id} className="flex flex-col gap-2">
          <Link to={`/library/${l.lift.exercise_key}`} className="text-[15px] font-semibold">
            {l.lift.name}
          </Link>
          <div className="flex flex-wrap gap-1.5">
            {l.sets.map((s) => (
              <button key={s.id} onClick={() => setEditing({ lift: l, set: s })} className="num h-11 rounded-[10px] bg-raised px-3 text-sm font-semibold">
                {setText(s)}
              </button>
            ))}
          </div>
          {l.lift.note && <span className="text-xs text-muted">{l.lift.note}</span>}
        </Card>
      ))}
      <span className="text-center text-xs text-muted">Tap a set to correct it.</span>

      <Label>This workout</Label>
      <Button
        disabled={!!active}
        onClick={() => {
          unlockSound()
          void repeatSession(user!.id, found, program).then(() => navigate('/session'))
        }}
      >
        {active ? 'Finish the open workout to repeat this one' : 'Do this workout again'}
      </Button>
      <Button
        onClick={() => {
          const name = window.prompt('Name this routine', session.title)
          if (name?.trim()) void saveRoutine(user!.id, program, name, found.lifts).then(() => window.alert('Saved. Start it from Today, under Other.'))
        }}
      >
        Save as a routine
      </Button>
      <Button
        variant="danger"
        onClick={() => {
          if (!window.confirm('Delete this workout? Its sets will no longer count toward your history or records.')) return
          void discardSession(session).then(() => navigate('/history', { replace: true }))
        }}
      >
        Delete workout
      </Button>

      {editing && <SetPad view={view(editing.lift)} set={editing.set} startOn={editing.set.reps === null ? 'seconds' : 'weight'} onClose={() => setEditing(null)} />}
    </div>
  )
}
