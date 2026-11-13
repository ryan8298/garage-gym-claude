/**
 * The approved program (see PROGRAM_PROPOSAL.md). This file is the single
 * place the days, main lifts, slot roles and exercise pools are defined.
 * Each user's own choices (pins, bans, which pull they train) live in their
 * program state, not here.
 */

/** A day's key within its program, such as "A" or "U1". Unique across all programs. */
export type DayKey = string
/** The days of the standard program, in order. */
export const DAY_ORDER: DayKey[] = ['A', 'B', 'C', 'D']

export interface MainLift {
  /** Default exercise. */
  key: string
  /** One-tap swap for a session without a spotter. */
  alone?: string
  alternatives: string[]
  reps: 'standard' | 'deadlift' | 'core'
  /** Stable id used for per-user overrides. Unique across all programs. */
  id: string
  /** The vertical pull: each person trains pull-ups or lat pulldowns here, by their own setting. */
  pull?: boolean
}

export interface Slot {
  role: string
  pool: string[]
  /** The slot's place in the standard order. Rotation follows this, so moving a slot never changes its exercise. */
  home?: number
}

export interface Day {
  key: DayKey
  title: string
  short: string
  mains: MainLift[]
  /** Accessory slots in priority order. */
  slots: Slot[]
  /** Core finisher, done after the accessories. Day C has none: it is the core day. */
  finisher: Slot[]
  /** Starts with strength top-ups for whichever muscles are furthest behind. */
  topUps?: boolean
  /** Slots past the listed ones are filled from whichever muscles are furthest behind. */
  catchUp?: boolean
}

export const PROGRAM: Record<'A' | 'B' | 'C' | 'D', Day> = {
  A: {
    key: 'A',
    title: 'Legs & Lower Back',
    short: 'Legs',
    mains: [
      { id: 'A1', key: 'barbell_back_squat', alone: 'smith_squat', alternatives: ['goblet_squat', 'landmine_squat'], reps: 'standard' },
      { id: 'A2', key: 'barbell_rdl', alone: 'db_rdl', alternatives: ['smith_rdl'], reps: 'standard' },
    ],
    slots: [
      { role: 'Single-leg strength', pool: ['bulgarian_split_squat', 'reverse_lunge', 'db_step_up', 'walking_lunge'] },
      { role: 'Glutes', pool: ['smith_hip_thrust', 'barbell_glute_bridge', 'cable_pull_through', 'cable_kickback'] },
      { role: 'Hamstring curl', pool: ['cable_leg_curl', 'db_leg_curl', 'nordic_lowering', 'single_leg_rdl'] },
      { role: 'Calves', pool: ['smith_calf_raise', 'db_calf_raise', 'seated_db_calf_raise'] },
      { role: 'Inner and outer hip', pool: ['cable_hip_abduction', 'cossack_squat', 'cable_hip_adduction', 'lateral_lunge', 'copenhagen_plank'] },
      { role: 'Lower-back endurance', pool: ['good_morning', 'bird_dog', 'superman_hold'] },
      { role: 'Extra quad work', pool: ['heels_raised_goblet_squat', 'landmine_squat', 'db_front_squat'] },
    ],
    finisher: [
      { role: 'Rotation', pool: ['pallof_press', 'cable_woodchop', 'landmine_rotation'] },
      { role: 'Side of the trunk', pool: ['side_plank', 'suitcase_carry', 'db_side_bend'] },
    ],
  },
  B: {
    key: 'B',
    title: 'Arms, Upper Back & Shoulders',
    short: 'Upper',
    mains: [
      { id: 'B1', key: 'barbell_bench', alone: 'smith_bench', alternatives: ['db_bench'], reps: 'standard' },
      // Which of the two a user trains is their own setting (pull_main).
      { id: 'B2', key: 'lat_pulldown', alternatives: ['pull_up', 'chin_up', 'neutral_pulldown'], reps: 'standard', pull: true },
    ],
    slots: [
      { role: 'Incline press', pool: ['incline_barbell_bench', 'incline_db_press'] },
      { role: 'Rows', pool: ['barbell_row', 'tbar_row', 'db_row', 'seated_cable_row'] },
      { role: 'Side shoulders', pool: ['db_lateral_raise', 'cable_lateral_raise', 'db_upright_row'] },
      { role: 'Biceps', pool: ['barbell_curl', 'incline_db_curl', 'hammer_curl', 'cable_curl'] },
      { role: 'Triceps', pool: ['rope_pushdown', 'overhead_rope_extension', 'db_skull_crusher', 'dips'] },
      { role: 'Rear shoulders and rotator cuff', pool: ['face_pull', 'reverse_fly', 'cable_external_rotation'] },
      { role: 'Grip, forearms and traps', pool: ['farmer_carry', 'dead_hang', 'db_shrug', 'wrist_curl'] },
    ],
    finisher: [
      { role: 'Upper abs', pool: ['cable_crunch', 'weighted_situp'] },
      { role: 'Lower abs', pool: ['reverse_crunch', 'lying_leg_raise'] },
    ],
  },
  C: {
    key: 'C',
    title: 'Core & Cardio',
    short: 'Core',
    topUps: true,
    mains: [
      { id: 'C1', key: 'hanging_leg_raise', alternatives: ['lying_leg_raise'], reps: 'core' },
      { id: 'C2', key: 'barbell_rollout', alternatives: ['plank'], reps: 'core' },
    ],
    slots: [
      { role: 'Rotation', pool: ['landmine_rotation', 'cable_woodchop', 'pallof_press'] },
      { role: 'Loaded flexion', pool: ['cable_crunch', 'weighted_situp', 'reverse_crunch'] },
      { role: 'Side of the trunk', pool: ['suitcase_carry', 'side_plank', 'db_side_bend'] },
      { role: 'Holding position', pool: ['hollow_hold', 'plank', 'dead_bug'] },
      { role: 'Back of the trunk', pool: ['bird_dog', 'superman_hold'] },
    ],
    finisher: [],
  },
  D: {
    key: 'D',
    title: 'Full Body',
    short: 'Full',
    catchUp: true,
    mains: [
      { id: 'D1', key: 'barbell_deadlift', alternatives: ['db_deadlift'], reps: 'deadlift' },
      { id: 'D2', key: 'barbell_ohp', alone: 'smith_ohp', alternatives: ['db_shoulder_press', 'landmine_press'], reps: 'standard' },
    ],
    slots: [
      { role: 'Leg work', pool: ['goblet_squat', 'db_front_squat', 'reverse_lunge'] },
      { role: 'Upper pull', pool: ['chin_up', 'db_row', 'seated_cable_row'] },
      { role: 'Chest', pool: ['db_bench', 'push_up', 'cable_fly'] },
      // Slots 4 to 7 are filled by the engine from whichever muscle groups are furthest behind.
    ],
    finisher: [
      { role: 'Holding position', pool: ['hollow_hold', 'plank', 'dead_bug'] },
      { role: 'Rotation', pool: ['landmine_rotation', 'cable_woodchop'] },
    ],
  },
}

/** Compound lifts used for Day C top-ups, one leg, one push, one pull. */
export const TOP_UP: Record<'legs' | 'push' | 'pull', Record<string, string[]>> = {
  legs: {
    quads: ['goblet_squat', 'reverse_lunge'],
    hamstrings: ['db_rdl', 'single_leg_rdl'],
    glutes: ['barbell_glute_bridge', 'cable_pull_through'],
  },
  push: {
    chest: ['db_bench', 'push_up'],
    shoulders: ['db_shoulder_press', 'landmine_press'],
  },
  pull: {
    back: ['db_row', 'seated_cable_row', 'neutral_pulldown'],
  },
}

/** Pools the engine draws on when a muscle group is behind for the week. */
export const CATCH_UP: Record<string, string[]> = {
  glutes: PROGRAM.A.slots[1].pool,
  shoulders: PROGRAM.B.slots[2].pool,
  hamstrings: PROGRAM.A.slots[2].pool,
  biceps: PROGRAM.B.slots[3].pool,
  triceps: PROGRAM.B.slots[4].pool,
  calves: PROGRAM.A.slots[3].pool,
  hips: PROGRAM.A.slots[4].pool,
  back: PROGRAM.B.slots[1].pool,
  chest: PROGRAM.B.slots[0].pool,
  quads: PROGRAM.A.slots[0].pool,
  forearms: PROGRAM.B.slots[6].pool,
}
/** Order used to break ties when there is no history yet. */
export const CATCH_UP_ORDER = ['glutes', 'shoulders', 'hamstrings', 'biceps', 'triceps', 'calves', 'hips', 'back', 'chest', 'quads', 'forearms']

/** Hard sets per muscle group per week that the program builds toward. */
export const WEEKLY_SET_TARGET = 10

// ---------- programs to choose from ----------

/** A whole program: its days in rotation order. */
export interface ProgramDef {
  id: string
  name: string
  /** One line on who it suits. */
  summary: string
  /** How many days a week it is meant for. */
  perWeek: string
  order: DayKey[]
  days: Record<DayKey, Day>
}

const { A, B, C, D } = PROGRAM
const squat: Omit<MainLift, 'id'> = { key: 'barbell_back_squat', alone: 'smith_squat', alternatives: ['goblet_squat', 'landmine_squat'], reps: 'standard' }
const rdl: Omit<MainLift, 'id'> = { key: 'barbell_rdl', alone: 'db_rdl', alternatives: ['smith_rdl'], reps: 'standard' }
const bench: Omit<MainLift, 'id'> = { key: 'barbell_bench', alone: 'smith_bench', alternatives: ['db_bench'], reps: 'standard' }
const pull: Omit<MainLift, 'id'> = { key: 'lat_pulldown', alternatives: ['pull_up', 'chin_up', 'neutral_pulldown'], reps: 'standard', pull: true }
const deadlift: Omit<MainLift, 'id'> = { key: 'barbell_deadlift', alternatives: ['db_deadlift'], reps: 'deadlift' }
const press: Omit<MainLift, 'id'> = { key: 'barbell_ohp', alone: 'smith_ohp', alternatives: ['db_shoulder_press', 'landmine_press'], reps: 'standard' }
const row: Omit<MainLift, 'id'> = { key: 'barbell_row', alternatives: ['tbar_row', 'db_row', 'seated_cable_row'], reps: 'standard' }
const thrust: Omit<MainLift, 'id'> = { key: 'smith_hip_thrust', alternatives: ['barbell_glute_bridge'], reps: 'standard' }
const day = (key: string, title: string, short: string, mains: Omit<MainLift, 'id'>[], slots: Slot[], finisher: Slot[]): Day => ({ key, title, short, mains: mains.map((m, i) => ({ ...m, id: `${key}${i + 1}` })), slots, finisher })
const program = (id: string, name: string, perWeek: string, summary: string, days: Day[]): ProgramDef => ({ id, name, perWeek, summary, order: days.map((d) => d.key), days: Object.fromEntries(days.map((d) => [d.key, d])) })

const [single, glutes, hamCurl, calves, hips, lowBack, quadsExtra] = A.slots
const [incline, rows, sideDelts, biceps, triceps, rearDelts, grip] = B.slots
const [legWork, upperPull, chest] = D.slots

export const STANDARD: ProgramDef = { id: 'standard', name: 'Legs, upper, core, full body', perWeek: '3 or 4', summary: 'Balanced strength with a dedicated core and conditioning day. Good for fat loss and getting back into training.', order: DAY_ORDER, days: PROGRAM }

export const TEMPLATES: ProgramDef[] = [
  STANDARD,
  program('full3', 'Full body', '2 or 3', 'Every muscle group each session. Best when you can train only two or three days.', [
    day('FA', 'Full Body 1', 'Full 1', [squat, bench], [rows, hamCurl, sideDelts, biceps, calves, glutes], A.finisher),
    day('FB', 'Full Body 2', 'Full 2', [deadlift, press], [single, upperPull, chest, triceps, rearDelts, hips], B.finisher),
    day('FC', 'Full Body 3', 'Full 3', [rdl, pull], [legWork, incline, sideDelts, biceps, triceps, calves], D.finisher),
  ]),
  program('upperlower4', 'Upper / lower', '4', 'Two upper and two lower days a week. More work per muscle than full body, for building muscle and strength.', [
    day('U1', 'Upper 1', 'Upper 1', [bench, pull], B.slots, B.finisher),
    day('L1', 'Lower 1', 'Lower 1', [squat, rdl], A.slots, A.finisher),
    day('U2', 'Upper 2', 'Upper 2', [press, row], [incline, upperPull, sideDelts, triceps, biceps, rearDelts, grip], D.finisher),
    day('L2', 'Lower 2', 'Lower 2', [deadlift, thrust], [single, quadsExtra, hamCurl, calves, hips, lowBack], [C.slots[1], C.slots[3]]),
  ]),
  program('ppl3', 'Push / pull / legs', '3, or 5 to 6 running it twice', 'Each day has one job. Run it once a week for three days, or keep rotating for five or six.', [
    day('PU', 'Push', 'Push', [bench, press], [incline, sideDelts, triceps, chest, rearDelts], B.finisher),
    day('PL', 'Pull', 'Pull', [pull, row], [upperPull, biceps, rearDelts, grip, lowBack], D.finisher),
    day('LG', 'Legs', 'Legs', [squat, rdl], A.slots, A.finisher),
  ]),
]

export const programDef = (id?: string | null): ProgramDef => TEMPLATES.find((t) => t.id === id) ?? STANDARD
/** Every day of every program, for looking up where an exercise or main lift belongs. */
export const ALL_DAYS: Day[] = TEMPLATES.flatMap((t) => Object.values(t.days))
export const dayByKey = (key: string | null | undefined): Day | null => ALL_DAYS.find((d) => d.key === key) ?? null
