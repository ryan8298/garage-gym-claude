import { describe, expect, it } from 'vitest'
import { intervalAt, intervalTotal } from '../src/lib/intervals'

const plan = { work: 30, rest: 10, rounds: 3 }

describe('interval timer', () => {
  it('counts down five seconds before the first round', () => {
    expect(intervalAt(plan, 0)).toEqual({ phase: 'ready', round: 1, left: 5 })
    expect(intervalAt(plan, 4.5)).toEqual({ phase: 'ready', round: 1, left: 1 })
  })
  it('alternates work and rest and counts the rounds', () => {
    expect(intervalAt(plan, 5)).toEqual({ phase: 'work', round: 1, left: 30 })
    expect(intervalAt(plan, 5 + 30)).toEqual({ phase: 'rest', round: 1, left: 10 })
    expect(intervalAt(plan, 5 + 40)).toEqual({ phase: 'work', round: 2, left: 30 })
    expect(intervalAt(plan, 5 + 80 + 29.5)).toEqual({ phase: 'work', round: 3, left: 1 })
  })
  it('ends after the last work period with no trailing rest', () => {
    expect(intervalTotal(plan)).toBe(110)
    expect(intervalAt(plan, 5 + 110).phase).toBe('done')
  })
  it('handles no rest at all', () => {
    expect(intervalAt({ work: 20, rest: 0, rounds: 2 }, 5 + 20)).toEqual({ phase: 'work', round: 2, left: 20 })
  })
})
