// Offline writes for progress notes and lab results.
//
// When a note or lab can't reach Supabase (no internet, or the hospital
// Wi-Fi drops the request), the change is saved on this device in an
// "outbox" and shown in the chart straight away, marked "waiting to sync".
// As soon as the connection is back the outbox is replayed, oldest first,
// automatically -- no button to press.
//
// Every new row gets its id here on the device, so replaying the same insert
// twice (e.g. the first attempt reached the server but the reply was lost)
// is harmless: the second attempt hits "duplicate key" and counts as done.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { supabase } from './supabaseClient'
import { upsertGrowthMeasurement } from './api/growth'
import { updatePatient } from './api/patients'

export type OutboxTable = 'progress_notes' | 'lab_entries'

type OutboxOp =
  | { kind: 'insert'; table: OutboxTable; id: string; row: Record<string, unknown> }
  | { kind: 'update'; table: OutboxTable; id: string; row: Record<string, unknown> }
  | { kind: 'delete'; table: OutboxTable; id: string }
  // a note's weight also updates the patient's weight and growth chart
  | { kind: 'noteWeight'; id: string; patientId: string; date: string; weight: number }

export type OutboxEntry = OutboxOp & {
  seq?: number
  userId: string | null
  queuedAt: number
  failed?: string
}

interface OutboxDB extends DBSchema {
  ops: { key: number; value: OutboxEntry }
}

let dbPromise: Promise<IDBPDatabase<OutboxDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<OutboxDB>('nephron-outbox', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('ops')) db.createObjectStore('ops', { keyPath: 'seq', autoIncrement: true })
      },
    })
  }
  return dbPromise
}

export const OUTBOX_EVENT = 'nephron:outbox-changed'

function notify() {
  window.dispatchEvent(new Event(OUTBOX_EVENT))
}

// A Supabase error that means "couldn't reach the server" rather than "the
// server said no" -- only these get queued for later.
export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: unknown; message?: unknown }
  if (e.code === 'OFFLINE') return true
  const msg = typeof e.message === 'string' ? e.message : ''
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(msg)
}

function isAuthError(error: { code?: string; message?: string }) {
  return error.code === 'PGRST301' || error.code === 'PGRST303' || /jwt/i.test(error.message ?? '')
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session.user.id
  } catch {
    // ignore
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue
      const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as { user?: { id?: string } } | null
      if (parsed?.user?.id) return parsed.user.id
    }
  } catch {
    // ignore
  }
  return null
}

export function newRowId(): string {
  return crypto.randomUUID()
}

export async function queueOp(op: OutboxOp): Promise<void> {
  const db = await getDb()
  await db.add('ops', { ...op, userId: await currentUserId(), queuedAt: Date.now() })
  // ask the browser not to clear unsynced changes when space runs low
  navigator.storage?.persist?.()?.catch(() => undefined)
  notify()
  scheduleSync()
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  try {
    const db = await getDb()
    return await db.getAll('ops')
  } catch {
    return []
  }
}

export async function pendingIds(): Promise<Set<string>> {
  const ops = await listOutbox()
  return new Set(ops.filter((o) => o.kind !== 'noteWeight').map((o) => o.id))
}

// Lays the not-yet-synced changes for one table over rows loaded from the
// server (or the offline copy), so a list shows what the user actually did.
export async function applyPending<Row extends { id: string }>(
  table: OutboxTable,
  rows: Row[],
  belongs: (row: Row) => boolean
): Promise<Row[]> {
  const ops = (await listOutbox()).filter((o) => o.kind !== 'noteWeight' && o.table === table)
  if (ops.length === 0) return rows
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const op of ops) {
    if (op.kind === 'insert') {
      const row = op.row as unknown as Row
      if (belongs(row)) byId.set(op.id, row)
    } else if (op.kind === 'update') {
      const existing = byId.get(op.id)
      if (existing) byId.set(op.id, { ...existing, ...op.row })
    } else if (op.kind === 'delete') {
      byId.delete(op.id)
    }
  }
  return [...byId.values()]
}

// ---------------------------------------------------------------------------
// Sync

let syncing: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | null = null

function scheduleSync(delayMs = 1500) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void syncOutbox()
  }, delayMs)
}

type RunResult = 'done' | 'offline' | { failed: string }

async function runOp(op: OutboxEntry): Promise<RunResult> {
  if (op.kind === 'noteWeight') {
    try {
      await upsertGrowthMeasurement(op.patientId, op.date, { weightKg: op.weight })
      await updatePatient(op.patientId, { weight: op.weight })
      return 'done'
    } catch (err) {
      return isOfflineError(err) ? 'offline' : 'done' // best-effort, same as online
    }
  }
  const table = supabase.from(op.table)
  const response =
    op.kind === 'insert'
      ? await table.insert(op.row)
      : op.kind === 'update'
        ? await table.update(op.row).eq('id', op.id)
        : await table.delete().eq('id', op.id)
  const error = response.error
  if (!error) return 'done'
  if (op.kind === 'insert' && error.code === '23505') return 'done' // already there from an earlier attempt
  if (isOfflineError(error) || isAuthError(error)) return 'offline'
  return { failed: error.message ?? 'Rejected by the server' }
}

export function syncOutbox(): Promise<void> {
  if (syncing) return syncing
  syncing = (async () => {
    try {
      if (!navigator.onLine) return
      const ops = await listOutbox()
      if (ops.length === 0) return
      // refreshes the access token if it expired while offline
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      const userId = data.session.user.id
      const db = await getDb()
      const blockedIds = new Set<string>()
      for (const op of ops) {
        if (op.userId && op.userId !== userId) continue // another account's change: leave it
        if (op.failed || blockedIds.has(op.id)) {
          blockedIds.add(op.id)
          continue
        }
        const result = await runOp(op)
        if (result === 'offline') break
        if (result === 'done') {
          await db.delete('ops', op.seq as number)
        } else {
          // keep later changes to the same row from running out of order
          blockedIds.add(op.id)
          await db.put('ops', { ...op, failed: result.failed })
        }
        notify()
      }
    } catch {
      // try again on the next trigger
    } finally {
      syncing = null
      notify()
    }
  })()
  return syncing
}

export async function retryFailed(): Promise<void> {
  const db = await getDb()
  for (const op of await db.getAll('ops')) {
    if (op.failed) await db.put('ops', { ...op, failed: undefined })
  }
  notify()
  await syncOutbox()
}

export async function discardOp(seq: number): Promise<void> {
  const db = await getDb()
  await db.delete('ops', seq)
  notify()
}

let started = false

// Called once at startup: sync now, whenever the connection comes back,
// when the app is reopened, and every 30 s while something is waiting.
export function startOutboxSync() {
  if (started) return
  started = true
  window.addEventListener('online', () => scheduleSync(800))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(500)
  })
  setInterval(() => {
    void listOutbox().then((ops) => {
      if (ops.some((o) => !o.failed)) void syncOutbox()
    })
  }, 30000)
  scheduleSync(2000)
}
