import type { Gym } from './db'
import { equipLabels, type Equip, type Exercise } from './exercises'
import { DEFAULT_INVENTORY, SMITH_PLATE_LIMIT, type Gear } from './plates'
import type { ProgramData } from './programState'

export type { Gym }

/** Equipment a gym can be said to have, in the order it is listed. */
export const EQUIPMENT: Equip[] = ['barbell', 'dumbbell', 'cable', 'smith', 'machine', 'kettlebell', 'ez_bar', 'landmine', 'band', 'medicine_ball', 'exercise_ball', 'other']
export const equipmentHint: Partial<Record<Equip, string>> = {
  barbell: 'with a rack or bench',
  cable: 'any cable station or pulley',
  machine: 'leg press, chest press and the like',
  other: 'sleds, boxes, chains, specialty bars',
}
export { equipLabels }

/** Our own garage, before anyone edits it. The plates come from the older plate setting if it was used. */
export const homeGym = (plates?: Record<string, number>): Gym => ({
  id: 'home',
  name: 'Home gym',
  kind: 'home',
  equipment: ['barbell', 'smith', 'cable', 'landmine', 'dumbbell'],
  barbell: 45,
  smith: 33,
  plates: plates ?? DEFAULT_INVENTORY,
  dumbbells: { min: 5, max: 50, step: 5 },
  smithLimit: SMITH_PLATE_LIMIT,
})

/** A commercial gym: assume it has everything, so nobody fills in a long form. */
export const publicGym = (): Gym => ({
  id: 'public',
  name: 'Public gym',
  kind: 'public',
  equipment: [...EQUIPMENT],
  barbell: 45,
  smith: 25,
  plates: { '45': 6, '35': 2, '25': 4, '15': 0, '10': 4, '5': 4, '2.5': 4, '1.25': 0 },
  dumbbells: { min: 5, max: 100, step: 5 },
  smithLimit: null,
})

export const gymsOf = (p: ProgramData): Gym[] => (p.gyms?.length ? p.gyms : [homeGym(p.plates), publicGym()])
export const activeGym = (p: ProgramData): Gym => {
  const all = gymsOf(p)
  return all.find((g) => g.id === p.gym) ?? all[0]
}
export const gearOf = (g: Gym): Gear => ({ plates: g.plates, barbell: g.barbell, smith: g.smith, dumbbells: g.dumbbells, smithLimit: g.smithLimit ?? null })

/** Can this exercise be done here? This only ranks and labels; it never hides an exercise. */
export const availableAt = (g: Gym, e: Pick<Exercise, 'equip'>): boolean => e.equip === 'bodyweight' || g.equipment.includes(e.equip)

/** Exercises that fit this gym first, keeping the given order otherwise. */
export function rankForGym<T extends Pick<Exercise, 'equip'>>(g: Gym, list: T[]): T[] {
  return [...list].sort((a, b) => Number(availableAt(g, b)) - Number(availableAt(g, a)))
}
