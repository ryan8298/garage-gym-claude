import { describe, expect, it } from 'vitest'
import { recommend } from '../src/lib/builder'
import { defaultSettings, planSession } from '../src/lib/engine'
import { hasExercise } from '../src/lib/exercises'
import { ALL_DAYS, TEMPLATES, programDef } from '../src/lib/program'
import { defaultProgram, nextDay } from '../src/lib/programState'

describe('programs to choose from', () => {
  it('have day keys and main lift ids that are unique across all programs', () => {
    const days = ALL_DAYS.map((d) => d.key)
    const mains = ALL_DAYS.flatMap((d) => d.mains.map((m) => m.id))
    expect(new Set(days).size).toBe(days.length)
    expect(new Set(mains).size).toBe(mains.length)
  })
  it('use only exercises that exist, and no slot role twice in a day', () => {
    for (const d of ALL_DAYS) {
      for (const m of d.mains) for (const k of [m.key, m.alone, ...m.alternatives]) if (k) expect(hasExercise(k), `${d.key} ${k}`).toBe(true)
      for (const s of [...d.slots, ...d.finisher]) for (const k of s.pool) expect(hasExercise(k), `${d.key} ${k}`).toBe(true)
      const roles = [...d.slots, ...d.finisher].map((s) => s.role)
      expect(new Set(roles).size, d.key).toBe(roles.length)
    }
  })
  it('give every day two main lifts, accessories, a finisher and a session within the time cap, in every block', () => {
    for (const def of TEMPLATES)
      for (const day of def.order)
        for (let blockIndex = 0; blockIndex < 6; blockIndex++)
          for (let week = 1; week <= 4; week++) {
            const p = planSession({ def, day, blockIndex, week })
            const label = `${def.id} ${day} b${blockIndex} w${week}`
            expect(p.lifts.filter((l) => l.kind === 'main').length, label).toBe(2)
            expect(p.lifts.filter((l) => l.kind === 'accessory').length, label).toBeGreaterThanOrEqual(3)
            expect(new Set(p.lifts.map((l) => l.key)).size, label).toBe(p.lifts.length)
            expect(p.minutes, label).toBeLessThanOrEqual(70)
          }
  })
  it('use each person\'s own pull on every program that has one', () => {
    for (const [id, day] of [['full3', 'FC'], ['upperlower4', 'U1'], ['ppl3', 'PL']] as const) {
      const mains = (pullMain: 'pull_up' | 'lat_pulldown') => planSession({ def: programDef(id), day, blockIndex: 0, week: 1, settings: { ...defaultSettings, pullMain } }).lifts.filter((l) => l.kind === 'main').map((l) => l.key)
      expect(mains('pull_up')).toContain('pull_up')
      expect(mains('lat_pulldown')).toContain('lat_pulldown')
    }
  })
  it('rotate through the days of the chosen program', () => {
    expect(nextDay(defaultProgram)).toBe('A')
    expect(nextDay({ ...defaultProgram, template: 'ppl3', queueIndex: 4 })).toBe('PL')
    expect(nextDay({ ...defaultProgram, template: 'full3', queueIndex: 3 })).toBe('FA')
    expect(nextDay({ ...defaultProgram, template: 'gone', queueIndex: 1 })).toBe('B')
  })
})

describe('session length and my own numbers', () => {
  it('keeps to a shorter session by dropping accessories, never main lifts', () => {
    const long = planSession({ day: 'A', blockIndex: 1, week: 4 - 1 })
    const short = planSession({ day: 'A', blockIndex: 1, week: 3, settings: { ...defaultSettings, maxMinutes: 30 } })
    expect(short.minutes).toBeLessThanOrEqual(34)
    expect(short.lifts.length).toBeLessThan(long.lifts.length)
    expect(short.lifts.filter((l) => l.kind === 'main').length).toBe(2)
  })
  it('gives more accessory work for muscle and less for strength', () => {
    const n = (accessoryDelta: number) => planSession({ day: 'A', blockIndex: 0, week: 1, settings: { ...defaultSettings, accessoryDelta } }).lifts.filter((l) => l.kind === 'accessory').length
    expect(n(1)).toBe(n(0) + 1)
    expect(n(-1)).toBe(n(0) - 1)
  })
  it('applies my own sets and reps to a main lift and to a slot', () => {
    const tweaks = { 'A:A1': { sets: 5, low: 3, high: 5 }, 'A:Calves': { sets: 4 } }
    const p = planSession({ day: 'A', blockIndex: 0, week: 2, settings: { ...defaultSettings, tweaks } })
    expect(p.lifts[0]).toMatchObject({ key: 'barbell_back_squat', sets: 5, low: 3, high: 5 })
    expect(p.lifts.find((l) => l.role === 'Calves')?.sets).toBe(4)
    expect(p.lifts[1].sets).toBe(3)
  })
})

describe('program builder', () => {
  it('recommends by days a week, with the goal deciding at four', () => {
    expect(recommend({ goal: 'muscle', days: 2 }).template).toBe('full3')
    expect(recommend({ goal: 'fat_loss', days: 3 }).template).toBe('full3')
    expect(recommend({ goal: 'fat_loss', days: 4 }).template).toBe('standard')
    expect(recommend({ goal: 'strength', days: 4 }).template).toBe('upperlower4')
    expect(recommend({ goal: 'muscle', days: 6 }).template).toBe('ppl3')
  })
})
