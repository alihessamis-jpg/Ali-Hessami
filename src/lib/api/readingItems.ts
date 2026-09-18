import { supabase } from '../supabaseClient'
import type { ReadingItem, ReadingItemDraft, ReviewCheckpointKey } from '../../types/domain'

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
