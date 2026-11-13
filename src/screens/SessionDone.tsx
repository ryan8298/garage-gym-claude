import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { rateSession, summarize } from '../lib/session'
import { askCoach, useCoachMessages } from '../lib/coach'
import { useProgram } from '../lib/programState'
import { useAuth } from '../lib/auth'
import { Button, Label, cx } from '../components/ui'

export function SessionDone() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const session = useLiveQuery(() => db.workout_sessions.get(id).then((s) => s ?? null), [id])
  const summary = useLiveQuery(async () => (session ? summarize(session) : null), [session?.id, session?.finished_at])
  const [effort, setEffort] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const { user } = useAuth()
  const program = useProgram(user!.id)
  const debrief = useCoachMessages(user!.id).find((m) => m.kind === 'debrief' && m.session_id === id)
  const [asking, setAsking] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  useEffect(() => {
    if (session) {
      setEffort(session.effort)
      setNote(session.note ?? '')
    }
  }, [session?.id])

  if (session === undefined) return null
  if (session === null || session.deleted) return <Navigate to="/" replace />

  return (
    <div className="scroll-y pt-safe pb-safe flex h-full flex-col gap-4 px-5">
      <div className="mt-4 flex flex-col gap-1">
        <Label tone="accent">Workout complete</Label>
        <h1 className="font-display text-[32px] leading-[1.05] font-bold tracking-[-0.6px]">{session.title}</h1>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          [summary && summary.minutes ? `${summary.minutes}` : '—', 'minutes'],
          [summary ? summary.volume.toLocaleString() : '—', 'lb lifted'],
          [summary ? `${summary.sets}` : '—', 'sets'],
        ].map(([n, label]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-3">
            <span className="num text-2xl font-bold">{n}</span>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>

      {summary && summary.records.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-card border border-accent bg-accent-dim p-4">
          <Label tone="accent">
            {summary.records.length} personal record{summary.records.length === 1 ? '' : 's'}
          </Label>
          {summary.records.map((r) => (
            <div key={r.name} className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium">{r.name}</span>
              <span className="num text-base font-bold">{r.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">How hard was it?</span>
        <div className="grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={`Effort ${n}`}
              aria-pressed={effort === n}
              onClick={() => setEffort(effort === n ? null : n)}
              className={cx('num h-12 rounded-xl border text-[17px] font-semibold', effort === n ? 'border-accent bg-accent-dim font-bold text-accent' : 'border-line bg-surface text-muted')}
            >
              {n}
            </button>
          ))}
        </div>
        <span className="flex justify-between text-xs text-muted">
          <span>Easy</span>
          <span>All out</span>
        </span>
      </div>

      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Note
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember about today" className="h-12 rounded-control border border-line bg-surface px-3.5 text-ink outline-none focus:border-accent" />
      </label>

      {program.coach !== false && (
        <div className="flex flex-col gap-2 rounded-card border border-coach-line bg-coach-dim p-4">
          <Label tone="coach">Coach debrief</Label>
          {debrief ? (
            <>
              <span className="text-sm leading-relaxed whitespace-pre-line">{debrief.body}</span>
              {(debrief.proposals.length > 0 || debrief.quick_workout) && (
                <Link to="/coach" className="flex h-9 items-center text-sm font-semibold text-coach">
                  The coach suggested a change. Review it
                </Link>
              )}
            </>
          ) : (
            <>
              {coachError && <span className="text-[13px] text-danger">{coachError}</span>}
              <button
                disabled={asking}
                onClick={() => {
                  setAsking(true)
                  setCoachError(null)
                  void askCoach(session.user_id, program, 'debrief', undefined, session.id).then((r) => {
                    setCoachError(r.error ?? null)
                    setAsking(false)
                  })
                }}
                className="h-11 rounded-control bg-coach text-sm font-semibold text-accent-ink disabled:opacity-60"
              >
                {asking ? 'Looking at your workout…' : 'Get a debrief'}
              </button>
            </>
          )}
        </div>
      )}

      {session.template_key === 'C' && (
        <Link to="/log" replace className="flex h-11 items-center justify-center rounded-control border border-coach-line bg-coach-dim text-sm font-semibold text-coach">
          Next: log your cardio
        </Link>
      )}

      <div className="mt-auto flex flex-col gap-2 pb-2">
        <Button variant="primary" onClick={() => void rateSession(session, effort, note.trim() || null).then(() => navigate('/', { replace: true }))}>
          Save workout
        </Button>
        <Link to="/" replace className="flex h-11 items-center justify-center text-sm text-muted">
          Skip
        </Link>
      </div>
    </div>
  )
}
