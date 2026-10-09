import { supabase } from '../supabaseClient'
import type { Book, BookChapter, BookChapterDraft, BookDraft, BookSection, BookSectionDraft, BookSectionStatus } from '../../types/domain'

interface BookRow {
  id: string
  title: string
  author: string | null
  total_pages: number | null
  created_at: string
}

interface BookChapterRow {
  id: string
  book_id: string
  title: string
  chapter_index: number
  pages_from: number | null
  pages_to: number | null
}

interface BookSectionRow {
  id: string
  chapter_id: string
  title: string
  section_index: number
  pages_from: number | null
  pages_to: number | null
  status: BookSectionStatus
  read_at: string | null
}

function bookToDomain(row: BookRow): Book {
  return { id: row.id, title: row.title, author: row.author, totalPages: row.total_pages, createdAt: row.created_at }
}

function chapterToDomain(row: BookChapterRow): BookChapter {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    chapterIndex: row.chapter_index,
    pagesFrom: row.pages_from,
    pagesTo: row.pages_to,
  }
}

function sectionToDomain(row: BookSectionRow): BookSection {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    title: row.title,
    sectionIndex: row.section_index,
    pagesFrom: row.pages_from,
    pagesTo: row.pages_to,
    status: row.status,
    readAt: row.read_at,
  }
}

export async function listBooks(): Promise<Book[]> {
  const { data, error } = await supabase.from('books').select('*').order('created_at')
  if (error) throw error
  return (data as BookRow[]).map(bookToDomain)
}

export async function addBook(draft: BookDraft): Promise<Book> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('books')
    .insert({ owner_id: user.id, title: draft.title, author: draft.author ?? null, total_pages: draft.totalPages ?? null })
    .select()
    .single()
  if (error) throw error
  return bookToDomain(data as BookRow)
}

export async function deleteBook(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) throw error
}

export async function listChaptersForBook(bookId: string): Promise<BookChapter[]> {
  const { data, error } = await supabase.from('book_chapters').select('*').eq('book_id', bookId).order('chapter_index')
  if (error) throw error
  return (data as BookChapterRow[]).map(chapterToDomain)
}

export async function addChapter(draft: BookChapterDraft): Promise<BookChapter> {
  const { data, error } = await supabase
    .from('book_chapters')
    .insert({
      book_id: draft.bookId,
      title: draft.title,
      chapter_index: draft.chapterIndex,
      pages_from: draft.pagesFrom ?? null,
      pages_to: draft.pagesTo ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return chapterToDomain(data as BookChapterRow)
}

export async function deleteChapter(id: string): Promise<void> {
  const { error } = await supabase.from('book_chapters').delete().eq('id', id)
  if (error) throw error
}

export async function listSectionsForChapters(chapterIds: string[]): Promise<BookSection[]> {
  if (chapterIds.length === 0) return []
  const { data, error } = await supabase
    .from('book_sections')
    .select('*')
    .in('chapter_id', chapterIds)
    .order('section_index')
  if (error) throw error
  return (data as BookSectionRow[]).map(sectionToDomain)
}

export async function listAllSectionsForUser(): Promise<BookSection[]> {
  const { data, error } = await supabase.from('book_sections').select('*').order('section_index')
  if (error) throw error
  return (data as BookSectionRow[]).map(sectionToDomain)
}

export async function addSection(draft: BookSectionDraft): Promise<BookSection> {
  const { data, error } = await supabase
    .from('book_sections')
    .insert({
      chapter_id: draft.chapterId,
      title: draft.title,
      section_index: draft.sectionIndex,
      pages_from: draft.pagesFrom ?? null,
      pages_to: draft.pagesTo ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return sectionToDomain(data as BookSectionRow)
}

export async function setSectionStatus(id: string, status: BookSectionStatus): Promise<BookSection> {
  const { data, error } = await supabase
    .from('book_sections')
    .update({ status, read_at: status === 'unread' ? null : new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return sectionToDomain(data as BookSectionRow)
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await supabase.from('book_sections').delete().eq('id', id)
  if (error) throw error
}

export async function listTopicIdsForSection(sectionId: string): Promise<string[]> {
  const { data, error } = await supabase.from('book_section_topics').select('topic_id').eq('section_id', sectionId)
  if (error) throw error
  return (data as Array<{ topic_id: string }>).map((r) => r.topic_id)
}

export async function listTopicIdsForSections(sectionIds: string[]): Promise<Record<string, string[]>> {
  if (sectionIds.length === 0) return {}
  const { data, error } = await supabase.from('book_section_topics').select('section_id, topic_id').in('section_id', sectionIds)
  if (error) throw error
  const map: Record<string, string[]> = {}
  for (const row of data as Array<{ section_id: string; topic_id: string }>) {
    (map[row.section_id] ??= []).push(row.topic_id)
  }
  return map
}

export async function linkSectionTopic(sectionId: string, topicId: string): Promise<void> {
  const { error } = await supabase.from('book_section_topics').insert({ section_id: sectionId, topic_id: topicId })
  if (error) throw error
}

export async function unlinkSectionTopic(sectionId: string, topicId: string): Promise<void> {
  const { error } = await supabase
    .from('book_section_topics')
    .delete()
    .eq('section_id', sectionId)
    .eq('topic_id', topicId)
  if (error) throw error
}
