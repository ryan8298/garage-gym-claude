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
  }
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
export const SYNC_TABLES = ['profiles', 'program_state', 'daily_logs', 'workout_sessions', 'session_exercises', 'sets'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export class GymDB extends Dexie {
  profiles!: Table<Profile, string>
  daily_logs!: Table<DailyLog, string>
  workout_sessions!: Table<WorkoutSession, string>
  session_exercises!: Table<SessionExercise, string>
  sets!: Table<SetRow, string>
  program_state!: Table<ProgramState, string>
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
