// Global search over the library (notes chunks, cards, question bank) and
// patients. Library search goes through the pgroonga-backed SQL functions
// from assistant_phase1_retrieval_migration.sql (RLS-scoped, SECURITY
// INVOKER); patients are matched with a plain ILIKE.
import { supabase } from '../supabaseClient'

export interface LibraryHit {
  chunkId: string
  bookTitle: string | null
  chapterId: string
  chapterNumber: number
  chapterTitle: string
  partNumber: number | null
  sectionIdx: number
  subIdx: number
  heading: string
  anchor: string | null
  pageFrom: number | null
  pageTo: number | null
  content: string
  snippet: string
  score: number
}

export interface CardHit {
  cardId: string
  chapterId: string | null
  chapterTitle: string | null
  kind: string
  front: string
  back: string | null
  sectionNumber: string | null
  snippet: string
}

export interface QuestionHit {
  questionId: string
  chapterId: string | null
  chapterTitle: string | null
  topic: string | null
  question: string
  options: string[] | null
  correctIndex: number | null
  explanation: string | null
  snippet: string
}

export interface PatientHit {
  id: string
  name: string
  code: string | null
  diagnosis: string | null
  bed: string | null
}

export interface GlobalSearchResults {
  library: LibraryHit[]
  cards: CardHit[]
  questions: QuestionHit[]
  patients: PatientHit[]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapLibraryHit(r: any): LibraryHit {
  return {
    chunkId: r.chunk_id,
    bookTitle: r.book_title,
    chapterId: r.chapter_id,
    chapterNumber: r.chapter_number,
    chapterTitle: r.chapter_title,
    partNumber: r.part_number,
    sectionIdx: r.section_idx,
    subIdx: r.sub_idx,
    heading: r.heading,
    anchor: r.anchor,
    pageFrom: r.page_from,
    pageTo: r.page_to,
    content: r.content,
    snippet: r.snippet ?? '',
    score: r.score,
  }
}

export async function searchLibrary(q: string, opts: { chapterId?: string | null; k?: number } = {}): Promise<LibraryHit[]> {
  const { data, error } = await supabase.rpc('search_library', { q, chapter: opts.chapterId ?? null, k: opts.k ?? 8 })
  if (error) throw error
  return (data ?? []).map(mapLibraryHit)
}

export async function searchCards(q: string, k = 6): Promise<CardHit[]> {
  const { data, error } = await supabase.rpc('search_cards', { q, k })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    cardId: r.card_id,
    chapterId: r.chapter_id,
    chapterTitle: r.chapter_title,
    kind: r.kind,
    front: r.front,
    back: r.back,
    sectionNumber: r.section_number,
    snippet: r.snippet ?? '',
  }))
}

export async function searchQuestions(q: string, k = 6): Promise<QuestionHit[]> {
  const { data, error } = await supabase.rpc('search_questions', { q, k })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    questionId: r.question_id,
    chapterId: r.chapter_id,
    chapterTitle: r.chapter_title,
    topic: r.topic,
    question: r.question,
    options: Array.isArray(r.options) ? r.options : null,
    correctIndex: r.correct_index,
    explanation: r.explanation,
    snippet: r.snippet ?? '',
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function searchPatients(q: string, k = 6): Promise<PatientHit[]> {
  // PostgREST .or() syntax breaks on commas/parentheses -- drop them.
  const term = q.replace(/[,()*%\\]/g, ' ').trim()
  if (!term) return []
  const like = `%${term}%`
  const { data, error } = await supabase
    .from('patients')
    .select('id, name, code, diagnosis, bed')
    .or(`name.ilike.${like},code.ilike.${like},diagnosis.ilike.${like},underlying_disease.ilike.${like}`)
    .order('updated_at', { ascending: false })
    .limit(k)
  if (error) throw error
  return (data ?? []) as PatientHit[]
}

export async function globalSearch(q: string): Promise<GlobalSearchResults> {
  const settle = <T,>(p: Promise<T[]>) => p.catch((e) => {
    console.warn('search group failed', e)
    return [] as T[]
  })
  const [library, cards, questions, patients] = await Promise.all([
    settle(searchLibrary(q, { k: 8 })),
    settle(searchCards(q, 6)),
    settle(searchQuestions(q, 6)),
    settle(searchPatients(q, 6)),
  ])
  return { library, cards, questions, patients }
}

/** Re-chunk every chapter/part note (RLS-scoped). Returns the chunk count. */
export async function reindexLibrary(): Promise<number> {
  const { data, error } = await supabase.rpc('reindex_library')
  if (error) throw error
  return data as number
}

/** Reader deep link for a book passage. */
export function passageHref(chapterId: string, anchor: string | null | undefined): string {
  return `/academy/reader/${chapterId}${anchor ? `#${anchor}` : ''}`
}

/** "pp. 761–778" / "p. 3231" / "" */
export function pageLabel(from: number | null | undefined, to: number | null | undefined): string {
  if (from == null && to == null) return ''
  if (from != null && to != null && to !== from) return `pp. ${from}–${to}`
  return `p. ${from ?? to}`
}

/**
 * pgroonga's snippet_html escapes the text and wraps matches in
 * <span class="keyword">. Keep only those spans (defence in depth), turn
 * them into <mark>, and drop markdown noise (**, ##, {#id}, callout tags).
 */
export function snippetToSafeHtml(snippet: string): string {
  const MARK_OPEN = '\u0001'
  const MARK_CLOSE = '\u0002'
  let s = snippet
    .replace(/<span class="keyword">/g, MARK_OPEN)
    .replace(/<\/span>/g, MARK_CLOSE)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  s = s
    .replace(/\{#[\w-]+[^}]*\}/g, '')
    .replace(/\*\*|__|`+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/(^|\n)\s*(&gt;\s?)+/g, '$1') // blockquote / callout markers
    .replace(/\[!\w+\]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return s.split(MARK_OPEN).join('<mark>').split(MARK_CLOSE).join('</mark>')
}
