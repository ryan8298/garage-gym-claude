/** Local calendar date as yyyy-mm-dd. Never derived from UTC. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseLocal(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(date: string, n: number): string {
  const d = parseLocal(date)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

/** Monday of the week containing the date. Weeks start on Monday. */
export function weekStart(date: string): string {
  const d = parseLocal(date)
  return addDays(date, -((d.getDay() + 6) % 7))
}

export function weekDays(date: string): string[] {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const longDate = (date: string) =>
  parseLocal(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
export const shortDate = (date: string) =>
  parseLocal(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export function partOfDay(d = new Date()): string {
  const h = d.getHours()
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
}
