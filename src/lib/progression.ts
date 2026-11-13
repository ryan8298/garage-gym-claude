import { loadAtOrBelow, stepUp, type LoadMode } from './plates'

/**
 * Weight and rep suggestions. Rule-based, so it works offline.
 * Double progression: add reps until every set reaches the top of the range,
 * then add the smallest loadable amount of weight.
 */

export interface PastSet {
  weight: number | null
  reps: number | null
  seconds: number | null
}
export interface PastSession {
  /** Local date, yyyy-mm-dd. */
  date: string
  sets: PastSet[]
  /** Reps left in the tank on the last set, if the user said. */
  rir: number | null
}

export type Reason = 'first' | 'add_weight' | 'add_rep' | 'ease_back' | 'time_off' | 'longer'

export interface Suggestion {
  weight: number | null
  reps: number | null
  seconds: number | null
  reason: Reason
  text: string
}

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const TIME_OFF_DAYS = 14
const BIG_JUMP = 1.1

export function suggest(input: { history: PastSession[]; low: number; high: number; unit: 'reps' | 'sec'; mode: LoadMode; today: string }): Suggestion {
  const { history, low, high, unit, mode, today } = input
  const last = history[0]

  if (unit === 'sec') {
    const best = last ? Math.max(0, ...last.sets.map((s) => s.seconds ?? 0)) : 0
    const weight = last?.sets.find((s) => s.weight)?.weight ?? null
    if (!last || best === 0) return { weight, reps: null, seconds: low, reason: 'first', text: `Hold for ${low} seconds to start` }
    if (best >= high && weight !== null && mode !== 'none') {
      return { weight: stepUp(mode, weight), reps: null, seconds: low, reason: 'add_weight', text: 'You reached the top time on every set, so the weight goes up' }
    }
    const next = Math.min(high, best + 5)
    return { weight, reps: null, seconds: next, reason: 'longer', text: next > best ? 'Five seconds longer than last time' : 'Match last time' }
  }

  const done = last?.sets.filter((s) => s.reps !== null) ?? []
  if (!last || done.length === 0) {
    return { weight: mode === 'added' ? 0 : null, reps: low, seconds: null, reason: 'first', text: 'First time: start light and find a weight that leaves 2 reps in the tank' }
  }

  const weight = Math.max(...done.map((s) => s.weight ?? 0))
  const reps = done.map((s) => s.reps as number)
  const allAtTop = reps.every((r) => r >= high)
  const nearlyThere = reps.every((r) => r >= high - 1) && (last.rir ?? 0) >= 3
  const missed = (s: PastSession) => s.sets.some((x) => x.reps !== null && x.reps < low)

  if (days(last.date, today) >= TIME_OFF_DAYS && weight > 0) {
    return { weight: loadAtOrBelow(mode, weight * 0.9), reps: low, seconds: null, reason: 'time_off', text: 'It has been two weeks or more, so start about 10% lighter' }
  }

  const before = history[1]
  const sameWeight = before && Math.max(0, ...before.sets.map((s) => s.weight ?? 0)) === weight
  if (weight > 0 && missed(last) && before && sameWeight && missed(before)) {
    return { weight: loadAtOrBelow(mode, weight * 0.9), reps: low, seconds: null, reason: 'ease_back', text: 'Two sessions short of the range: drop about 10% and build back up' }
  }

  if (allAtTop || nearlyThere) {
    const heavier = stepUp(mode, weight)
    if (heavier > weight && (weight === 0 || heavier <= weight * BIG_JUMP)) {
      return { weight: heavier, reps: low, seconds: null, reason: 'add_weight', text: 'You reached the top of the range, so the weight goes up' }
    }
    // The next loadable weight is a big jump: earn it with a few more reps first.
    const most = Math.max(...reps)
    if (heavier > weight && most < high + 3) {
      return { weight, reps: most + 1, seconds: null, reason: 'add_rep', text: 'The next weight up is a big jump, so add a rep first' }
    }
    return { weight: heavier, reps: low, seconds: null, reason: 'add_weight', text: 'Time for the next weight up' }
  }

  const fewest = Math.min(...reps)
  return { weight, reps: Math.min(high, Math.max(low, fewest + 1)), seconds: null, reason: 'add_rep', text: 'Same weight, one more rep than last time' }
}

/** Estimated one-rep max (Epley). Used to compare sets of different weight and reps. */
export const estimatedMax = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30))
