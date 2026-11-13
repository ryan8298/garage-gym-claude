import { useLiveQuery } from 'dexie-react-hooks'
import { db, save, type FeedReaction, type Profile } from './db'
import { estimatedMax } from './progression'
import { notify } from './push'
import type { DoneSession } from './progressData'
import { requestSync } from './syncRunner'

/** The other person. Their rows arrive through the same sync as ours. */
export function usePartner(userId: string): Profile | null {
  return useLiveQuery(async () => (await db.profiles.toArray()).find((p) => p.id !== userId && !p.deleted) ?? null, [userId], null)
}

export const useReactions = () => useLiveQuery(async () => (await db.feed_reactions.toArray()).filter((r) => !r.deleted), [], [] as FeedReaction[])

export async function toggleReaction(userId: string, sessionId: string, on: boolean) {
  await save<FeedReaction>(db, 'feed_reactions', { id: `${userId}_${sessionId}`, user_id: userId, session_id: sessionId, deleted: !on })
  requestSync(0)
  // Give the reaction a moment to reach the server before asking it to notify.
  if (on) setTimeout(() => void notify('reaction', sessionId), 2500)
}

/** How many lifts in this workout beat everything that person had done before it. */
export function recordsIn(all: DoneSession[], target: DoneSession): number {
  const earlier = all.filter((s) => s.session.started_at < target.session.started_at)
  const score = (sets: DoneSession['lifts'][number]['sets']) => Math.max(0, ...sets.filter((s) => s.reps !== null && (s.weight ?? 0) > 0).map((s) => estimatedMax(s.weight!, s.reps!)))
  let count = 0
  for (const lift of target.lifts) {
    const before = earlier.flatMap((s) => s.lifts.filter((l) => l.lift.exercise_key === lift.lift.exercise_key))
    if (before.length === 0) continue
    const mine = score(lift.sets)
    if (mine > 0 && mine > Math.max(...before.map((l) => score(l.sets)))) count++
  }
  return count
}

const SEEN = 'gg.feedSeen'
export const lastSeenFeed = () => localStorage.getItem(SEEN) ?? ''
export const markFeedSeen = () => localStorage.setItem(SEEN, new Date().toISOString())
