import { supabase } from '../supabaseClient'
import bookContents from '../../data/bookContents.json'
import { parseChapterNoteForImport } from '../chapterImport'
import { uploadChapterFigureFile } from '../storage'
import type { BulkCardImportItem, BulkImportError } from '../libraryBulkImport'
import type {
  FsrsCardState,
  LibraryBook,
  LibraryBookDraft,
  LibraryCard,
  LibraryCardDraft,
  LibraryChapter,
  LibraryChapterFigure,
  LibraryChapterPart,
  LibraryChapterSeed,
  LibraryChapterStatus,
  LibraryHighlight,
  LibraryHighlightDraft,
  ReadingLogEntry,
} from '../../types/domain'

interface BookRow {
  id: string
  title: string
  edition: string | null
  publisher: string | null
  year: number | null
  editors: string[] | null
  total_pages: number | null
  created_at: string
}

interface ChapterRow {
  id: string
  book_id: string
  part_roman: string
  part_title: string
  chapter_number: number
  title: string
  start_page: number | null
  end_page: number | null
  pages: number | null
  status: LibraryChapterStatus
  reading_pct: number
  last_section: string | null
  note: string | null
  subtitle: string | null
  language: string | null
  direction: string | null
  note_format: string | null
  imported_at: string | null
}

interface CardRow {
  id: string
  chapter_id: string
  kind: LibraryCard['kind']
  front: string
  back: string
  options: LibraryCard['options']
  section_number: string | null
  page: number | null
  source_text: string | null
  patient_id: string | null
  fsrs_due: string
  fsrs_stability: number | null
  fsrs_difficulty: number | null
  fsrs_elapsed_days: number
  fsrs_scheduled_days: number
  fsrs_reps: number
  fsrs_lapses: number
  fsrs_state: LibraryCard['state']
  fsrs_last_review: string | null
  review_history: LibraryCard['reviewHistory']
  status: LibraryCard['status']
  import_key: string | null
  tags: string[] | null
  topic: string | null
  high_yield: boolean
  figure_key: string | null
  source: string | null
  created_at: string
  chapter_part: number | null
  board_question_id: string | null
}

interface ChapterPartRow {
  id: string
  chapter_id: string
  part_number: number
  title: string | null
  subtitle: string | null
  note: string | null
  note_format: string | null
  language: string | null
  direction: string | null
  status: LibraryChapterStatus
  reading_pct: number
  last_section: string | null
  imported_at: string | null
  created_at: string
}

interface FigureRow {
  id: string
  chapter_id: string
  figure_key: string
  storage_path: string
  caption: string | null
  created_at: string
}

interface HighlightRow {
  id: string
  chapter_id: string
  section_number: string | null
  kind: LibraryHighlight['kind']
  text: string
  note_text: string | null
  created_at: string
}

function bookToDomain(row: BookRow): LibraryBook {
  return {
    id: row.id,
    title: row.title,
    edition: row.edition,
    publisher: row.publisher,
    year: row.year,
    editors: row.editors ?? [],
    totalPages: row.total_pages,
    createdAt: row.created_at,
  }
}

function chapterToDomain(row: ChapterRow): LibraryChapter {
  return {
    id: row.id,
    bookId: row.book_id,
    partRoman: row.part_roman,
    partTitle: row.part_title,
    chapterNumber: row.chapter_number,
    title: row.title,
    startPage: row.start_page,
    endPage: row.end_page,
    pages: row.pages,
    status: row.status,
    readingPct: row.reading_pct,
    lastSection: row.last_section,
    note: row.note,
    subtitle: row.subtitle,
    language: row.language,
    direction: row.direction,
    noteFormat: row.note_format,
    importedAt: row.imported_at,
  }
}

function cardToDomain(row: CardRow): LibraryCard {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    kind: row.kind,
    front: row.front,
    back: row.back,
    options: row.options,
    sectionNumber: row.section_number,
    page: row.page,
    sourceText: row.source_text,
    patientId: row.patient_id,
    due: row.fsrs_due,
    stability: row.fsrs_stability,
    difficulty: row.fsrs_difficulty,
    elapsedDays: row.fsrs_elapsed_days,
    scheduledDays: row.fsrs_scheduled_days,
    reps: row.fsrs_reps,
    lapses: row.fsrs_lapses,
    state: row.fsrs_state,
    lastReview: row.fsrs_last_review,
    reviewHistory: row.review_history ?? [],
    status: row.status ?? 'approved',
    importKey: row.import_key,
    tags: row.tags ?? [],
    topic: row.topic,
    highYield: row.high_yield ?? false,
    figureKey: row.figure_key,
    source: row.source,
    createdAt: row.created_at,
    chapterPart: row.chapter_part,
    boardQuestionId: row.board_question_id,
  }
}

function chapterPartToDomain(row: ChapterPartRow): LibraryChapterPart {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    partNumber: row.part_number,
    title: row.title,
    subtitle: row.subtitle,
    note: row.note,
    noteFormat: row.note_format,
    language: row.language,
    direction: row.direction,
    status: row.status,
    readingPct: row.reading_pct,
    lastSection: row.last_section,
    importedAt: row.imported_at,
    createdAt: row.created_at,
  }
}

function figureToDomain(row: FigureRow): LibraryChapterFigure {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    figureKey: row.figure_key,
    storagePath: row.storage_path,
    caption: row.caption,
    createdAt: row.created_at,
  }
}

function highlightToDomain(row: HighlightRow): LibraryHighlight {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    sectionNumber: row.section_number,
    kind: row.kind,
    text: row.text,
    noteText: row.note_text,
    createdAt: row.created_at,
  }
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

// --- Books / chapters -------------------------------------------------

export async function listLibraryBooks(): Promise<LibraryBook[]> {
  const { data, error } = await supabase.from('library_books').select('*').order('created_at')
  if (error) throw error
  return (data as BookRow[]).map(bookToDomain)
}

export async function addLibraryBook(draft: LibraryBookDraft): Promise<LibraryBook> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('library_books')
    .insert({
      owner_id: userId,
      title: draft.title,
      edition: draft.edition ?? null,
      publisher: draft.publisher ?? null,
      year: draft.year ?? null,
      editors: draft.editors,
      total_pages: draft.totalPages ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return bookToDomain(data as BookRow)
}

export async function getLibraryChapter(id: string): Promise<LibraryChapter | null> {
  const { data, error } = await supabase.from('library_chapters').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? chapterToDomain(data as ChapterRow) : null
}

export async function listLibraryChapters(bookId: string): Promise<LibraryChapter[]> {
  const { data, error } = await supabase
    .from('library_chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('chapter_number')
  if (error) throw error
  return (data as ChapterRow[]).map(chapterToDomain)
}

// Across every book, not just the one ensureLibraryBookSeeded() seeds --
// the review queue can hold cards from any book, so it needs every
// chapter to resolve a card's chapter/book label.
export async function listAllLibraryChapters(): Promise<LibraryChapter[]> {
  const { data, error } = await supabase.from('library_chapters').select('*').order('chapter_number')
  if (error) throw error
  return (data as ChapterRow[]).map(chapterToDomain)
}

export async function seedLibraryChapters(seeds: LibraryChapterSeed[]): Promise<LibraryChapter[]> {
  if (seeds.length === 0) return []
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('library_chapters')
    .insert(
      seeds.map((s) => ({
        owner_id: userId,
        book_id: s.bookId,
        part_roman: s.partRoman,
        part_title: s.partTitle,
        chapter_number: s.chapterNumber,
        title: s.title,
        start_page: s.startPage ?? null,
        end_page: s.endPage ?? null,
        pages: s.pages ?? null,
      }))
    )
    .select()
  if (error) throw error
  return (data as ChapterRow[]).map(chapterToDomain)
}

export interface LibraryChapterPatch {
  status?: LibraryChapterStatus
  readingPct?: number
  lastSection?: string | null
  note?: string | null
  subtitle?: string | null
  language?: string | null
  direction?: string | null
  noteFormat?: string | null
  importedAt?: string | null
}

export async function updateLibraryChapter(id: string, patch: LibraryChapterPatch): Promise<LibraryChapter> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.readingPct !== undefined) row.reading_pct = patch.readingPct
  if (patch.lastSection !== undefined) row.last_section = patch.lastSection
  if (patch.note !== undefined) row.note = patch.note
  if (patch.subtitle !== undefined) row.subtitle = patch.subtitle
  if (patch.language !== undefined) row.language = patch.language
  if (patch.direction !== undefined) row.direction = patch.direction
  if (patch.noteFormat !== undefined) row.note_format = patch.noteFormat
  if (patch.importedAt !== undefined) row.imported_at = patch.importedAt
  const { data, error } = await supabase.from('library_chapters').update(row).eq('id', id).select().single()
  if (error) throw error
  return chapterToDomain(data as ChapterRow)
}

// --- Cards --------------------------------------------------------------

export async function listLibraryCardsForChapter(chapterId: string): Promise<LibraryCard[]> {
  const { data, error } = await supabase
    .from('library_cards')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('created_at')
  if (error) throw error
  return (data as CardRow[]).map(cardToDomain)
}

export async function listAllLibraryCards(): Promise<LibraryCard[]> {
  const { data, error } = await supabase.from('library_cards').select('*').order('created_at')
  if (error) throw error
  return (data as CardRow[]).map(cardToDomain)
}

export async function addLibraryCard(draft: LibraryCardDraft): Promise<LibraryCard> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('library_cards')
    .insert({
      owner_id: userId,
      chapter_id: draft.chapterId,
      kind: draft.kind,
      front: draft.front,
      back: draft.back,
      options: draft.options ?? null,
      section_number: draft.sectionNumber ?? null,
      page: draft.page ?? null,
      source_text: draft.sourceText ?? null,
      patient_id: draft.patientId ?? null,
      figure_key: draft.figureKey ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return cardToDomain(data as CardRow)
}

export async function addLibraryCards(drafts: LibraryCardDraft[]): Promise<LibraryCard[]> {
  if (drafts.length === 0) return []
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('library_cards')
    .insert(
      drafts.map((draft) => ({
        owner_id: userId,
        chapter_id: draft.chapterId,
        kind: draft.kind,
        front: draft.front,
        back: draft.back,
        options: draft.options ?? null,
        section_number: draft.sectionNumber ?? null,
        page: draft.page ?? null,
        source_text: draft.sourceText ?? null,
        patient_id: draft.patientId ?? null,
        status: draft.status ?? 'suggested',
        import_key: draft.importKey ?? null,
        tags: draft.tags ?? [],
        topic: draft.topic ?? null,
        high_yield: draft.highYield ?? false,
        figure_key: draft.figureKey ?? null,
        source: draft.source ?? null,
      }))
    )
    .select()
  if (error) throw error
  return (data as CardRow[]).map(cardToDomain)
}

// Phase 4: bulk-paste cards/questions/scenarios from JSON or CSV (see
// lib/libraryBulkImport.ts for parsing). Each item resolves its own
// (book, chapter_number) -- cached per batch so a 100-card file for one
// chapter only looks the chapter up once -- and lands as a 'suggested'
// card, same as every other import path, so it goes through Approve
// before it's scheduled. Items whose chapter can't be resolved are
// skipped and reported rather than failing the whole batch.
export async function importBulkCards(items: BulkCardImportItem[]): Promise<{ created: LibraryCard[]; errors: BulkImportError[] }> {
  const errors: BulkImportError[] = []
  const chapterCache = new Map<string, LibraryChapter>()
  const drafts: LibraryCardDraft[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const cacheKey = `${item.bookId ?? ''}|${item.chapterNumber}`
    let chapter = chapterCache.get(cacheKey)
    if (!chapter) {
      try {
        chapter = await resolveChapterByBookAndNumber(item.bookId, item.chapterNumber)
        chapterCache.set(cacheKey, chapter)
      } catch (err) {
        errors.push({ index: i, message: err instanceof Error ? err.message : 'Chapter not found' })
        continue
      }
    }

    let options: LibraryCard['options'] = null
    if (item.kind === 'mcq') options = { choices: item.choices ?? [], explanation: item.explanation }
    else if (item.kind === 'patient_case') options = { stats: item.stats ?? [] }
    else if (item.kind === 'clinical_scenario') options = { steps: item.steps ?? [] }

    drafts.push({
      chapterId: chapter.id,
      kind: item.kind,
      front: item.front,
      back: item.back,
      options,
      sectionNumber: item.sectionNumber,
      page: item.page,
      sourceText: null,
      patientId: null,
      status: 'suggested',
      tags: item.tags,
      topic: item.topic,
      highYield: item.highYield,
      source: 'bulk_import',
    })
  }

  const created = await addLibraryCards(drafts)
  return { created, errors }
}

export async function updateLibraryCardFsrs(id: string, state: FsrsCardState): Promise<LibraryCard> {
  const { data, error } = await supabase
    .from('library_cards')
    .update({
      fsrs_due: state.due,
      fsrs_stability: state.stability,
      fsrs_difficulty: state.difficulty,
      fsrs_elapsed_days: state.elapsedDays,
      fsrs_scheduled_days: state.scheduledDays,
      fsrs_reps: state.reps,
      fsrs_lapses: state.lapses,
      fsrs_state: state.state,
      fsrs_last_review: state.lastReview,
      review_history: state.reviewHistory,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return cardToDomain(data as CardRow)
}

export async function deleteLibraryCard(id: string): Promise<void> {
  const { error } = await supabase.from('library_cards').delete().eq('id', id)
  if (error) throw error
}

// Flips a suggested card to approved -- scheduling starts from its existing
// (default, untouched-by-import) FSRS state, i.e. it becomes due now, same
// as any other freshly made card's first review.
export async function approveLibraryCard(id: string): Promise<LibraryCard> {
  const { data, error } = await supabase.from('library_cards').update({ status: 'approved' }).eq('id', id).select().single()
  if (error) throw error
  return cardToDomain(data as CardRow)
}

// Links a library card (board-MCQ or otherwise) to a figure already uploaded
// via addLibraryChapterFigure, so ReviewPage can show it with the card.
export async function setLibraryCardFigure(id: string, figureKey: string): Promise<void> {
  const { error } = await supabase.from('library_cards').update({ figure_key: figureKey }).eq('id', id)
  if (error) throw error
}

export async function approveLibraryCards(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('library_cards').update({ status: 'approved' }).in('id', ids)
  if (error) throw error
}

// --- Chapter figures (NEPHRON_CHAPTER_FORMAT.md v1.3) ---------------------

export async function listLibraryChapterFigures(chapterId: string): Promise<LibraryChapterFigure[]> {
  const { data, error } = await supabase.from('library_chapter_figures').select('*').eq('chapter_id', chapterId)
  if (error) throw error
  return (data as FigureRow[]).map(figureToDomain)
}

export async function listAllLibraryChapterFigures(): Promise<LibraryChapterFigure[]> {
  const { data, error } = await supabase.from('library_chapter_figures').select('*')
  if (error) throw error
  return (data as FigureRow[]).map(figureToDomain)
}

// Uploads one figure's image file to the chapter-figures bucket and
// upserts its library_chapter_figures row by (chapter, figureKey), so
// re-uploading the same figure replaces the file/row in place instead of
// duplicating. Shared by the .md import flow and the Reader's own per-figure
// "Add image" upload (for a figure the import was missing an image for).
export async function addLibraryChapterFigure(
  chapterId: string,
  chapterNumber: number,
  figureKey: string,
  caption: string | null,
  file: File
): Promise<LibraryChapterFigure> {
  const userId = await currentUserId()
  const storagePath = await uploadChapterFigureFile(userId, chapterNumber, figureKey, file)
  const { data, error } = await supabase
    .from('library_chapter_figures')
    .upsert(
      { owner_id: userId, chapter_id: chapterId, figure_key: figureKey, storage_path: storagePath, caption },
      { onConflict: 'chapter_id,figure_key' }
    )
    .select()
    .single()
  if (error) throw error
  return figureToDomain(data as FigureRow)
}

// Deletes a figure's library_chapter_figures row (its storage file is
// removed separately -- see deleteChapterFigureFile -- since this is just
// the DB half of "Remove image").
export async function deleteLibraryChapterFigure(id: string): Promise<void> {
  const { error } = await supabase.from('library_chapter_figures').delete().eq('id', id)
  if (error) throw error
}

// --- Chapter-note import (NEPHRON_CHAPTER_FORMAT.md v1) -------------------

export interface ImportChapterNoteResult {
  chapter: LibraryChapter
  suggestedCardCount: number
  /** v1.3: figure filenames the note references but weren't among `images`. */
  missingFigures: string[]
  /** v1.4: set when the file had a `chapter_part:` -- the part row that was created/updated. */
  part: LibraryChapterPart | null
}

const DEFAULT_BOOK_SLUG = 'pediatric-nephrology-8e'

// v1.4: resolves a chapter-note's front-matter `book_id:` slug (missing =
// the original bundled textbook) to the real library_books.id -- the slug
// is a stable identifier a note author can type, the UUID is the DB's.
async function resolveBookId(slug: string | null): Promise<string> {
  const { data, error } = await supabase
    .from('library_books')
    .select('id')
    .eq('slug', slug ?? DEFAULT_BOOK_SLUG)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No book with slug "${slug ?? DEFAULT_BOOK_SLUG}" -- add it to Library first`)
  return (data as { id: string }).id
}

// Shared by the bulk card/question/scenario importer -- same lookup
// importChapterNote() does inline, exposed so it doesn't have to parse a
// chapter-note file to find a chapter by (book, chapter number).
export async function resolveChapterByBookAndNumber(bookSlug: string | null, chapterNumber: number): Promise<LibraryChapter> {
  const bookId = await resolveBookId(bookSlug)
  const { data, error } = await supabase
    .from('library_chapters')
    .select('*')
    .eq('book_id', bookId)
    .eq('chapter_number', chapterNumber)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`No chapter ${chapterNumber} found in this book -- seed the Library first`)
  return chapterToDomain(data as ChapterRow)
}

// One image file supplied alongside the .md at import time, keyed by its
// bare filename (e.g. "ch49-fig1.jpg") so it matches a note's
// `figures/ch49-fig1.jpg` reference regardless of how it was selected
// (multi-file picker, or unzipped from a single .zip).
export interface ChapterNoteImageInput {
  filename: string
  file: File
}

// Parses a .md chapter note, updates the chapter its front matter's
// `chapter:` number names, and upserts its "نکات امتحانی" bullets as
// SUGGESTED (unscheduled) cards keyed by (chapter, section id, position) --
// re-importing the same file updates a card's front/back text in place
// without resetting its FSRS state/review history or creating a duplicate,
// because `status`/the fsrs_* columns are deliberately left out of the
// upsert payload (Postgres's ON CONFLICT DO UPDATE only touches the
// columns actually provided).
//
// v1.3: `images` carries the figure files selected alongside the .md (or
// unzipped from a single .zip) -- each `![..](figures/x.jpg){#id .figure}`
// reference is matched to one by filename, uploaded to the chapter-figures
// bucket, and upserted by figureKey so re-import replaces the file in place.
// A referenced figure with no matching image is reported in
// `missingFigures` instead of failing the whole import.
export async function importChapterNote(raw: string, images: ChapterNoteImageInput[] = []): Promise<ImportChapterNoteResult> {
  const userId = await currentUserId()
  const parsed = parseChapterNoteForImport(raw)
  const bookId = await resolveBookId(parsed.meta.bookId)

  const { data: existingRow, error: findError } = await supabase
    .from('library_chapters')
    .select('*')
    .eq('book_id', bookId)
    .eq('chapter_number', parsed.meta.chapter)
    .maybeSingle()
  if (findError) throw findError
  if (!existingRow) throw new Error(`No chapter ${parsed.meta.chapter} found in this book -- seed the Library first`)
  const chapterRow = existingRow as ChapterRow
  const chapterId = chapterRow.id
  const chapterPart = parsed.meta.chapterPart

  // v1.4: a file with `chapter_part:` is one of several independent notes
  // for this chapter -- it goes to its own library_chapter_parts row
  // (upserted by chapter_id+part_number, so re-import replaces only that
  // part) instead of the chapter's own note/subtitle/etc. columns, which a
  // legacy single-note file (no chapter_part) still updates directly,
  // unchanged from v1-v1.3 behavior.
  let partRow: ChapterPartRow | null = null
  let resultChapterRow = chapterRow
  if (chapterPart != null) {
    const { data, error: partError } = await supabase
      .from('library_chapter_parts')
      .upsert(
        {
          owner_id: userId,
          chapter_id: chapterId,
          part_number: chapterPart,
          title: parsed.meta.partTitle ?? parsed.meta.partTitleEn,
          subtitle: parsed.meta.subtitle,
          note: parsed.body,
          note_format: parsed.meta.format ?? 'nephron-chapter-note/1.4',
          language: parsed.meta.language,
          direction: parsed.meta.direction,
          imported_at: new Date().toISOString(),
        },
        { onConflict: 'chapter_id,part_number' }
      )
      .select()
      .single()
    if (partError) throw partError
    partRow = data as ChapterPartRow
  } else {
    const { data: updatedRow, error: updateError } = await supabase
      .from('library_chapters')
      .update({
        note: parsed.body,
        subtitle: parsed.meta.subtitle,
        language: parsed.meta.language,
        direction: parsed.meta.direction,
        note_format: parsed.meta.format ?? 'nephron-chapter-note/1',
        imported_at: new Date().toISOString(),
      })
      .eq('id', chapterId)
      .select()
      .single()
    if (updateError) throw updateError
    resultChapterRow = updatedRow as ChapterRow
  }

  const clozeUpserts = parsed.suggestedCards.map((c) => ({
    owner_id: userId,
    chapter_id: chapterId,
    kind: 'cloze' as const,
    front: c.front,
    back: c.back,
    section_number: c.sectionNumber,
    import_key: c.importKey,
    tags: c.tags,
    topic: c.topic,
    high_yield: c.highYield,
    figure_key: c.figureKey,
    chapter_part: chapterPart,
  }))
  const mcqUpserts = parsed.suggestedMcqCards.map((c) => ({
    owner_id: userId,
    chapter_id: chapterId,
    kind: 'mcq' as const,
    front: c.front,
    back: c.back,
    options: c.options,
    section_number: c.sectionNumber,
    import_key: c.importKey,
    tags: [],
    topic: null,
    high_yield: false,
    figure_key: null,
    chapter_part: chapterPart,
  }))
  const cardUpserts = [...clozeUpserts, ...mcqUpserts]

  if (cardUpserts.length > 0) {
    const { error: upsertError } = await supabase
      .from('library_cards')
      .upsert(cardUpserts, { onConflict: 'chapter_id,import_key' })
    if (upsertError) throw upsertError
  }

  const missingFigures: string[] = []
  for (const fig of parsed.figures) {
    const filename = fig.file.split('/').pop() ?? fig.file
    const imageInput = images.find((img) => img.filename === filename)
    if (!imageInput) {
      missingFigures.push(filename)
      continue
    }
    await addLibraryChapterFigure(chapterId, parsed.meta.chapter, fig.figureKey, fig.caption || null, imageInput.file)
  }

  return {
    chapter: chapterToDomain(resultChapterRow),
    suggestedCardCount: parsed.suggestedCards.length + parsed.suggestedMcqCards.length,
    missingFigures,
    part: partRow ? chapterPartToDomain(partRow) : null,
  }
}

// v1.4: parts for a chapter, in part-number order; empty for a chapter
// that only ever got a legacy single-note import.
export async function listLibraryChapterParts(chapterId: string): Promise<LibraryChapterPart[]> {
  const { data, error } = await supabase
    .from('library_chapter_parts')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('part_number')
  if (error) throw error
  return (data as ChapterPartRow[]).map(chapterPartToDomain)
}

export interface LibraryChapterPartProgressPatch {
  status?: LibraryChapterStatus
  readingPct?: number
  lastSection?: string | null
}

export async function updateLibraryChapterPart(id: string, patch: LibraryChapterPartProgressPatch): Promise<LibraryChapterPart> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.readingPct !== undefined) row.reading_pct = patch.readingPct
  if (patch.lastSection !== undefined) row.last_section = patch.lastSection
  const { data, error } = await supabase.from('library_chapter_parts').update(row).eq('id', id).select().single()
  if (error) throw error
  return chapterPartToDomain(data as ChapterPartRow)
}

// --- Highlights / notes --------------------------------------------------

export async function listLibraryHighlights(chapterId: string): Promise<LibraryHighlight[]> {
  const { data, error } = await supabase
    .from('library_highlights')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('created_at')
  if (error) throw error
  return (data as HighlightRow[]).map(highlightToDomain)
}

export async function addLibraryHighlight(draft: LibraryHighlightDraft): Promise<LibraryHighlight> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('library_highlights')
    .insert({
      owner_id: userId,
      chapter_id: draft.chapterId,
      section_number: draft.sectionNumber ?? null,
      kind: draft.kind,
      text: draft.text,
      note_text: draft.noteText ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return highlightToDomain(data as HighlightRow)
}

export async function deleteLibraryHighlight(id: string): Promise<void> {
  const { error } = await supabase.from('library_highlights').delete().eq('id', id)
  if (error) throw error
}

// --- Chapter <-> Academy topic links --------------------------------------

export async function listTopicIdsForChapter(chapterId: string): Promise<string[]> {
  const { data, error } = await supabase.from('chapter_topics').select('topic_id').eq('chapter_id', chapterId)
  if (error) throw error
  return (data as Array<{ topic_id: string }>).map((r) => r.topic_id)
}

export async function listChapterIdsForTopic(topicId: string): Promise<string[]> {
  const { data, error } = await supabase.from('chapter_topics').select('chapter_id').eq('topic_id', topicId)
  if (error) throw error
  return (data as Array<{ chapter_id: string }>).map((r) => r.chapter_id)
}

export async function linkChapterTopic(chapterId: string, topicId: string): Promise<void> {
  const { error } = await supabase.from('chapter_topics').insert({ chapter_id: chapterId, topic_id: topicId })
  if (error) throw error
}

export async function unlinkChapterTopic(chapterId: string, topicId: string): Promise<void> {
  const { error } = await supabase.from('chapter_topics').delete().eq('chapter_id', chapterId).eq('topic_id', topicId)
  if (error) throw error
}

// --- First-run seeding ----------------------------------------------------

// Creates the bundled textbook's Library book + its 87 chapters (from
// src/data/bookContents.json) for the signed-in clinician the first time
// they open the Library — nothing to run server-side, no shared seed row.
export async function ensureLibraryBookSeeded(): Promise<{ book: LibraryBook; chapters: LibraryChapter[] }> {
  const existingBooks = await listLibraryBooks()
  if (existingBooks.length > 0) {
    const book = existingBooks[0]
    const chapters = await listLibraryChapters(book.id)
    if (chapters.length > 0) return { book, chapters }
    const seeded = await seedLibraryChapters(buildChapterSeeds(book.id))
    return { book, chapters: seeded }
  }

  const book = await addLibraryBook({
    title: bookContents.title,
    edition: bookContents.edition,
    publisher: bookContents.publisher,
    year: bookContents.year,
    editors: bookContents.editors,
    totalPages: Math.max(...bookContents.parts.flatMap((p) => p.chapters.map((c) => c.end))),
  })
  const chapters = await seedLibraryChapters(buildChapterSeeds(book.id))
  return { book, chapters }
}

// --- Reading log (daily goal + streak) ------------------------------------

export async function logPagesRead(pages: number): Promise<void> {
  if (pages <= 0) return
  const userId = await currentUserId()
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await supabase
    .from('library_reading_log')
    .select('pages_read')
    .eq('owner_id', userId)
    .eq('log_date', today)
    .maybeSingle()
  const nextPages = (existing?.pages_read ?? 0) + pages
  const { error } = await supabase
    .from('library_reading_log')
    .upsert({ owner_id: userId, log_date: today, pages_read: nextPages }, { onConflict: 'owner_id,log_date' })
  if (error) throw error
}

export async function listReadingLog(days = 60): Promise<ReadingLogEntry[]> {
  const { data, error } = await supabase
    .from('library_reading_log')
    .select('log_date, pages_read')
    .order('log_date', { ascending: false })
    .limit(days)
  if (error) throw error
  return (data as Array<{ log_date: string; pages_read: number }>).map((r) => ({ logDate: r.log_date, pagesRead: r.pages_read }))
}

function buildChapterSeeds(bookId: string): LibraryChapterSeed[] {
  return bookContents.parts.flatMap((part) =>
    part.chapters.map(
      (c): LibraryChapterSeed => ({
        bookId,
        partRoman: part.roman,
        partTitle: part.title,
        chapterNumber: c.n,
        title: c.title,
        startPage: c.start,
        endPage: c.end,
        pages: c.pages,
      })
    )
  )
}
