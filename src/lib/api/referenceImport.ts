import { supabase } from '../supabaseClient'
import { getAuthUser } from './authUser'

// Imports a reference-data file (format "nephron-reference-import/1") the
// clinician picks on their device -- e.g. the Harriet Lane Handbook formulary
// built from their own copy of the book. The data never lives in the repo:
// it goes straight from the chosen file into the user's own rows (RLS).
//
// Idempotent: drug rows upsert on (owner_id, source_key); the book is found
// by slug; chapters upsert on (book_id, chapter_number). Needs
// harriet_lane_reference_migration.sql to have been applied.

interface ImportFile {
  format: string
  source?: string
  drugs: Record<string, unknown>[]
  library?: {
    book: { slug: string; title: string; edition?: string; publisher?: string; year?: number; editors?: string[]; total_pages?: number }
    chapters: {
      part_roman: string
      part_title: string
      chapter_number: number
      title: string
      start_page?: number
      end_page?: number
      pages?: number
      note: string
    }[]
  }
}

export interface ReferenceImportResult {
  drugs: number
  chapters: number
}

const BATCH = 40

export async function importReferenceFile(
  file: File,
  onProgress?: (done: number, total: number) => void
): Promise<ReferenceImportResult> {
  const {
    data: { user },
  } = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  let data: ImportFile
  try {
    data = JSON.parse(await file.text()) as ImportFile
  } catch {
    throw new Error('This file is not a valid Nephron reference import (.json).')
  }
  if (data.format !== 'nephron-reference-import/1' || !Array.isArray(data.drugs)) {
    throw new Error('Unrecognized file format — expected nephron-reference-import/1.')
  }

  const rows = data.drugs.filter((d) => typeof d.source_key === 'string' && typeof d.medication === 'string')
  const total = rows.length
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH).map((d) => ({ ...d, owner_id: user.id }))
    const { error } = await supabase.from('drug_reference').upsert(chunk, { onConflict: 'owner_id,source_key' })
    if (error) throw new Error(`Drug import failed at row ${i + 1}: ${error.message}`)
    onProgress?.(Math.min(i + BATCH, total), total)
  }

  let chapters = 0
  const lib = data.library
  if (lib?.book?.slug && Array.isArray(lib.chapters)) {
    const { data: existing, error: findErr } = await supabase
      .from('library_books')
      .select('id')
      .eq('slug', lib.book.slug)
      .maybeSingle()
    if (findErr) throw findErr
    let bookId = (existing as { id: string } | null)?.id ?? null
    if (!bookId) {
      const { data: created, error: bookErr } = await supabase
        .from('library_books')
        .insert({
          owner_id: user.id,
          slug: lib.book.slug,
          title: lib.book.title,
          edition: lib.book.edition ?? null,
          publisher: lib.book.publisher ?? null,
          year: lib.book.year ?? null,
          editors: lib.book.editors ?? [],
          total_pages: lib.book.total_pages ?? null,
        })
        .select('id')
        .single()
      if (bookErr) throw bookErr
      bookId = (created as { id: string }).id
    }
    const now = new Date().toISOString()
    const chapterRows = lib.chapters.map((c) => ({
      owner_id: user.id,
      book_id: bookId,
      part_roman: c.part_roman,
      part_title: c.part_title,
      chapter_number: c.chapter_number,
      title: c.title,
      start_page: c.start_page ?? null,
      end_page: c.end_page ?? null,
      pages: c.pages ?? null,
      note: c.note,
      language: 'en',
      direction: 'ltr',
      note_format: 'harriet-lane-import/1',
      imported_at: now,
    }))
    const { error: chErr } = await supabase.from('library_chapters').upsert(chapterRows, { onConflict: 'book_id,chapter_number' })
    if (chErr) throw new Error(`Library import failed: ${chErr.message}`)
    chapters = chapterRows.length
  }

  return { drugs: total, chapters }
}
