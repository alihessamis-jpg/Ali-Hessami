import { supabase } from '../supabaseClient'
import type { ReadingItem, ReadingItemDraft, ReadingItemFromQuestionDraft, ReviewCheckpointKey, SrsState } from '../../types/domain'

interface ReadingItemRow {
  id: string
  title: string
  source: string | null
  date_read: string
  review_3d_done: boolean
  review_7d_done: boolean
  review_14d_done: boolean
  review_30d_done: boolean
  review_90d_done: boolean
  topic_id: string | null
  answer: string | null
  origin: string | null
  interval_index: number | null
  last_reviewed: string | null
  next_review: string | null
  review_history: ReadingItem['reviewHistory']
}

const CHECKPOINT_COLUMNS: Record<ReviewCheckpointKey, string> = {
  review3dDone: 'review_3d_done',
  review7dDone: 'review_7d_done',
  review14dDone: 'review_14d_done',
  review30dDone: 'review_30d_done',
  review90dDone: 'review_90d_done',
}

function toDomain(row: ReadingItemRow): ReadingItem {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    dateRead: row.date_read,
    review3dDone: row.review_3d_done,
    review7dDone: row.review_7d_done,
    review14dDone: row.review_14d_done,
    review30dDone: row.review_30d_done,
    review90dDone: row.review_90d_done,
    topicId: row.topic_id,
    answer: row.answer,
    origin: row.origin,
    intervalIndex: row.interval_index,
    lastReviewed: row.last_reviewed,
    nextReview: row.next_review,
    reviewHistory: row.review_history ?? [],
  }
}

export async function listReadingItems(): Promise<ReadingItem[]> {
  const { data, error } = await supabase.from('reading_items').select('*').order('date_read', { ascending: false })
  if (error) throw error
  return (data as ReadingItemRow[]).map(toDomain)
}

export async function addReadingItem(draft: ReadingItemDraft): Promise<ReadingItem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('reading_items')
    .insert({
      user_id: user.id,
      title: draft.title,
      source: draft.source,
      date_read: draft.dateRead,
      topic_id: draft.topicId ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReadingItemRow)
}

export async function updateReadingItem(
  id: string,
  patch: { title: string; source: string | null; dateRead: string }
): Promise<ReadingItem> {
  const { data, error } = await supabase
    .from('reading_items')
    .update({ title: patch.title, source: patch.source, date_read: patch.dateRead })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReadingItemRow)
}

export async function setReadingItemTopic(id: string, topicId: string | null): Promise<ReadingItem> {
  const { data, error } = await supabase
    .from('reading_items')
    .update({ topic_id: topicId })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReadingItemRow)
}

export async function setReadingItemCheckpoint(
  id: string,
  key: ReviewCheckpointKey,
  done: boolean
): Promise<ReadingItem> {
  const { data, error } = await supabase
    .from('reading_items')
    .update({ [CHECKPOINT_COLUMNS[key]]: done })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReadingItemRow)
}

export async function deleteReadingItem(id: string): Promise<void> {
  const { error } = await supabase.from('reading_items').delete().eq('id', id)
  if (error) throw error
}

// Saves a question/case encountered elsewhere in the app (Board Questions,
// Lab/Imaging Challenges, Reasoning Cases) into the reading list, scheduled
// with the adaptive Leitner-box intervals (see updateReadingItemSrs) instead
// of the fixed checkpoint schedule used for manually-logged articles. The
// checkpoint columns are set to true since they don't apply to this item.
export async function addReadingItemFromQuestion(draft: ReadingItemFromQuestionDraft): Promise<ReadingItem> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('reading_items')
    .insert({
      user_id: user.id,
      title: draft.title,
      answer: draft.answer,
      origin: draft.origin,
      date_read: new Date().toISOString().slice(0, 10),
      review_3d_done: true,
      review_7d_done: true,
      review_14d_done: true,
      review_30d_done: true,
      review_90d_done: true,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReadingItemRow)
}

export async function updateReadingItemSrs(id: string, state: SrsState): Promise<ReadingItem> {
  const { data, error } = await supabase
    .from('reading_items')
    .update({
      interval_index: state.intervalIndex,
      last_reviewed: state.lastReviewed,
      next_review: state.nextReview,
      review_history: state.reviewHistory,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReadingItemRow)
}
