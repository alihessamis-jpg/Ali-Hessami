import { supabase } from '../supabaseClient'
import type { FollowUpItem, FollowUpItemDraft } from '../../types/domain'

interface FollowUpItemRow {
  id: string
  patient_id: string
  category: FollowUpItem['category']
  description: string
  ordered_date: string
  resolved: boolean
  resolved_date: string | null
  notes: string | null
  created_at: string
}

function toDomain(row: FollowUpItemRow): FollowUpItem {
  return {
    id: row.id,
    patientId: row.patient_id,
    category: row.category,
    description: row.description,
    orderedDate: row.ordered_date,
    resolved: row.resolved,
    resolvedDate: row.resolved_date,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export async function listFollowUpItems(patientId: string): Promise<FollowUpItem[]> {
  const { data, error } = await supabase
    .from('follow_up_items')
    .select('*')
    .eq('patient_id', patientId)
    .order('ordered_date', { ascending: false })
  if (error) throw error
  return (data as FollowUpItemRow[]).map(toDomain)
}

export async function addFollowUpItem(draft: FollowUpItemDraft): Promise<FollowUpItem> {
  const { data, error } = await supabase
    .from('follow_up_items')
    .insert({
      patient_id: draft.patientId,
      category: draft.category,
      description: draft.description,
      ordered_date: draft.orderedDate,
      resolved: draft.resolved,
      resolved_date: draft.resolvedDate,
      notes: draft.notes,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as FollowUpItemRow)
}

export async function setFollowUpResolved(id: string, resolved: boolean): Promise<void> {
  const { error } = await supabase
    .from('follow_up_items')
    .update({ resolved, resolved_date: resolved ? new Date().toISOString().slice(0, 10) : null })
    .eq('id', id)
  if (error) throw error
}

export async function deleteFollowUpItem(id: string): Promise<void> {
  const { error } = await supabase.from('follow_up_items').delete().eq('id', id)
  if (error) throw error
}
