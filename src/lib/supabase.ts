import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SyncTable } from './db'
import { AuthNeededError, type Row, type Transport } from './sync'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

export const configured = Boolean(url && key)

export const supabase: SupabaseClient | null = configured
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null

function check(error: { message: string; code?: string } | null, status?: number) {
  if (!error) return
  if (status === 401 || error.code === 'PGRST301' || /jwt/i.test(error.message)) throw new AuthNeededError(error.message)
  throw new Error(error.message)
}

export const transport: Transport | null = supabase && {
  async upsert(table: SyncTable, rows: Row[]) {
    const { data, error, status } = await supabase.from(table).upsert(rows, { onConflict: 'id' }).select('id, updated_at')
    check(error, status)
    return (data ?? []) as { id: string; updated_at: string }[]
  },
  async pull(table: SyncTable, cursor: string | null, limit: number) {
    let q = supabase.from(table).select('*').order('synced_at', { ascending: true }).limit(limit)
    if (cursor) q = q.gt('synced_at', cursor)
    const { data, error, status } = await q
    check(error, status)
    return (data ?? []) as Row[]
  },
  async getByIds(table: SyncTable, ids: string[]) {
    const { data, error, status } = await supabase.from(table).select('*').in('id', ids)
    check(error, status)
    return (data ?? []) as Row[]
  },
}
