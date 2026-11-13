import { describe, expect, it } from 'vitest'
import { accessoryCount, defaultSettings, isRecoveryWeek, phaseOf, planSession, type SessionPlan } from '../src/lib/engine'
import { exercise, hasExercise } from '../src/lib/exercises'
import { CATCH_UP, DAY_ORDER, PROGRAM, TOP_UP, type DayKey } from '../src/lib/program'

const allWeeks = Array.from({ length: 24 }, (_, i) => ({ blockIndex: Math.floor(i / 4), week: (i % 4) + 1 }))
const plan = (day: DayKey, blockIndex: number, week: number, extra = {}) => planSession({ day, blockIndex, week, ...extra })
const keys = (p: SessionPlan, kind: string) => p.lifts.filter((l) => l.kind === kind).map((l) => l.key)

describe('program definition', () => {
  it('only refers to exercises that exist in the library', () => {
    const used = new Set<string>()
    for (const d of Object.values(PROGRAM)) {
      d.mains.forEach((m) => [m.key, m.alone, ...m.alternatives].forEach((k) => k && used.add(k)))
      ;[...d.slots, ...d.finisher].forEach((s) => s.pool.forEach((k) => used.add(k)))
    }
    Object.values(TOP_UP).forEach((c) => Object.values(c).forEach((p) => p.forEach((k) => used.add(k))))
    Object.values(CATCH_UP).forEach((p) => p.forEach((k) => used.add(k)))
    expect([...used].filter((k) => !hasExercise(k))).toEqual([])
  })
})

describe('six blocks of training (24 weeks)', () => {
  it('keeps the main lifts the same in every block', () => {
    for (const day of DAY_ORDER) {
      const first = keys(plan(day, 0, 1), 'main')
      for (const w of allWeeks) expect(keys(plan(day, w.blockIndex, w.week), 'main')).toEqual(first)
    }
  })

  it('never changes an accessory in the middle of a block', () => {
    for (const day of DAY_ORDER)
      for (let b = 0; b < 6; b++) {
        const week1 = plan(day, b, 1)
        for (let w = 2; w <= 4; w++) {
          const later = plan(day, b, w)
          const shared = later.lifts.filter((l) => l.kind !== 'main')
          for (const l of shared) {
            const same = week1.lifts.find((x) => x.role === l.role)
            if (same) expect(l.key).toBe(same.key)
          }
        }
      }
  })

  it('rotates about half the accessory slots at each block boundary', () => {
    const a0 = plan('A', 0, 4)
    const a1 = plan('A', 1, 1)
    const common = a0.lifts.filter((l) => l.kind === 'accessory' && a1.lifts.some((x) => x.role === l.role))
    const changed = common.filter((l) => a1.lifts.find((x) => x.role === l.role)!.key !== l.key).length
    expect(changed).toBeGreaterThan(0)
    expect(changed).toBeLessThan(common.length)
  })

  it('gives every strength day 3 to 7 accessories, following the phase rules', () => {
    for (const w of allWeeks) {
      const n = accessoryCount(w.blockIndex, w.week)
      expect(n).toBeGreaterThanOrEqual(3)
      expect(n).toBeLessThanOrEqual(7)
      if (phaseOf(w.blockIndex) === 'strength' && !isRecoveryWeek(w.blockIndex, w.week)) expect(n).toBeLessThanOrEqual(4)
      for (const day of ['A', 'B', 'D'] as DayKey[]) {
        const got = keys(plan(day, w.blockIndex, w.week), 'accessory').length
        expect(got).toBeGreaterThanOrEqual(3)
        expect(got).toBeLessThanOrEqual(n)
      }
    }
    expect([1, 2, 3, 4].map((w) => accessoryCount(0, w))).toEqual([4, 5, 5, 6])
  })

  it('schedules a lighter week every eighth week and not before', () => {
    const recovery = allWeeks.filter((w) => isRecoveryWeek(w.blockIndex, w.week)).map((w) => w.blockIndex * 4 + w.week)
    expect(recovery).toEqual([8, 16, 24])
    const light = plan('A', 1, 4)
    expect(light.recovery).toBe(true)
    expect(keys(light, 'accessory').length).toBe(3)
    expect(light.lifts.filter((l) => l.kind === 'main').every((l) => l.sets === 2)).toBe(true)
  })

  it('keeps every session within 70 minutes', () => {
    for (const day of DAY_ORDER) for (const w of allWeeks) expect(plan(day, w.blockIndex, w.week).minutes).toBeLessThanOrEqual(70)
  })

  it('never repeats an exercise within a session', () => {
    for (const day of DAY_ORDER)
      for (const w of allWeeks) {
        const all = plan(day, w.blockIndex, w.week).lifts.map((l) => l.key)
        expect(new Set(all).size).toBe(all.length)
      }
  })
})

describe('day-specific rules', () => {
  it('ends days A, B and D with a two-exercise core finisher, in every week', () => {
    for (const day of ['A', 'B', 'D'] as DayKey[])
      for (const w of allWeeks) {
        const f = plan(day, w.blockIndex, w.week).lifts.filter((l) => l.kind === 'finisher')
        expect(f.length).toBe(2)
        expect(f.every((l) => exercise(l.key).group === 'core')).toBe(true)
      }
  })

  it('always includes an incline press as the first accessory on day B', () => {
    for (const w of allWeeks) expect(keys(plan('B', w.blockIndex, w.week), 'accessory')[0]).toMatch(/incline/)
  })

  it('gives day C a leg, a push and a pull top-up', () => {
    const groups = plan('C', 0, 1).lifts.filter((l) => l.kind === 'topup').map((l) => exercise(l.key).group)
    expect(groups.length).toBe(3)
    expect(['quads', 'hamstrings', 'glutes']).toContain(groups[0])
    expect(['chest', 'shoulders']).toContain(groups[1])
    expect(groups[2]).toBe('back')
  })

  it('aims day C top-ups at whichever muscle group is furthest behind', () => {
    const p = plan('C', 0, 1, { setsByGroup: { quads: 9, glutes: 8, hamstrings: 1, chest: 8, shoulders: 2 } })
    const groups = p.lifts.filter((l) => l.kind === 'topup').map((l) => exercise(l.key).group)
    expect(groups.slice(0, 2)).toEqual(['hamstrings', 'shoulders'])
  })

  it('fills the open day D slots from the muscle groups furthest behind', () => {
    const p = plan('D', 0, 4, { setsByGroup: { glutes: 9, shoulders: 9, hamstrings: 9, biceps: 9, triceps: 9, forearms: 9, calves: 0, hips: 1 } })
    const groups = p.lifts.filter((l) => l.role.startsWith('Catch-up')).map((l) => exercise(l.key).group)
    expect(groups.slice(0, 2)).toEqual(['calves', 'hips'])
  })
})

describe('per-user settings', () => {
  it('gives each person their own pulling main lift on day B', () => {
    const ryan = plan('B', 0, 1, { settings: { ...defaultSettings, pullMain: 'pull_up' } })
    const stella = plan('B', 0, 1, { settings: { ...defaultSettings, pullMain: 'lat_pulldown' } })
    expect(keys(ryan, 'main')).toEqual(['barbell_bench', 'pull_up'])
    expect(keys(stella, 'main')).toEqual(['barbell_bench', 'lat_pulldown'])
    expect(stella.lifts[1].note).toMatch(/practice/)
  })

  it('swaps free-barbell main lifts to their solo versions when training alone', () => {
    expect(keys(plan('A', 0, 1, { trainingAlone: true }), 'main')).toEqual(['smith_squat', 'db_rdl'])
    expect(keys(plan('B', 0, 1, { trainingAlone: true }), 'main')[0]).toBe('smith_bench')
  })

  it('never selects a banned exercise, or one needing equipment we lack', () => {
    const settings = { ...defaultSettings, ankleStrap: false, partner: false, bans: ['bulgarian_split_squat'] }
    for (const day of DAY_ORDER)
      for (const w of allWeeks)
        for (const l of planSession({ day, ...w, settings }).lifts) {
          expect(l.key).not.toBe('bulgarian_split_squat')
          expect(exercise(l.key).needs).toBeUndefined()
        }
  })

  it('keeps a pinned exercise in its slot across blocks', () => {
    const settings = { ...defaultSettings, pins: ['walking_lunge'] }
    for (let b = 0; b < 6; b++) expect(keys(planSession({ day: 'A', blockIndex: b, week: 1, settings }), 'accessory')[0]).toBe('walking_lunge')
  })
})

describe('weekly volume', () => {
  it('reaches about 10 hard sets a week for the big muscle groups from the second block, on four sessions', () => {
    const totals: Record<string, number> = {}
    for (const day of DAY_ORDER)
      for (const l of plan(day, 1, 2).lifts) {
        const g = exercise(l.key).group
        totals[g] = (totals[g] ?? 0) + l.sets
      }
    const legs = (totals.quads ?? 0) + (totals.hamstrings ?? 0) + (totals.glutes ?? 0)
    expect(legs).toBeGreaterThanOrEqual(20)
    for (const g of ['chest', 'back', 'shoulders']) expect(totals[g], g).toBeGreaterThanOrEqual(8)
    expect(totals.core).toBeGreaterThanOrEqual(16)
  })
})
