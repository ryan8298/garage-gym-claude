import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { askCoach, decide, startQuick, useCoachMessages, type ProposalState, type QuickWorkout } from '../lib/coach'
import type { CoachMessage } from '../lib/db'
import { exercise, hasExercise } from '../lib/exercises'
import { PROGRAM, type DayKey } from '../lib/program'
import { useProgram, type ProgramData } from '../lib/programState'
import { unlockSound } from '../lib/rest'
import { useActiveSession } from '../lib/session'
import { Button, Icon, Label, RoundButton, cx, icons } from '../components/ui'

/** Bold text between pairs of asterisks. */
function bold(line: string) {
  return line.split('**').map((part, i) => (i % 2 ? <b key={i} className="font-semibold text-ink">{part}</b> : part))
}

/** The coach's reply: short paragraphs, bullet lines that start with "- ", and bold labels. */
function Reply({ text }: { text: string }) {
  const blocks: { bullets: boolean; lines: string[] }[] = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const bullet = /^[-•*]\s+/.test(line)
    const last = blocks[blocks.length - 1]
    const clean = bullet ? line.replace(/^[-•*]\s+/, '') : line.replace(/^#+\s*/, '')
    if (bullet && last?.bullets) last.lines.push(clean)
    else blocks.push({ bullets: bullet, lines: [clean] })
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.bullets ? (
          <ul key={i} className="flex flex-col gap-1.5">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-2">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-coach" />
                <span>{bold(l)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{bold(b.lines[0])}</p>
        ),
      )}
    </>
  )
}

const nameOf = (key: string | null) => (key && hasExercise(key) ? exercise(key).name : (key ?? ''))

function describe(p: ProposalState, program: ProgramData): { title: string; from?: string; to: string } {
  const day = p.day ? `Day ${p.day}` : ''
  if (p.kind === 'ban_exercise') return { title: 'Remove from rotation', to: `Never use ${nameOf(p.exercise_key)}` }
  if (p.kind === 'swap_main') {
    const main = PROGRAM[p.day as DayKey]?.mains.find((m) => m.id === p.target)
    const current = main ? (program.mains[main.id] ?? (main.id === 'B2' ? program.pullMain : main.key)) : null
    return { title: `${day} · swap main lift`, from: nameOf(current), to: nameOf(p.exercise_key) }
  }
  if (p.kind === 'lock_slot') return { title: `${day} · ${p.target}`, to: `Always ${nameOf(p.exercise_key)}` }
  return { title: `${day} · new accessory priority`, to: (p.order ?? []).join(', ') }
}

function Proposals({ message, program, userId }: { message: CoachMessage; program: ProgramData; userId: string }) {
  const [problem, setProblem] = useState<string | null>(null)
  const list = message.proposals as ProposalState[]
  if (list.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {list.map((p, i) => {
        const d = describe(p, program)
        return (
          <div key={i} className={cx('flex flex-col gap-2.5 rounded-2xl border bg-surface p-3.5', p.status === 'accepted' ? 'border-accent' : 'border-line')}>
            <div className="flex items-center justify-between gap-3">
              <Label tone="coach">{d.title}</Label>
              {p.status !== 'open' && <span className={cx('text-xs font-semibold', p.status === 'accepted' ? 'text-accent' : 'text-muted')}>{p.status === 'accepted' ? 'Accepted' : 'Rejected'}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              {d.from && (
                <>
                  <span className="text-muted line-through">{d.from}</span>
                  <span className="text-muted">
                    <Icon d="M5 12h14M13 6l6 6-6 6" size={16} />
                  </span>
                </>
              )}
              <span className="font-semibold">{d.to}</span>
            </div>
            <span className="text-[13px] leading-snug text-muted">Why: {p.reason}</span>
            {p.status === 'open' && (
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => void decide(userId, program, message, i, false)}>Reject</Button>
                <button className="h-11 rounded-control bg-accent text-sm font-semibold text-accent-ink" onClick={() => void decide(userId, program, message, i, true).then(setProblem)}>
                  Accept
                </button>
              </div>
            )}
          </div>
        )
      })}
      {problem && <span className="text-[13px] text-danger">{problem}</span>}
      <span className="text-xs text-muted">Accepted changes apply to your own program from your next workout. Your partner's program and your history are untouched.</span>
    </div>
  )
}

function Quick({ quick, program, userId }: { quick: QuickWorkout; program: ProgramData; userId: string }) {
  const navigate = useNavigate()
  const active = useActiveSession(userId)
  const [starting, setStarting] = useState(false)
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-3.5">
      <Label tone="coach">Workout for today</Label>
      <span className="text-[15px] font-semibold">{quick.title}</span>
      <div className="flex flex-col gap-1">
        {quick.lifts.map((l) => (
          <div key={l.exercise_key} className="flex items-baseline justify-between gap-3 text-sm">
            <span>{nameOf(l.exercise_key)}</span>
            <span className="num shrink-0 text-muted">
              {l.sets} × {l.low}–{l.high}
            </span>
          </div>
        ))}
      </div>
      <button
        disabled={!!active || starting}
        onClick={() => {
          unlockSound()
          setStarting(true)
          void startQuick(userId, program, quick).then(() => navigate('/session'))
        }}
        className="h-11 rounded-control bg-coach text-sm font-semibold text-accent-ink disabled:opacity-50"
      >
        {active ? 'Finish the open workout first' : starting ? 'Starting…' : 'Start this workout'}
      </button>
    </div>
  )
}

const chips = ['Review my week', 'Only 30 minutes today', 'What should I focus on next?']

export function Coach() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const program = useProgram(user!.id)
  const messages = useCoachMessages(user!.id)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [left, setLeft] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const enabled = program.coach !== false

  // In braces on purpose: newer browsers return a promise from scrollIntoView, and an effect must not return one.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, busy])

  async function send(message: string, mode: CoachMessage['kind'] = 'chat') {
    if (busy || (mode === 'chat' && !message.trim())) return
    setBusy(true)
    setError(null)
    setText('')
    const result = await askCoach(user!.id, program, mode, message.trim())
    if (result.error) setError(result.error)
    else if (result.used !== undefined && result.limit !== undefined) setLeft(`${result.used} of ${result.limit} today`)
    setBusy(false)
  }

  // Arriving with ?ask=weekly (from the Progress tab) asks for the weekly review once.
  useEffect(() => {
    if (params.get('ask') === 'weekly' && enabled) {
      setParams({}, { replace: true })
      void send('', 'weekly')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void send(text)
  }

  return (
    <div data-swipe className="push flex h-dvh flex-col bg-bg">
      <header className="pt-safe flex shrink-0 items-center gap-2.5 px-5 pb-2">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-1 flex-col">
          <h1 className="font-display text-xl font-bold">Coach</h1>
          <span className="text-xs text-muted">Reads your last 8 weeks of training</span>
        </div>
        {left && <span className="num text-xs text-muted">{left}</span>}
      </header>

      <div className="scroll-y min-h-0 flex-1 px-4">
        <div className="flex flex-col gap-3 pt-2 pb-4">
          {!enabled && <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">The coach is switched off. Turn it on in Settings.</p>}
          {enabled && messages.length === 0 && !busy && (
            <p className="rounded-2xl border border-coach-line bg-coach-dim p-4 text-sm leading-relaxed">
              Ask about your training: why a lift has stalled, what to swap when something hurts, or what to do with 30 minutes. I can also suggest changes to your program, which you accept or reject one at a time.
            </p>
          )}
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="max-w-[78%] self-end rounded-[20px_20px_6px_20px] bg-line px-3.5 py-3 text-[15px] leading-snug">
                {m.body}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[88%] flex-col gap-2.5 self-start">
                {m.kind !== 'chat' && <Label tone="coach">{m.kind === 'debrief' ? 'Workout debrief' : 'Weekly review'}</Label>}
                <div className="flex flex-col gap-2 rounded-[20px_20px_20px_6px] border border-coach-line bg-coach-dim px-3.5 py-3 text-[15px] leading-snug select-text">
                  <Reply text={m.body} />
                </div>
                <Proposals message={m} program={program} userId={user!.id} />
                {m.quick_workout ? <Quick quick={m.quick_workout as QuickWorkout} program={program} userId={user!.id} /> : null}
              </div>
            ),
          )}
          {busy && (
            <div role="status" className="self-start rounded-[20px_20px_20px_6px] border border-coach-line bg-coach-dim px-3.5 py-3 text-sm text-muted">
              Looking at your training…
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-2xl border border-line bg-surface p-3.5 text-sm text-danger">
              {error}
            </p>
          )}
          <div ref={end} />
        </div>
      </div>

      {enabled && (
        <div className="pb-safe flex shrink-0 flex-col gap-2 px-4 pt-2">
          <div className="scroll-x -mx-4 flex gap-2 overflow-x-auto px-4" style={{ scrollbarWidth: 'none' }}>
            {chips.map((c) => (
              <button key={c} disabled={busy} onClick={() => void send(c, c === 'Review my week' ? 'weekly' : 'chat')} className="h-11 shrink-0 rounded-full border border-coach-line bg-coach-dim px-3.5 text-[13px] font-medium disabled:opacity-50">
                {c}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex items-center gap-2">
            <label className="flex flex-1">
              <span className="sr-only">Message the coach</span>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your training" enterKeyHint="send" className="h-[52px] w-full rounded-full border border-line bg-surface px-[18px] text-ink outline-none focus:border-coach" />
            </label>
            <button type="submit" aria-label="Send" disabled={busy || !text.trim()} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-coach text-accent-ink disabled:opacity-40">
              <Icon d="M12 19V5M6 11l6-6 6 6" size={22} />
            </button>
          </form>
          <span className="text-center text-[11px] text-muted">Training guidance only, not medical advice.</span>
        </div>
      )}
    </div>
  )
}
