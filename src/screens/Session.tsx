import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/data'
import { usePartner } from '../lib/partner'
import type { SetRow } from '../lib/db'
import { exercise, exercises, groupLabels, equipLabels, matchesQuery } from '../lib/exercises'
import { breakdown, loadModeFor, stepDown, stepUp } from '../lib/plates'
import { ALL_DAYS, CATCH_UP, TOP_UP, dayByKey } from '../lib/program'
import { restOf, saveProgram, useProgram, useSetsByGroup } from '../lib/programState'
import { WEEKLY_SET_TARGET, gapSuggestions } from '../lib/gaps'
import { activeGym, availableAt } from '../lib/gym'
import { adjustRest, beep, clearRest, clock, startRest, unlockSound, useRest, useWakeLock } from '../lib/rest'
import {
  addExercise,
  addSet,
  addWarmups,
  discardSession,
  finishSession,
  history,
  isRecord,
  removeLift,
  reorderLifts,
  restoreLift,
  swapExercise,
  updateLift,
  updateSet,
  useActiveSession,
  usePairedSession,
  useSessionLifts,
  type LiftView,
} from '../lib/session'
import { Button, Icon, Label, Sheet, cx, icons } from '../components/ui'
import { SetPad } from '../components/SetPad'
import { LiftQueue } from '../components/LiftQueue'
import { NowPlaying } from '../components/NowPlaying'

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
  for (const day of ALL_DAYS) {
    for (const m of day.mains) {
      const family = [m.key, m.alone, ...m.alternatives].filter((k): k is string => !!k)
      if (family.includes(key)) return family.filter((k) => k !== key)
    }
  }
  const pools = [
    ...ALL_DAYS.flatMap((d) => [...d.slots, ...d.finisher].map((s) => s.pool)),
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
  // In a shared workout the screen shows one person at a time: whoever's turn it is.
  const mine = useActiveSession(user!.id)
  const theirs = usePairedSession(mine)
  const [who, setWho] = useState<'me' | 'partner'>('me')
  const session = who === 'partner' && theirs ? theirs : mine
  const other = session === mine ? theirs : mine
  const viewer = session?.user_id ?? user!.id
  const lifts = useSessionLifts(session?.id)
  const otherLifts = useSessionLifts(other?.id)
  const program = useProgram(viewer)
  const partnerProgram = useProgram(other?.user_id ?? viewer)
  // The place is the phone owner's choice, whoever is being logged for.
  const myProgram = useProgram(user!.id)
  const myName = useProfile(user!.id)?.display_name || 'Me'
  const partnerName = usePartner(user!.id)?.display_name || 'Partner'
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
  const [pinned, setPinned] = useState('')
  const [undo, setUndo] = useState<{ text: string; run(): void } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [swapFor, setSwapFor] = useState<string | null>(null)
  const [queue, setQueue] = useState(false)
  const [swapOpen, setSwapOpen] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const weekSets = useSetsByGroup(viewer)

  const current = useMemo(() => {
    if (!lifts?.length) return null
    return lifts.find((v) => v.lift.id === picked) ?? lifts.find((v) => !isDone(v)) ?? lifts[lifts.length - 1]
  }, [lifts, picked])
  useEffect(() => setNote(current?.lift.note ?? ''), [current?.lift.id, current?.lift.note])
  const pinnedNote = current ? (program.notes?.[current.lift.exercise_key] ?? '') : ''
  useEffect(() => setPinned(pinnedNote), [current?.lift.exercise_key, pinnedNote])
  useEffect(() => {
    if (!undo) return
    const id = setTimeout(() => setUndo(null), 6000)
    return () => clearTimeout(id)
  }, [undo])

  const past = useLiveQuery(async () => (current && session ? history(viewer, current.lift.exercise_key, 1, session.id) : []), [current?.lift.exercise_key, session?.id, viewer], [])

  if (session === undefined || lifts === undefined) return null
  if (session === null) return <Navigate to="/" replace />

  const index = current ? lifts.indexOf(current) : 0
  const nextSet = current?.sets.find((s) => !s.done)
  const mode = current?.exercise ? loadModeFor(current.exercise) : 'none'
  const shownSet = current?.sets.find((x) => x.id === focusId && !x.done) ?? nextSet
  const plates = shownSet?.weight != null && mode !== 'none' ? breakdown(mode, shownSet.weight) : null
  const measure = current?.lift.measure ?? 'wr'
  const padSet = pad && current ? (current.sets.find((s) => s.id === pad.setId) ?? null) : null
  const allDone = current ? isDone(current) && !current.lift.skipped : false
  const upNext = lifts.find((v, i) => i > index && !isDone(v)) ?? lifts.find((v) => !isDone(v) && v !== current)
  const gym = activeGym(myProgram)
  // What fits today's kind of workout comes first when suggesting additions.
  const day = dayByKey(session.template_key)
  const preferred = day ? [...day.slots, ...day.finisher].flatMap((x) => x.pool) : []
  const suggestions = suggesting
    ? gapSuggestions({
        weekSets,
        session: lifts.filter((v) => v.exercise && !v.lift.skipped).map((v) => ({ key: v.lift.exercise_key, group: v.exercise!.group, remaining: v.sets.filter((x) => !x.done && x.set_type !== 'warmup').length })),
        catalog: exercises.filter((e) => availableAt(gym, e)),
        preferred,
        bans: program.bans,
        ankleStrap: program.ankleStrap,
        partner: program.partner,
      })
    : []
  const swapTarget = swapFor ? (lifts.find((v) => v.lift.id === swapFor) ?? null) : null
  const remaining = [...lifts, ...(other ? (otherLifts ?? []) : [])].reduce((n, v) => n + (v.lift.skipped ? 0 : v.sets.filter((s) => !s.done).length), 0)

  /** Replace a lift with another, and make it permanent in that person's program if asked. */
  function doSwap(view: LiftView, k: string) {
    const old = view.lift.exercise_key
    void swapExercise(view, k)
    if (!alsoProgram || !session) return
    const main = (dayByKey(session.template_key)?.mains ?? ALL_DAYS.flatMap((d) => d.mains)).find((m) => [m.key, m.alone, ...m.alternatives].includes(old))
    if (main?.pull && (k === 'pull_up' || k === 'lat_pulldown')) void saveProgram(viewer, { pullMain: k })
    else if (main && view.target.kind === 'main') void saveProgram(viewer, { mains: { ...program.mains, [main.id]: k } })
    else void saveProgram(viewer, { pins: [...program.pins.filter((p) => p !== old), k] })
  }

  async function toggleDone(view: LiftView, s: SetRow) {
    unlockSound()
    if (s.done) return void updateSet(s, { done: false, done_at: null })
    // A set cannot be ticked off without its numbers: open the pad on whatever is missing.
    const m = view.lift.measure
    if ((m === 'wr' || m === 'carry') && s.weight === null) return setPad({ setId: s.id, field: 'weight' })
    if ((m === 'wr' || m === 'bw') && s.reps === null) return setPad({ setId: s.id, field: 'reps' })
    if ((m === 'time' || m === 'carry') && s.duration_seconds === null) return setPad({ setId: s.id, field: 'seconds' })
    const saved = await updateSet(s, { done: true, done_at: new Date().toISOString() })
    if (await isRecord(viewer, view.lift.exercise_key, saved)) {
      setRecord(other ? `${session === mine ? myName : partnerName}: ${view.lift.name}` : view.lift.name)
      beep('record')
      setTimeout(() => setRecord(null), 2600)
    }
    // Training together: the other person goes next on the same lift, and the rest starts once both have gone.
    if (other && otherLifts) {
      const match = otherLifts.find((v) => v.lift.exercise_key === view.lift.exercise_key) ?? otherLifts.find((v) => v.lift.position === view.lift.position && v.target.kind === view.target.kind)
      if (match && !match.lift.skipped && match.sets.some((x) => !x.done)) {
        const doneHere = view.sets.filter((x) => x.done || x.id === s.id).length
        const doneThere = match.sets.filter((x) => x.done).length
        if (doneThere >= doneHere && s.set_type !== 'warmup') startRest(restOf(program)[view.target.kind])
        // That was this person's last set of the lift: stay, so they can say how hard it was. The card passes the turn.
        if (view.sets.every((x) => x.done || x.id === s.id)) return setPicked(view.lift.id)
        setPicked(match.lift.id)
        setWho(session === mine ? 'partner' : 'me')
        return
      }
      if (view.sets.every((x) => x.done || x.id === s.id)) setPicked(view.lift.id)
      if (s.set_type !== 'warmup') startRest(restOf(program)[view.target.kind])
      return
    }
    // The last set of a lift: stay on it, so "reps left in the tank" can be answered before moving on.
    if (view.sets.every((x) => x.done || x.id === s.id)) setPicked(view.lift.id)
    // Supersets: go straight to the partner after the first lift, rest after the second.
    const group = view.lift.superset_group
    const partner = group ? lifts!.find((v) => v.lift.superset_group === group && v.lift.id !== view.lift.id) : undefined
    if (partner && partner.lift.position > view.lift.position && partner.sets.some((x) => !x.done)) return setPicked(partner.lift.id)
    if (s.set_type !== 'warmup') startRest(restOf(program)[view.target.kind])
    if (partner && partner.lift.position < view.lift.position && partner.sets.some((x) => !x.done)) setPicked(partner.lift.id)
  }

  const weightText = (s: SetRow) => (s.weight === null ? '—' : measure === 'bw' && s.weight === 0 ? 'BW' : measure === 'bw' ? `+${s.weight}` : String(s.weight))
  let working = 0
  // One set at a time: the next one to do, unless another has been tapped.
  const focus = current ? (current.sets.find((x) => x.id === focusId && !x.done) ?? nextSet ?? null) : null
  const workingSets = current ? current.sets.filter((x) => x.set_type !== 'warmup') : []
  const workingTotal = workingSets.length
  const focusNumber = focus ? workingSets.indexOf(focus) + 1 : 0
  const before = focus && focus.set_type !== 'warmup' ? past[0]?.sets[focusNumber - 1] : undefined
  const focusBefore = !before ? '' : before.reps !== null ? `${before.weight ? `${before.weight} × ` : ''}${before.reps}` : `${before.seconds}s`
  // Each person has a colour: the phone's owner lime, their partner blue.
  const tone =
    other && session !== mine
      ? { fill: 'bg-coach', card: 'border-coach-line bg-coach-dim', line: 'border-coach-line', ring: 'border-coach', label: 'coach' as const }
      : { fill: 'bg-accent', card: 'border-line bg-surface', line: 'border-line-strong', ring: 'border-accent', label: 'accent' as const }
  // The other person's copy of this lift, if they still have sets to do on it.
  const waiting = (() => {
    if (!other || !otherLifts || !current) return null
    const match = otherLifts.find((v) => v.lift.exercise_key === current.lift.exercise_key) ?? otherLifts.find((v) => v.lift.position === current.lift.position && v.target.kind === current.target.kind)
    return match && !match.lift.skipped && match.sets.some((x) => !x.done) ? match : null
  })()
  const turnNote = (() => {
    if (!other || !otherLifts || !current || !focus) return ''
    const match = otherLifts.find((v) => v.lift.exercise_key === current.lift.exercise_key) ?? otherLifts.find((v) => v.lift.position === current.lift.position)
    const theirs = match?.sets.find((x) => !x.done)
    if (!match || match.lift.skipped || !theirs) return ''
    const who = session === mine ? partnerName : myName
    const what = theirs.reps !== null ? `${theirs.weight ?? '—'} × ${theirs.reps}` : `${theirs.duration_seconds ?? '—'}s`
    return `Then ${who}: ${what}`
  })()

  return (
    <div className="flex h-dvh flex-col">
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

          <NowPlaying />

          {other && otherLifts && (
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Whose turn">
              {(
                [
                  ['me', myName, mine === session ? lifts : otherLifts],
                  ['partner', partnerName, mine === session ? otherLifts : lifts],
                ] as const
              ).map(([key, label, list]) => {
                const on = (key === 'me') === (session === mine)
                const sets = list.flatMap((v) => (v.lift.skipped ? [] : v.sets))
                return (
                  <button
                    key={key}
                    aria-pressed={on}
                    onClick={() => {
                      if (on) return
                      // Land on the same lift the other person is on.
                      const match = current ? (list.find((v) => v.lift.exercise_key === current.lift.exercise_key) ?? list.find((v) => v.lift.position === current.lift.position)) : undefined
                      setPicked(match?.lift.id ?? null)
                      setWho(key)
                    }}
                    className={cx('flex h-14 flex-col items-center justify-center rounded-2xl border-2', !on ? 'border-line bg-surface' : key === 'partner' ? 'border-coach bg-coach-dim' : 'border-accent bg-accent-dim')}
                  >
                    <span className={cx('font-display text-[17px] leading-tight font-bold', !on ? 'text-muted' : key === 'partner' ? 'text-coach' : 'text-accent')}>{on ? `${label}'s turn` : label}</span>
                    <span className="num text-[11px] text-muted">
                      {sets.filter((x) => x.done).length} of {sets.length} sets
                    </span>
                  </button>
                )
              })}
            </div>
          )}

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
                <button aria-label="Exercise options" onClick={() => setMenu(true)} className="h-11 shrink-0 rounded-full border border-line bg-surface px-4 text-[13px] font-semibold">
                  Swap
                </button>
              </div>

              {current.target.note && <p className="rounded-xl bg-coach-dim px-3 py-2 text-[13px] leading-snug">{current.target.note}</p>}
              {pinnedNote && (
                <button onClick={() => setMenu(true)} className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface px-3 py-2 text-left">
                  <span className="text-[11px] font-medium text-muted">MY NOTE</span>
                  <span className="text-sm leading-snug">{pinnedNote}</span>
                </button>
              )}

              {current.lift.skipped ? (
                <div className="flex items-center justify-between rounded-card border border-line bg-surface p-4">
                  <span className="text-sm text-muted">Skipped today</span>
                  <Button variant="ghost" onClick={() => void updateLift(current.lift, { skipped: false })}>
                    Bring back
                  </Button>
                </div>
              ) : (
                <>
                  {/* Every set of this lift as a chip: done ones show their numbers, the one in focus is outlined. */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {current.sets.map((s) => {
                      if (s.set_type !== 'warmup') working++
                      const text = s.reps !== null ? `${weightText(s)} × ${s.reps}` : s.duration_seconds !== null ? `${s.weight ? `${s.weight} · ` : ''}${s.duration_seconds}s` : setLabel(s, working)
                      return s.done ? (
                        <button key={s.id} aria-label="Mark set not done" aria-pressed="true" onClick={() => void toggleDone(current, s)} className={cx('num flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-accent-ink', tone.fill)}>
                          <Icon d={icons.check} size={16} />
                          {text}
                        </button>
                      ) : (
                        <button key={s.id} aria-label={`Go to set ${setLabel(s, working)}`} onClick={() => setFocusId(s.id)} className={cx('num flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold', s.id === focus?.id ? cx(tone.ring, 'text-ink') : 'border-line text-muted')}>
                          {setLabel(s, working)}
                        </button>
                      )
                    })}
                    <button className="h-11 px-2 text-sm font-semibold text-accent" onClick={() => void addSet(current)}>
                      + Add set
                    </button>
                  </div>

                  {focus && (
                    <div className={cx('flex flex-col gap-3.5 rounded-[22px] border p-[18px]', tone.card)}>
                      <div className="flex items-center justify-between gap-3">
                        <Label tone={tone.label}>
                          {focus.set_type === 'warmup' ? 'Warm-up set' : `Set ${focusNumber} of ${workingTotal}`}
                          {focus.set_type === 'drop' ? ' · drop set' : focus.set_type === 'failure' ? ' · to failure' : ''}
                        </Label>
                        <span className="num text-[13px] text-muted">{focusBefore ? `Last time ${focusBefore}` : `Target ${current.target.low} to ${current.target.high}${current.target.unit === 'sec' ? ' sec' : ''}${current.target.eachSide ? ' each' : ''}`}</span>
                      </div>
                      <div className={cx('grid gap-2.5', measure === 'time' ? 'grid-cols-1' : 'grid-cols-2')}>
                        {(measure === 'time' ? (['seconds'] as const) : measure === 'carry' ? (['weight', 'seconds'] as const) : (['weight', 'reps'] as const)).map((field) => {
                          const value = field === 'weight' ? weightText(focus) : field === 'reps' ? (focus.reps ?? '—') : (focus.duration_seconds ?? '—')
                          const unit = field === 'weight' ? (measure === 'bw' ? 'lb added' : 'lb') : field === 'reps' ? (current.target.eachSide ? 'reps each' : 'reps') : 'sec'
                          const step = (dir: 1 | -1) => {
                            if (field === 'weight') {
                              const w = focus.weight ?? 0
                              const next = mode === 'none' ? Math.max(0, w + dir * 5) : dir > 0 ? stepUp(mode, w) : stepDown(mode, w)
                              // The later sets that shared the old weight follow, as they do in the number pad.
                              for (const later of current.sets) if (later.position > focus.position && !later.done && later.set_type !== 'warmup' && (later.weight === null || later.weight === focus.weight)) void updateSet(later, { weight: next })
                              void updateSet(focus, { weight: next })
                            } else if (field === 'reps') void updateSet(focus, { reps: Math.max(0, (focus.reps ?? current.target.low) + dir) })
                            else void updateSet(focus, { duration_seconds: Math.max(0, (focus.duration_seconds ?? current.target.low) + dir * 5) })
                          }
                          const name = field === 'weight' ? 'Weight' : field === 'reps' ? 'Reps' : 'Seconds'
                          return (
                            <div key={field} className="flex flex-col items-center gap-2">
                              <button aria-label={`${name}, ${value}`} onClick={() => setPad({ setId: focus.id, field })} className={cx('num h-[92px] w-full rounded-[18px] border bg-bg text-[56px] leading-none font-bold tracking-[-2px]', tone.line)}>
                                {value}
                              </button>
                              <div className="flex items-center gap-1.5">
                                <button aria-label={`Less ${name.toLowerCase()}`} className={cx('h-11 w-11 rounded-control border bg-bg text-xl', tone.line)} onClick={() => step(-1)}>
                                  −
                                </button>
                                <span className="w-12 text-center text-xs text-muted">{unit}</span>
                                <button aria-label={`More ${name.toLowerCase()}`} className={cx('h-11 w-11 rounded-control border bg-bg text-xl', tone.line)} onClick={() => step(1)}>
                                  +
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {plates?.text ? <span className="text-sm font-semibold">{plates.text}</span> : null}
                      {current.target.hint && !focusBefore && <span className="text-[13px] text-muted">{current.target.hint}</span>}
                    </div>
                  )}
                  {focus && turnNote && <span className="px-0.5 text-[13px] text-muted">{turnNote}</span>}
                </>
              )}

              {allDone && (
                <div className={cx('flex flex-col gap-2.5 rounded-card border p-3.5', tone.card)}>
                  <span className="text-sm font-medium">{other ? `${session === mine ? myName : partnerName}: reps left in the tank on the last set?` : 'Reps left in the tank on the last set?'}</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[0, 1, 2, 3].map((n) => (
                      <button
                        key={n}
                        aria-pressed={current.target.rir === n}
                        onClick={() => void updateLift(current.lift, { target: { ...current.target, rir: n } })}
                        className={cx('num h-11 rounded-[10px] border text-[15px] font-semibold', current.target.rir === n ? cx(tone.ring, tone.fill, 'text-accent-ink') : cx(tone.line, 'bg-bg text-muted'))}
                      >
                        {n === 3 ? '3+' : n}
                      </button>
                    ))}
                  </div>
                  {waiting ? (
                    <button
                      className={cx('h-12 rounded-2xl font-display text-base font-bold text-accent-ink', session === mine ? 'bg-coach' : 'bg-accent')}
                      onClick={() => {
                        setPicked(waiting.lift.id)
                        setWho(session === mine ? 'partner' : 'me')
                      }}
                    >
                      Now {session === mine ? partnerName : myName}
                    </button>
                  ) : (
                    upNext && (
                      <button className={cx('h-12 rounded-2xl font-display text-base font-bold text-accent-ink', tone.fill)} onClick={() => setPicked(upNext.lift.id)}>
                        Next: {upNext.lift.name}
                      </button>
                    )
                  )}
                </div>
              )}
            </>
          )}

          {lifts.length === 0 && <Button onClick={() => setAdding(true)}>+ Add an exercise</Button>}
        </div>
      </div>

      {record && (
        <div role="status" className="sheet pointer-events-none fixed inset-x-4 top-[max(env(safe-area-inset-top),14px)] z-40 flex flex-col gap-0.5 rounded-card border border-accent bg-accent-dim px-4 py-3">
          <Label tone="accent">New personal record</Label>
          <span className="font-display text-lg font-bold">{record}</span>
        </div>
      )}

      {undo && !queue && (
        <div role="status" className="mx-3 mt-2 flex h-12 shrink-0 items-center justify-between rounded-control border border-line-strong bg-raised pr-1.5 pl-4">
          <span className="truncate text-sm">{undo.text}</span>
          <button
            className="h-10 rounded-xl px-3 text-sm font-semibold text-accent"
            onClick={() => {
              undo.run()
              setUndo(null)
            }}
          >
            Undo
          </button>
        </div>
      )}

      <RestBar />

      {current && !current.lift.skipped && focus && (
        <div className="shrink-0 px-5 pt-2">
          <button onClick={() => void toggleDone(current, focus)} aria-label="Mark set done" className={cx('h-16 w-full rounded-[18px] font-display text-xl font-bold text-accent-ink', tone.fill)}>
            {other ? `${session === mine ? myName : partnerName} did it` : 'Set done'}
          </button>
        </div>
      )}
      <button onClick={() => setQueue(true)} className="pb-safe mt-2 flex shrink-0 items-center justify-between gap-3 border-t border-line bg-bar px-5 pt-3 text-left">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[11px] font-semibold tracking-[1px] text-muted">{upNext ? 'UP NEXT' : 'LAST LIFT'}</span>
          <span className="truncate text-[15px] font-semibold">{upNext ? upNext.lift.name : (current?.lift.name ?? 'Add an exercise')}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold text-muted">
          All {lifts.length} lifts
          <Icon d="M6 15l6-6 6 6" size={18} />
        </span>
      </button>

      {/* ---- today's lifts ---- */}
      <Sheet open={queue} onClose={() => setQueue(false)}>
        <div className="scroll-y flex max-h-[78vh] flex-col gap-3 pb-3 [&>*]:shrink-0">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[22px] font-bold">Today's lifts</span>
            <span className="num text-[13px] text-muted">
              {lifts.filter(isDone).length} of {lifts.length} done
            </span>
          </div>
          {undo && (
            <div role="status" className="flex h-12 items-center justify-between rounded-control border border-line-strong bg-raised pr-1.5 pl-4">
              <span className="truncate text-sm">{undo.text}</span>
              <button
                className="h-10 rounded-xl px-3 text-sm font-semibold text-accent"
                onClick={() => {
                  undo.run()
                  setUndo(null)
                }}
              >
                Undo
              </button>
            </div>
          )}
          <LiftQueue
            lifts={lifts}
            currentId={current?.lift.id}
            isDone={isDone}
            onPick={(id) => {
              setPicked(id)
              setQueue(false)
            }}
            onReorder={(ids) => void reorderLifts(lifts, ids)}
            onRemove={(v) => {
              void removeLift(v)
              if (picked === v.lift.id) setPicked(null)
              setUndo({ text: `${v.lift.name} removed`, run: () => void restoreLift(v) })
            }}
            onSwap={(v) => setSwapOpen(swapOpen === v.lift.id ? null : v.lift.id)}
            detail={(v) =>
              v.lift.id !== swapOpen ? null : (
                <div className="flex flex-col gap-2.5 border-t border-coach-line bg-coach-dim p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label tone="coach">Swap for, same movement</Label>
                    <button className="h-9 rounded-full border border-coach px-3 text-[13px] font-semibold text-coach" onClick={() => setSwapOpen(null)}>
                      Keep it
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {alternativesFor(v.lift.exercise_key)
                      .filter((k) => !lifts.some((x) => x.lift.exercise_key === k))
                      .sort((a, b) => Number(availableAt(gym, exercise(b))) - Number(availableAt(gym, exercise(a))))
                      .slice(0, 3)
                      .map((k) => {
                        const e = exercise(k)
                        return (
                          <button
                            key={k}
                            onClick={() => {
                              doSwap(v, k)
                              setSwapOpen(null)
                            }}
                            className="flex min-h-[60px] flex-col justify-center gap-0.5 rounded-xl border border-coach-line bg-bg px-3 py-1.5 text-left"
                          >
                            <span className="text-sm leading-tight font-semibold">{e.name}</span>
                            <span className="text-[11px] text-muted">
                              {equipLabels[e.equip]}
                              {!availableAt(gym, e) ? ` · not at ${gym.name}` : ''}
                            </span>
                          </button>
                        )
                      })}
                    <button
                      onClick={() => {
                        setSwapFor(v.lift.id)
                        setSwapOpen(null)
                        setQuery('')
                        setQueue(false)
                        setAdding(true)
                      }}
                      className="flex min-h-[60px] flex-col justify-center gap-0.5 rounded-xl border border-dashed border-coach-line px-3 py-1.5 text-left"
                    >
                      <span className="text-sm font-semibold text-coach">Search all {exercises.length}</span>
                      <span className="text-[11px] text-muted">Any lift, any place</span>
                    </button>
                  </div>
                  <label className="flex min-h-[40px] items-center justify-between gap-3">
                    <span className="text-[13px] text-muted">Use it every time, not only today</span>
                    <input type="checkbox" role="switch" className="switch" checked={alsoProgram} onChange={(e) => setAlsoProgram(e.target.checked)} />
                  </label>
                </div>
              )
            }
          />
          <span className="text-xs text-muted">Drag the handle to reorder. Swipe left to remove, right for swap choices.</span>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setQueue(false)
                setAdding(true)
              }}
            >
              + Add exercise
            </Button>
            <Button
              onClick={() => {
                setQueue(false)
                setSuggesting(true)
              }}
            >
              Suggest for gaps
            </Button>
          </div>
        </div>
      </Sheet>

      {current && <SetPad view={current} set={padSet} startOn={pad?.field ?? 'weight'} onClose={() => setPad(null)} onDeleted={(deleted) => setUndo({ text: 'Set deleted', run: () => void updateSet(deleted, { deleted: false }) })} />}

      {/* ---- exercise options ---- */}
      <Sheet open={menu && !!current} onClose={() => setMenu(false)}>
        {current && (
          <div className="scroll-y flex max-h-[76vh] flex-col gap-3.5 pb-3 [&>*]:shrink-0">
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-[22px] font-bold">{current.lift.name}</span>
              <span className="text-[13px] text-muted">{current.exercise ? `${groupLabels[current.exercise.group]} · ${equipLabels[current.exercise.equip]}` : ''}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Recommended swaps</Label>
              {alternativesFor(current.lift.exercise_key).map((k) => {
                const e = exercise(k)
                return (
                  <button
                    key={k}
                    onClick={() => {
                      doSwap(current, k)
                      setMenu(false)
                    }}
                    className="flex min-h-[56px] items-center justify-between gap-3 rounded-control border border-line bg-raised px-3.5 py-2 text-left"
                  >
                    <span className="text-[15px] font-semibold">{e.name}</span>
                    <span className="shrink-0 text-xs text-muted">{equipLabels[e.equip]}</span>
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
              <Button
                onClick={() => {
                  setSwapFor(current.lift.id)
                  setQuery('')
                  setMenu(false)
                  setAdding(true)
                }}
              >
                Choose any exercise
              </Button>
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
                className="flex h-[52px] w-full items-center border-b border-line px-3.5 text-[15px] text-danger"
                onClick={() => {
                  void updateLift(current.lift, { skipped: !current.lift.skipped })
                  setMenu(false)
                }}
              >
                {current.lift.skipped ? 'Bring back' : 'Skip today'}
              </button>
              <button
                className="flex h-[52px] w-full items-center px-3.5 text-[15px] text-danger"
                onClick={() => {
                  if (current.sets.some((x) => x.done) && !window.confirm(`Remove ${current.lift.name} and its logged sets from this workout?`)) return
                  void removeLift(current)
                  setPicked(null)
                  setMenu(false)
                }}
              >
                Remove from this workout
              </button>
            </div>
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              My note for this exercise, shown every time
              <input
                type="text"
                value={pinned}
                onChange={(e) => setPinned(e.target.value)}
                onBlur={() => {
                  if (pinned.trim() === pinnedNote) return
                  const notes = { ...(program.notes ?? {}) }
                  if (pinned.trim()) notes[current.lift.exercise_key] = pinned.trim().slice(0, 200)
                  else delete notes[current.lift.exercise_key]
                  void saveProgram(viewer, { notes })
                }}
                placeholder="Hook height, bench notch, grip width"
                className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              Note for today only
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (current.lift.note ?? '') && void updateLift(current.lift, { note: note.trim() || null })}
                placeholder="How it felt today"
                className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none focus:border-accent"
              />
            </label>
          </div>
        )}
      </Sheet>

      {/* ---- add an exercise, or swap the current one for anything in the library ---- */}
      <Sheet
        open={adding}
        onClose={() => {
          setAdding(false)
          setSwapFor(null)
        }}
      >
        <div className="flex h-[70vh] flex-col gap-3 pb-3">
          {swapTarget && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Swap {swapTarget.lift.name} for</span>
              <span className="text-xs text-muted">For today only. {swapTarget.exercise ? `${groupLabels[swapTarget.exercise.group]} exercises are listed first.` : ''}</span>
            </div>
          )}
          <label className="flex flex-col">
            <span className="sr-only">Search exercises</span>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all exercises" className="h-12 rounded-control border border-line bg-raised px-4 text-ink outline-none focus:border-accent" />
          </label>
          <div className="scroll-y min-h-0 flex-1 overflow-hidden rounded-control border border-line">
            {exercises
              .filter((e) => matchesQuery(e, query) && !lifts.some((v) => v.lift.exercise_key === e.key))
              .sort(
                (a, b) =>
                  Number(b.group === swapTarget?.exercise?.group) - Number(a.group === swapTarget?.exercise?.group) ||
                  Number(availableAt(gym, b)) - Number(availableAt(gym, a)) ||
                  Number(b.curated) - Number(a.curated) ||
                  a.name.localeCompare(b.name),
              )
              .slice(0, 80)
              .map((e) => (
                <button
                  key={e.key}
                  onClick={() => {
                    if (swapTarget) void swapExercise(swapTarget, e.key)
                    else void addExercise(session, e.key)
                    setAdding(false)
                    setSwapFor(null)
                    setQuery('')
                  }}
                  className="flex min-h-[52px] w-full items-center justify-between gap-3 border-b border-line bg-raised px-3.5 py-2 text-left last:border-b-0"
                >
                  <span className="text-[15px] font-medium">{e.name}</span>
                  <span className="shrink-0 text-right text-xs text-muted">
                    {groupLabels[e.group]} · {equipLabels[e.equip]}
                    {!availableAt(gym, e) && <span className="block text-warn">not at {gym.name}</span>}
                  </span>
                </button>
              ))}
          </div>
          <span className="text-center text-xs text-muted">Showing the best 80 matches. Search to find anything in the library.</span>
        </div>
      </Sheet>

      {/* ---- suggestions for muscle groups that are short this week ---- */}
      <Sheet open={suggesting} onClose={() => setSuggesting(false)}>
        <div className="scroll-y flex max-h-[76vh] flex-col gap-2.5 pb-3 [&>*]:shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[22px] font-bold">Fill the gaps</span>
            <span className="text-[13px] text-muted">Muscle groups that will still be under {WEEKLY_SET_TARGET} sets this week after this workout.</span>
          </div>
          {suggestions.length === 0 && <span className="rounded-control border border-line bg-raised p-3.5 text-sm text-muted">Nothing to add. This workout puts every muscle group on target for the week.</span>}
          {suggestions.map((g) => {
            const e = exercise(g.key)
            return (
              <button
                key={g.key}
                onClick={() => void addExercise(session, g.key)}
                className="flex min-h-[60px] items-center justify-between gap-3 rounded-control border border-line bg-raised px-3.5 py-2 text-left"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{e.name}</span>
                  <span className="text-xs text-muted">
                    {groupLabels[g.group]}: {Number.isInteger(g.sets) ? g.sets : g.sets.toFixed(1)} of {WEEKLY_SET_TARGET} sets this week · {equipLabels[e.equip]}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-accent">+ Add</span>
              </button>
            )
          })}
          <span className="text-xs text-muted">Worked out on this phone from your last 7 days, so it works without signal.</span>
        </div>
      </Sheet>

      {/* ---- finish ---- */}
      <Sheet open={finishing} onClose={() => setFinishing(false)}>
        <div className="flex flex-col gap-3 pb-3">
          <span className="font-display text-[22px] font-bold">{other ? 'Finish both workouts?' : 'Finish this workout?'}</span>
          <span className="text-sm text-muted">
            {remaining > 0 ? `${remaining} set${remaining === 1 ? ' is' : 's are'} not ticked off and will be left out of the record.` : 'Every set is done.'}
          </span>
          <Button
            variant="primary"
            onClick={() => {
              clearRest()
              const done = mine ?? session
              void (async () => {
                if (other) await finishSession(other, partnerProgram)
                await finishSession(session, program)
                navigate(`/done/${done.id}`, { replace: true })
              })()
            }}
          >
            Finish workout
          </Button>
          <Button onClick={() => setFinishing(false)}>Keep going</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (!window.confirm(other ? 'Discard both workouts? Nothing from either will be saved.' : 'Discard this workout? Nothing from it will be saved.')) return
              clearRest()
              void (async () => {
                if (other) await discardSession(other)
                await discardSession(session)
                navigate('/', { replace: true })
              })()
            }}
          >
            Discard workout
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
