// App-wide offline support for every Supabase read.
//
// The Supabase client is created with this `fetch` (see supabaseClient.ts),
// so every request the app makes passes through here:
//
//  * Reads (GET/HEAD on the REST API, and the storage "sign URL" calls) are
//    network-first: a successful response is mirrored into IndexedDB, and
//    when there's no network -- or the network is too slow -- the last saved
//    copy is served instead. Every page therefore keeps working offline with
//    whatever it last loaded (Settings → "Download everything for offline"
//    walks the whole app once so nothing is missing).
//  * Writes while offline are refused with a clear message instead of a
//    cryptic "Failed to fetch", so nothing looks saved when it wasn't.
//  * Auth calls are passed straight through untouched.
//
// The cached copy is keyed by URL (not by access token), and the whole cache
// is wiped on sign-out so another account on the same device never sees it.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface CachedResponse {
  key: string
  status: number
  statusText: string
  headers: [string, string][]
  body: ArrayBuffer
  cachedAt: number
}

interface HttpCacheDB extends DBSchema {
  responses: { key: string; value: CachedResponse }
}

const DB_NAME = 'nephron-http-cache'
const SLOW_NETWORK_MS = 7000

let dbPromise: Promise<IDBPDatabase<HttpCacheDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<HttpCacheDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('responses')) db.createObjectStore('responses', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}

// ---------------------------------------------------------------------------
// Network activity tracking -- read by the offline-prep crawler (it loads the
// app in a hidden frame and waits for this to go quiet before moving on).

interface NetActivity {
  inflight: number
  lastActivity: number
  servedFromCache: number
}

declare global {
  interface Window {
    __nephronNet?: NetActivity
  }
}

function activity(): NetActivity {
  if (!window.__nephronNet) window.__nephronNet = { inflight: 0, lastActivity: Date.now(), servedFromCache: 0 }
  return window.__nephronNet
}

// Lets the UI show "showing saved data" when a page was served from cache.
export const OFFLINE_SERVED_EVENT = 'nephron:served-from-cache'

function notifyServedFromCache() {
  activity().servedFromCache++
  window.dispatchEvent(new Event(OFFLINE_SERVED_EVENT))
}

// ---------------------------------------------------------------------------

function headerValue(init: RequestInit | undefined, input: RequestInfo | URL, name: string): string {
  const fromInit = init?.headers ? new Headers(init.headers).get(name) : null
  if (fromInit != null) return fromInit
  if (input instanceof Request) return input.headers.get(name) ?? ''
  return ''
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

type Kind = 'read' | 'write' | 'passthrough'

function classify(method: string, url: URL): Kind {
  const path = url.pathname
  if (path.includes('/auth/v1/')) return 'passthrough'
  if (path.includes('/rest/v1/')) {
    return method === 'GET' || method === 'HEAD' ? 'read' : 'write'
  }
  if (path.includes('/storage/v1/')) {
    // Creating a signed URL is a read even though it's a POST; the file it
    // points at is cached by the service worker (see vite.config.ts).
    if (method === 'POST' && path.includes('/object/sign/')) return 'read'
    if (method === 'POST' && path.includes('/object/list/')) return 'read'
    if (method === 'GET' || method === 'HEAD') return 'read'
    return 'write'
  }
  return 'passthrough'
}

async function cacheKey(method: string, url: string, init: RequestInit | undefined, input: RequestInfo | URL) {
  const parts = [
    method,
    url,
    headerValue(init, input, 'accept'),
    headerValue(init, input, 'prefer'),
    headerValue(init, input, 'range'),
    headerValue(init, input, 'accept-profile'),
  ]
  if (method === 'POST') {
    const body = init?.body
    parts.push(typeof body === 'string' ? body : '')
  }
  return parts.join('\u0001')
}

async function readCache(key: string): Promise<Response | null> {
  try {
    const db = await getDb()
    const row = await db.get('responses', key)
    if (!row) return null
    const headers = new Headers(row.headers)
    headers.set('x-nephron-offline-cache', String(row.cachedAt))
    return new Response(row.status === 204 || row.status === 304 ? null : row.body, {
      status: row.status,
      statusText: row.statusText,
      headers,
    })
  } catch {
    return null
  }
}

async function writeCache(key: string, response: Response): Promise<void> {
  try {
    const body = await response.clone().arrayBuffer()
    const headers: [string, string][] = []
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() !== 'set-cookie') headers.push([name, value])
    })
    const db = await getDb()
    await db.put('responses', {
      key,
      status: response.status,
      statusText: response.statusText,
      headers,
      body,
      cachedAt: Date.now(),
    })
  } catch {
    // best-effort -- never block the UI on the cache
  }
}

function offlineError(message: string, status = 503): Response {
  return new Response(JSON.stringify({ message, code: 'OFFLINE', details: null, hint: null, error: message }), {
    status,
    statusText: 'Offline',
    headers: { 'content-type': 'application/json' },
  })
}

export const OFFLINE_WRITE_MESSAGE =
  "You're offline — this change wasn't saved. Reconnect and try again (everything you can see is still readable offline)."
const OFFLINE_MISSING_MESSAGE =
  "You're offline and this wasn't saved on this device yet. Open it once while online, or use Settings → Download everything for offline."

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export async function offlineAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
  const url = urlOf(input)
  let parsed: URL
  try {
    parsed = new URL(url, window.location.href)
  } catch {
    return fetch(input, init)
  }
  const kind = classify(method, parsed)
  if (kind === 'passthrough') return fetch(input, init)

  if (kind === 'write') {
    if (isOffline()) return offlineError(OFFLINE_WRITE_MESSAGE)
    return tracked(() => fetch(input, init))
  }

  // read: network-first, falling back to (or racing a slow network with) the cache
  const key = await cacheKey(method, url, init, input)

  if (isOffline()) {
    const cached = await readCache(key)
    if (cached) {
      notifyServedFromCache()
      return cached
    }
    return offlineError(OFFLINE_MISSING_MESSAGE)
  }

  const network = tracked(() => fetch(input, init)).then(async (response) => {
    if (response.ok) await writeCache(key, response)
    return response
  })

  const cachedPromise = readCache(key)
  try {
    const slow = new Promise<'slow'>((resolve) => setTimeout(() => resolve('slow'), SLOW_NETWORK_MS))
    const winner = await Promise.race([network, slow])
    if (winner !== 'slow') return winner
    // network is dragging (common on a weak hospital connection): serve the
    // saved copy now if there is one, and let the network refresh it later
    const cached = await cachedPromise
    if (cached) {
      network.catch(() => undefined)
      notifyServedFromCache()
      return cached
    }
    return await network
  } catch (err) {
    const cached = await cachedPromise
    if (cached) {
      notifyServedFromCache()
      return cached
    }
    if (err instanceof TypeError) return offlineError(OFFLINE_MISSING_MESSAGE)
    throw err
  }
}

async function tracked(run: () => Promise<Response>): Promise<Response> {
  const a = activity()
  a.inflight++
  a.lastActivity = Date.now()
  try {
    return await run()
  } finally {
    a.inflight--
    a.lastActivity = Date.now()
  }
}

export async function clearOfflineHttpCache(): Promise<void> {
  try {
    const db = await getDb()
    await db.clear('responses')
  } catch {
    // ignore
  }
}

export async function countOfflineHttpCache(): Promise<number> {
  try {
    const db = await getDb()
    return await db.count('responses')
  } catch {
    return 0
  }
}
