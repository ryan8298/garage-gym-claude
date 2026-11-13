import { useLiveQuery } from 'dexie-react-hooks'
import { db, save, type BodyMeasurement, type CardioEntry, type DailyLog, type Goal, type SessionExercise, type SetRow, type WorkoutSession } from './db'
import { addDays, localDate, weekStart } from './dates'
import { exercise, hasExercise, muscleCredit } from './exercises'
import { estimatedMax } from './progression'
import type { Point } from './stats'
import { requestSync } from './syncRunner'

export interface DoneLift {
  lift: SessionExercise
  /** Ticked, non-warm-up sets. */
  sets: SetRow[]
}
export interface DoneSession {
  session: WorkoutSession
  lifts: DoneLift[]
  volume: number
  setCount: number
  /** Null for a workout logged after the fact. */
  minutes: number | null
}

export async function loadSessions(userId: string): Promise<DoneSession[]> {
  const sessions = (await db.workout_sessions.where('user_id').equals(userId).toArray()).filter((s) => s.finished_at && !s.deleted)
  if (sessions.length === 0) return []
  const ids = sessions.map((s) => s.id)
  const lifts = (await db.session_exercises.where('session_id').anyOf(ids).toArray()).filter((l) => !l.deleted && !l.skipped)
  const sets = (await db.sets.where('session_id').anyOf(ids).toArray()).filter((s) => s.done && !s.deleted && s.set_type !== 'warmup')
  return sessions
    .map((session) => {
      const mine = lifts
        .filter((l) => l.session_id === session.id)
        .sort((a, b) => a.position - b.position)
        .map((lift) => ({ lift, sets: sets.filter((s) => s.session_exercise_id === lift.id).sort((a, b) => a.position - b.position) }))
        .filter((l) => l.sets.length > 0)
      const all = mine.flatMap((l) => l.sets)
      const sameDay = localDate(new Date(session.finished_at!)) === session.local_date
      return {
        session,
        lifts: mine,
        volume: Math.round(all.reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0)),
        setCount: all.length,
        minutes: sameDay ? Math.max(1, Math.round((Date.parse(session.finished_at!) - Date.parse(session.started_at)) / 60_000)) : null,
      }
    })
    .sort((a, b) => (a.session.local_date < b.session.local_date ? 1 : a.session.local_date > b.session.local_date ? -1 : a.session.started_at < b.session.started_at ? 1 : -1))
}

export const useSessions = (userId: string) => useLiveQuery(() => loadSessions(userId), [userId])
export const useLogs = (userId: string) => useLiveQuery(async () => (await db.daily_logs.where('user_id').equals(userId).toArray()).filter((l) => !l.deleted), [userId], [] as DailyLog[])
export const useCardio = (userId: string) => useLiveQuery(async () => (await db.cardio_entries.where('user_id').equals(userId).toArray()).filter((c) => !c.deleted), [userId], [] as CardioEntry[])
export const useGoals = (userId: string) => useLiveQuery(async () => (await db.goals.where('user_id').equals(userId).toArray()).filter((g) => !g.deleted), [userId], [] as Goal[])
export const useMeasurements = (userId: string) =>
  useLiveQuery(async () => (await db.body_measurements.where('user_id').equals(userId).toArray()).filter((m) => !m.deleted).sort((a, b) => (a.measured_on < b.measured_on ? 1 : -1)), [userId], [] as BodyMeasurement[])

// ---------- weekly numbers ----------

export interface WeekStats {
  workouts: number
  volume: number
  sets: number
  setsByGroup: Record<string, number>
  cardioMinutes: number
  miles: number
  avgSteps: number | null
}

export function weekStats(start: string, sessions: DoneSession[], logs: DailyLog[], cardio: CardioEntry[]): WeekStats {
  const end = addDays(start, 6)
  const inWeek = (d: string) => d >= start && d <= end
  const mine = sessions.filter((s) => inWeek(s.session.local_date))
  const setsByGroup: Record<string, number> = {}
  for (const s of mine)
    for (const l of s.lifts) {
      if (!hasExercise(l.lift.exercise_key)) continue
      // A full set for the main muscle, half for each one that helps.
      for (const [g, share] of Object.entries(muscleCredit(exercise(l.lift.exercise_key)))) setsByGroup[g] = (setsByGroup[g] ?? 0) + l.sets.length * share
    }
  const steps = logs.filter((l) => inWeek(l.log_date) && l.steps !== null).map((l) => l.steps as number)
  const c = cardio.filter((x) => inWeek(x.log_date))
  return {
    workouts: mine.length,
    volume: mine.reduce((n, s) => n + s.volume, 0),
    sets: mine.reduce((n, s) => n + s.setCount, 0),
    setsByGroup,
    cardioMinutes: Math.round(c.reduce((n, x) => n + (x.minutes ?? 0), 0)),
    miles: Number(c.reduce((n, x) => n + (x.distance ?? 0), 0).toFixed(1)),
    avgSteps: steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null,
  }
}

export const thisWeek = () => weekStart(localDate())

// ---------- per-lift history ----------

const best = (sets: SetRow[]) => sets.filter((s) => s.reps !== null && (s.weight ?? 0) > 0).sort((a, b) => estimatedMax(b.weight!, b.reps!) - estimatedMax(a.weight!, a.reps!))[0]

/** Estimated one-rep max of the best set in each session, oldest first. */
export function liftSeries(sessions: DoneSession[], key: string): (Point & { weight: number; reps: number })[] {
  const out: (Point & { weight: number; reps: number })[] = []
  for (const s of sessions) {
    const top = best(s.lifts.filter((l) => l.lift.exercise_key === key).flatMap((l) => l.sets))
    if (top) out.push({ date: s.session.local_date, value: Math.round(estimatedMax(top.weight!, top.reps!)), weight: top.weight!, reps: top.reps! })
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Exercises with weighted history, most recently trained first. */
export function liftsWithHistory(sessions: DoneSession[]): { key: string; name: string }[] {
  const seen = new Map<string, string>()
  for (const s of sessions) for (const l of s.lifts) if (!seen.has(l.lift.exercise_key) && best(l.sets)) seen.set(l.lift.exercise_key, l.lift.name)
  return [...seen].map(([key, name]) => ({ key, name }))
}

export function records(sessions: DoneSession[]): { key: string; name: string; weight: number; reps: number; date: string; max: number }[] {
  return liftsWithHistory(sessions)
    .map(({ key, name }) => {
      const top = [...liftSeries(sessions, key)].sort((a, b) => b.value - a.value)[0]
      return { key, name, weight: top.weight, reps: top.reps, date: top.date, max: top.value }
    })
    .sort((a, b) => b.max - a.max)
}

// ---------- writes ----------

const strip = <T extends { updated_at: string; synced_at?: string }>(row: T) => {
  const { updated_at: _u, synced_at: _s, ...rest } = row
  return rest
}

export async function saveCardio(userId: string, entry: { date: string; kind: string; minutes: number | null; distance: number | null }) {
  await save<CardioEntry>(db, 'cardio_entries', { id: crypto.randomUUID(), user_id: userId, log_date: entry.date, kind: entry.kind, minutes: entry.minutes, distance: entry.distance })
  requestSync()
}
export async function deleteCardio(entry: CardioEntry) {
  await save<CardioEntry>(db, 'cardio_entries', { ...strip(entry), deleted: true })
  requestSync()
}

type Tape = Pick<BodyMeasurement, 'waist' | 'chest' | 'hips' | 'arm' | 'thigh'>
export async function saveMeasurement(userId: string, date: string, patch: Partial<Tape>) {
  const id = `${userId}_${date}`
  const current = await db.body_measurements.get(id)
  await save<BodyMeasurement>(db, 'body_measurements', {
    id,
    user_id: userId,
    measured_on: date,
    waist: current?.waist ?? null,
    chest: current?.chest ?? null,
    hips: current?.hips ?? null,
    arm: current?.arm ?? null,
    thigh: current?.thigh ?? null,
    ...patch,
  })
  requestSync()
}

export async function addGoal(userId: string, goal: Pick<Goal, 'kind' | 'exercise_key' | 'target_value' | 'target_date' | 'start_value'>) {
  await save<Goal>(db, 'goals', { id: crypto.randomUUID(), user_id: userId, start_date: localDate(), ...goal })
  requestSync()
}
export async function deleteGoal(goal: Goal) {
  await save<Goal>(db, 'goals', { ...strip(goal), deleted: true })
  requestSync()
}
