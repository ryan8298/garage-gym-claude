import { useLiveQuery } from 'dexie-react-hooks'
import { db, save, type Routine, type SessionExercise, type SetRow, type WorkoutSession } from './db'
import { localDate } from './dates'
import type { PlannedLift, SessionPlan } from './engine'
import { exercise, hasExercise, type Exercise } from './exercises'
import { loadModeFor, warmupLoads } from './plates'
import { estimatedMax, suggest, type PastSession, type Suggestion } from './progression'
import { saveProgram, type ProgramData } from './programState'
import { notify } from './push'
import { requestSync } from './syncRunner'

/** What a session exercise was planned as. Stored with it, so history never depends on the current program. */
export interface LiftTarget {
  kind: PlannedLift['kind']
  role: string
  sets: number
  low: number
  high: number
  unit: 'reps' | 'sec'
  eachSide: boolean
  note?: string
  /** Why these numbers were suggested. */
  hint?: string
  /** Reps left in the tank on the last set, once the user says. */
  rir?: number
}

const uuid = () => crypto.randomUUID()
const targetOf = (x: SessionExercise) => x.target as LiftTarget

// ---------- history ----------

/** The most recent finished sessions of an exercise for a user, newest first. Working sets only. */
export async function history(userId: string, key: string, limit = 2, excludeSession?: string): Promise<PastSession[]> {
  const rows = await db.session_exercises.where('[user_id+exercise_key]').equals([userId, key]).toArray()
  const usable = rows.filter((r) => !r.deleted && !r.skipped && r.session_id !== excludeSession)
  if (usable.length === 0) return []
  const sessions = (await db.workout_sessions.bulkGet(usable.map((r) => r.session_id))).filter((s): s is WorkoutSession => !!s && !s.deleted && !!s.finished_at)
  sessions.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
  const out: PastSession[] = []
  for (const s of sessions.slice(0, limit)) {
    const lift = usable.find((r) => r.session_id === s.id)!
    const sets = (await db.sets.where('session_exercise_id').equals(lift.id).toArray())
      .filter((x) => x.done && !x.deleted && x.set_type !== 'warmup')
      .sort((a, b) => a.position - b.position)
    if (sets.length === 0) continue
    out.push({ date: s.local_date, rir: targetOf(lift).rir ?? null, sets: sets.map((x) => ({ weight: x.weight, reps: x.reps, seconds: x.duration_seconds })) })
  }
  return out
}

export function describeSets(p: PastSession | undefined): string {
  if (!p) return 'No history yet'
  const first = p.sets[0]
  if (first.seconds !== null && first.reps === null) return p.sets.map((s) => `${s.seconds}s`).join(', ')
  const weight = first.weight
  const sameWeight = p.sets.every((s) => s.weight === weight)
  if (sameWeight) return `${weight ? `${weight} × ` : ''}${p.sets.map((s) => s.reps).join(', ')}`
  return p.sets.map((s) => `${s.weight}×${s.reps}`).join(', ')
}

async function suggestionFor(userId: string, e: Exercise, t: Pick<LiftTarget, 'low' | 'high' | 'unit'>, excludeSession?: string) {
  const past = await history(userId, e.key, 2, excludeSession)
  return { past, suggestion: suggest({ history: past, low: t.low, high: t.high, unit: t.unit, mode: loadModeFor(e), today: localDate() }) }
}

function blankSet(lift: SessionExercise, position: number, s: Suggestion, type: SetRow['set_type'] = 'normal'): Omit<SetRow, 'updated_at' | 'deleted'> {
  return {
    id: uuid(),
    session_exercise_id: lift.id,
    session_id: lift.session_id,
    user_id: lift.user_id,
    position,
    set_type: type,
    weight: s.weight,
    reps: s.reps,
    duration_seconds: s.seconds,
    distance: null,
    side: null,
    reps_in_reserve: null,
    done: false,
    done_at: null,
  }
}

// ---------- starting ----------

async function addLift(session: WorkoutSession, key: string, position: number, t: Omit<LiftTarget, 'hint'>, superset: number | null): Promise<void> {
  const e = exercise(key)
  const { suggestion } = await suggestionFor(session.user_id, e, t, session.id)
  const lift = await save<SessionExercise>(db, 'session_exercises', {
    id: uuid(),
    session_id: session.id,
    user_id: session.user_id,
    exercise_key: key,
    name: e.name,
    position,
    is_main: t.kind === 'main',
    superset_group: superset,
    measure: e.measure,
    target: { ...t, hint: suggestion.text } satisfies LiftTarget,
    note: null,
    skipped: false,
  })
  for (let i = 0; i < t.sets; i++) await save<SetRow>(db, 'sets', blankSet(lift, i, suggestion))
}

export async function startSession(userId: string, plan: SessionPlan | null, program: ProgramData, opts: { date?: string; title?: string; pairId?: string } = {}): Promise<string> {
  // A past date means the workout is being written down after the fact.
  const now = opts.date && opts.date !== localDate() ? new Date(`${opts.date}T12:00:00`) : new Date()
  const session = await save<WorkoutSession>(db, 'workout_sessions', {
    id: uuid(),
    user_id: userId,
    template_key: plan?.day ?? null,
    title: opts.title ?? plan?.title ?? 'Freestyle workout',
    local_date: localDate(now),
    started_at: now.toISOString(),
    finished_at: null,
    block_phase: plan?.phase ?? null,
    block_week: plan?.week ?? null,
    effort: null,
    note: null,
    pair_id: opts.pairId ?? null,
  })
  for (const [i, l] of (plan?.lifts ?? []).entries()) {
    await addLift(session, l.key, i, { kind: l.kind, role: l.role, sets: l.sets, low: l.low, high: l.high, unit: l.unit, eachSide: l.eachSide, note: l.note }, l.superset ?? null)
  }
  // Blocks are counted from the week of the very first workout.
  if (!program.startedOn && !opts.date) await saveProgram(userId, { startedOn: localDate(now) })
  requestSync()
  return session.id
}

/**
 * Start a workout for two people on one phone: one session each, linked, so
 * each keeps their own weights, history and records.
 */
export async function startPair(me: { id: string; plan: SessionPlan; program: ProgramData }, partner: { id: string; plan: SessionPlan; program: ProgramData }): Promise<void> {
  const pairId = uuid()
  await startSession(partner.id, partner.plan, partner.program, { pairId })
  await startSession(me.id, me.plan, me.program, { pairId })
}

/** The other person's open session in a shared workout, if there is one. */
export function usePairedSession(session: WorkoutSession | null | undefined) {
  return useLiveQuery(async () => {
    if (!session?.pair_id) return null
    const all = await db.workout_sessions.filter((s) => s.pair_id === session.pair_id && s.id !== session.id && !s.finished_at && !s.deleted).toArray()
    return all[0] ?? null
  }, [session?.id, session?.pair_id])
}

/** Add a planned lift to a session. Used for workouts built outside the standard program. */
export const addLiftTo = (session: WorkoutSession, key: string, position: number, t: Omit<LiftTarget, 'hint'>) => addLift(session, key, position, t, null)

/** Start a new workout with the same exercises as a past one, with fresh suggestions. */
export async function repeatSession(userId: string, past: { session: WorkoutSession; lifts: { lift: SessionExercise }[] }, program: ProgramData): Promise<string> {
  const id = await startSession(userId, null, program, { title: past.session.title })
  const session = (await db.workout_sessions.get(id))!
  for (const [i, { lift }] of past.lifts.entries()) {
    if (!hasExercise(lift.exercise_key)) continue
    const { hint: _h, rir: _r, ...t } = targetOf(lift)
    await addLift(session, lift.exercise_key, i, t, lift.superset_group)
  }
  requestSync()
  return id
}

/** Add an exercise to a running session (freestyle, or an extra accessory). */
export async function addExercise(session: WorkoutSession, key: string): Promise<void> {
  const e = exercise(key)
  const count = await db.session_exercises.where('session_id').equals(session.id).count()
  const timed = e.measure === 'time' || e.measure === 'carry'
  await addLift(session, key, count, { kind: 'accessory', role: 'Added', sets: 2, low: timed ? 20 : 10, high: timed ? 45 : 15, unit: timed ? 'sec' : 'reps', eachSide: e.side }, null)
  requestSync()
}

// ---------- during ----------

export function useActiveSession(userId: string | undefined) {
  return useLiveQuery(async () => {
    if (!userId) return null
    const open = await db.workout_sessions.where('user_id').equals(userId).filter((s) => !s.finished_at && !s.deleted).toArray()
    return open.sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0] ?? null
  }, [userId])
}

export interface LiftView {
  lift: SessionExercise
  target: LiftTarget
  exercise: Exercise | null
  sets: SetRow[]
}

export function useSessionLifts(sessionId: string | undefined): LiftView[] | undefined {
  return useLiveQuery(async () => {
    if (!sessionId) return []
    const lifts = (await db.session_exercises.where('session_id').equals(sessionId).toArray()).filter((l) => !l.deleted).sort((a, b) => a.position - b.position)
    const sets = (await db.sets.where('session_id').equals(sessionId).toArray()).filter((s) => !s.deleted)
    return lifts.map((lift) => ({
      lift,
      target: targetOf(lift),
      exercise: hasExercise(lift.exercise_key) ? exercise(lift.exercise_key) : null,
      sets: sets.filter((s) => s.session_exercise_id === lift.id).sort((a, b) => a.position - b.position),
    }))
  }, [sessionId])
}

type SetPatch = Partial<Pick<SetRow, 'weight' | 'reps' | 'duration_seconds' | 'set_type' | 'done' | 'done_at' | 'deleted' | 'position'>>
export async function updateSet(set: SetRow, patch: SetPatch): Promise<SetRow> {
  const { updated_at: _u, synced_at: _s, ...rest } = set
  const saved = await save<SetRow>(db, 'sets', { ...rest, ...patch })
  requestSync(1500)
  return saved
}

export async function updateLift(lift: SessionExercise, patch: Partial<Pick<SessionExercise, 'note' | 'skipped' | 'deleted' | 'target' | 'exercise_key' | 'name' | 'measure' | 'position'>>): Promise<void> {
  const { updated_at: _u, synced_at: _s, ...rest } = lift
  await save<SessionExercise>(db, 'session_exercises', { ...rest, ...patch })
  requestSync(1500)
}

export async function addSet(view: LiftView): Promise<void> {
  const last = view.sets[view.sets.length - 1]
  const copy: Suggestion = { weight: last?.weight ?? null, reps: last?.reps ?? view.target.low, seconds: last?.duration_seconds ?? null, reason: 'first', text: '' }
  await save<SetRow>(db, 'sets', blankSet(view.lift, (last?.position ?? -1) + 1, copy))
  requestSync(1500)
}

/** Move a lift one place earlier or later in the workout. */
export async function moveLift(lifts: LiftView[], view: LiftView, dir: -1 | 1): Promise<void> {
  const i = lifts.indexOf(view)
  const other = lifts[i + dir]
  if (i < 0 || !other) return
  await updateLift(view.lift, { position: other.lift.position })
  await updateLift(other.lift, { position: view.lift.position })
}

/** Save a new order for the lifts of a workout. */
export async function reorderLifts(lifts: LiftView[], ids: string[]): Promise<void> {
  for (const [position, id] of ids.entries()) {
    const view = lifts.find((v) => v.lift.id === id)
    if (view && view.lift.position !== position) await updateLift(view.lift, { position })
  }
}

/** Bring back a lift that was just removed, with the sets it had. */
export async function restoreLift(view: LiftView): Promise<void> {
  await updateLift(view.lift, { deleted: false })
  for (const s of view.sets) await updateSet(s, { deleted: false })
}

/** Take a lift out of the workout, with its sets. */
export async function removeLift(view: LiftView): Promise<void> {
  for (const s of view.sets) await updateSet(s, { deleted: true })
  await updateLift(view.lift, { deleted: true })
}

// ---------- routines ----------

/** Save the exercises of a workout under a name, to start again later. */
export async function saveRoutine(userId: string, program: ProgramData, name: string, lifts: { lift: SessionExercise }[]): Promise<void> {
  const routine: Routine = {
    id: uuid(),
    name: name.trim().slice(0, 40),
    lifts: lifts
      .filter(({ lift }) => hasExercise(lift.exercise_key))
      .map(({ lift }) => {
        const t = targetOf(lift)
        return { key: lift.exercise_key, kind: t.kind, role: t.role, sets: t.sets, low: t.low, high: t.high, unit: t.unit, eachSide: t.eachSide, superset: lift.superset_group }
      }),
  }
  await saveProgram(userId, { routines: [...(program.routines ?? []).filter((r) => r.name !== routine.name), routine] })
}

export async function startRoutine(userId: string, program: ProgramData, routine: Routine): Promise<void> {
  const id = await startSession(userId, null, program, { title: routine.name })
  const session = (await db.workout_sessions.get(id))!
  for (const [i, l] of routine.lifts.entries()) {
    if (!hasExercise(l.key)) continue
    await addLift(session, l.key, i, { kind: l.kind as LiftTarget['kind'], role: l.role, sets: l.sets, low: l.low, high: l.high, unit: l.unit, eachSide: l.eachSide }, l.superset)
  }
  requestSync()
}

/** Put ramp-up sets in front of the working sets. Returns false if no working weight is set yet. */
export async function addWarmups(view: LiftView): Promise<boolean> {
  if (!view.exercise) return false
  const working = view.sets.find((s) => s.set_type !== 'warmup' && s.weight)?.weight
  if (!working) return false
  const loads = warmupLoads(loadModeFor(view.exercise), working)
  if (loads.length === 0) return false
  const first = Math.min(0, ...view.sets.map((s) => s.position))
  const reps = [8, 5, 3]
  for (const [i, weight] of loads.entries()) {
    await save<SetRow>(db, 'sets', blankSet(view.lift, first - loads.length + i, { weight, reps: reps[i] ?? 3, seconds: null, reason: 'first', text: '' }, 'warmup'))
  }
  requestSync(1500)
  return true
}

/** Replace a lift with another exercise, with fresh suggestions for the sets not yet done. */
export async function swapExercise(view: LiftView, key: string): Promise<void> {
  const e = exercise(key)
  const { suggestion } = await suggestionFor(view.lift.user_id, e, view.target, view.lift.session_id)
  await updateLift(view.lift, { exercise_key: key, name: e.name, measure: e.measure, target: { ...view.target, eachSide: e.side, hint: suggestion.text } })
  for (const s of view.sets) {
    if (s.done) continue
    if (s.set_type === 'warmup') await updateSet(s, { deleted: true })
    else await updateSet(s, { weight: suggestion.weight, reps: suggestion.reps, duration_seconds: suggestion.seconds })
  }
}

/**
 * Is this set a personal record? Compared with every earlier finished
 * session of the exercise. The first time an exercise is done is not a PR.
 */
export async function isRecord(userId: string, key: string, set: SetRow): Promise<boolean> {
  if (set.set_type === 'warmup') return false
  const rows = (await db.session_exercises.where('[user_id+exercise_key]').equals([userId, key]).toArray()).filter((r) => !r.deleted && r.session_id !== set.session_id)
  if (rows.length === 0) return false
  const earlier = (await db.sets.where('session_exercise_id').anyOf(rows.map((r) => r.id)).toArray()).filter((s) => s.done && !s.deleted && s.set_type !== 'warmup')
  if (earlier.length === 0) return false
  const score = (s: SetRow) => (s.reps !== null ? estimatedMax(Math.max(s.weight ?? 0, 1), s.reps) + (s.weight ? 0 : s.reps) : (s.duration_seconds ?? 0) + (s.weight ?? 0) * 1000)
  return score(set) > Math.max(...earlier.map(score))
}

// ---------- finishing ----------

export interface Summary {
  minutes: number
  volume: number
  sets: number
  records: { name: string; text: string }[]
}

export async function summarize(session: WorkoutSession): Promise<Summary> {
  const lifts = (await db.session_exercises.where('session_id').equals(session.id).toArray()).filter((l) => !l.deleted)
  const sets = (await db.sets.where('session_id').equals(session.id).toArray()).filter((s) => s.done && !s.deleted && s.set_type !== 'warmup')
  const end = session.finished_at ? Date.parse(session.finished_at) : Date.now()
  const records: Summary['records'] = []
  for (const lift of lifts) {
    const mine = sets.filter((s) => s.session_exercise_id === lift.id)
    let best: SetRow | null = null
    for (const s of mine) if (await isRecord(session.user_id, lift.exercise_key, s)) best = s
    if (best) records.push({ name: lift.name, text: best.reps !== null ? `${best.weight ? `${best.weight} × ` : ''}${best.reps}` : `${best.duration_seconds}s` })
  }
  return {
    minutes: localDate(new Date(end)) === session.local_date ? Math.max(1, Math.round((end - Date.parse(session.started_at)) / 60_000)) : 0,
    volume: Math.round(sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)),
    sets: sets.length,
    records,
  }
}

async function patchSession(session: WorkoutSession, patch: Partial<Pick<WorkoutSession, 'finished_at' | 'effort' | 'note' | 'deleted'>>) {
  const { updated_at: _u, synced_at: _s, ...rest } = session
  return save<WorkoutSession>(db, 'workout_sessions', { ...rest, ...patch })
}

/** Close the session. Sets never marked done are removed; the rotation moves on. */
export async function finishSession(session: WorkoutSession, program: ProgramData): Promise<void> {
  const sets = await db.sets.where('session_id').equals(session.id).toArray()
  for (const s of sets) if (!s.done && !s.deleted) await updateSet(s, { deleted: true })
  await patchSession(session, { finished_at: new Date().toISOString() })
  if (session.template_key) await saveProgram(session.user_id, { queueIndex: program.queueIndex + 1 })
  requestSync(0)
  // Tell the other person, once the workout has had a moment to upload. Not for workouts logged after the fact.
  if (session.local_date === localDate() && !session.pair_id) setTimeout(() => void notify('workout_finished', session.id), 4000)
}

export async function rateSession(session: WorkoutSession, effort: number | null, note: string | null) {
  await patchSession(session, { effort, note })
  requestSync(0)
}

/** Throw the session away entirely. */
export async function discardSession(session: WorkoutSession): Promise<void> {
  const sets = await db.sets.where('session_id').equals(session.id).toArray()
  for (const s of sets) if (!s.deleted) await updateSet(s, { deleted: true })
  const lifts = await db.session_exercises.where('session_id').equals(session.id).toArray()
  for (const l of lifts) if (!l.deleted) await updateLift(l, { deleted: true })
  await patchSession(session, { deleted: true, finished_at: session.finished_at ?? new Date().toISOString() })
  requestSync(0)
}
