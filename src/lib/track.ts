/** Distance and pace for a route tracked with the phone's location. Pure functions, so they can be tested. */

export type Point = [number, number]
const MILE = 1609.344

/** Metres between two points on the earth. */
export function metresBetween(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const dLat = (b[0] - a[0]) * rad
  const dLng = (b[1] - a[1]) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export const routeMiles = (route: Point[]): number => route.reduce((sum, p, i) => (i ? sum + metresBetween(route[i - 1], p) : 0), 0) / MILE

/**
 * Should a new location reading be added to the route? Readings the phone is
 * unsure of are ignored, as are tiny moves (standing still looks like
 * wandering) and impossible jumps.
 */
export function accept(last: { point: Point; at: number } | null, next: { point: Point; at: number; accuracy: number }): boolean {
  if (next.accuracy > 35) return false
  if (!last) return true
  const moved = metresBetween(last.point, next.point)
  if (moved < 4) return false
  const seconds = Math.max(1, (next.at - last.at) / 1000)
  // Faster than about 27 mph on foot or bike is a bad reading.
  return moved / seconds <= 12
}

/** Minutes and seconds per mile, or "" when there is not enough distance to say. */
export function pace(seconds: number, miles: number): string {
  if (miles < 0.05 || seconds <= 0) return ''
  const per = seconds / miles
  return `${Math.floor(per / 60)}:${String(Math.round(per % 60)).padStart(2, '0')}`
}

/** Keep a route small enough to store: every nth point, always with the last one. */
export function thin(route: Point[], max = 1500): Point[] {
  if (route.length <= max) return route
  const stride = Math.ceil(route.length / max)
  const out = route.filter((_, i) => i % stride === 0)
  if (out[out.length - 1] !== route[route.length - 1]) out.push(route[route.length - 1])
  return out
}
