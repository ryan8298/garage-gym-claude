import { SYNC_TABLES, type GymDB, type SyncFields, type SyncTable } from './db'

/**
 * Sync engine. Rules:
 *  - Pushes are upserts keyed by the row's client-made id, so sending the
 *    same row twice can never create a duplicate.
 *  - An outbox entry is removed only after the server confirms the write and
 *    only if the row was not edited again while the request was in flight.
 *  - Conflicts are last write wins on updated_at. The server refuses older
 *    writes; when it does, we take the server's copy.
 *  - Pulls never overwrite a row that still has unsent local changes.
 */

export type Row = SyncFields & Record<string, unknown>

export interface Transport {
  /** Upsert rows; return id and updated_at of each row as the server now holds it. */
  upsert(table: SyncTable, rows: Row[]): Promise<{ id: string; updated_at: string }[]>
  /** Rows whose server stamp is after the cursor, oldest first. */
  pull(table: SyncTable, cursor: string | null, limit: number): Promise<Row[]>
  getByIds(table: SyncTable, ids: string[]): Promise<Row[]>
}

export class AuthNeededError extends Error {}

const PAGE = 500
const OVERLAP_MS = 5_000
const t = (iso: string) => Date.parse(iso)

export async function pushOutbox(db: GymDB, transport: Transport): Promise<number> {
  let pushed = 0
  for (const table of SYNC_TABLES) {
    const entries = await db.outbox.where('table').equals(table).toArray()
    if (entries.length === 0) continue
    const found = (await db.table(table).bulkGet(entries.map((e) => e.id))) as (Row | undefined)[]
    const rows = found.filter((r): r is Row => !!r)
    // An entry whose row no longer exists has nothing to send.
    const orphaned = entries.filter((_, i) => !found[i]).map((e) => e.key)
    if (orphaned.length) await db.outbox.bulkDelete(orphaned)
    if (rows.length === 0) continue

    const payload = rows.map(({ synced_at: _ignored, ...rest }) => rest as Row)
    const confirmed = await transport.upsert(table, payload)
    const serverStamp = new Map(confirmed.map((c) => [c.id, c.updated_at]))

    // The server kept a newer copy of these rows (or returned nothing for them).
    const superseded = rows.filter((r) => {
      const s = serverStamp.get(r.id)
      return s === undefined || t(s) > t(r.updated_at)
    })
    const serverCopies = superseded.length ? await transport.getByIds(table, superseded.map((r) => r.id)) : []
    const serverCopy = new Map(serverCopies.map((r) => [r.id, r]))

    await db.transaction('rw', db.table(table), db.outbox, async () => {
      for (const sent of rows) {
        const current = (await db.table(table).get(sent.id)) as Row | undefined
        const editedSince = !!current && current.updated_at !== sent.updated_at
        if (editedSince) continue // keep the outbox entry; the newer edit goes next round
        const newer = serverCopy.get(sent.id)
        if (newer) await db.table(table).put(newer)
        else if (superseded.includes(sent)) continue // could not confirm; try again later
        await db.outbox.delete(`${table}:${sent.id}`)
        pushed++
      }
    })
  }
  return pushed
}

export async function pullChanges(db: GymDB, transport: Transport): Promise<number> {
  let applied = 0
  for (const table of SYNC_TABLES) {
    const cursorKey = `cursor:${table}`
    const stored = (await db.meta.get(cursorKey))?.value ?? null
    // Re-read a few seconds before the cursor on the first page. A write that
    // was stamped earlier but committed later would otherwise be missed.
    let cursor = stored && new Date(Date.parse(stored) - OVERLAP_MS).toISOString()
    for (;;) {
      const rows = await transport.pull(table, cursor, PAGE)
      if (rows.length === 0) break
      await db.transaction('rw', db.table(table), db.outbox, db.meta, async () => {
        for (const remote of rows) {
          if (await db.outbox.get(`${table}:${remote.id}`)) continue
          const local = (await db.table(table).get(remote.id)) as Row | undefined
          if (!local || t(remote.updated_at) > t(local.updated_at)) {
            await db.table(table).put(remote)
            applied++
          }
        }
        cursor = rows[rows.length - 1].synced_at as string
        await db.meta.put({ key: cursorKey, value: cursor })
      })
      if (rows.length < PAGE) break
    }
  }
  return applied
}

// ---- status, shared with the UI ----

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'auth'
export interface SyncStatus {
  state: SyncState
  pending: number
  lastSynced: number | null
}

let status: SyncStatus = { state: 'idle', pending: 0, lastSynced: null }
const listeners = new Set<() => void>()
const setStatus = (patch: Partial<SyncStatus>) => {
  status = { ...status, ...patch }
  listeners.forEach((l) => l())
}
export const getSyncStatus = () => status
export const subscribeSync = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

// ---- runner ----

let running: Promise<void> | null = null
let again = false
let retryTimer: ReturnType<typeof setTimeout> | undefined
let failures = 0

export function createSyncRunner(db: GymDB, getTransport: () => Transport | null, isOnline: () => boolean) {
  async function once() {
    const transport = getTransport()
    const pending = await db.outbox.count()
    if (!transport) return setStatus({ pending })
    if (!isOnline()) return setStatus({ state: 'offline', pending })
    setStatus({ state: 'syncing', pending })
    try {
      await pushOutbox(db, transport)
      await pullChanges(db, transport)
      failures = 0
      setStatus({ state: 'idle', pending: await db.outbox.count(), lastSynced: Date.now() })
    } catch (err) {
      failures++
      const state: SyncState = err instanceof AuthNeededError ? 'auth' : isOnline() ? 'error' : 'offline'
      setStatus({ state, pending: await db.outbox.count() })
      clearTimeout(retryTimer)
      if (state !== 'auth') retryTimer = setTimeout(run, Math.min(60_000, 2_000 * 2 ** Math.min(failures, 5)))
    }
  }

  /** Start a sync. Calls made while one is running are merged into one follow-up run. */
  function run(): Promise<void> {
    if (running) {
      again = true
      return running
    }
    running = once().finally(() => {
      running = null
      if (again) {
        again = false
        void run()
      }
    })
    return running
  }

  return { run }
}
