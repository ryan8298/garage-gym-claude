import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { GymDB, save, type DailyLog, type SyncTable } from '../src/lib/db'
import { pullChanges, pushOutbox, type Row, type Transport } from '../src/lib/sync'

/**
 * A stand-in server with the same rules as the real one: upsert by id,
 * refuse writes older than what it holds, stamp every accepted write.
 * It records every row it is sent, so a duplicate insert would be visible.
 */
class FakeServer implements Transport {
  tables = new Map<string, Map<string, Row>>()
  received: Row[] = []
  clock = 0
  failNext: 'before' | 'after' | null = null

  private table(t: string) {
    if (!this.tables.has(t)) this.tables.set(t, new Map())
    return this.tables.get(t)!
  }
  seed(t: SyncTable, row: Row) {
    this.table(t).set(row.id, { ...row, synced_at: new Date(++this.clock).toISOString() })
  }
  async upsert(t: SyncTable, rows: Row[]) {
    if (this.failNext === 'before') {
      this.failNext = null
      throw new Error('network down')
    }
    for (const row of rows) {
      this.received.push(row)
      const held = this.table(t).get(row.id)
      if (held && Date.parse(row.updated_at) < Date.parse(held.updated_at)) continue
      this.table(t).set(row.id, { ...row, synced_at: new Date(++this.clock).toISOString() })
    }
    if (this.failNext === 'after') {
      this.failNext = null
      throw new Error('response lost') // the write landed, the client never heard
    }
    return rows.map((r) => ({ id: r.id, updated_at: this.table(t).get(r.id)!.updated_at }))
  }
  async pull(t: SyncTable, cursor: string | null, limit: number) {
    return [...this.table(t).values()]
      .filter((r) => !cursor || r.synced_at! > cursor)
      .sort((a, b) => (a.synced_at! < b.synced_at! ? -1 : 1))
      .slice(0, limit)
  }
  async getByIds(t: SyncTable, ids: string[]) {
    return ids.map((id) => this.table(t).get(id)).filter((r): r is Row => !!r)
  }
}

const log = (id: string, weight: number) => ({
  id,
  user_id: 'u1',
  log_date: '2026-11-12',
  body_weight: weight,
  steps: null,
  sleep_hours: null,
  energy: null,
  soreness: null,
  note: null,
})

let n = 0
let db: GymDB
let server: FakeServer
beforeEach(() => {
  db = new GymDB(`test-${++n}`)
  server = new FakeServer()
})

describe('sync outbox', () => {
  it('saves the row and its outbox entry together', async () => {
    await save<DailyLog>(db, 'daily_logs', log('a', 190))
    expect(await db.daily_logs.count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
  })

  it('pushes a row once and clears the outbox', async () => {
    await save<DailyLog>(db, 'daily_logs', log('a', 190))
    await pushOutbox(db, server)
    expect(server.tables.get('daily_logs')!.size).toBe(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('keeps the row queued when the request fails before reaching the server', async () => {
    await save<DailyLog>(db, 'daily_logs', log('a', 190))
    server.failNext = 'before'
    await expect(pushOutbox(db, server)).rejects.toThrow()
    expect(await db.outbox.count()).toBe(1)
    await pushOutbox(db, server)
    expect(server.tables.get('daily_logs')!.size).toBe(1)
    expect(await db.outbox.count()).toBe(0)
  })

  it('never duplicates a row when the response is lost and the push is retried', async () => {
    await save<DailyLog>(db, 'daily_logs', log('a', 190))
    server.failNext = 'after'
    await expect(pushOutbox(db, server)).rejects.toThrow()
    expect(await db.outbox.count()).toBe(1)
    await pushOutbox(db, server)
    expect(server.received.length).toBe(2) // sent twice
    expect(server.tables.get('daily_logs')!.size).toBe(1) // stored once
    expect(await db.outbox.count()).toBe(0)
  })

  it('collapses many edits to one row into one outbox entry with the latest value', async () => {
    await save<DailyLog>(db, 'daily_logs', log('a', 190))
    await save<DailyLog>(db, 'daily_logs', log('a', 190.2))
    await save<DailyLog>(db, 'daily_logs', log('a', 190.4))
    expect(await db.outbox.count()).toBe(1)
    await pushOutbox(db, server)
    expect(server.tables.get('daily_logs')!.get('a')!.body_weight).toBe(190.4)
  })

  it('does not lose an edit made while a push is in flight', async () => {
    await save<DailyLog>(db, 'daily_logs', log('a', 190))
    const slow: Transport = {
      ...server,
      upsert: async (t, rows) => {
        const result = await server.upsert(t, rows)
        await save<DailyLog>(db, 'daily_logs', log('a', 191)) // user edits mid-request
        return result
      },
      pull: server.pull.bind(server),
      getByIds: server.getByIds.bind(server),
    }
    await pushOutbox(db, slow)
    expect(await db.outbox.count()).toBe(1) // the newer edit is still queued
    await pushOutbox(db, server)
    expect(server.tables.get('daily_logs')!.get('a')!.body_weight).toBe(191)
    expect(await db.outbox.count()).toBe(0)
  })

  it('pushes parents before children', async () => {
    const base = { user_id: 'u1' }
    await save(db, 'sets', { id: 's1', session_exercise_id: 'e1', session_id: 'w1', position: 0, ...base } as never)
    await save(db, 'session_exercises', { id: 'e1', session_id: 'w1', position: 0, ...base } as never)
    await save(db, 'workout_sessions', { id: 'w1', title: 'Legs', ...base } as never)
    await pushOutbox(db, server)
    expect(server.received.map((r) => r.id)).toEqual(['w1', 'e1', 's1'])
  })

  it('takes the server copy when the server holds a newer write', async () => {
    const mine = await save<DailyLog>(db, 'daily_logs', log('a', 190))
    server.seed('daily_logs', { ...mine, body_weight: 188, updated_at: new Date(Date.parse(mine.updated_at) + 60_000).toISOString() })
    await pushOutbox(db, server)
    expect((await db.daily_logs.get('a'))!.body_weight).toBe(188)
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('sync pull', () => {
  it('applies partner rows and advances the cursor', async () => {
    server.seed('daily_logs', { ...log('p1', 140), user_id: 'u2', updated_at: '2026-11-12T10:00:00.000Z', deleted: false })
    expect(await pullChanges(db, server)).toBe(1)
    expect(await pullChanges(db, server)).toBe(0) // nothing new the second time
    expect((await db.daily_logs.get('p1'))!.body_weight).toBe(140)
  })

  it('never overwrites a row that has unsent local changes', async () => {
    await save<DailyLog>(db, 'daily_logs', log('a', 190))
    server.seed('daily_logs', { ...log('a', 185), updated_at: '2099-01-01T00:00:00.000Z', deleted: false })
    await pullChanges(db, server)
    expect((await db.daily_logs.get('a'))!.body_weight).toBe(190)
  })

  it('pages through more rows than one request returns', async () => {
    for (let i = 0; i < 1203; i++) server.seed('daily_logs', { ...log(`r${i}`, 150), updated_at: '2026-11-12T10:00:00.000Z', deleted: false })
    expect(await pullChanges(db, server)).toBe(1203)
    expect(await db.daily_logs.count()).toBe(1203)
  })
})
