/** Small, pure helpers for trends and projections. */

export interface Point {
  date: string // yyyy-mm-dd
  value: number
}

const DAY = 86_400_000
const at = (date: string) => Date.parse(`${date}T12:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** For each point, the average of all points in the `window` days ending on it. */
export function movingAverage(points: Point[], window = 7): Point[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1))
  return sorted.map((p) => {
    const from = at(p.date) - (window - 1) * DAY
    const inside = sorted.filter((q) => at(q.date) >= from && at(q.date) <= at(p.date))
    return { date: p.date, value: inside.reduce((s, q) => s + q.value, 0) / inside.length }
  })
}

/** Least-squares slope in units per day. Null if there are fewer than two distinct days. */
export function slopePerDay(points: Point[]): number | null {
  if (points.length < 2) return null
  const xs = points.map((p) => at(p.date) / DAY)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = points.reduce((a, p) => a + p.value, 0) / points.length
  const denom = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (denom === 0) return null
  return xs.reduce((a, x, i) => a + (x - mx) * (points[i].value - my), 0) / denom
}

/**
 * When the current trend reaches the target. Null if there is no trend yet,
 * the trend points the wrong way, or the date is more than two years out.
 */
export function projectedDate(points: Point[], target: number, today: string): string | null {
  const recent = points.filter((p) => at(p.date) >= at(today) - 42 * DAY)
  const slope = slopePerDay(recent)
  if (slope === null || recent.length < 3) return null
  const latest = [...recent].sort((a, b) => (a.date < b.date ? 1 : -1))[0]
  const gap = target - latest.value
  if (gap === 0) return today
  if (slope === 0 || Math.sign(gap) !== Math.sign(slope)) return null
  const days = gap / slope
  return days > 730 ? null : iso(at(today) + Math.ceil(days) * DAY)
}

/** How far along a goal is, from 0 to 1. */
export function goalProgress(start: number, current: number, target: number): number {
  if (start === target) return 1
  return Math.max(0, Math.min(1, (current - start) / (target - start)))
}
