import raw from '../data/classes.json'
import yoga from '../data/yoga.json'
import { db, save, type WorkoutSession } from './db'
import { localDate } from './dates'
import { hasExercise } from './exercises'
import type { Gym } from './gym'
import type { ProgramData } from './programState'
import { addLiftTo, startSession } from './session'
import { requestSync } from './syncRunner'

/** Workouts outside the lifting program: follow-along sessions and bodyweight strength. */

export interface ClassStep {
  name: string
  seconds: number
  /** Done once on each side, for `seconds` each. */
  side: boolean
  cue: string
  image: string
  /** Who took the photo and under which licence, when it needs saying. */
  credit?: string
}
export interface GymClass {
  id: string
  kind: 'mobility' | 'pilates' | 'yoga'
  title: string
  level: string
  /** Equipment it uses, by the tags a place can list. */
  needs: string[]
  about: string
  steps: ClassStep[]
}
export const classes = [...raw, ...yoga] as GymClass[]
/** Photos shot on a white background show whole, not cropped. */
export const whole = (image: string) => image.startsWith('/classes/yoga/')
export const kindLabels: Record<GymClass['kind'] | 'calisthenics', string> = { calisthenics: 'Calisthenics', mobility: 'Mobility and stretching', pilates: 'Pilates', yoga: 'Yoga' }

/** One thing the player shows at a time: a pose, on one side if it has sides. */
export interface Beat {
  step: ClassStep
  side: 'left' | 'right' | null
  seconds: number
  /** Seconds from the start of the class to the start of this beat. */
  at: number
}
/** The class laid out in order, with a short pause to move between poses. */
export function timeline(c: GymClass, gap = 5): Beat[] {
  const beats: Beat[] = []
  let at = 0
  for (const step of c.steps)
    for (const side of step.side ? (['left', 'right'] as const) : [null]) {
      at += gap
      beats.push({ step, side, seconds: step.seconds, at })
      at += step.seconds
    }
  return beats
}
export const classSeconds = (c: GymClass, gap = 5) => timeline(c, gap).reduce((n, b) => Math.max(n, b.at + b.seconds), 0)

/** Where the player is at a number of seconds in: which beat, and whether it is the pause before it. */
export function beatAt(beats: Beat[], elapsed: number): { index: number; phase: 'ready' | 'hold' | 'done'; left: number } {
  for (const [index, b] of beats.entries()) {
    if (elapsed < b.at) return { index, phase: 'ready', left: Math.ceil(b.at - elapsed) }
    if (elapsed < b.at + b.seconds) return { index, phase: 'hold', left: Math.ceil(b.at + b.seconds - elapsed) }
  }
  return { index: beats.length - 1, phase: 'done', left: 0 }
}

export const missingFor = (c: { needs: string[] }, gym: Gym) => c.needs.filter((n) => !gym.equipment.includes(n))

/** Record a finished class as a workout, so it shows in history and counts toward the week. */
export async function logClass(userId: string, c: GymClass, startedAt: number): Promise<string> {
  const session = await save<WorkoutSession>(db, 'workout_sessions', {
    id: crypto.randomUUID(),
    user_id: userId,
    template_key: null,
    title: c.title,
    local_date: localDate(),
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date().toISOString(),
    block_phase: null,
    block_week: null,
    effort: null,
    note: null,
    pair_id: null,
  })
  requestSync(0)
  return session.id
}

// ---------- calisthenics: bodyweight strength, logged set by set like any workout ----------

export interface Calisthenics {
  id: string
  title: string
  level: string
  needs: string[]
  about: string
  lifts: { key: string; sets: number; low: number; high: number }[]
}
const l = (key: string, sets: number, low: number, high: number) => ({ key, sets, low, high })
export const calisthenics: Calisthenics[] = [
  {
    id: 'cali_push', title: 'Push and core', level: 'All levels', needs: [],
    about: 'Push-up variations from easiest to hardest, dips and trunk work. Pick the push-up you can do for the reps shown.',
    lifts: [l('x_incline_push_up', 3, 8, 15), l('push_up', 3, 6, 15), l('x_push_ups_close_triceps_position', 2, 6, 12), l('x_bench_dips', 3, 8, 15), l('plank', 3, 30, 60), l('hollow_hold', 2, 20, 40)],
  },
  {
    id: 'cali_pull', title: 'Pull and hang', level: 'Moderate', needs: ['pull_up_bar'],
    about: 'Rows, chin-ups and pull-ups, with hanging work for grip and abs.',
    lifts: [l('x_inverted_row', 3, 6, 12), l('chin_up', 3, 3, 10), l('pull_up', 3, 3, 10), l('dead_hang', 2, 20, 45), l('hanging_leg_raise', 3, 6, 12)],
  },
  {
    id: 'cali_legs', title: 'Legs and hips', level: 'All levels', needs: [],
    about: 'Squats, lunges and bridges with no weight, finishing with the back of the body.',
    lifts: [l('x_bodyweight_squat', 3, 12, 25), l('x_bodyweight_walking_lunge', 3, 8, 15), l('x_single_leg_glute_bridge', 3, 8, 15), l('x_freehand_jump_squat', 2, 6, 12), l('superman_hold', 2, 20, 40), l('side_plank', 2, 20, 40)],
  },
  {
    id: 'cali_full', title: 'Full body', level: 'All levels', needs: ['pull_up_bar'],
    about: 'One push, one pull, one squat, one hinge and one core move. A whole session in about half an hour.',
    lifts: [l('push_up', 3, 6, 15), l('x_inverted_row', 3, 6, 12), l('x_bodyweight_squat', 3, 12, 25), l('x_single_leg_glute_bridge', 3, 8, 15), l('x_mountain_climbers', 2, 15, 30), l('plank', 2, 30, 60)],
  },
]

/** Start a calisthenics session as a normal workout, so sets, records and suggestions work as usual. */
export async function startCalisthenics(userId: string, program: ProgramData, c: Calisthenics): Promise<void> {
  const id = await startSession(userId, null, program, { title: `Calisthenics: ${c.title}` })
  const session = (await db.workout_sessions.get(id))!
  let position = 0
  for (const lift of c.lifts) {
    if (!hasExercise(lift.key)) continue
    const timed = lift.low >= 20 && ['plank', 'hollow_hold', 'dead_hang', 'superman_hold', 'side_plank'].includes(lift.key)
    await addLiftTo(session, lift.key, position++, { kind: position <= 2 ? 'main' : 'accessory', role: 'Calisthenics', sets: lift.sets, low: lift.low, high: lift.high, unit: timed ? 'sec' : 'reps', eachSide: lift.key === 'side_plank' || lift.key === 'x_single_leg_glute_bridge' })
  }
  requestSync()
}
