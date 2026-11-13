import { useLiveQuery } from 'dexie-react-hooks'
import { db, SYNC_TABLES, type Profile } from './db'
import { supabase } from './supabase'
import { requestSync } from './syncRunner'

/** The other people in my group. Their rows arrive through the same sync as mine. */
export const usePartners = (userId: string): Profile[] => useLiveQuery(async () => (await db.profiles.toArray()).filter((p) => p.id !== userId && !p.deleted), [userId], [] as Profile[])

const plain = (message: string | undefined) => (!message || /fetch|network/i.test(message) ? 'No connection. Try again when you have signal.' : message)

/** Make a one-use code that lets someone join my group. */
export async function createInvite(): Promise<{ code?: string; error?: string }> {
  if (!supabase) return { error: 'Not connected.' }
  const { data, error } = await supabase.rpc('create_invite')
  return error ? { error: plain(error.message) } : { code: data as string }
}

/**
 * After my group changes, other people's rows on this phone are no longer mine
 * to see. Remove them and read everything again from the start.
 */
export async function forgetOthers(userId: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of SYNC_TABLES) {
      const own = table === 'profiles' || table === 'program_state' ? 'id' : 'user_id'
      await db.table(table).filter((row) => row[own] !== userId).delete()
      await db.meta.delete(`cursor:${table}`)
    }
  })
  requestSync(0)
}

/**
 * Someone may have left my group, or deleted their account, since this phone
 * last looked. Drop the copies of anyone I can no longer see on the server.
 */
export async function forgetStrangers(userId: string): Promise<void> {
  if (!supabase || !navigator.onLine) return
  const { data, error } = await supabase.from('profiles').select('id')
  if (error || !data) return
  const visible = new Set([userId, ...data.map((p) => p.id as string)])
  const local = (await db.profiles.toArray()).map((p) => p.id)
  const gone = local.filter((id) => !visible.has(id))
  if (gone.length === 0) return
  await db.transaction('rw', db.tables, async () => {
    for (const table of SYNC_TABLES) {
      const own = table === 'profiles' || table === 'program_state' ? 'id' : 'user_id'
      await db.table(table).filter((row) => gone.includes(row[own])).delete()
    }
  })
}

export async function acceptInvite(userId: string, code: string): Promise<string | null> {
  if (!supabase) return 'Not connected.'
  const { error } = await supabase.rpc('accept_invite', { p_code: code })
  if (error) return plain(error.message)
  await forgetOthers(userId)
  return null
}

export async function leaveGroup(userId: string): Promise<string | null> {
  if (!supabase) return 'Not connected.'
  const { error } = await supabase.rpc('leave_group')
  if (error) return plain(error.message)
  await forgetOthers(userId)
  return null
}

export async function deleteAccount(): Promise<string | null> {
  if (!supabase) return 'Not connected.'
  const { error } = await supabase.rpc('delete_my_account')
  return error ? plain(error.message) : null
}

/** Create an account from an invitation. The person then signs in as usual. */
export async function joinWithInvite(input: { code: string; name: string; email: string; password: string }): Promise<string | null> {
  if (!supabase) return 'The app is not connected to a database yet.'
  const { data, error } = await supabase.functions.invoke('join', { body: input })
  if (error) {
    // The function's own message is in the response body.
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    return body?.error ?? plain(error.message)
  }
  return data?.error ?? null
}
