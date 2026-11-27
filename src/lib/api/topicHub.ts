// Academy · Topic Hub — reads (all RLS-scoped to the signed-in user).
import { supabase } from '../supabaseClient'
import { fetchAll } from './fetchAll'
import { listAcademyTopics } from './academy'
import { buildHubIndex, type HubIndex } from '../topicHub'
import type { AcademyTopic } from '../../types/domain'

export interface HubData {
  topics: AcademyTopic[]
  index: HubIndex
}

/** Everything the hub's category cards need, in four light queries. */
export async function loadHub(): Promise<HubData> {
  const [topics, chapterTopics, questions, attempts, topicPatients] = await Promise.all([
    listAcademyTopics(),
    fetchAll<{ chapter_id: string; topic_id: string }>(() =>
      supabase.from('chapter_topics').select('chapter_id, topic_id').order('topic_id').order('chapter_id'),
    ),
    // approved only — the same pool the Board Questions practice engine serves
    fetchAll<{ id: string; chapter_id: string | null }>(() =>
      supabase.from('board_questions').select('id, chapter_id').eq('review_status', 'approved').order('id'),
    ),
    fetchAll<{ question_id: string; is_correct: boolean; attempted_at: string }>(() =>
      supabase.from('board_question_attempts').select('question_id, is_correct, attempted_at').order('id'),
    ),
    fetchAll<{ topic_id: string; patient_id: string }>(() =>
      supabase.from('academy_topic_patients').select('topic_id, patient_id').order('topic_id').order('patient_id'),
    ),
  ])
  return { topics, index: buildHubIndex({ chapterTopics, questions, attempts, topicPatients }) }
}

export interface HubChapter {
  id: string
  bookId: string
  bookTitle: string
  bookSlug: string | null
  chapterNumber: number
  title: string
  startPage: number | null
  endPage: number | null
  readingPct: number
  status: string
}

interface ChapterRow {
  id: string
  book_id: string
  chapter_number: number
  title: string
  start_page: number | null
  end_page: number | null
  reading_pct: number | null
  status: string
  library_books: { title: string; slug: string | null } | null
}

function chapterToHub(r: ChapterRow): HubChapter {
  return {
    id: r.id,
    bookId: r.book_id,
    bookTitle: r.library_books?.title ?? '',
    bookSlug: r.library_books?.slug ?? null,
    chapterNumber: r.chapter_number,
    title: r.title,
    startPage: r.start_page,
    endPage: r.end_page,
    readingPct: r.reading_pct ?? 0,
    status: r.status,
  }
}

const CHAPTER_COLS = 'id, book_id, chapter_number, title, start_page, end_page, reading_pct, status, library_books(title, slug)'

export async function getChapters(ids: string[]): Promise<HubChapter[]> {
  if (!ids.length) return []
  const { data, error } = await supabase.from('library_chapters').select(CHAPTER_COLS).in('id', ids)
  if (error) throw error
  return ((data ?? []) as unknown as ChapterRow[])
    .map(chapterToHub)
    .sort((a, b) => a.bookTitle.localeCompare(b.bookTitle) || a.chapterNumber - b.chapterNumber)
}

/** Every chapter of every book (for the «pick chapters» form). */
export async function listAllChapters(): Promise<HubChapter[]> {
  const rows = await fetchAll<ChapterRow>(() =>
    supabase.from('library_chapters').select(CHAPTER_COLS).order('book_id').order('chapter_number'),
  )
  return rows.map(chapterToHub)
}

/**
 * «(Ch.N §M)» in the topic texts refers to Pediatric Nephrology. Returns
 * chapter number → id, and which `chN-sM` anchors exist for the numbers given.
 */
export async function pedNephRefs(numbers: number[]): Promise<{ ids: Map<number, string>; anchors: Set<string> }> {
  const ids = new Map<number, string>()
  const anchors = new Set<string>()
  if (!numbers.length) return { ids, anchors }
  const { data, error } = await supabase
    .from('library_chapters')
    .select('id, chapter_number, library_books!inner(slug)')
    .eq('library_books.slug', 'pediatric-nephrology-8e')
    .in('chapter_number', numbers)
  if (error) throw error
  for (const r of (data ?? []) as { id: string; chapter_number: number }[]) ids.set(r.chapter_number, r.id)
  if (ids.size) {
    const rows = await fetchAll<{ anchor: string | null }>(() =>
      supabase.from('library_chunks').select('anchor').in('chapter_id', [...ids.values()]).like('anchor', 'ch%-s%').order('id'),
    )
    for (const r of rows) if (r.anchor && /^ch\d+-s\d+$/.test(r.anchor)) anchors.add(r.anchor)
  }
  return { ids, anchors }
}

export async function linkChapter(topicId: string, chapterId: string): Promise<void> {
  const { error } = await supabase.from('chapter_topics').upsert({ topic_id: topicId, chapter_id: chapterId }, { onConflict: 'chapter_id,topic_id', ignoreDuplicates: true })
  if (error) throw error
}

export async function unlinkChapter(topicId: string, chapterId: string): Promise<void> {
  const { error } = await supabase.from('chapter_topics').delete().eq('topic_id', topicId).eq('chapter_id', chapterId)
  if (error) throw error
}

// ---------------------------------------------------------------- daily cases
export interface TopicDailyCase {
  id: string
  caseDate: string
  title: string
  difficulty: string
  topicName: string
  bestScore: number | null
  inProgress: boolean
  finalDiagnosis: string | null
}

/** Ready Daily Cases whose case_topics.category is one of `caseCategories`, newest first. */
export async function dailyCasesForCategories(caseCategories: string[]): Promise<TopicDailyCase[]> {
  if (!caseCategories.length) return []
  const { data, error } = await supabase
    .from('daily_cases')
    .select('id, case_date, title, difficulty, final_diagnosis:case_json->>final_diagnosis, case_topics!inner(name, category)')
    .eq('status', 'ready')
    .in('case_topics.category', caseCategories)
    .order('case_date', { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as unknown as {
    id: string
    case_date: string
    title: string
    difficulty: string
    final_diagnosis: string | null
    case_topics: { name: string; category: string }
  }[]
  if (!rows.length) return []
  const { data: att, error: aErr } = await supabase
    .from('case_attempts')
    .select('case_id, score, completed_at')
    .in('case_id', rows.map((r) => r.id))
  if (aErr) throw aErr
  const best = new Map<string, number>()
  const open = new Set<string>()
  for (const a of (att ?? []) as { case_id: string; score: number | null; completed_at: string | null }[]) {
    if (a.completed_at && a.score != null) best.set(a.case_id, Math.max(best.get(a.case_id) ?? 0, a.score))
    else open.add(a.case_id)
  }
  return rows.map((r) => ({
    id: r.id,
    caseDate: r.case_date,
    title: r.title,
    difficulty: r.difficulty,
    topicName: r.case_topics.name,
    bestScore: best.get(r.id) ?? null,
    inProgress: !best.has(r.id) && open.has(r.id),
    // the diagnosis is only shown once the case has been solved
    finalDiagnosis: best.has(r.id) ? r.final_diagnosis : null,
  }))
}

/** Root topic of a hub category (for «مرور این مبحث در Topic Hub»). */
export async function rootTopicForCategories(categories: string[]): Promise<{ id: string; name: string } | null> {
  if (!categories.length) return null
  const { data, error } = await supabase
    .from('academy_topics')
    .select('id, name, category')
    .in('category', categories)
    .is('parent_topic_id', null)
  if (error) throw error
  const rows = (data ?? []) as { id: string; name: string; category: string }[]
  // keep the mapping order (e.g. cakut → CAKUT before UTI & VUR)
  for (const c of categories) {
    const r = rows.find((x) => x.category === c)
    if (r) return { id: r.id, name: r.name }
  }
  return null
}
