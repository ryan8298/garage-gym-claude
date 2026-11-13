import { describe, expect, it } from 'vitest'
import { checkProposal, checkQuickWorkout, sanitize, type CoachContext, type Proposal } from '../supabase/functions/coach/rules'
import { coachContext } from '../src/lib/coach'
import { defaultProgram } from '../src/lib/programState'

const ctx: CoachContext = coachContext(defaultProgram)
const p = (over: Partial<Proposal>): Proposal => ({ kind: 'swap_main', day: 'A', target: 'A1', exercise_key: 'smith_squat', order: null, reason: 'test', ...over })

describe('coach output is checked before the app uses it', () => {
  it('accepts a main-lift swap within the allowed alternatives', () => {
    expect(checkProposal(p({}), ctx)).toBeNull()
  })

  it('rejects an exercise that is not in the library', () => {
    expect(checkProposal(p({ exercise_key: 'leg_press' }), ctx)).toMatch(/not an exercise/)
    expect(checkProposal(p({ kind: 'lock_slot', target: 'Calves', exercise_key: 'seated_machine_calf_raise' }), ctx)).toMatch(/not an exercise/)
  })

  it('rejects a real exercise put where it does not belong', () => {
    expect(checkProposal(p({ exercise_key: 'barbell_curl' }), ctx)).toMatch(/not an allowed alternative/)
    expect(checkProposal(p({ kind: 'lock_slot', target: 'Calves', exercise_key: 'barbell_curl' }), ctx)).toMatch(/does not belong/)
    expect(checkProposal(p({ target: 'Z9' }), ctx)).toMatch(/not a main lift/)
    expect(checkProposal(p({ day: 'E' }), ctx)).toMatch(/not a training day/)
  })

  it('rejects an exercise that needs equipment we do not have', () => {
    const noStrap = coachContext({ ...defaultProgram, ankleStrap: false })
    expect(checkProposal(p({ kind: 'lock_slot', target: 'Hamstring curl', exercise_key: 'cable_leg_curl' }), noStrap)).toMatch(/ankle strap/)
    expect(checkProposal(p({ kind: 'lock_slot', target: 'Hamstring curl', exercise_key: 'cable_leg_curl' }), ctx)).toBeNull()
  })

  it('only accepts a slot order that lists every slot once', () => {
    const roles = ctx.program.days.A.slots.filter((s) => s.reorderable).map((s) => s.role)
    expect(checkProposal(p({ kind: 'reorder_slots', order: [...roles].reverse() }), ctx)).toBeNull()
    expect(checkProposal(p({ kind: 'reorder_slots', order: roles.slice(1) }), ctx)).toMatch(/exactly once/)
    expect(checkProposal(p({ kind: 'reorder_slots', order: [...roles.slice(1), 'Made up'] }), ctx)).toMatch(/exactly once/)
  })

  it('throws out a quick workout containing anything we cannot do, or silly numbers', () => {
    const good = { title: 'Quick upper body', lifts: [{ exercise_key: 'db_bench', sets: 3, low: 8, high: 12 }, { exercise_key: 'db_row', sets: 3, low: 8, high: 12 }] }
    expect(checkQuickWorkout(good, ctx)).not.toBeNull()
    expect(checkQuickWorkout({ ...good, lifts: [...good.lifts, { exercise_key: 'pec_deck', sets: 3, low: 8, high: 12 }] }, ctx)).toBeNull()
    expect(checkQuickWorkout({ ...good, lifts: [{ exercise_key: 'db_bench', sets: 40, low: 8, high: 12 }] }, ctx)).toBeNull()
    expect(checkQuickWorkout({ ...good, lifts: [{ exercise_key: 'db_bench', sets: 3, low: 12, high: 8 }] }, ctx)).toBeNull()
    expect(checkQuickWorkout({ ...good, lifts: [] }, ctx)).toBeNull()
  })

  it('keeps the good parts of a reply and drops the bad ones', () => {
    const out = sanitize(
      {
        reply: 'Here is what I would change.',
        proposals: [p({}), p({ exercise_key: 'hack_squat' }), p({ kind: 'lock_slot', target: 'Calves', exercise_key: 'smith_calf_raise' })],
        quick_workout: { title: 'Bad', lifts: [{ exercise_key: 'leg_extension', sets: 3, low: 10, high: 15 }] },
      },
      ctx,
    )
    expect(out.proposals.map((x) => x.exercise_key)).toEqual(['smith_squat', 'smith_calf_raise'])
    expect(out.quick_workout).toBeNull()
    expect(out.dropped).toBe(2)
  })
})
