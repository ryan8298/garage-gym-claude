// Rules the coach's output must pass before the app will show or apply it.
// This file has no dependencies: the app and the server function both use
// it, so the same checks run in both places.

export interface CatalogItem {
  key: string
  name: string
  group: string
  station: string
  needs?: string
}

export interface ProgramShape {
  days: Record<
    string,
    {
      title: string
      /** Each main lift slot and the exercises allowed in it. */
      mains: { id: string; options: string[] }[]
      /** Accessory and finisher slots with the exercises allowed in each. */
      slots: { role: string; pool: string[]; reorderable: boolean }[]
    }
  >
}

export interface CoachContext {
  catalog: CatalogItem[]
  program: ProgramShape
  equipment: { ankleStrap: boolean; partner: boolean }
}

export type ProposalKind = 'swap_main' | 'lock_slot' | 'ban_exercise' | 'reorder_slots'
export interface Proposal {
  kind: ProposalKind
  day: string | null
  /** A main lift id for swap_main, or a slot role for lock_slot. */
  target: string | null
  exercise_key: string | null
  /** Slot roles in the new order, for reorder_slots. */
  order: string[] | null
  reason: string
}

export interface QuickLift {
  exercise_key: string
  sets: number
  low: number
  high: number
}
export interface QuickWorkout {
  title: string
  lifts: QuickLift[]
}

export interface CoachOutput {
  reply: string
  proposals: Proposal[]
  quick_workout: QuickWorkout | null
}

function usable(key: string | null, ctx: CoachContext): string | null {
  const item = ctx.catalog.find((c) => c.key === key)
  if (!item) return `"${key}" is not an exercise in the library`
  if (item.needs === 'ankle_strap' && !ctx.equipment.ankleStrap) return `${item.name} needs an ankle strap`
  if (item.needs === 'partner' && !ctx.equipment.partner) return `${item.name} needs a training partner`
  return null
}

/** Returns why a proposal is not allowed, or null if it is fine. */
export function checkProposal(p: Proposal, ctx: CoachContext): string | null {
  if (p.kind === 'ban_exercise') return ctx.catalog.some((c) => c.key === p.exercise_key) ? null : `"${p.exercise_key}" is not an exercise in the library`
  const day = p.day ? ctx.program.days[p.day] : undefined
  if (!day) return `"${p.day}" is not a training day`
  if (p.kind === 'reorder_slots') {
    const roles = day.slots.filter((s) => s.reorderable).map((s) => s.role)
    const order = p.order ?? []
    const same = order.length === roles.length && new Set(order).size === roles.length && order.every((r) => roles.includes(r))
    return same ? null : 'the new order must list every accessory slot of that day exactly once'
  }
  const problem = usable(p.exercise_key, ctx)
  if (problem) return problem
  if (p.kind === 'swap_main') {
    const main = day.mains.find((m) => m.id === p.target)
    if (!main) return `"${p.target}" is not a main lift on that day`
    return main.options.includes(p.exercise_key!) ? null : 'that exercise is not an allowed alternative for this main lift'
  }
  if (p.kind === 'lock_slot') {
    const slot = day.slots.find((s) => s.role === p.target)
    if (!slot) return `"${p.target}" is not a slot on that day`
    return slot.pool.includes(p.exercise_key!) ? null : 'that exercise does not belong to this slot'
  }
  return 'unknown kind of change'
}

/** A one-off workout is kept only if every lift in it is doable and its numbers are sensible. */
export function checkQuickWorkout(q: QuickWorkout | null, ctx: CoachContext): QuickWorkout | null {
  if (!q || !q.title.trim() || q.lifts.length < 1 || q.lifts.length > 9) return null
  const seen = new Set<string>()
  for (const l of q.lifts) {
    if (usable(l.exercise_key, ctx) || seen.has(l.exercise_key)) return null
    seen.add(l.exercise_key)
    const whole = [l.sets, l.low, l.high].every((n) => Number.isInteger(n))
    if (!whole || l.sets < 1 || l.sets > 5 || l.low < 1 || l.high < l.low || l.high > 120) return null
  }
  return { title: q.title.trim().slice(0, 60), lifts: q.lifts }
}

/** Drop anything the coach suggested that we cannot actually do. */
export function sanitize(out: CoachOutput, ctx: CoachContext): CoachOutput & { dropped: number } {
  const proposals = out.proposals.filter((p) => checkProposal(p, ctx) === null).slice(0, 6)
  const quick = checkQuickWorkout(out.quick_workout, ctx)
  const dropped = out.proposals.length - proposals.length + (out.quick_workout && !quick ? 1 : 0)
  return { reply: out.reply, proposals, quick_workout: quick, dropped }
}
