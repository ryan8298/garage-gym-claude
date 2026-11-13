/**
 * The approved program (see PROGRAM_PROPOSAL.md). This file is the single
 * place the days, main lifts, slot roles and exercise pools are defined.
 * Each user's own choices (pins, bans, which pull they train) live in their
 * program state, not here.
 */

export type DayKey = 'A' | 'B' | 'C' | 'D'
export const DAY_ORDER: DayKey[] = ['A', 'B', 'C', 'D']

export interface MainLift {
  /** Default exercise. */
  key: string
  /** One-tap swap for a session without a spotter. */
  alone?: string
  alternatives: string[]
  reps: 'standard' | 'deadlift' | 'core'
  /** Stable id used for per-user overrides. */
  id: string
}

export interface Slot {
  role: string
  pool: string[]
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
}

export const PROGRAM: Record<DayKey, Day> = {
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
      { id: 'B2', key: 'lat_pulldown', alternatives: ['pull_up', 'chin_up', 'neutral_pulldown'], reps: 'standard' },
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
