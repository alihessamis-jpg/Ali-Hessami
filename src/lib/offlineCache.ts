// Read-only offline cache for Academy: every chapter the reader opens (its
// note, cards, highlights and figure images) and the chapter list are
// mirrored into IndexedDB as they load, so LibraryPage/ReaderPage can fall
// back to this when a fetch fails (no network) instead of going blank.
// Deliberately read-only -- nothing written while offline is queued back to
// Supabase; the next successful load just overwrites the cache with the
// server's current state.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { getChapterFigureSignedUrl } from './storage'
import type { LibraryBook, LibraryCard, LibraryChapter, LibraryChapterFigure, LibraryHighlight } from '../types/domain'

interface ChapterBundle {
  chapterId: string
  chapter: LibraryChapter
  cards: LibraryCard[]
  highlights: LibraryHighlight[]
  figures: LibraryChapterFigure[]
  cachedAt: number
}

interface LibrarySnapshot {
  id: 'default'
  book: LibraryBook
  chapters: LibraryChapter[]
  cachedAt: number
}

interface FigureBlobRow {
  figureKey: string
  blob: Blob
  cachedAt: number
}

interface NephronOfflineDB extends DBSchema {
  chapterBundles: { key: string; value: ChapterBundle }
  librarySnapshot: { key: string; value: LibrarySnapshot }
  figureBlobs: { key: string; value: FigureBlobRow }
}

const DB_NAME = 'nephron-offline'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<NephronOfflineDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<NephronOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chapterBundles')) db.createObjectStore('chapterBundles', { keyPath: 'chapterId' })
        if (!db.objectStoreNames.contains('librarySnapshot')) db.createObjectStore('librarySnapshot', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('figureBlobs')) db.createObjectStore('figureBlobs', { keyPath: 'figureKey' })
      },
    })
  }
  return dbPromise
}

export async function cacheChapterBundle(bundle: Omit<ChapterBundle, 'cachedAt'>): Promise<void> {
  try {
    const db = await getDb()
    await db.put('chapterBundles', { ...bundle, cachedAt: Date.now() })
  } catch {
    // best-effort -- offline cache is a convenience, never block the UI on it
  }
}

export async function getCachedChapterBundle(chapterId: string): Promise<ChapterBundle | null> {
  try {
    const db = await getDb()
    return (await db.get('chapterBundles', chapterId)) ?? null
  } catch {
    return null
  }
}

export async function cacheLibrarySnapshot(book: LibraryBook, chapters: LibraryChapter[]): Promise<void> {
  try {
    const db = await getDb()
    await db.put('librarySnapshot', { id: 'default', book, chapters, cachedAt: Date.now() })
  } catch {
    // best-effort
  }
}

export async function getCachedLibrarySnapshot(): Promise<{ book: LibraryBook; chapters: LibraryChapter[] } | null> {
  try {
    const db = await getDb()
    const row = await db.get('librarySnapshot', 'default')
    return row ? { book: row.book, chapters: row.chapters } : null
  } catch {
    return null
  }
}

async function getCachedFigureObjectUrl(figureKey: string): Promise<string | null> {
  try {
    const db = await getDb()
    const row = await db.get('figureBlobs', figureKey)
    return row ? URL.createObjectURL(row.blob) : null
  } catch {
    return null
  }
}

// Resolves a chapter figure to a *local* object URL usable both online and
// offline: the cached blob if there is one, otherwise it downloads the
// (short-lived) signed URL once and caches the bytes for next time. Unlike
// a signed URL, the result never expires and needs no network once cached.
export async function resolveFigureUrl(figureKey: string, storagePath: string): Promise<string | null> {
  const cached = await getCachedFigureObjectUrl(figureKey)
  if (cached) return cached
  try {
    const signedUrl = await getChapterFigureSignedUrl(storagePath)
    const response = await fetch(signedUrl)
    const blob = await response.blob()
    const db = await getDb()
    await db.put('figureBlobs', { figureKey, blob, cachedAt: Date.now() })
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}
