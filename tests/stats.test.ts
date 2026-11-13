import { describe, expect, it } from 'vitest'
import { goalProgress, movingAverage, projectedDate, slopePerDay, weeklyStreak } from '../src/lib/stats'

const days = (start: string, values: number[]) => values.map((value, i) => ({ date: new Date(Date.parse(`${start}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), value }))

describe('trends', () => {
  it('averages over the last seven days, not the last seven entries', () => {
    const avg = movingAverage([{ date: '2026-11-01', value: 200 }, { date: '2026-11-02', value: 198 }, { date: '2026-11-12', value: 190 }])
    expect(avg[1].value).toBe(199)
    expect(avg[2].value).toBe(190) // the two older entries are more than a week back
  })

  it('finds the slope of a steady trend', () => {
    expect(slopePerDay(days('2026-11-01', [200, 199.5, 199, 198.5]))).toBeCloseTo(-0.5)
    expect(slopePerDay([{ date: '2026-11-01', value: 200 }])).toBeNull()
  })

  it('projects when a goal will be reached', () => {
    const points = days('2026-11-01', [200, 199.5, 199, 198.5, 198])
    expect(projectedDate(points, 190, '2026-11-05')).toBe('2026-11-21')
  })

  it('gives no date when the trend is going the wrong way or there is too little data', () => {
    expect(projectedDate(days('2026-11-01', [198, 199, 200]), 190, '2026-11-03')).toBeNull()
    expect(projectedDate(days('2026-11-01', [200, 199]), 190, '2026-11-02')).toBeNull()
  })

  it('measures goal progress in either direction', () => {
    expect(goalProgress(200, 192.4, 180)).toBeCloseTo(0.38)
    expect(goalProgress(135, 160, 185)).toBeCloseTo(0.5)
    expect(goalProgress(200, 205, 180)).toBe(0)
    expect(goalProgress(200, 170, 180)).toBe(1)
  })

  it('counts weeks in a row that hit the workout number', () => {
    const lastThreeWeeks = ['2026-10-26', '2026-10-28', '2026-10-30', '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09']
    // This week (starting Nov 9) has one workout so far: it does not break the streak.
    expect(weeklyStreak(lastThreeWeeks, 3, '2026-11-09')).toBe(2)
    expect(weeklyStreak([...lastThreeWeeks, '2026-11-10', '2026-11-12'], 3, '2026-11-09')).toBe(3)
    // A missed week ends it.
    expect(weeklyStreak(['2026-10-19', '2026-10-21', '2026-10-23', '2026-11-02', '2026-11-04', '2026-11-06'], 3, '2026-11-09')).toBe(1)
    expect(weeklyStreak([], 3, '2026-11-09')).toBe(0)
  })
})
