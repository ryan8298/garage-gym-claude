import { describe, expect, it } from 'vitest'
import type { Exercise } from '../src/lib/exercises'
import { gapSuggestions } from '../src/lib/gaps'

const ex = (key: string, group: string, needs?: Exercise['needs']): Exercise => ({ key, name: key, group, station: 'dumbbell', equip: 'dumbbell', curated: true, measure: 'wr', side: false, needs, images: [], primary: [], secondary: [], steps: [] })
const catalog = [ex('squat', 'quads'), ex('lunge', 'quads'), ex('calf_raise', 'calves'), ex('curl', 'biceps'), ex('leg_curl', 'hamstrings', 'ankle_strap'), ex('rdl', 'hamstrings'), ex('plank', 'core')]
const full = Object.fromEntries(['quads', 'hamstrings', 'glutes', 'calves', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'core'].map((g) => [g, 10]))
const base = { catalog, preferred: ['squat', 'lunge', 'calf_raise', 'leg_curl', 'rdl'], bans: [], ankleStrap: true, partner: true }

describe('gap suggestions', () => {
  it('suggests nothing when every muscle group is on target', () => {
    expect(gapSuggestions({ ...base, weekSets: full, session: [] })).toEqual([])
  })
  it("puts today's kind of work before other shortfalls", () => {
    const out = gapSuggestions({ ...base, weekSets: { ...full, calves: 4, biceps: 0 }, session: [] })
    expect(out.map((s) => s.key)).toEqual(['calf_raise', 'curl'])
  })
  it("counts the sets still to do in today's workout", () => {
    const out = gapSuggestions({ ...base, weekSets: { ...full, quads: 6 }, session: [{ key: 'squat', group: 'quads', remaining: 4 }] })
    expect(out).toEqual([])
  })
  it('never suggests an exercise already in the workout, banned, or needing missing equipment', () => {
    const out = gapSuggestions({ ...base, weekSets: { ...full, quads: 0, hamstrings: 0 }, session: [{ key: 'squat', group: 'quads', remaining: 0 }], bans: [], ankleStrap: false })
    expect(out.map((s) => s.key)).toEqual(['lunge', 'rdl'])
    expect(gapSuggestions({ ...base, weekSets: { ...full, quads: 0 }, session: [], bans: ['squat'] })[0].key).toBe('lunge')
  })
})
