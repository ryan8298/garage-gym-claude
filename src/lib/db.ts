import Dexie, { type Table } from 'dexie'

/**
 * The phone's own database. It is the source of truth: every screen reads
 * and writes here, and the sync engine copies changes to Supabase later.
 */

export interface SyncFields {
  id: string
  updated_at: string // client clock, decides last-write-wins
  synced_at?: string // server clock, only used as the pull cursor
  deleted: boolean
}

export interface Profile extends SyncFields {
  display_name: string
  weekly_target: number
  step_target: number
}

export interface DailyLog extends SyncFields {
  user_id: string
  log_date: string // local calendar date, yyyy-mm-dd
  body_weight: number | null
  steps: number | null
  sleep_hours: number | null
  energy: number | null
  soreness: number | null
  note: string | null
}

export interface WorkoutSession extends SyncFields {
  user_id: string
  template_key: string | null
  title: string
  local_date: string
  started_at: string
  finished_at: string | null
  block_phase: string | null
  block_week: number | null
  effort: number | null
  note: string | null
  /** Shared by the two sessions of a workout done together. */
  pair_id?: string | null
}

export interface SessionExercise extends SyncFields {
  session_id: string
  user_id: string
  exercise_key: string
  name: string
  position: number
  is_main: boolean
  superset_group: number | null
  measure: string
  target: unknown
  note: string | null
  skipped: boolean
}

export interface SetRow extends SyncFields {
  session_exercise_id: string
  session_id: string
  user_id: string
  position: number
  set_type: 'warmup' | 'normal' | 'drop' | 'failure'
  weight: number | null
  reps: number | null
  duration_seconds: number | null
  distance: number | null
  side: 'left' | 'right' | null
  reps_in_reserve: number | null
  done: boolean
  done_at: string | null
}

/** One row per user: their own choices on top of the shared program. */
export interface ProgramState extends SyncFields {
  data: {
    queueIndex: number
    /** Local date the first workout was started; blocks are counted from that week. */
    startedOn: string | null
    pullMain: 'pull_up' | 'lat_pulldown'
    ankleStrap: boolean
    partner: boolean
    pins: string[]
    bans: string[]
    mains: Record<string, string>
    /** YouTube links the user has added, by exercise key. */
    videos: Record<string, string>
    /** Let my partner see my body measurements. */
    shareMeasurements?: boolean
    /** Which push notifications I want. Missing means on. */
    notify?: { partnerWorkout?: boolean; reactions?: boolean; weekly?: boolean; nudge?: boolean }
    /** Pairs of each plate size we own, by size. Missing means one pair of each. */
    plates?: Record<string, number>
    /** Rest timer lengths in seconds. */
    rest?: { main: number; topup: number; accessory: number; finisher: number }
    /** My own priority order for each day's accessory slots. */
    slotOrder?: Partial<Record<'A' | 'B' | 'C' | 'D', number[]>>
    /** The first-run setup has been completed. */
    onboarded?: boolean
    /** The AI coach is switched on. Missing means on. */
    coach?: boolean
    /** My own note for an exercise, shown every time I do it. By exercise key. */
    notes?: Record<string, string>
    /** The places I train and what each has. Missing means my home gym and a standard public gym. */
    gyms?: Gym[]
    /** The gym I am training at now. */
    gym?: string
    /** Workouts I have named and saved to reuse. */
    routines?: Routine[]
  }
}

export interface Gym {
  id: string
  name: string
  kind: 'home' | 'public'
  /** Equipment tags this place has. Bodyweight is always available. */
  equipment: string[]
  barbell: number
  smith: number
  plates: Record<string, number>
  dumbbells: { min: number; max: number; step: number }
  smithLimit?: number | null
}

export interface Routine {
  id: string
  name: string
  lifts: { key: string; kind: string; role: string; sets: number; low: number; high: number; unit: 'reps' | 'sec'; eachSide: boolean; superset: number | null }[]
}

export interface CardioEntry extends SyncFields {
  user_id: string
  log_date: string
  kind: string
  minutes: number | null
  distance: number | null
}

export interface BodyMeasurement extends SyncFields {
  user_id: string
  measured_on: string
  waist: number | null
  chest: number | null
  hips: number | null
  arm: number | null
  thigh: number | null
}

export interface Goal extends SyncFields {
  user_id: string
  kind: 'body_weight' | 'lift'
  exercise_key: string | null
  target_value: number
  target_date: string | null
  start_value: number | null
  start_date: string
}

export interface FeedReaction extends SyncFields {
  user_id: string
  session_id: string
}

export interface ProgressPhoto extends SyncFields {
  user_id: string
  taken_on: string
  path: string
}

export interface CoachMessage extends SyncFields {
  user_id: string
  at: string
  role: 'user' | 'coach'
  kind: 'chat' | 'debrief' | 'weekly'
  body: string
  /** Proposed program changes, each with whether it was accepted, rejected or is still open. */
  proposals: unknown[]
  quick_workout: unknown | null
  session_id: string | null
}

export interface OutboxEntry {
  key: string // "<table>:<id>", so many edits to one row are one entry
  table: SyncTable
  id: string
  queued_at: number
}

export interface MetaEntry {
  key: string
  value: string
}

/** Parents before children, so a set is never pushed before its session. */
export const SYNC_TABLES = ['profiles', 'program_state', 'daily_logs', 'cardio_entries', 'body_measurements', 'goals', 'workout_sessions', 'session_exercises', 'sets', 'feed_reactions', 'progress_photos', 'coach_messages'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export class GymDB extends Dexie {
  profiles!: Table<Profile, string>
  daily_logs!: Table<DailyLog, string>
  workout_sessions!: Table<WorkoutSession, string>
  session_exercises!: Table<SessionExercise, string>
  sets!: Table<SetRow, string>
  program_state!: Table<ProgramState, string>
  cardio_entries!: Table<CardioEntry, string>
  body_measurements!: Table<BodyMeasurement, string>
  goals!: Table<Goal, string>
  feed_reactions!: Table<FeedReaction, string>
  progress_photos!: Table<ProgressPhoto, string>
  coach_messages!: Table<CoachMessage, string>
  outbox!: Table<OutboxEntry, string>
  meta!: Table<MetaEntry, string>

  constructor(name = 'garage-gym') {
    super(name)
    this.version(1).stores({
      profiles: 'id',
      daily_logs: 'id, user_id, log_date, [user_id+log_date]',
      workout_sessions: 'id, user_id, local_date, [user_id+local_date]',
      session_exercises: 'id, session_id, user_id',
      sets: 'id, session_exercise_id, session_id, user_id',
      outbox: 'key, table',
      meta: 'key',
    })
    this.version(2).stores({ program_state: 'id' })
    this.version(3).stores({ session_exercises: 'id, session_id, user_id, [user_id+exercise_key]' })
    this.version(4).stores({ cardio_entries: 'id, user_id, [user_id+log_date]', body_measurements: 'id, user_id', goals: 'id, user_id' })
    this.version(5).stores({ feed_reactions: 'id, user_id, session_id', progress_photos: 'id, user_id' })
    this.version(6).stores({ coach_messages: 'id, user_id' })
  }
}

export const db = new GymDB()

let lastStamp = 0
/** Timestamps that always move forward, even if two writes share a millisecond. */
export function stamp(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1)
  return new Date(lastStamp).toISOString()
}

/**
 * Save a row and queue it for sync in one transaction. Either both happen or
 * neither does, so nothing shown as saved can be missing from the outbox.
 */
export async function save<T extends SyncFields>(
  database: GymDB,
  table: SyncTable,
  row: Omit<T, 'updated_at' | 'deleted' | 'synced_at'> & { deleted?: boolean },
): Promise<T> {
  const full = { ...row, deleted: row.deleted ?? false, updated_at: stamp() } as unknown as T
  await database.transaction('rw', database.table(table), database.outbox, async () => {
    await database.table(table).put(full)
    await database.outbox.put({ key: `${table}:${full.id}`, table, id: full.id, queued_at: Date.now() })
  })
  return full
}

export async function clearLocalData(database: GymDB = db) {
  await Promise.all(database.tables.map((t) => t.clear()))
}
