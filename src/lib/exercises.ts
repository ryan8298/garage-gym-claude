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
  /** Added by one of us. */
  custom?: boolean
  level?: string
  /** Jumping and throwing drills: fine to choose, but never picked for you. */
  plyo?: boolean
  /** Works several joints at once. */
  compound?: boolean
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
const builtIn = exercises.length

/** A person's own exercise, as saved in their settings. */
export interface CustomExercise {
  key: string
  name: string
  group: string
  equip: Equip
  measure: Measure
  side: boolean
}
export const stationFor = (equip: Equip): Station => (['barbell', 'smith', 'cable', 'landmine', 'dumbbell', 'bodyweight'].includes(equip) ? (equip as Station) : 'free')

/** Make people's own exercises part of the library. Called whenever the saved list changes. */
export function registerCustom(list: CustomExercise[]) {
  for (const e of exercises.splice(builtIn)) byKey.delete(e.key)
  for (const c of list) {
    if (byKey.has(c.key)) continue
    const e: Exercise = { ...c, station: stationFor(c.equip), curated: false, custom: true, images: [], primary: [], secondary: [], steps: [] }
    exercises.push(e)
    byKey.set(e.key, e)
  }
}

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

// Other names people type, mapped to the words the library uses.
const ALIASES: [RegExp, string][] = [
  [/\brdls?\b/g, 'romanian deadlift'],
  [/\bohp\b/g, 'overhead press'],
  [/\bskull ?crushers?\b/g, 'lying triceps'],
  [/\bdb\b/g, 'dumbbell'],
  [/\bbb\b/g, 'barbell'],
  [/\bkb\b/g, 'kettlebell'],
  [/\bpull ?ups?\b/g, 'pull up'],
  [/\bchin ?ups?\b/g, 'chin up'],
  [/\bpush ?ups?\b/g, 'push up'],
  [/\bsit ?ups?\b/g, 'sit up'],
  [/\bstep ?ups?\b/g, 'step up'],
  [/\bpull ?downs?\b/g, 'pulldown'],
  [/\bpush ?downs?\b/g, 'pushdown'],
  [/\bmilitary press\b/g, 'overhead press'],
  [/\bhip thrusts?\b/g, 'hip thrust'],
  [/\babs\b/g, 'core'],
  [/\blegs?\b(?! (press|curl|raise|extension))/g, 'quads'],
  [/\bdelts?\b/g, 'shoulders'],
  [/\bpecs?\b/g, 'chest'],
  [/\blats?\b(?! pull)/g, 'back lat'],
  [/\bhams?\b/g, 'hamstrings'],
  [/\bbis?\b/g, 'biceps'],
  [/\btris?\b/g, 'triceps'],
]
const norm = (text: string) => text.toLowerCase().replace(/[-_'’.,()/]/g, ' ').replace(/\s+/g, ' ').trim()
const hay = new Map<string, string>()
const haystack = (e: Exercise) => {
  let h = hay.get(e.key)
  if (h === undefined) hay.set(e.key, (h = norm(`${e.name} ${groupLabels[e.group] ?? ''} ${equipLabels[e.equip]} ${e.primary.join(' ')}`)))
  return h
}

/** Does an exercise match what was typed? Every word must appear, and common other names are understood. */
export function matchesQuery(e: Exercise, query: string): boolean {
  let q = norm(query)
  if (!q) return true
  const h = haystack(e)
  if (h.includes(q)) return true
  for (const [from, to] of ALIASES) q = q.replace(from, to)
  // "back lat" style aliases mean either word is enough for that term.
  return q.split(' ').every((word) => h.includes(word) || (word.length > 3 && word.endsWith('s') && h.includes(word.slice(0, -1))))
}

// The library's muscle names, mapped to the groups we count weekly sets for.
const MUSCLE_GROUP: Record<string, string> = {
  quads: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves', chest: 'chest', shoulders: 'shoulders',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms', abs: 'core', 'lower back': 'lower_back', lats: 'back',
  'mid back': 'back', traps: 'back', 'inner hip': 'hips', 'outer hip': 'hips', neck: 'neck',
}

/**
 * What one set of an exercise counts toward each muscle group: a full set for
 * its main group, half a set for each group that helps.
 */
export function muscleCredit(e: Exercise): Record<string, number> {
  const credit: Record<string, number> = { [e.group]: 1 }
  for (const m of e.secondary) {
    const g = MUSCLE_GROUP[m]
    if (g && !(g in credit)) credit[g] = 0.5
  }
  return credit
}
