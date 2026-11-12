import { useLiveQuery } from 'dexie-react-hooks'
import { db, save, type DailyLog, type Profile } from './db'
import { requestSync } from './syncRunner'

export const dailyLogId = (userId: string, date: string) => `${userId}_${date}`

export function useProfile(userId: string | undefined) {
  return useLiveQuery(() => (userId ? db.profiles.get(userId) : undefined), [userId])
}

export async function saveProfile(userId: string, patch: Partial<Pick<Profile, 'display_name' | 'weekly_target' | 'step_target'>>) {
  const current = await db.profiles.get(userId)
  await save<Profile>(db, 'profiles', {
    id: userId,
    display_name: current?.display_name ?? '',
    weekly_target: current?.weekly_target ?? 4,
    step_target: current?.step_target ?? 8000,
    ...patch,
  })
  requestSync()
}

export function useDailyLog(userId: string, date: string) {
  return useLiveQuery(() => db.daily_logs.get(dailyLogId(userId, date)), [userId, date])
}

type LogFields = Pick<DailyLog, 'body_weight' | 'steps' | 'sleep_hours' | 'energy' | 'soreness' | 'note'>

export async function saveDailyLog(userId: string, date: string, patch: Partial<LogFields>) {
  const id = dailyLogId(userId, date)
  const current = await db.daily_logs.get(id)
  await save<DailyLog>(db, 'daily_logs', {
    id,
    user_id: userId,
    log_date: date,
    body_weight: current?.body_weight ?? null,
    steps: current?.steps ?? null,
    sleep_hours: current?.sleep_hours ?? null,
    energy: current?.energy ?? null,
    soreness: current?.soreness ?? null,
    note: current?.note ?? null,
    ...patch,
  })
  requestSync()
}

/** Most recent body weight on or before a date, for prefilling. */
export async function lastBodyWeight(userId: string, onOrBefore: string): Promise<number | null> {
  const rows = await db.daily_logs.where('[user_id+log_date]').between([userId, '0000-00-00'], [userId, onOrBefore], true, true).reverse().toArray()
  return rows.find((r) => r.body_weight !== null && !r.deleted)?.body_weight ?? null
}
