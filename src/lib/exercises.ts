import raw from '../data/exercises.json'

export type Measure = 'wr' | 'bw' | 'time' | 'carry'
export type Station = 'barbell' | 'smith' | 'cable' | 'landmine' | 'dumbbell' | 'bodyweight'

export interface Exercise {
  key: string
  name: string
  group: string
  station: Station
  measure: Measure
  side: boolean
  needs?: 'ankle_strap' | 'partner'
  setup?: string
  cues?: string[]
  images: string[]
  primary: string[]
  secondary: string[]
  steps: string[]
}

export const exercises = raw as Exercise[]
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
}
export const stationLabels: Record<Station, string> = {
  barbell: 'Barbell',
  smith: 'Smith bar',
  cable: 'Cable',
  landmine: 'Landmine',
  dumbbell: 'Dumbbell',
  bodyweight: 'Bodyweight',
}
