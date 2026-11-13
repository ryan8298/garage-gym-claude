import { describe, expect, it } from 'vitest'
import { breakdown } from '../src/lib/plates'
import { estimatedMax, suggest, type PastSession } from '../src/lib/progression'

const session = (date: string, weight: number, reps: number[], rir: number | null = null): PastSession => ({ date, rir, sets: reps.map((r) => ({ weight, reps: r, seconds: null })) })
const base = { low: 8, high: 12, unit: 'reps' as const, mode: 'barbell' as const, today: '2026-11-20' }

describe('weight suggestions', () => {
  it('asks a first-timer to find a starting weight', () => {
    const s = suggest({ ...base, history: [] })
    expect(s.reason).toBe('first')
    expect(s.weight).toBeNull()
    expect(s.reps).toBe(8)
  })

  it('keeps the weight and adds a rep while inside the range', () => {
    const s = suggest({ ...base, history: [session('2026-11-17', 135, [10, 9, 9])] })
    expect(s).toMatchObject({ weight: 135, reps: 10, reason: 'add_rep' })
  })

  it('adds the smallest loadable weight once every set reaches the top', () => {
    const s = suggest({ ...base, history: [session('2026-11-17', 135, [12, 12, 12])] })
    expect(s).toMatchObject({ weight: 137.5, reps: 8, reason: 'add_weight' })
  })

  it('does not add weight if one set fell short of the top', () => {
    expect(suggest({ ...base, history: [session('2026-11-17', 135, [12, 12, 11])] }).weight).toBe(135)
  })

  it('moves up a rep early when the last set felt easy', () => {
    const s = suggest({ ...base, history: [session('2026-11-17', 135, [12, 12, 11], 3)] })
    expect(s.reason).toBe('add_weight')
  })

  it('adds reps first when the next dumbbell is a big jump', () => {
    const s = suggest({ ...base, mode: 'dumbbell', history: [session('2026-11-17', 15, [12, 12])] })
    expect(s).toMatchObject({ weight: 15, reps: 13, reason: 'add_rep' })
    const later = suggest({ ...base, mode: 'dumbbell', history: [session('2026-11-17', 15, [15, 15])] })
    expect(later).toMatchObject({ weight: 20, reason: 'add_weight' })
  })

  it('drops about 10% after missing the range two sessions running at the same weight', () => {
    const s = suggest({ ...base, history: [session('2026-11-17', 185, [7, 6, 6]), session('2026-11-13', 185, [8, 7, 6])] })
    expect(s.reason).toBe('ease_back')
    expect(s.weight).toBe(165)
  })

  it('does not drop after a single bad session', () => {
    const s = suggest({ ...base, history: [session('2026-11-17', 185, [7, 6, 6]), session('2026-11-13', 185, [9, 9, 8])] })
    expect(s.weight).toBe(185)
  })

  it('starts about 10% lighter after two weeks away', () => {
    const s = suggest({ ...base, history: [session('2026-11-01', 185, [12, 12, 12])] })
    expect(s.reason).toBe('time_off')
    expect(s.weight).toBe(165)
  })

  it('only ever suggests a weight we can load', () => {
    for (const mode of ['barbell', 'smith', 'cable', 'dumbbell'] as const)
      for (const w of [20, 37.5, 50, 133, 185]) {
        for (const reps of [[12, 12, 12], [7, 7, 7], [10, 9, 8]]) {
          const s = suggest({ ...base, mode, history: [session('2026-11-17', w, reps), session('2026-11-13', w, reps)] })
          if (s.weight !== null && s.weight !== w) expect(breakdown(mode, s.weight), `${mode} ${s.weight}`).not.toBeNull()
        }
      }
  })

  it('progresses bodyweight lifts by reps, then by added weight', () => {
    const more = suggest({ ...base, mode: 'added', history: [{ date: '2026-11-17', rir: null, sets: [{ weight: 0, reps: 9, seconds: null }] }] })
    expect(more).toMatchObject({ weight: 0, reps: 10 })
    const add = suggest({ ...base, mode: 'added', history: [{ date: '2026-11-17', rir: null, sets: [{ weight: 0, reps: 12, seconds: null }] }] })
    expect(add).toMatchObject({ weight: 5, reps: 8 })
  })

  it('progresses timed holds five seconds at a time', () => {
    const s = suggest({ history: [{ date: '2026-11-17', rir: null, sets: [{ weight: null, reps: null, seconds: 30 }] }], low: 20, high: 45, unit: 'sec', mode: 'none', today: '2026-11-20' })
    expect(s.seconds).toBe(35)
  })

  it('estimates a one-rep max', () => {
    expect(Math.round(estimatedMax(133, 10))).toBe(177)
    expect(estimatedMax(200, 1)).toBe(200)
  })
})
