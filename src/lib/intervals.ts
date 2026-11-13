export interface Plan {
  work: number
  rest: number
  rounds: number
}

/** Where we are at a given number of seconds into the session. A 5 second countdown comes first. */
export function intervalAt(plan: Plan, elapsed: number): { phase: 'ready' | 'work' | 'rest' | 'done'; round: number; left: number } {
  if (elapsed < 5) return { phase: 'ready', round: 1, left: Math.ceil(5 - elapsed) }
  let t = elapsed - 5
  for (let round = 1; round <= plan.rounds; round++) {
    if (t < plan.work) return { phase: 'work', round, left: Math.ceil(plan.work - t) }
    t -= plan.work
    // No rest after the last round.
    if (round < plan.rounds) {
      if (t < plan.rest) return { phase: 'rest', round, left: Math.ceil(plan.rest - t) }
      t -= plan.rest
    }
  }
  return { phase: 'done', round: plan.rounds, left: 0 }
}
export const intervalTotal = (p: Plan) => p.rounds * p.work + (p.rounds - 1) * p.rest
