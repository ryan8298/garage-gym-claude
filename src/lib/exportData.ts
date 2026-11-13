import { db } from './db'

/** Everything that belongs to one user, as one object. Read from the phone, so it works offline. */
export async function exportAll(userId: string) {
  const mine = <T extends { user_id: string; deleted: boolean }>(rows: T[]) => rows.filter((r) => r.user_id === userId && !r.deleted)
  const sessions = mine(await db.workout_sessions.toArray())
  const lifts = mine(await db.session_exercises.toArray())
  const sets = mine(await db.sets.toArray())
  return {
    exported_at: new Date().toISOString(),
    app: 'Garage Gym',
    profile: (await db.profiles.get(userId)) ?? null,
    program: (await db.program_state.get(userId))?.data ?? null,
    daily_logs: mine(await db.daily_logs.toArray()),
    cardio: mine(await db.cardio_entries.toArray()),
    measurements: mine(await db.body_measurements.toArray()),
    goals: mine(await db.goals.toArray()),
    workouts: sessions
      .sort((a, b) => (a.started_at < b.started_at ? -1 : 1))
      .map((s) => ({
        ...s,
        exercises: lifts
          .filter((l) => l.session_id === s.id)
          .sort((a, b) => a.position - b.position)
          .map((l) => ({ ...l, sets: sets.filter((x) => x.session_exercise_id === l.id).sort((a, b) => a.position - b.position) })),
      })),
  }
}

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n'

export async function workoutsCsv(userId: string): Promise<string> {
  const data = await exportAll(userId)
  const rows: unknown[][] = []
  for (const w of data.workouts)
    for (const e of w.exercises)
      e.sets.forEach((s, i) => {
        if (s.done) rows.push([w.local_date, w.title, e.name, i + 1, s.set_type, s.weight, s.reps, s.duration_seconds])
      })
  return csv(['date', 'workout', 'exercise', 'set', 'type', 'weight_lb', 'reps', 'seconds'], rows)
}

export async function dailyLogsCsv(userId: string): Promise<string> {
  const data = await exportAll(userId)
  return csv(
    ['date', 'body_weight_lb', 'steps', 'sleep_hours', 'energy', 'soreness', 'note'],
    data.daily_logs.sort((a, b) => (a.log_date < b.log_date ? -1 : 1)).map((l) => [l.log_date, l.body_weight, l.steps, l.sleep_hours, l.energy, l.soreness, l.note]),
  )
}

/** Hand a file to the user: the iOS share sheet where available, a normal download otherwise. */
export async function deliver(name: string, text: string, type: string) {
  const file = new File([text], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
