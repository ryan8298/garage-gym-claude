import { afterEach, describe, expect, it } from 'vitest'
import { defaultSettings, planSession } from '../src/lib/engine'
import { exercise, exercises, hasExercise, matchesQuery, registerCustom } from '../src/lib/exercises'

const plan = (equipment: string[] | undefined, day: 'A' | 'B' | 'C' | 'D' = 'A') => planSession({ day, blockIndex: 0, week: 1, settings: { ...defaultSettings, equipment } })
const doable = (keys: string[], equipment: string[]) => keys.every((k) => exercise(k).equip === 'bodyweight' || equipment.includes(exercise(k).equip))

describe('the plan follows the place', () => {
  it('is unchanged where everything our program needs is present', () => {
    const full = ['barbell', 'smith', 'cable', 'landmine', 'dumbbell']
    for (const day of ['A', 'B', 'C', 'D'] as const) {
      expect(plan(full, day).lifts.map((l) => l.key)).toEqual(plan(undefined, day).lifts.map((l) => l.key))
      expect(plan(full, day).adapted).toEqual([])
    }
  })
  it('with dumbbells only, uses only dumbbell and bodyweight exercises and still fills the day', () => {
    for (const day of ['A', 'B', 'C', 'D'] as const) {
      const p = plan(['dumbbell'], day)
      expect(doable(p.lifts.map((l) => l.key), ['dumbbell']), day).toBe(true)
      expect(p.lifts.filter((l) => l.kind === 'main').length, day).toBe(2)
      expect(p.lifts.length, day).toBeGreaterThanOrEqual(6)
    }
  })
  it('says which main lifts were changed', () => {
    const p = plan(['dumbbell'], 'A')
    expect(p.adapted.length).toBe(2)
    expect(p.adapted[0]).toContain('in place of Barbell back squat')
  })
  it('with no equipment at all, gives a bodyweight workout', () => {
    const p = plan([], 'B')
    expect(doable(p.lifts.map((l) => l.key), [])).toBe(true)
    expect(p.lifts.length).toBeGreaterThanOrEqual(4)
  })
})

describe('search', () => {
  const find = (q: string) => exercises.filter((e) => matchesQuery(e, q)).map((e) => e.key)
  it('understands other names', () => {
    expect(find('rdl')).toContain('barbell_rdl')
    expect(find('db rdl')).toContain('db_rdl')
    expect(find('pullup')).toContain('pull_up')
    expect(find('ohp')).toContain('barbell_ohp')
  })
  it('matches words in any order and by muscle or equipment', () => {
    expect(find('curl hammer')).toContain('hammer_curl')
    expect(find('smith squat')).toContain('smith_squat')
    expect(find('kettlebell').length).toBeGreaterThan(20)
  })
  it('returns everything for an empty search', () => {
    expect(find('  ').length).toBe(exercises.length)
  })
})

describe('your own exercises', () => {
  afterEach(() => registerCustom([]))
  it('join the library and leave it again', () => {
    const before = exercises.length
    registerCustom([{ key: 'c_belt', name: 'Belt squat', group: 'quads', equip: 'machine', measure: 'wr', side: false }])
    expect(exercises.length).toBe(before + 1)
    expect(exercise('c_belt').station).toBe('free')
    expect(exercises.filter((e) => matchesQuery(e, 'belt squat')).map((e) => e.key)).toContain('c_belt')
    registerCustom([])
    expect(hasExercise('c_belt')).toBe(false)
    expect(exercises.length).toBe(before)
  })
})
