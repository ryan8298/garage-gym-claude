import { afterEach, describe, expect, it } from 'vitest'
import { curatedExercises, exercises } from '../src/lib/exercises'
import { activeGym, availableAt, gearOf, gymsOf, homeGym, publicGym, rankForGym } from '../src/lib/gym'
import { achievableLoads, breakdown, nearestLoad, setGear } from '../src/lib/plates'
import { defaultProgram } from '../src/lib/programState'

afterEach(() => setGear())

describe('exercise library', () => {
  it('holds our own exercises plus the wider library, with no key used twice', () => {
    expect(curatedExercises.length).toBe(86)
    expect(exercises.length).toBeGreaterThan(600)
    expect(new Set(exercises.map((e) => e.key)).size).toBe(exercises.length)
  })
  it('gives every exercise a muscle group and an equipment tag', () => {
    for (const e of exercises) {
      expect(e.group, e.key).toBeTruthy()
      expect(e.equip, e.key).toBeTruthy()
    }
  })
})

describe('gym profiles', () => {
  it('starts with a home gym and a public gym, home first', () => {
    const gyms = gymsOf(defaultProgram)
    expect(gyms.map((g) => g.id)).toEqual(['home', 'public'])
    expect(activeGym(defaultProgram).id).toBe('home')
    expect(activeGym({ ...defaultProgram, gym: 'public' }).id).toBe('public')
  })
  it('carries the older plate setting into the home gym', () => {
    expect(gymsOf({ ...defaultProgram, plates: { '45': 2 } })[0].plates).toEqual({ '45': 2 })
  })
  it('knows what can be done where, and always allows bodyweight', () => {
    const home = homeGym()
    expect(availableAt(home, { equip: 'barbell' })).toBe(true)
    expect(availableAt(home, { equip: 'machine' })).toBe(false)
    expect(availableAt({ ...home, equipment: [] }, { equip: 'bodyweight' })).toBe(true)
    expect(availableAt(publicGym(), { equip: 'machine' })).toBe(true)
  })
  it('ranks without removing anything', () => {
    const list = [{ equip: 'machine' as const, n: 1 }, { equip: 'barbell' as const, n: 2 }, { equip: 'kettlebell' as const, n: 3 }]
    const ranked = rankForGym(homeGym(), list)
    expect(ranked.map((x) => x.n)).toEqual([2, 1, 3])
    expect(ranked.length).toBe(list.length)
  })
})

describe('plate math follows the gym', () => {
  it('uses the public gym bars, plates and dumbbells', () => {
    setGear(gearOf(publicGym()))
    expect(nearestLoad('barbell', 315)).toBe(315)
    expect(breakdown('barbell', 315)?.plates).toEqual([45, 45, 45])
    expect(breakdown('smith', 115)?.text).toContain('25 lb Smith bar')
    expect(breakdown('smith', 425)?.overLimit).toBe(false)
    expect(achievableLoads('dumbbell').at(-1)).toBe(100)
  })
  it('goes back to our own equipment', () => {
    setGear(gearOf(publicGym()))
    setGear(gearOf(homeGym()))
    expect(nearestLoad('barbell', 405)).toBeLessThan(405)
    expect(breakdown('smith', 123)?.text).toContain('33 lb Smith bar')
    expect(achievableLoads('dumbbell').at(-1)).toBe(50)
  })
  it('lets any weight in 2.5 lb steps be entered for equipment without plate math', () => {
    expect(nearestLoad('free', 62)).toBe(62.5)
    expect(breakdown('free', 62.5)).not.toBeNull()
  })
})
