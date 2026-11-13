import { exercise, type Exercise } from './exercises'
import { CATCH_UP, CATCH_UP_ORDER, PROGRAM, TOP_UP, type DayKey, type MainLift, type Slot } from './program'

/**
 * The programming engine. Pure functions: given the day, where we are in the
 * training blocks and a user's settings, it returns the session to do.
 * It runs on the phone, with no network.
 */

export type Phase = 'foundation' | 'build' | 'strength'
export const PHASES: Phase[] = ['foundation', 'build', 'strength']
export const phaseLabel: Record<Phase, string> = { foundation: 'Foundation', build: 'Build', strength: 'Strength' }

export interface UserSettings {
  pullMain: 'pull_up' | 'lat_pulldown'
  ankleStrap: boolean
  partner: boolean
  pins: string[]
  bans: string[]
  /** Main lift overrides by MainLift id, for example a "training alone" swap made permanent. */
  mains: Record<string, string>
}
export const defaultSettings: UserSettings = { pullMain: 'lat_pulldown', ankleStrap: true, partner: true, pins: [], bans: [], mains: {} }

export interface PlannedLift {
  key: string
  name: string
  kind: 'main' | 'topup' | 'accessory' | 'finisher'
  role: string
  sets: number
  low: number
  high: number
  unit: 'reps' | 'sec'
  eachSide: boolean
  /** Lifts sharing a number are done back to back. */
  superset?: number
  note?: string
}

export interface SessionPlan {
  day: DayKey
  title: string
  blockIndex: number
  week: number
  phase: Phase
  recovery: boolean
  lifts: PlannedLift[]
  minutes: number
}

export const phaseOf = (blockIndex: number): Phase => PHASES[blockIndex % 3]
/** A lighter week closes every second block: week 8, 16, 24 and so on. */
export const isRecoveryWeek = (blockIndex: number, week: number) => blockIndex % 2 === 1 && week === 4

const ACCESSORY_COUNT: Record<Phase, number[]> = {
  foundation: [5, 5, 6, 6],
  build: [5, 6, 6, 7],
  strength: [3, 4, 4, 4],
}
const FIRST_BLOCK = [4, 5, 5, 6]

export function accessoryCount(blockIndex: number, week: number): number {
  if (isRecoveryWeek(blockIndex, week)) return 3
  if (blockIndex === 0) return FIRST_BLOCK[week - 1]
  return ACCESSORY_COUNT[phaseOf(blockIndex)][week - 1]
}

const MAIN_REPS: Record<MainLift['reps'], Record<Phase, [number, number]>> = {
  standard: { foundation: [8, 12], build: [8, 10], strength: [5, 8] },
  deadlift: { foundation: [6, 8], build: [5, 8], strength: [3, 6] },
  core: { foundation: [8, 12], build: [8, 12], strength: [6, 10] },
}
const ACCESSORY_REPS: Record<Phase, [number, number]> = { foundation: [10, 15], build: [10, 15], strength: [8, 12] }

function usable(e: Exercise, s: UserSettings): boolean {
  if (s.bans.includes(e.key)) return false
  if (e.needs === 'ankle_strap' && !s.ankleStrap) return false
  if (e.needs === 'partner' && !s.partner) return false
  return true
}

/**
 * Which exercise fills a slot in a given block. Even-numbered slots change on
 * even blocks and odd slots on odd blocks, so about half the accessories are
 * new each block and each one runs for two blocks.
 */
export function pickFromPool(pool: string[], slotIndex: number, blockIndex: number, s: UserSettings, taken: Set<string>): string | null {
  const candidates = pool.filter((k) => usable(exercise(k), s) && !taken.has(k))
  if (candidates.length === 0) return null
  const pinned = candidates.find((k) => s.pins.includes(k))
  if (pinned) return pinned
  const turn = Math.floor((blockIndex + (slotIndex % 2)) / 2)
  return candidates[turn % candidates.length]
}

function target(e: Exercise, range: [number, number]): Pick<PlannedLift, 'low' | 'high' | 'unit'> {
  if (e.measure === 'time') return { low: 20, high: 45, unit: 'sec' }
  if (e.measure === 'carry') return { low: 30, high: 60, unit: 'sec' }
  return { low: range[0], high: range[1], unit: 'reps' }
}

function lift(key: string, kind: PlannedLift['kind'], role: string, sets: number, range: [number, number], note?: string): PlannedLift {
  const e = exercise(key)
  return { key, name: e.name, kind, role, sets, eachSide: e.side, ...target(e, range), ...(note ? { note } : {}) }
}

/** Muscle groups ordered from furthest behind to furthest ahead. */
function mostBehind(groups: string[], setsByGroup: Record<string, number>): string[] {
  return [...groups].sort((a, b) => (setsByGroup[a] ?? 0) - (setsByGroup[b] ?? 0) || groups.indexOf(a) - groups.indexOf(b))
}

const MINUTES_PER_SET = { main: 3, topup: 2, accessory: 1.75, finisher: 1.25 }
const WARM_UP_MINUTES = 6
const MAX_MINUTES = 70

export function estimateMinutes(lifts: PlannedLift[]): number {
  const total = lifts.reduce((sum, l) => sum + l.sets * MINUTES_PER_SET[l.kind] * (l.superset ? 0.75 : 1), WARM_UP_MINUTES)
  return Math.round(total)
}

export interface PlanInput {
  day: DayKey
  blockIndex: number
  /** 1 to 4 */
  week: number
  settings?: UserSettings
  /** Hard sets per muscle group in the last 7 days, used for top-ups. */
  setsByGroup?: Record<string, number>
  /** Swap free-barbell main lifts for their solo-safe versions today. */
  trainingAlone?: boolean
}

export function planSession(input: PlanInput): SessionPlan {
  const { day, blockIndex, week } = input
  const s = input.settings ?? defaultSettings
  const sets7d = input.setsByGroup ?? {}
  const def = PROGRAM[day]
  const phase = phaseOf(blockIndex)
  const recovery = isRecoveryWeek(blockIndex, week)
  const taken = new Set<string>()
  const lifts: PlannedLift[] = []

  // ---- main lifts ----
  const mainSets = recovery ? 2 : phase === 'strength' ? 4 : 3
  for (const m of def.mains) {
    let key = s.mains[m.id] ?? m.key
    let note: string | undefined
    if (m.id === 'B2' && !s.mains[m.id]) {
      key = s.pullMain
      if (s.pullMain === 'lat_pulldown') note = 'Before your sets: 3 single pull-ups or slow lowerings for practice.'
      else note = 'Add weight once you reach the top of the range on every set.'
    }
    if (input.trainingAlone && m.alone && key === m.key) key = m.alone
    taken.add(key)
    lifts.push(lift(key, 'main', 'Main lift', mainSets, MAIN_REPS[m.reps][phase], note))
  }

  // ---- accessories ----
  const count = accessoryCount(blockIndex, week)
  const accessorySets = recovery || blockIndex === 0 ? 2 : 3
  const range = ACCESSORY_REPS[phase]
  const add = (slot: Slot, index: number, kind: PlannedLift['kind'], sets: number) => {
    const key = pickFromPool(slot.pool, index, blockIndex, s, taken)
    if (!key) return false
    taken.add(key)
    lifts.push(lift(key, kind, slot.role, sets, range))
    return true
  }

  if (day === 'C') {
    // Top-ups first: one leg, one push, one pull, from whichever group is furthest behind.
    const topUps = recovery ? 2 : 3
    const order: (keyof typeof TOP_UP)[] = ['legs', 'push', 'pull']
    order.slice(0, topUps).forEach((category, i) => {
      const group = mostBehind(Object.keys(TOP_UP[category]), sets7d)[0]
      add({ role: `Top-up: ${category}`, pool: TOP_UP[category][group] }, i, 'topup', accessorySets)
    })
    // This is the core day, so it always keeps at least three core slots.
    def.slots.slice(0, Math.max(3, count - 2)).forEach((slot, i) => add(slot, i, 'accessory', accessorySets))
  } else {
    let filled = 0
    def.slots.slice(0, count).forEach((slot, i) => {
      if (add(slot, i, 'accessory', accessorySets)) filled++
    })
    if (day === 'D') {
      // Remaining slots go to whichever muscle groups are furthest behind this week.
      const covered = new Set(lifts.map((l) => exercise(l.key).group))
      const behind = mostBehind(CATCH_UP_ORDER, sets7d).filter((g) => !covered.has(g))
      for (const group of behind) {
        if (filled >= count) break
        if (add({ role: `Catch-up: ${group.replace('_', ' ')}`, pool: CATCH_UP[group] }, filled, 'accessory', accessorySets)) filled++
      }
    }
  }

  // ---- core finisher ----
  def.finisher.forEach((slot, i) => add(slot, i, 'finisher', 2))

  // ---- pair small accessories back to back once the session is long ----
  const accessories = lifts.filter((l) => l.kind === 'accessory')
  if (accessories.length >= 5) {
    let n = 1
    for (let i = 2; i + 1 < accessories.length; i += 2) {
      accessories[i].superset = n
      accessories[i + 1].superset = n
      n++
    }
  }

  // ---- keep within the time cap by dropping the lowest-priority accessory ----
  while (estimateMinutes(lifts) > MAX_MINUTES) {
    const last = lifts.map((l) => l.kind).lastIndexOf('accessory')
    if (last === -1 || lifts.filter((l) => l.kind === 'accessory').length <= 3) break
    const [removed] = lifts.splice(last, 1)
    if (removed.superset) lifts.forEach((l) => l.superset === removed.superset && delete l.superset)
  }

  return { day, title: def.title, blockIndex, week, phase, recovery, lifts, minutes: estimateMinutes(lifts) }
}

/** Where a date falls in the blocks, counted in whole weeks from the program's first Monday. */
export function blockPosition(startedOn: string | null, today: string, weekStart: (d: string) => string, daysBetween: (a: string, b: string) => number) {
  if (!startedOn) return { blockIndex: 0, week: 1 }
  const weeks = Math.max(0, Math.floor(daysBetween(weekStart(startedOn), weekStart(today)) / 7))
  return { blockIndex: Math.floor(weeks / 4), week: (weeks % 4) + 1 }
}
