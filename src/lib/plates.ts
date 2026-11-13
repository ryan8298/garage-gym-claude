import type { Exercise } from './exercises'

/**
 * Plate math for our actual equipment. Every weight the app suggests or
 * accepts is one we can really load.
 */

export type LoadMode = 'barbell' | 'smith' | 'landmine' | 'cable' | 'dumbbell' | 'added' | 'none'

export const BAR_WEIGHT = { barbell: 45, smith: 33 } as const
/** We own one pair of each of these. */
export const PLATE_PAIRS = [45, 35, 25, 15, 10, 5, 2.5, 1.25]
export const DUMBBELLS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
/** The warning label on the machine. */
export const SMITH_PLATE_LIMIT = 275

export function loadModeFor(e: Exercise): LoadMode {
  if (e.measure === 'time') return 'none'
  if (e.measure === 'bw') return 'added'
  if (e.measure === 'carry') return 'dumbbell'
  return e.station === 'bodyweight' ? 'added' : e.station
}

type Combo = Map<number, number[]>

/** Fewer plates wins; with the same count, the set with the bigger plates wins. */
function better(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return a.length < b.length
  const x = [...a].sort((p, q) => q - p)
  const y = [...b].sort((p, q) => q - p)
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

/** Every total reachable using each plate at most `max` times, with the fewest plates for each total. */
function combos(max: number): Combo {
  let found: Combo = new Map([[0, []]])
  for (const plate of PLATE_PAIRS) {
    const next: Combo = new Map(found)
    for (const [sum, plates] of found) {
      for (let n = 1; n <= max; n++) {
        const total = sum + plate * n
        const candidate = [...plates, ...Array(n).fill(plate)]
        const existing = next.get(total)
        if (!existing || better(candidate, existing)) next.set(total, candidate)
      }
    }
    found = next
  }
  return found
}

const PER_SIDE = combos(1) // one plate of each size on each side of a bar
const STACK = combos(2) // both plates of each size on one cable or landmine

const sorted = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b)
const LOADS: Record<LoadMode, number[]> = {
  barbell: sorted([...PER_SIDE.keys()].map((s) => BAR_WEIGHT.barbell + 2 * s)),
  smith: sorted([...PER_SIDE.keys()].map((s) => BAR_WEIGHT.smith + 2 * s)),
  landmine: sorted(STACK.keys()),
  cable: sorted(STACK.keys()).filter((w) => w > 0),
  dumbbell: DUMBBELLS,
  added: [0, ...DUMBBELLS],
  none: [0],
}

export const achievableLoads = (mode: LoadMode): number[] => LOADS[mode]

/** The loadable weight closest to the target. Ties go to the lighter one. */
export function nearestLoad(mode: LoadMode, target: number): number {
  return LOADS[mode].reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best))
}
/** The heaviest loadable weight at or below the target (or the lightest one there is). */
export function loadAtOrBelow(mode: LoadMode, target: number): number {
  const below = LOADS[mode].filter((w) => w <= target + 1e-9)
  return below.length ? below[below.length - 1] : LOADS[mode][0]
}
export function stepUp(mode: LoadMode, weight: number): number {
  return LOADS[mode].find((w) => w > weight + 1e-9) ?? LOADS[mode][LOADS[mode].length - 1]
}
export function stepDown(mode: LoadMode, weight: number): number {
  const below = LOADS[mode].filter((w) => w < weight - 1e-9)
  return below.length ? below[below.length - 1] : LOADS[mode][0]
}

export interface Breakdown {
  /** Plates to put on, largest first. Per side for a bar; the whole stack for a cable or landmine. */
  plates: number[]
  text: string
  overLimit: boolean
}

const list = (plates: number[]) => plates.join(' + ')

/** How to load a weight. Returns null if it cannot be loaded exactly. */
export function breakdown(mode: LoadMode, weight: number): Breakdown | null {
  if (mode === 'barbell' || mode === 'smith') {
    const bar = BAR_WEIGHT[mode]
    const plates = PER_SIDE.get((weight - bar) / 2)
    if (!plates) return null
    const name = mode === 'smith' ? '33 lb Smith bar' : '45 lb bar'
    plates.sort((p, q) => q - p)
    return {
      plates,
      text: plates.length ? `Per side: ${list(plates)} on the ${name}` : `Empty ${name}`,
      overLimit: mode === 'smith' && weight - bar > SMITH_PLATE_LIMIT,
    }
  }
  if (mode === 'cable' || mode === 'landmine') {
    const plates = STACK.get(weight)
    if (!plates) return null
    const where = mode === 'cable' ? 'on the cable' : 'on the end of the bar'
    return { plates, text: plates.length ? `Plates: ${list(plates)} ${where}` : 'No plates', overLimit: false }
  }
  if (mode === 'dumbbell') return DUMBBELLS.includes(weight) ? { plates: [], text: `${weight} lb dumbbells`, overLimit: false } : null
  if (mode === 'added') {
    if (weight === 0) return { plates: [], text: 'Bodyweight only', overLimit: false }
    return DUMBBELLS.includes(weight) ? { plates: [], text: `Bodyweight + ${weight} lb dumbbell`, overLimit: false } : null
  }
  return { plates: [], text: '', overLimit: false }
}

/** Two or three ramp-up sets toward a working weight, each one loadable. */
export function warmupLoads(mode: LoadMode, working: number): number[] {
  if (mode === 'none' || mode === 'added' || working <= 0) return []
  const lightest = LOADS[mode][0]
  const steps = [0.5, 0.7, 0.85].map((f) => nearestLoad(mode, working * f)).filter((w) => w < working && w >= lightest)
  return [...new Set(steps)]
}
