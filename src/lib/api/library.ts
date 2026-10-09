import { supabase } from '../supabaseClient'
import bookContents from '../../data/bookContents.json'
import type {
  FsrsCardState,
  LibraryBook,
  LibraryBookDraft,
  LibraryCard,
  LibraryCardDraft,
  LibraryChapter,
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
}

export async function updateLibraryChapter(id: string, patch: LibraryChapterPatch): Promise<LibraryChapter> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.readingPct !== undefined) row.reading_pct = patch.readingPct
  if (patch.lastSection !== undefined) row.last_section = patch.lastSection
  if (patch.note !== undefined) row.note = patch.note
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
      }))
    )
    .select()
  if (error) throw error
  return (data as CardRow[]).map(cardToDomain)
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
