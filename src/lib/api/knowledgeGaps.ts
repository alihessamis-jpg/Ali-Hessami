import { supabase } from '../supabaseClient'
import type { KnowledgeGap, KnowledgeGapDraft } from '../../types/domain'

interface KnowledgeGapRow {
  id: string
  topic: string
  description: string | null
  date: string
  priority: string | null
  review_date: string | null
  status: string | null
}

function toDomain(row: KnowledgeGapRow): KnowledgeGap {
  return {
    id: row.id,
    topic: row.topic,
    description: row.description,
    date: row.date,
    priority: row.priority,
    reviewDate: row.review_date,
    status: row.status,
  }
}

export async function listKnowledgeGaps(): Promise<KnowledgeGap[]> {
  const { data, error } = await supabase.from('knowledge_gaps').select('*').order('date', { ascending: false })
  if (error) throw error
  return (data as KnowledgeGapRow[]).map(toDomain)
}

export async function addKnowledgeGap(draft: KnowledgeGapDraft): Promise<KnowledgeGap> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('knowledge_gaps')
    .insert({
      topic: draft.topic,
      description: draft.description,
      date: draft.date,
      priority: draft.priority,
      review_date: draft.reviewDate,
      status: draft.status,
      user_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as KnowledgeGapRow)
}

export async function updateKnowledgeGap(id: string, patch: Partial<KnowledgeGap>): Promise<KnowledgeGap> {
  const { data, error } = await supabase
    .from('knowledge_gaps')
    .update({
      topic: patch.topic,
      description: patch.description,
      priority: patch.priority,
      review_date: patch.reviewDate,
      status: patch.status,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as KnowledgeGapRow)
}

export async function deleteKnowledgeGap(id: string): Promise<void> {
  const { error } = await supabase.from('knowledge_gaps').delete().eq('id', id)
  if (error) throw error
}
