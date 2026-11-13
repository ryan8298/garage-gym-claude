import { describe, expect, it } from 'vitest'
import { exercise, muscleCredit } from '../src/lib/exercises'

describe('what a set counts toward', () => {
  it('gives the main muscle a full set and helpers half a set', () => {
    const squat = muscleCredit(exercise('barbell_back_squat'))
    expect(squat.quads).toBe(1)
    expect(squat.glutes).toBe(0.5)
    expect(squat.hamstrings).toBe(0.5)
    expect(squat.chest).toBeUndefined()
  })
  it('never counts one group twice, even when several of its muscles help', () => {
    for (const key of ['barbell_row', 'lat_pulldown', 'barbell_deadlift']) {
      const credit = muscleCredit(exercise(key))
      expect(Object.values(credit).every((v) => v === 1 || v === 0.5), key).toBe(true)
      expect(Object.values(credit).filter((v) => v === 1).length, key).toBe(1)
    }
  })
})
