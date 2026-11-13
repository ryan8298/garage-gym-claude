import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, save, type ProgramState } from './db'
import { daysBetween, localDate, weekStart, addDays } from './dates'
import { blockPosition, planSession, type SessionPlan, type UserSettings } from './engine'
import { exercise } from './exercises'
import { DAY_ORDER, type DayKey } from './program'
import { requestSync } from './syncRunner'
import { activeGym } from './gym'

export type ProgramData = ProgramState['data']

export const defaultProgram: ProgramData = {
  queueIndex: 0,
  startedOn: null,
  pullMain: 'lat_pulldown',
  ankleStrap: true,
  partner: true,
  pins: [],
  bans: [],
  mains: {},
  videos: {},
}

export function useProgram(userId: string): ProgramData {
  const row = useLiveQuery(() => db.program_state.get(userId), [userId])
  return useMemo(() => ({ ...defaultProgram, ...(row?.data ?? {}) }), [row])
}

export async function saveProgram(userId: string, patch: Partial<ProgramData>) {
  const current = await db.program_state.get(userId)
  await save<ProgramState>(db, 'program_state', { id: userId, data: { ...defaultProgram, ...(current?.data ?? {}), ...patch } })
  requestSync()
}

export const settingsOf = (p: ProgramData): UserSettings => ({
  pullMain: p.pullMain,
  ankleStrap: p.ankleStrap,
  partner: p.partner,
  pins: p.pins,
  bans: p.bans,
  mains: p.mains,
  slotOrder: p.slotOrder,
  equipment: activeGym(p).equipment,
})

export const nextDay = (p: ProgramData): DayKey => DAY_ORDER[((p.queueIndex % 4) + 4) % 4]

/** Hard sets per muscle group over the last 7 days, from what was actually logged. */
export function useSetsByGroup(userId: string): Record<string, number> {
  const today = localDate()
  return useLiveQuery(
    async () => {
      const sessions = await db.workout_sessions.where('[user_id+local_date]').between([userId, addDays(today, -6)], [userId, today], true, true).toArray()
      const ids = sessions.filter((s) => !s.deleted).map((s) => s.id)
      if (ids.length === 0) return {}
      const lifts = await db.session_exercises.where('session_id').anyOf(ids).toArray()
      const groupOf = new Map(lifts.map((l) => [l.id, l.exercise_key]))
      const sets = await db.sets.where('session_id').anyOf(ids).toArray()
      const totals: Record<string, number> = {}
      for (const s of sets) {
        if (!s.done || s.deleted || s.set_type === 'warmup') continue
        const key = groupOf.get(s.session_exercise_id)
        if (!key) continue
        try {
          const g = exercise(key).group
          totals[g] = (totals[g] ?? 0) + 1
        } catch {
          /* a custom or retired exercise: not counted */
        }
      }
      return totals
    },
    [userId, today],
    {} as Record<string, number>,
  )
}

export function usePlan(userId: string, day?: DayKey, trainingAlone = false, equipment?: string[]): { plan: SessionPlan; program: ProgramData } {
  const program = useProgram(userId)
  const setsByGroup = useSetsByGroup(userId)
  const plan = useMemo(() => {
    const pos = blockPosition(program.startedOn, localDate(), weekStart, daysBetween)
    return planSession({ day: day ?? nextDay(program), ...pos, settings: { ...settingsOf(program), ...(equipment ? { equipment } : {}) }, setsByGroup, trainingAlone })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, setsByGroup, day, trainingAlone, equipment?.join()])
  return { plan, program }
}

export const DEFAULT_REST = { main: 120, topup: 90, accessory: 75, finisher: 45 }
export const restOf = (p: ProgramData) => ({ ...DEFAULT_REST, ...(p.rest ?? {}) })
