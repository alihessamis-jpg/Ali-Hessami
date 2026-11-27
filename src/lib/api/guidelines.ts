// Academy → Guidelines.
//
// A guideline is a library_books row with kind = 'guideline' plus ordinary
// library_chapters (a Persian analysis chapter and the original text split
// into chapters). Because the chapters are normal library chapters, the
// existing note → library_chunks triggers index them, so the assistant's
// search_library / read_section tools search the full guideline text, and
// the Reader, cards and "Ask AI" chips work on them unchanged.
//
// Guideline content arrives as a "guideline package" JSON file (see
// GuidelinePackage below), imported once from the Guidelines tab.
// Re-importing the same slug updates the book and its chapters in place
// (matched by chapter number), so reading progress and cards survive.
import { supabase } from '../supabaseClient'
import { getAuthUser } from './authUser'
import { bookToDomain, chapterToDomain, type BookRow, type ChapterRow } from './library'
import { getGuidelinePdfSignedUrl, uploadGuidelinePdfFile } from '../storage'
import { FN_URL, authHeaders } from './assistant'
import type { GuidelineHighlight, LibraryBook, LibraryChapter } from '../../types/domain'

export interface GuidelinePackageChapter {
  part_roman: string
  part_title: string
  chapter_number: number
  title: string
  subtitle?: string | null
  language?: string | null
  direction?: string | null
  start_page?: number | null
  end_page?: number | null
  note: string
}

export interface GuidelinePackageBook {
  slug: string
  title: string
  edition?: string | null
  publisher?: string | null
  year?: number | null
  total_pages?: number | null
  organization?: string | null
  doc_status?: string | null
  citation?: string | null
  scope?: string | null
  summary?: string | null
  highlights?: GuidelineHighlight[]
  chapters: GuidelinePackageChapter[]
}

export interface GuidelinePackage {
  format: 'nephron-guidelines/1'
  guidelines: GuidelinePackageBook[]
}

export interface GuidelineWithChapters {
  book: LibraryBook
  chapters: LibraryChapter[]
}

export async function listGuidelines(): Promise<GuidelineWithChapters[]> {
  const { data: books, error } = await supabase
    .from('library_books')
    .select('*')
    .eq('kind', 'guideline')
    .order('created_at')
  if (error) throw error
  const rows = (books ?? []) as BookRow[]
  if (rows.length === 0) return []
  // Notes can be hundreds of KB per chapter; the list only needs metadata.
  const { data: chapters, error: chError } = await supabase
    .from('library_chapters')
    .select(
      'id, book_id, part_roman, part_title, chapter_number, title, subtitle, start_page, end_page, pages, status, reading_pct, last_section, language, direction, note_format, imported_at, created_at'
    )
    .in(
      'book_id',
      rows.map((r) => r.id)
    )
    .order('chapter_number')
  if (chError) throw chError
  const byBook = new Map<string, LibraryChapter[]>()
  for (const c of (chapters ?? []) as unknown as Array<Omit<ChapterRow, 'note' | 'clinical_summary'>>) {
    const list = byBook.get(c.book_id) ?? []
    list.push(chapterToDomain({ ...c, note: null, clinical_summary: null } as ChapterRow))
    byBook.set(c.book_id, list)
  }
  return rows.map((r) => ({ book: bookToDomain(r), chapters: byBook.get(r.id) ?? [] }))
}

export function parseGuidelinePackage(text: string): GuidelinePackage {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const pkg = parsed as Partial<GuidelinePackage>
  if (pkg?.format !== 'nephron-guidelines/1' || !Array.isArray(pkg.guidelines)) {
    throw new Error('Not a Nephron guideline package (expected format "nephron-guidelines/1").')
  }
  for (const g of pkg.guidelines) {
    if (!g.slug || !g.title || !Array.isArray(g.chapters)) throw new Error('A guideline in the package is missing its slug, title or chapters.')
    for (const c of g.chapters) {
      if (typeof c.chapter_number !== 'number' || !c.title || typeof c.note !== 'string') {
        throw new Error(`Chapter data in "${g.title}" is incomplete.`)
      }
    }
  }
  return pkg as GuidelinePackage
}

export interface GuidelineImportProgress {
  guideline: string
  done: number
  total: number
  current: string
}

export interface GuidelineImportResult {
  guidelines: number
  chaptersCreated: number
  chaptersUpdated: number
}

export async function importGuidelinePackage(
  pkg: GuidelinePackage,
  onProgress?: (p: GuidelineImportProgress) => void
): Promise<GuidelineImportResult> {
  const {
    data: { user },
  } = await getAuthUser()
  if (!user) throw new Error('Not authenticated')
  const total = pkg.guidelines.reduce((n, g) => n + g.chapters.length, 0)
  let done = 0
  let chaptersCreated = 0
  let chaptersUpdated = 0

  for (const g of pkg.guidelines) {
    const meta = {
      kind: 'guideline' as const,
      title: g.title,
      edition: g.edition ?? null,
      publisher: g.publisher ?? null,
      year: g.year ?? null,
      total_pages: g.total_pages ?? null,
      organization: g.organization ?? null,
      doc_status: g.doc_status ?? null,
      citation: g.citation ?? null,
      scope: g.scope ?? null,
      summary: g.summary ?? null,
      highlights: g.highlights ?? [],
    }
    const { data: existing, error: findError } = await supabase
      .from('library_books')
      .select('id')
      .eq('owner_id', user.id)
      .eq('slug', g.slug)
      .maybeSingle()
    if (findError) throw findError

    let bookId: string
    if (existing) {
      bookId = (existing as { id: string }).id
      const { error } = await supabase.from('library_books').update(meta).eq('id', bookId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('library_books')
        .insert({ ...meta, owner_id: user.id, slug: g.slug, editors: [] })
        .select('id')
        .single()
      if (error) throw error
      bookId = (data as { id: string }).id
    }

    const { data: oldChapters, error: oldError } = await supabase
      .from('library_chapters')
      .select('id, chapter_number')
      .eq('book_id', bookId)
    if (oldError) throw oldError
    const byNumber = new Map(((oldChapters ?? []) as Array<{ id: string; chapter_number: number }>).map((c) => [c.chapter_number, c.id]))

    // One request per chapter: notes are large and each insert/update also
    // re-chunks the note for the assistant (library_chunks trigger).
    for (const c of g.chapters) {
      onProgress?.({ guideline: g.title, done, total, current: c.title })
      const row = {
        part_roman: c.part_roman,
        part_title: c.part_title,
        chapter_number: c.chapter_number,
        title: c.title,
        subtitle: c.subtitle ?? null,
        language: c.language ?? null,
        direction: c.direction ?? null,
        start_page: c.start_page ?? null,
        end_page: c.end_page ?? null,
        pages: c.start_page != null && c.end_page != null ? c.end_page - c.start_page + 1 : null,
        note: c.note,
        note_format: 'nephron-guideline/1.0',
        imported_at: new Date().toISOString(),
      }
      const existingId = byNumber.get(c.chapter_number)
      if (existingId) {
        const { error } = await supabase.from('library_chapters').update(row).eq('id', existingId)
        if (error) throw error
        chaptersUpdated += 1
      } else {
        const { error } = await supabase
          .from('library_chapters')
          .insert({ ...row, owner_id: user.id, book_id: bookId, status: 'unread', reading_pct: 0 })
        if (error) throw error
        chaptersCreated += 1
      }
      done += 1
    }
  }
  onProgress?.({ guideline: '', done, total, current: '' })
  return { guidelines: pkg.guidelines.length, chaptersCreated, chaptersUpdated }
}

export async function attachGuidelinePdf(bookId: string, file: File): Promise<string> {
  const {
    data: { user },
  } = await getAuthUser()
  if (!user) throw new Error('Not authenticated')
  const path = await uploadGuidelinePdfFile(user.id, bookId, file)
  const { error } = await supabase.from('library_books').update({ pdf_path: path }).eq('id', bookId)
  if (error) throw error
  return path
}

export async function guidelinePdfUrl(path: string): Promise<string> {
  return getGuidelinePdfSignedUrl(path)
}

// --- Source-cited search across all guidelines (English text + Persian translations)

export interface GuidelineSearchHit {
  chunkId: string
  lang: 'en' | 'fa'
  bookId: string
  bookTitle: string
  organization: string | null
  chapterId: string
  chapterTitle: string
  heading: string
  anchor: string | null
  pageFrom: number | null
  pageTo: number | null
  /** pgroonga snippet: HTML with <span class="keyword"> around matches. */
  snippet: string
}

export async function searchGuidelines(q: string, k = 25): Promise<GuidelineSearchHit[]> {
  const { data, error } = await supabase.rpc('search_guidelines', { q, k })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    chunkId: String(r.chunk_id),
    lang: r.lang === 'fa' ? 'fa' : 'en',
    bookId: String(r.book_id),
    bookTitle: String(r.book_title ?? ''),
    organization: (r.organization as string | null) ?? null,
    chapterId: String(r.chapter_id),
    chapterTitle: String(r.chapter_title ?? ''),
    heading: String(r.heading ?? ''),
    anchor: (r.anchor as string | null) ?? null,
    pageFrom: (r.page_from as number | null) ?? null,
    pageTo: (r.page_to as number | null) ?? null,
    snippet: String(r.snippet ?? ''),
  }))
}

// --- Persian translation of a chapter, passage by passage (library_chunks)

export interface ChapterPassage {
  partNumber: number
  sectionIdx: number
  subIdx: number
  heading: string
  anchor: string | null
  pageFrom: number | null
  pageTo: number | null
  content: string
  translation: string | null
}

export async function listChapterPassages(chapterId: string): Promise<ChapterPassage[]> {
  const [{ data: chunks, error }, { data: tr, error: trError }] = await Promise.all([
    supabase
      .from('library_chunks')
      .select('part_number, section_idx, sub_idx, heading, anchor, page_from, page_to, content')
      .eq('chapter_id', chapterId)
      .is('part_number', null)
      .order('section_idx')
      .order('sub_idx'),
    supabase.from('library_chunk_translations').select('part_number, section_idx, sub_idx, content').eq('chapter_id', chapterId),
  ])
  if (error) throw error
  if (trError) throw trError
  const byKey = new Map(
    ((tr ?? []) as Array<{ part_number: number; section_idx: number; sub_idx: number; content: string }>).map((t) => [
      `${t.part_number}:${t.section_idx}:${t.sub_idx}`,
      t.content,
    ])
  )
  return ((chunks ?? []) as unknown as Array<{
    part_number: number | null
    section_idx: number
    sub_idx: number
    heading: string
    anchor: string | null
    page_from: number | null
    page_to: number | null
    content: string
  }>).map((c) => ({
    partNumber: c.part_number ?? 0,
    sectionIdx: c.section_idx,
    subIdx: c.sub_idx,
    heading: c.heading,
    anchor: c.anchor,
    pageFrom: c.page_from,
    pageTo: c.page_to,
    content: c.content,
    translation: byKey.get(`${c.part_number ?? 0}:${c.section_idx}:${c.sub_idx}`) ?? null,
  }))
}

export async function translatePassage(chapterId: string, p: Pick<ChapterPassage, 'partNumber' | 'sectionIdx' | 'subIdx'>): Promise<string> {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'translate', chapterId, partNumber: p.partNumber || null, sectionIdx: p.sectionIdx, subIdx: p.subIdx }),
  })
  const j = (await res.json().catch(() => ({}))) as { content?: string; error?: string }
  if (!res.ok || !j.content) throw new Error(j.error ?? `خطا (${res.status})`)
  return j.content
}
