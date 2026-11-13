import { useLiveQuery } from 'dexie-react-hooks'
import { checkProposal, sanitize, type CoachContext, type CoachOutput, type Proposal, type QuickWorkout } from '../../supabase/functions/coach/rules'
import { db, save, type CoachMessage } from './db'
import { addDays, daysBetween, localDate, weekStart } from './dates'
import { blockPosition, phaseOf, planSession } from './engine'
import { exercise, curatedExercises } from './exercises'
import { achievableLoads } from './plates'
import { DAY_ORDER, PROGRAM } from './program'
import { loadSessions, weekStats } from './progressData'
import { saveProgram, settingsOf, type ProgramData } from './programState'
import { addLiftTo, startSession } from './session'
import { movingAverage } from './stats'
import { supabase } from './supabase'
import { requestSync } from './syncRunner'

export type { Proposal, QuickWorkout }
export type ProposalState = Proposal & { status: 'open' | 'accepted' | 'rejected' }

/** The library and program, described for the coach and for checking its answers. Same for everyone except equipment. */
export function coachContext(program: ProgramData): CoachContext {
  return {
    catalog: curatedExercises.map((e) => ({ key: e.key, name: e.name, group: e.group, station: e.station, ...(e.needs ? { needs: e.needs } : {}) })),
    program: {
      days: Object.fromEntries(
        DAY_ORDER.map((d) => [
          d,
          {
            title: PROGRAM[d].title,
            mains: PROGRAM[d].mains.map((m) => ({ id: m.id, options: [m.key, m.alone, ...m.alternatives].filter((k): k is string => !!k) })),
            slots: [...PROGRAM[d].slots.map((s) => ({ role: s.role, pool: s.pool, reorderable: true })), ...PROGRAM[d].finisher.map((s) => ({ role: s.role, pool: s.pool, reorderable: false }))],
          },
        ]),
      ),
    },
    equipment: { ankleStrap: program.ankleStrap, partner: program.partner },
  }
}

const step = (mode: 'barbell' | 'smith' | 'cable') => {
  const loads = achievableLoads(mode)
  return loads.length > 1 ? `${loads[0]} lb then steps of ${Number((loads[1] - loads[0]).toFixed(2))} lb` : `${loads[0]} lb only`
}

/** A compact summary of one person's recent training, sent with each question. */
export async function trainingData(userId: string, program: ProgramData, latestSessionId?: string) {
  const today = localDate()
  const since = addDays(today, -56)
  const sessions = (await loadSessions(userId)).filter((s) => s.session.local_date >= since)
  const logs = (await db.daily_logs.where('user_id').equals(userId).toArray()).filter((l) => !l.deleted)
  const cardio = (await db.cardio_entries.where('user_id').equals(userId).toArray()).filter((c) => !c.deleted)
  const goals = (await db.goals.where('user_id').equals(userId).toArray()).filter((g) => !g.deleted)
  const profile = await db.profiles.get(userId)
  const pos = blockPosition(program.startedOn, today, weekStart, daysBetween)
  const settings = settingsOf(program)

  const describe = (s: (typeof sessions)[number]) => ({
    date: s.session.local_date,
    workout: s.session.title,
    minutes: s.minutes,
    effort_1_to_5: s.session.effort,
    note: s.session.note,
    lifts: s.lifts.map((l) => ({
      exercise: l.lift.exercise_key,
      target: (() => {
        const t = l.lift.target as { low?: number; high?: number; unit?: string; rir?: number }
        return `${t.low}-${t.high} ${t.unit === 'sec' ? 'sec' : 'reps'}`
      })(),
      sets: l.sets.map((x) => (x.reps !== null ? `${x.weight ?? 0}x${x.reps}` : `${x.duration_seconds}s`)).join(', '),
      reps_left_on_last_set: (l.lift.target as { rir?: number }).rir ?? null,
      note: l.lift.note,
    })),
  })

  // Per exercise, the last four sessions, so trends and stalls are visible.
  const byExercise: Record<string, { date: string; sets: string }[]> = {}
  for (const s of sessions)
    for (const l of s.lifts) {
      const list = (byExercise[l.lift.exercise_key] ??= [])
      if (list.length < 4) list.push({ date: s.session.local_date, sets: l.sets.map((x) => (x.reps !== null ? `${x.weight ?? 0}x${x.reps}` : `${x.duration_seconds}s`)).join(', ') })
    }

  const weights = movingAverage(logs.filter((l) => l.body_weight !== null).map((l) => ({ date: l.log_date, value: l.body_weight as number })))
  const recentLogs = logs.filter((l) => l.log_date >= addDays(today, -6))
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null)
    return v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)) : null
  }
  const thisWeek = weekStart(today)
  const latest = latestSessionId ? sessions.find((s) => s.session.id === latestSessionId) : undefined

  return {
    today,
    weekly_workout_target: profile?.weekly_target ?? 4,
    daily_step_target: profile?.step_target ?? 8000,
    training_block: { phase: phaseOf(pos.blockIndex), week_of_4: pos.week, block_number: pos.blockIndex + 1, program_started: program.startedOn },
    days_since_last_workout: sessions[0] ? daysBetween(sessions[0].session.local_date, today) : null,
    next_workouts: Object.fromEntries(DAY_ORDER.map((d) => [d, planSession({ day: d, ...pos, settings }).lifts.map((l) => `${l.key} (${l.kind}${l.kind === 'accessory' || l.kind === 'finisher' ? `: ${l.role}` : ''}) ${l.sets}x${l.low}-${l.high}`)])),
    my_choices: { pulling_main_lift: program.pullMain, locked_exercises: program.pins, never_use: program.bans, main_lift_changes: program.mains },
    this_week: weekStats(thisWeek, sessions, logs, cardio),
    last_week: weekStats(addDays(thisWeek, -7), sessions, logs, cardio),
    body_weight: weights.length ? { seven_day_average_now: Number(weights[weights.length - 1].value.toFixed(1)), four_weeks_ago: weights.filter((w) => w.date <= addDays(today, -28)).pop()?.value ?? null, first_logged: weights[0].value } : null,
    last_7_days: { average_sleep_hours: avg(recentLogs.map((l) => l.sleep_hours)), average_energy_1_to_5: avg(recentLogs.map((l) => l.energy)), average_soreness_1_to_5: avg(recentLogs.map((l) => l.soreness)), average_steps: avg(recentLogs.map((l) => l.steps)) },
    goals: goals.map((g) => ({ kind: g.kind, exercise: g.exercise_key, target_lb: g.target_value, by: g.target_date, started_at_lb: g.start_value })),
    loading: `Barbell: ${step('barbell')}. Smith bar: ${step('smith')}. Each cable: ${step('cable')}. Dumbbells: 5 to 50 lb in 5 lb steps.`,
    ...(latest ? { latest_workout: describe(latest) } : {}),
    recent_workouts: sessions.slice(0, 8).map(describe),
    last_sessions_by_exercise: byExercise,
    exercise_names: Object.fromEntries(Object.keys(byExercise).map((k) => [k, (() => { try { return exercise(k).name } catch { return k } })()])),
  }
}

export const useCoachMessages = (userId: string) =>
  useLiveQuery(async () => (await db.coach_messages.where('user_id').equals(userId).toArray()).filter((m) => !m.deleted).sort((a, b) => (a.at < b.at ? -1 : 1)), [userId], [] as CoachMessage[])

async function store(userId: string, m: Pick<CoachMessage, 'role' | 'kind' | 'body' | 'proposals' | 'quick_workout' | 'session_id'>) {
  const row = await save<CoachMessage>(db, 'coach_messages', { id: crypto.randomUUID(), user_id: userId, at: new Date().toISOString(), ...m })
  requestSync()
  return row
}

export interface AskResult {
  error?: string
  used?: number
  limit?: number
}

/** Ask the coach. Needs a connection. The answer is checked again on the phone before it is stored. */
export async function askCoach(userId: string, program: ProgramData, mode: CoachMessage['kind'], message?: string, sessionId?: string): Promise<AskResult> {
  if (!supabase) return { error: 'The app is not connected to a database.' }
  if (!navigator.onLine) return { error: 'The coach needs a connection. Everything else works offline.' }
  const history = (await db.coach_messages.where('user_id').equals(userId).toArray())
    .filter((m) => !m.deleted)
    .sort((a, b) => (a.at < b.at ? -1 : 1))
    .slice(-10)
    .map((m) => ({ role: m.role, text: m.body }))
  if (mode === 'chat' && message) await store(userId, { role: 'user', kind: 'chat', body: message, proposals: [], quick_workout: null, session_id: null })
  const context = coachContext(program)
  const name = (await db.profiles.get(userId))?.display_name ?? ''
  try {
    const { data, error } = await supabase.functions.invoke('coach', { body: { mode, message, name, history, context, data: await trainingData(userId, program, sessionId) } })
    if (error) {
      // The function's own message is in the response body.
      const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
      return { error: (detail as { error?: string } | null)?.error ?? 'The coach could not answer. Try again.' }
    }
    const out = data as CoachOutput & { used?: number; limit?: number; error?: string }
    if (out.error) return { error: out.error }
    const clean = sanitize({ reply: out.reply, proposals: out.proposals ?? [], quick_workout: out.quick_workout ?? null }, context)
    await store(userId, { role: 'coach', kind: mode, body: clean.reply, proposals: clean.proposals.map((p) => ({ ...p, status: 'open' })), quick_workout: clean.quick_workout, session_id: sessionId ?? null })
    return { used: out.used, limit: out.limit }
  } catch {
    return { error: 'The coach could not answer. Try again.' }
  }
}

/** What accepting a proposal changes in a person's program. */
export function programPatch(p: Proposal, program: ProgramData): Partial<ProgramData> {
  const key = p.exercise_key!
  if (p.kind === 'ban_exercise') return { bans: [...new Set([...program.bans, key])], pins: program.pins.filter((x) => x !== key) }
  const day = PROGRAM[p.day as keyof typeof PROGRAM]
  if (p.kind === 'swap_main') {
    const main = day.mains.find((m) => m.id === p.target)!
    const { [main.id]: _old, ...rest } = program.mains
    if (main.id === 'B2' && (key === 'pull_up' || key === 'lat_pulldown')) return { pullMain: key, mains: rest }
    return { mains: key === main.key ? rest : { ...rest, [main.id]: key } }
  }
  if (p.kind === 'lock_slot') {
    const slot = [...day.slots, ...day.finisher].find((s) => s.role === p.target)!
    return { pins: [...program.pins.filter((x) => !slot.pool.includes(x)), key], bans: program.bans.filter((x) => x !== key) }
  }
  const order = (p.order ?? []).map((role) => day.slots.findIndex((s) => s.role === role))
  return { slotOrder: { ...program.slotOrder, [p.day as string]: order } }
}

/** Accept or reject one proposal on a coach message. Accepting applies it to the user's own program. */
export async function decide(userId: string, program: ProgramData, message: CoachMessage, index: number, accept: boolean): Promise<string | null> {
  const proposals = (message.proposals as ProposalState[]).map((p) => ({ ...p }))
  const p = proposals[index]
  if (!p || p.status !== 'open') return null
  if (accept) {
    const problem = checkProposal(p, coachContext(program))
    if (problem) return `That change is no longer possible: ${problem}.`
    await saveProgram(userId, programPatch(p, program))
  }
  p.status = accept ? 'accepted' : 'rejected'
  const { updated_at: _u, synced_at: _s, ...rest } = message
  await save<CoachMessage>(db, 'coach_messages', { ...rest, proposals })
  requestSync()
  return null
}

/** Start the one-off workout the coach built. */
export async function startQuick(userId: string, program: ProgramData, quick: QuickWorkout): Promise<void> {
  const id = await startSession(userId, null, program, { title: quick.title })
  const session = (await db.workout_sessions.get(id))!
  for (const [i, l] of quick.lifts.entries()) {
    const e = exercise(l.exercise_key)
    const timed = e.measure === 'time' || e.measure === 'carry'
    await addLiftTo(session, l.exercise_key, i, { kind: i < 2 ? 'main' : 'accessory', role: 'Coach workout', sets: l.sets, low: l.low, high: l.high, unit: timed ? 'sec' : 'reps', eachSide: e.side })
  }
  requestSync()
}

/** This month's coach use, for the cost display in Settings. */
export async function monthUsage(userId: string): Promise<{ messages: number; cost: number } | null> {
  if (!supabase || !navigator.onLine) return null
  const { data, error } = await supabase.from('coach_usage').select('messages, input_tokens, output_tokens').eq('user_id', userId).gte('day', `${localDate().slice(0, 7)}-01`)
  if (error || !data) return null
  const sum = (f: 'messages' | 'input_tokens' | 'output_tokens') => data.reduce((n, r) => n + Number(r[f]), 0)
  // Upper estimate at list prices for the default model: $4 per million tokens in, $20 per million out.
  return { messages: sum('messages'), cost: (sum('input_tokens') * 4 + sum('output_tokens') * 20) / 1_000_000 }
}
