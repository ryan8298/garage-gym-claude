import raw from '../data/exercises.json'
import extra from '../data/library.json'

export type Measure = 'wr' | 'bw' | 'time' | 'carry'
/** How an exercise's weight is loaded. "free" means any weight can be typed: no plate math. */
export type Station = 'barbell' | 'smith' | 'cable' | 'landmine' | 'dumbbell' | 'bodyweight' | 'free'
/** The equipment an exercise needs. A gym profile lists which of these it has. */
export type Equip = 'barbell' | 'smith' | 'cable' | 'landmine' | 'dumbbell' | 'bodyweight' | 'machine' | 'kettlebell' | 'band' | 'ez_bar' | 'medicine_ball' | 'exercise_ball' | 'other'

export interface Exercise {
  key: string
  name: string
  group: string
  station: Station
  equip: Equip
  measure: Measure
  side: boolean
  /** Written and checked by us for our own program. The rest come from the wider public library. */
  curated: boolean
  level?: string
  needs?: 'ankle_strap' | 'partner'
  setup?: string
  cues?: string[]
  images: string[]
  primary: string[]
  secondary: string[]
  steps: string[]
}

type Raw = Omit<Exercise, 'equip' | 'curated'>
/** The exercises our own program is built from. */
export const curatedExercises: Exercise[] = (raw as Raw[]).map((e) => ({ ...e, equip: e.station as Equip, curated: true }))
/** Everything: our own exercises first, then the wider library. */
export const exercises: Exercise[] = [...curatedExercises, ...(extra as Omit<Exercise, 'curated' | 'steps'>[]).map((e) => ({ ...e, curated: false, steps: [] }))]

/** How-to steps. The wider library's text is large, so it is loaded only when asked for. */
export async function stepsFor(e: Exercise): Promise<string[]> {
  if (e.steps.length) return e.steps
  const all = (await import('../data/library-steps.json')).default as Record<string, string[]>
  return all[e.key] ?? []
}

const byKey = new Map(exercises.map((e) => [e.key, e]))

export function exercise(key: string): Exercise {
  const e = byKey.get(key)
  if (!e) throw new Error(`Unknown exercise: ${key}`)
  return e
}
export const hasExercise = (key: string) => byKey.has(key)

export const groupLabels: Record<string, string> = {
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  hips: 'Hips',
  lower_back: 'Lower back',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Grip & forearms',
  core: 'Core',
  neck: 'Neck',
}
export const stationLabels: Record<Station, string> = {
  barbell: 'Barbell',
  smith: 'Smith bar',
  cable: 'Cable',
  landmine: 'Landmine',
  dumbbell: 'Dumbbell',
  bodyweight: 'Bodyweight',
  free: 'Other equipment',
}
export const equipLabels: Record<Equip, string> = {
  barbell: 'Barbell',
  smith: 'Smith bar',
  cable: 'Cable',
  landmine: 'Landmine',
  dumbbell: 'Dumbbell',
  bodyweight: 'Bodyweight',
  machine: 'Machine',
  kettlebell: 'Kettlebell',
  band: 'Bands',
  ez_bar: 'EZ curl bar',
  medicine_ball: 'Medicine ball',
  exercise_ball: 'Exercise ball',
  other: 'Other',
}
