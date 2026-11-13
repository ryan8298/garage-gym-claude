import { describe, expect, it } from 'vitest'
import { accept, metresBetween, pace, routeMiles, thin, type Point } from '../src/lib/track'

describe('route tracking', () => {
  it('measures distance between points', () => {
    // One thousandth of a degree of latitude is about 111 metres.
    expect(metresBetween([40, -75], [40.001, -75])).toBeCloseTo(111.2, 0)
    const mile: Point[] = [[40, -75], [40.01447, -75]]
    expect(routeMiles(mile)).toBeCloseTo(1, 2)
    expect(routeMiles([])).toBe(0)
  })
  it('ignores unsure readings, standing still and impossible jumps', () => {
    const last = { point: [40, -75] as Point, at: 0 }
    expect(accept(null, { point: [40, -75], at: 0, accuracy: 10 })).toBe(true)
    expect(accept(null, { point: [40, -75], at: 0, accuracy: 80 })).toBe(false)
    expect(accept(last, { point: [40.00001, -75], at: 2000, accuracy: 5 })).toBe(false)
    expect(accept(last, { point: [40.0001, -75], at: 4000, accuracy: 5 })).toBe(true)
    expect(accept(last, { point: [40.01, -75], at: 2000, accuracy: 5 })).toBe(false)
  })
  it('gives pace per mile', () => {
    expect(pace(600, 1)).toBe('10:00')
    expect(pace(495, 1)).toBe('8:15')
    expect(pace(30, 0.01)).toBe('')
  })
  it('thins a long route and keeps its end', () => {
    const long: Point[] = Array.from({ length: 5000 }, (_, i) => [40 + i / 100000, -75])
    const short = thin(long, 1000)
    expect(short.length).toBeLessThanOrEqual(1001)
    expect(short[0]).toEqual(long[0])
    expect(short[short.length - 1]).toEqual(long[4999])
  })
})
