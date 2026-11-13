import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'
import type { SetRow } from '../lib/db'
import { exercise, exercises, groupLabels, stationLabels } from '../lib/exercises'
import { breakdown, loadModeFor } from '../lib/plates'
import { CATCH_UP, PROGRAM, TOP_UP } from '../lib/program'
import { restOf, saveProgram, useProgram } from '../lib/programState'
import { adjustRest, beep, clearRest, clock, startRest, unlockSound, useRest, useWakeLock } from '../lib/rest'
import {
  addExercise,
  addSet,
  addWarmups,
  describeSets,
  discardSession,
  finishSession,
  history,
  isRecord,
  swapExercise,
  updateLift,
  updateSet,
  useActiveSession,
  useSessionLifts,
  type LiftView,
} from '../lib/session'
import { Button, Icon, Label, Sheet, cx, icons } from '../components/ui'
import { SetPad } from '../components/SetPad'

const isDone = (v: LiftView) => v.lift.skipped || (v.sets.length > 0 && v.sets.every((s) => s.done))

export function useElapsed(startedAt: string | undefined): string {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return startedAt ? clock(Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))) : '0:00'
}

/** Every exercise that can stand in for this one: same main lift family, or same slot pool. */
function alternativesFor(key: string): string[] {
  for (const day of Object.values(PROGRAM)) {
    for (const m of day.mains) {
      const family = [m.key, m.alone, ...m.alternatives].filter((k): k is string => !!k)
      if (family.includes(key)) return family.filter((k) => k !== key)
    }
  }
  const pools = [
    ...Object.values(PROGRAM).flatMap((d) => [...d.slots, ...d.finisher].map((s) => s.pool)),
    ...Object.values(TOP_UP).flatMap((c) => Object.values(c)),
    ...Object.values(CATCH_UP),
  ]
  const pool = pools.find((p) => p.includes(key))
  if (pool) return pool.filter((k) => k !== key)
  const group = exercise(key).group
  return exercises.filter((e) => e.group === group && e.key !== key).map((e) => e.key).slice(0, 6)
}

function setLabel(s: SetRow, n: number) {
  return s.set_type === 'warmup' ? 'W' : s.set_type === 'drop' ? 'D' : s.set_type === 'failure' ? 'F' : String(n)
}

function RestBar() {
  const rest = useRest()
  if (!rest) return null
  const pct = rest.total > 0 ? Math.min(100, ((rest.total - rest.remaining) / rest.total) * 100) : 100
  const btn = 'relative h-11 rounded-xl border border-line-strong bg-surface text-sm font-semibold'
  return (
    <div className="pb-safe shrink-0 px-3 pt-2">
      <div className="relative flex h-[72px] items-center gap-2 overflow-hidden rounded-[20px] border border-line-strong bg-raised pr-2.5 pl-[18px]">
        <span className="absolute inset-y-0 left-0 bg-accent-dim" style={{ width: `${pct}%` }} />
        <div className="relative flex flex-1 flex-col" role="timer" aria-live="off">
          <Label tone="accent">{rest.over ? 'Rest over' : 'Rest'}</Label>
          <span className="num text-[28px] leading-none font-bold">{clock(rest.remaining)}</span>
        </div>
        <button className={cx(btn, 'w-[52px]')} onClick={() => adjustRest(-15)}>
          −15
        </button>
        <button className={cx(btn, 'w-[52px]')} onClick={() => adjustRest(15)}>
          +15
        </button>
        <button className="relative h-11 w-[60px] rounded-xl bg-ink text-sm font-semibold text-bg" onClick={clearRest}>
          {rest.over ? 'OK' : 'Skip'}
        </button>
      </div>
    </div>
  )
}

export function Session() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const session = useActiveSession(user!.id)
  const lifts = useSessionLifts(session?.id)
  const program = useProgram(user!.id)
  const elapsed = useElapsed(session?.started_at)
  useWakeLock(!!session)

  const [picked, setPicked] = useState<string | null>(null)
  const [pad, setPad] = useState<{ setId: string; field: 'weight' | 'reps' | 'seconds' } | null>(null)
  const [menu, setMenu] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [alsoProgram, setAlsoProgram] = useState(false)
  const [record, setRecord] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const current = useMemo(() => {
    if (!lifts?.length) return null
    return lifts.find((v) => v.lift.id === picked) ?? lifts.find((v) => !isDone(v)) ?? lifts[lifts.length - 1]
  }, [lifts, picked])
  useEffect(() => setNote(current?.lift.note ?? ''), [current?.lift.id, current?.lift.note])

  const past = useLiveQuery(async () => (current && session ? history(user!.id, current.lift.exercise_key, 1, session.id) : []), [current?.lift.exercise_key, session?.id], [])

  if (session === undefined || lifts === undefined) return null
  if (session === null) return <Navigate to="/" replace />

  const index = current ? lifts.indexOf(current) : 0
  const nextSet = current?.sets.find((s) => !s.done)
  const mode = current?.exercise ? loadModeFor(current.exercise) : 'none'
  const plates = nextSet?.weight != null && mode !== 'none' ? breakdown(mode, nextSet.weight) : null
  const measure = current?.lift.measure ?? 'wr'
  const padSet = pad && current ? (current.sets.find((s) => s.id === pad.setId) ?? null) : null
  const allDone = current ? isDone(current) && !current.lift.skipped : false
  const upNext = lifts.find((v, i) => i > index && !isDone(v)) ?? lifts.find((v) => !isDone(v) && v !== current)
  const remaining = lifts.reduce((n, v) => n + (v.lift.skipped ? 0 : v.sets.filter((s) => !s.done).length), 0)

  async function toggleDone(view: LiftView, s: SetRow) {
    unlockSound()
    if (s.done) return void updateSet(s, { done: false, done_at: null })
    // A set cannot be ticked off without its numbers: open the pad on whatever is missing.
    const m = view.lift.measure
    if ((m === 'wr' || m === 'carry') && s.weight === null) return setPad({ setId: s.id, field: 'weight' })
    if ((m === 'wr' || m === 'bw') && s.reps === null) return setPad({ setId: s.id, field: 'reps' })
    if ((m === 'time' || m === 'carry') && s.duration_seconds === null) return setPad({ setId: s.id, field: 'seconds' })
    const saved = await updateSet(s, { done: true, done_at: new Date().toISOString() })
    if (await isRecord(user!.id, view.lift.exercise_key, saved)) {
      setRecord(view.lift.name)
      beep('record')
      setTimeout(() => setRecord(null), 2600)
    }
    // Supersets: go straight to the partner after the first lift, rest after the second.
    const group = view.lift.superset_group
    const partner = group ? lifts!.find((v) => v.lift.superset_group === group && v.lift.id !== view.lift.id) : undefined
    if (partner && partner.lift.position > view.lift.position && partner.sets.some((x) => !x.done)) return setPicked(partner.lift.id)
    if (s.set_type !== 'warmup') startRest(restOf(program)[view.target.kind])
    if (partner && partner.lift.position < view.lift.position && partner.sets.some((x) => !x.done)) setPicked(partner.lift.id)
  }

  const cell = (active: boolean) => cx('num flex items-center justify-center rounded-[10px] font-semibold', active ? 'h-[52px] bg-raised text-2xl font-bold' : 'h-11 bg-surface text-lg')
  const weightText = (s: SetRow) => (s.weight === null ? '—' : measure === 'bw' && s.weight === 0 ? 'BW' : measure === 'bw' ? `+${s.weight}` : String(s.weight))
  const columns = measure === 'time' ? 'grid-cols-[36px_1fr_96px_48px]' : 'grid-cols-[36px_1fr_78px_64px_48px]'
  let working = 0

  return (
    <div className="flex h-full flex-col">
      <div className="scroll-y pt-safe min-h-0 flex-1">
        <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
          <header className="flex items-center gap-2.5">
            <Link to="/" aria-label="Minimize workout" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface">
              <Icon d="M6 9l6 6 6-6" size={20} />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-semibold">{session.title}</span>
              <span className="num text-[13px] text-muted">
                {elapsed}
                {lifts.length > 0 && ` · exercise ${index + 1} of ${lifts.length}`}
              </span>
            </div>
            <button className="h-11 rounded-full border border-line bg-raised px-4 text-sm font-semibold" onClick={() => setFinishing(true)}>
              Finish
            </button>
          </header>

          {lifts.length > 0 && (
            <div className="flex gap-[5px]">
              {lifts.map((v) => (
                <button key={v.lift.id} aria-label={`Go to ${v.lift.name}`} onClick={() => setPicked(v.lift.id)} className="flex h-6 flex-1 items-center">
                  <span className={cx('h-1 w-full rounded-full', isDone(v) ? 'bg-accent' : v === current ? 'bg-ink' : 'bg-line')} />
                </button>
              ))}
            </div>
          )}

          {!current && (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
              <span className="text-[15px] font-semibold">An empty workout</span>
              <span className="text-sm text-muted">Add the first exercise to begin.</span>
            </div>
          )}

          {current && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Label tone={current.target.kind === 'main' ? 'accent' : undefined}>
                    {current.target.kind === 'main' ? 'Main lift' : current.target.role}
                    {current.lift.superset_group ? ` · superset ${current.lift.superset_group}` : ''}
                  </Label>
                  <h1 className="font-display text-[28px] leading-[1.05] font-bold tracking-[-0.5px]">{current.lift.name}</h1>
                  <Link to={`/library/${current.lift.exercise_key}`} className="flex h-8 items-center text-[13px] font-medium text-coach">
                    How to · setup notes
                  </Link>
                </div>
                <button aria-label="Exercise options" onClick={() => setMenu(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface">
                  <Icon d="M5 12h.01M12 12h.01M19 12h.01" size={22} />
                </button>
              </div>

              {current.target.note && <p className="rounded-xl bg-coach-dim px-3 py-2 text-[13px] leading-snug">{current.target.note}</p>}

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5 rounded-control border border-line bg-surface px-3 py-2.5">
                  <span className="text-[11px] font-medium text-muted">LAST TIME</span>
                  <span className="num text-[15px] font-semibold">{describeSets(past[0])}</span>
                </div>
                <div className="flex flex-col gap-0.5 rounded-control border border-line bg-surface px-3 py-2.5">
                  <span className="text-[11px] font-medium text-muted">TARGET</span>
                  <span className="num text-[15px] font-semibold">
                    {current.target.low}–{current.target.high} {current.target.unit === 'sec' ? 'sec' : 'reps'}
                    {current.target.eachSide ? ' each' : ''}
                  </span>
                </div>
              </div>
              {current.target.hint && <p className="-mt-1.5 text-[13px] text-muted">{current.target.hint}</p>}

              {current.lift.skipped ? (
                <div className="flex items-center justify-between rounded-card border border-line bg-surface p-4">
                  <span className="text-sm text-muted">Skipped today</span>
                  <Button variant="ghost" onClick={() => void updateLift(current.lift, { skipped: false })}>
                    Bring back
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className={cx('grid gap-2 px-1 text-[11px] font-medium text-muted', columns)}>
                    <span>SET</span>
                    <span />
                    {measure !== 'time' && <span className="text-center">{measure === 'bw' ? 'ADDED' : 'LB'}</span>}
                    <span className="text-center">{measure === 'time' || measure === 'carry' ? 'SEC' : 'REPS'}</span>
                    <span />
                  </div>
                  {current.sets.map((s) => {
                    if (s.set_type !== 'warmup') working++
                    const active = s.id === nextSet?.id
                    const open = (field: 'weight' | 'reps' | 'seconds') => setPad({ setId: s.id, field })
                    return (
                      <div key={s.id} className={cx('grid items-center gap-2 rounded-control p-1', columns, active && 'border border-accent bg-surface py-2', s.done && 'opacity-70')}>
                        <span className={cx('num pl-1.5 font-bold', s.set_type === 'warmup' && 'text-warn')}>{setLabel(s, working)}</span>
                        <span className="text-xs text-muted">{s.set_type === 'warmup' ? 'warm-up' : s.set_type === 'drop' ? 'drop set' : s.set_type === 'failure' ? 'to failure' : ''}</span>
                        {measure !== 'time' && (
                          <button aria-label={`Weight, ${weightText(s)}`} className={cell(active)} onClick={() => open('weight')}>
                            {weightText(s)}
                          </button>
                        )}
                        {measure === 'time' || measure === 'carry' ? (
                          <button aria-label={`Seconds, ${s.duration_seconds ?? 'not set'}`} className={cell(active)} onClick={() => open('seconds')}>
                            {s.duration_seconds ?? '—'}
                          </button>
                        ) : (
                          <button aria-label={`Reps, ${s.reps ?? 'not set'}`} className={cell(active)} onClick={() => open('reps')}>
                            {s.reps ?? '—'}
                          </button>
                        )}
                        <button
                          aria-label={s.done ? 'Mark set not done' : 'Mark set done'}
                          aria-pressed={s.done}
                          onClick={() => void toggleDone(current, s)}
                          className={cx('flex w-11 items-center justify-center rounded-xl', active ? 'h-[52px]' : 'h-11', s.done ? 'bg-accent text-accent-ink' : 'border-2 border-faint text-muted')}
                        >
                          <Icon d={icons.check} size={20} />
                        </button>
                      </div>
                    )
                  })}
                  <div className="flex min-h-11 items-center justify-between px-1">
                    <span className="text-[13px] text-muted">{plates?.text ?? ''}</span>
                    <button className="h-11 shrink-0 px-2 text-sm font-semibold text-accent" onClick={() => void addSet(current)}>
                      + Add set
                    </button>
                  </div>
                </div>
              )}

              {allDone && (
                <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3.5">
                  <span className="text-sm font-medium">Reps left in the tank on the last set?</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        aria-pressed={current.target.rir === n}
                        onClick={() => void updateLift(current.lift, { target: { ...current.target, rir: n } })}
                        className={cx('num h-11 rounded-[10px] border text-[15px] font-semibold', current.target.rir === n ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}
                      >
                        {n === 3 ? '3+' : n}
                      </button>
                    ))}
                  </div>
                  {upNext && (
                    <Button variant="primary" className="!h-12 !text-base" onClick={() => setPicked(upNext.lift.id)}>
                      Next: {upNext.lift.name}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {lifts.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label>All exercises</Label>
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                {lifts.map((v, i) => (
                  <button key={v.lift.id} onClick={() => setPicked(v.lift.id)} className={cx('flex min-h-[48px] w-full items-center justify-between gap-3 px-3.5 py-2 text-left', i > 0 && 'border-t border-line', v === current && 'bg-raised')}>
                    <span className={cx('text-[15px]', v.target.kind === 'main' ? 'font-semibold' : 'font-medium', isDone(v) && 'text-muted')}>{v.lift.name}</span>
                    <span className="num shrink-0 text-[13px] text-muted">{v.lift.skipped ? 'skipped' : `${v.sets.filter((s) => s.done).length} / ${v.sets.length}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button onClick={() => setAdding(true)}>+ Add an exercise</Button>
        </div>
      </div>

      {record && (
        <div role="status" className="sheet pointer-events-none fixed inset-x-4 top-[max(env(safe-area-inset-top),14px)] z-40 flex flex-col gap-0.5 rounded-card border border-accent bg-accent-dim px-4 py-3">
          <Label tone="accent">New personal record</Label>
          <span className="font-display text-lg font-bold">{record}</span>
        </div>
      )}

      <RestBar />

      {current && <SetPad view={current} set={padSet} startOn={pad?.field ?? 'weight'} onClose={() => setPad(null)} />}

      {/* ---- exercise options ---- */}
      <Sheet open={menu && !!current} onClose={() => setMenu(false)}>
        {current && (
          <div className="scroll-y flex max-h-[76vh] flex-col gap-3.5 pb-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[22px] font-bold">{current.lift.name}</span>
              <span className="text-[13px] text-muted">{current.exercise ? `${groupLabels[current.exercise.group]} · ${stationLabels[current.exercise.station]}` : ''}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Swap for the same movement</Label>
              {alternativesFor(current.lift.exercise_key).map((k) => {
                const e = exercise(k)
                return (
                  <button
                    key={k}
                    onClick={() => {
                      const old = current.lift.exercise_key
                      void swapExercise(current, k)
                      if (alsoProgram) {
                        const main = Object.values(PROGRAM).flatMap((d) => d.mains).find((m) => [m.key, m.alone, ...m.alternatives].includes(old))
                        if (main?.id === 'B2' && (k === 'pull_up' || k === 'lat_pulldown')) void saveProgram(user!.id, { pullMain: k })
                        else if (main && current.target.kind === 'main') void saveProgram(user!.id, { mains: { ...program.mains, [main.id]: k } })
                        else void saveProgram(user!.id, { pins: [...program.pins.filter((p) => p !== old), k] })
                      }
                      setMenu(false)
                    }}
                    className="flex min-h-[56px] items-center justify-between gap-3 rounded-control border border-line bg-raised px-3.5 py-2 text-left"
                  >
                    <span className="text-[15px] font-semibold">{e.name}</span>
                    <span className="shrink-0 text-xs text-muted">{stationLabels[e.station]}</span>
                  </button>
                )
              })}
              <label className="flex min-h-[48px] items-center justify-between gap-3 rounded-control bg-bg px-3.5 py-2">
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">Also change my program</span>
                  <span className="text-xs text-muted">Off: the swap is for today only</span>
                </span>
                <input type="checkbox" checked={alsoProgram} onChange={(e) => setAlsoProgram(e.target.checked)} role="switch" className="switch" />
              </label>
            </div>
            <div className="overflow-hidden rounded-control border border-line bg-raised">
              {mode !== 'none' && mode !== 'added' && (
                <button
                  className="flex h-[52px] w-full items-center justify-between border-b border-line px-3.5 text-[15px]"
                  onClick={() => void addWarmups(current).then((ok) => (ok ? setMenu(false) : window.alert('Enter your working weight first, then add warm-up sets.')))}
                >
                  <span>Add warm-up sets</span>
                  <span className="text-[13px] text-muted">ramps up to your weight</span>
                </button>
              )}
              <button
                className="flex h-[52px] w-full items-center px-3.5 text-[15px] text-danger"
                onClick={() => {
                  void updateLift(current.lift, { skipped: !current.lift.skipped })
                  setMenu(false)
                }}
              >
                {current.lift.skipped ? 'Bring back' : 'Skip today'}
              </button>
            </div>
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              Note for this exercise
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (current.lift.note ?? '') && void updateLift(current.lift, { note: note.trim() || null })}
                placeholder="Bench angle, hook height, how it felt"
                className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
        )}
      </Sheet>

      {/* ---- add an exercise ---- */}
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <div className="flex h-[70vh] flex-col gap-3 pb-3">
          <label className="flex flex-col">
            <span className="sr-only">Search exercises</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exercises" className="h-12 rounded-control border border-line bg-raised px-4 text-ink outline-none focus:border-accent" />
          </label>
          <div className="scroll-y min-h-0 flex-1 overflow-hidden rounded-control border border-line">
            {exercises
              .filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase()) && !lifts.some((v) => v.lift.exercise_key === e.key))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((e) => (
                <button
                  key={e.key}
                  onClick={() => {
                    void addExercise(session, e.key)
                    setAdding(false)
                    setQuery('')
                  }}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line bg-raised px-3.5 py-2 text-left last:border-b-0"
                >
                  <span className="text-[15px] font-medium">{e.name}</span>
                  <span className="shrink-0 text-xs text-muted">{groupLabels[e.group]}</span>
                </button>
              ))}
          </div>
        </div>
      </Sheet>

      {/* ---- finish ---- */}
      <Sheet open={finishing} onClose={() => setFinishing(false)}>
        <div className="flex flex-col gap-3 pb-3">
          <span className="font-display text-[22px] font-bold">Finish this workout?</span>
          <span className="text-sm text-muted">
            {remaining > 0 ? `${remaining} set${remaining === 1 ? ' is' : 's are'} not ticked off and will be left out of the record.` : 'Every set is done.'}
          </span>
          <Button
            variant="primary"
            onClick={() => {
              clearRest()
              void finishSession(session, program).then(() => navigate(`/done/${session.id}`, { replace: true }))
            }}
          >
            Finish workout
          </Button>
          <Button onClick={() => setFinishing(false)}>Keep going</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm('Discard this workout? Nothing from it will be saved.')) return
              clearRest()
              void discardSession(session).then(() => navigate('/', { replace: true }))
            }}
          >
            Discard workout
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
