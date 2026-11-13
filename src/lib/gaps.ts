import type { Exercise } from './exercises'

/** Muscle groups with a weekly target, in the order they are shown. */
export const TRACKED_GROUPS = ['quads', 'hamstrings', 'glutes', 'calves', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'core']
export const WEEKLY_SET_TARGET = 10

export interface GapSuggestion {
  key: string
  group: string
  /** Sets this week once today's workout is finished as planned. */
  sets: number
}

/**
 * Exercises worth adding to today's workout, from the muscle groups that
 * will still be short of the weekly target after it. Groups that belong to
 * today's kind of workout come first, then the biggest shortfalls.
 */
export function gapSuggestions(input: {
  /** Sets done in the last 7 days, by muscle group. */
  weekSets: Record<string, number>
  /** Exercises in today's workout, with the sets still to do. */
  session: { key: string; group: string; remaining: number }[]
  catalog: Exercise[]
  /** Exercise keys that fit today's kind of workout, best first. */
  preferred: string[]
  bans: string[]
  ankleStrap: boolean
  partner: boolean
  limit?: number
}): GapSuggestion[] {
  const total = (g: string) => (input.weekSets[g] ?? 0) + input.session.filter((l) => l.group === g).reduce((n, l) => n + l.remaining, 0)
  const inSession = new Set(input.session.map((l) => l.key))
  const usable = input.catalog.filter((e) => !inSession.has(e.key) && !input.bans.includes(e.key) && (e.needs !== 'ankle_strap' || input.ankleStrap) && (e.needs !== 'partner' || input.partner))
  const rank = (e: Exercise) => {
    const i = input.preferred.indexOf(e.key)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const themed = new Set(input.preferred.map((k) => input.catalog.find((e) => e.key === k)?.group))
  return TRACKED_GROUPS.filter((g) => total(g) < WEEKLY_SET_TARGET)
    .sort((a, b) => Number(themed.has(b)) - Number(themed.has(a)) || total(a) - total(b))
    .map((group) => {
      const pick = usable.filter((e) => e.group === group).sort((a, b) => rank(a) - rank(b))[0]
      return pick ? { key: pick.key, group, sets: total(group) } : null
    })
    .filter((s): s is GapSuggestion => s !== null)
    .slice(0, input.limit ?? 4)
}
