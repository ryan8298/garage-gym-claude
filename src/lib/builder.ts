import type { ProgramData } from './programState'

export type Goal = NonNullable<ProgramData['goal']>
export const goalLabels: Record<Goal, string> = { fat_loss: 'Lose fat', muscle: 'Build muscle', strength: 'Get stronger' }
export const SESSION_LENGTHS = [30, 45, 60, 75]

/**
 * Which program suits the answers. Days a week decides most of it: with few
 * days every session must cover the whole body, and with many each day can
 * take one job. The goal breaks the tie at four days.
 */
export function recommend(a: { goal: Goal; days: number }): { template: string; why: string } {
  if (a.days <= 3) return { template: 'full3', why: `With ${a.days} days a week, each muscle group needs work every session to be trained often enough.` }
  if (a.days === 4) {
    if (a.goal === 'fat_loss') return { template: 'standard', why: 'Four days leaves room for a core and conditioning day, which helps most when the aim is fat loss.' }
    return { template: 'upperlower4', why: 'Four days splits cleanly into two upper and two lower sessions, so every muscle is trained hard twice a week.' }
  }
  return { template: 'ppl3', why: `At ${a.days} days a week, giving each day one job keeps sessions short and lets every muscle recover before its next turn.` }
}

export const goalNote: Record<Goal, string> = {
  fat_loss: 'Standard amount of accessory work. Fat loss itself comes from eating less than you burn; training keeps your muscle while you do.',
  muscle: 'One more accessory lift each session, since extra sets are what builds muscle.',
  strength: 'One fewer accessory lift each session, so the main lifts get your best effort.',
}
