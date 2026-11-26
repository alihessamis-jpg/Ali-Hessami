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
  for (const c of (chapters ?? []) as ChapterRow[]) {
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
