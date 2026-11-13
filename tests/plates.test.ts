import { describe, expect, it } from 'vitest'
import { achievableLoads, breakdown, loadAtOrBelow, nearestLoad, stepDown, stepUp, warmupLoads } from '../src/lib/plates'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('plate math', () => {
  it('starts each bar at its own weight and moves in 2.5 lb steps', () => {
    expect(achievableLoads('barbell').slice(0, 4)).toEqual([45, 47.5, 50, 52.5])
    expect(achievableLoads('smith').slice(0, 4)).toEqual([33, 35.5, 38, 40.5])
  })

  it('tops out at every plate we own', () => {
    expect(Math.max(...achievableLoads('barbell'))).toBe(45 + 277.5)
    expect(Math.max(...achievableLoads('cable'))).toBe(277.5)
  })

  it('knows 135 cannot be loaded on the 33 lb Smith bar, and offers the nearest weights', () => {
    expect(breakdown('smith', 135)).toBeNull()
    expect(nearestLoad('smith', 135)).toBe(135.5)
    expect(loadAtOrBelow('smith', 135)).toBe(133)
    expect(breakdown('smith', 133)!.plates).toEqual([45, 5])
  })

  it('loads 135 on the barbell with a single 45 per side', () => {
    const b = breakdown('barbell', 135)!
    expect(b.plates).toEqual([45])
    expect(b.text).toBe('Per side: 45 on the 45 lb bar')
  })

  it('gives a breakdown that adds up for every loadable weight, never using a plate twice per side', () => {
    for (const mode of ['barbell', 'smith'] as const)
      for (const w of achievableLoads(mode)) {
        const b = breakdown(mode, w)!
        expect(mode === 'barbell' ? 45 + 2 * sum(b.plates) : 33 + 2 * sum(b.plates)).toBe(w)
        expect(new Set(b.plates).size).toBe(b.plates.length)
      }
    for (const w of achievableLoads('cable')) {
      const b = breakdown('cable', w)!
      expect(sum(b.plates)).toBe(w)
      for (const p of new Set(b.plates)) expect(b.plates.filter((x) => x === p).length).toBeLessThanOrEqual(2)
    }
  })

  it('uses the fewest plates', () => {
    expect(breakdown('barbell', 145)!.plates).toEqual([45, 5]) // 50 per side, not 35 + 15
    expect(breakdown('cable', 50)!.plates.length).toBe(2)
  })

  it('steps up and down by the smallest loadable amount', () => {
    expect(stepUp('barbell', 135)).toBe(137.5)
    expect(stepDown('barbell', 45)).toBe(45)
    expect(stepUp('cable', 20)).toBe(21.25)
    expect(stepUp('dumbbell', 25)).toBe(30)
    expect(stepUp('dumbbell', 50)).toBe(50)
    expect(stepUp('added', 0)).toBe(5)
  })

  it('flags a Smith load over the 275 lb plate limit', () => {
    expect(breakdown('smith', 33 + 277.5)!.overLimit).toBe(true)
    expect(breakdown('smith', 33 + 270)!.overLimit).toBe(false)
  })

  it('only offers dumbbells we own', () => {
    expect(breakdown('dumbbell', 30)!.text).toBe('30 lb dumbbells')
    expect(breakdown('dumbbell', 32.5)).toBeNull()
  })

  it('builds warm-up sets that are loadable and lighter than the working weight', () => {
    const w = warmupLoads('barbell', 185)
    expect(w.length).toBeGreaterThanOrEqual(2)
    for (const x of w) {
      expect(x).toBeLessThan(185)
      expect(breakdown('barbell', x)).not.toBeNull()
    }
    expect(warmupLoads('barbell', 45)).toEqual([])
    expect(warmupLoads('added', 0)).toEqual([])
  })
})
