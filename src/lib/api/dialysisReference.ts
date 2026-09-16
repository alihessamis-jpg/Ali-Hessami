import { supabase } from '../supabaseClient'
import type { DialysisRefEntry, DialysisRefEntryDraft } from '../../types/domain'

interface DialysisRefRow {
  id: string
  medication: string
  indication: string | null
  pediatric_dose: string | null
  route: string | null
  frequency: string | null
  max_dose: string | null
  notes: string | null
}

function toDomain(row: DialysisRefRow): DialysisRefEntry {
  return {
    id: row.id,
    medication: row.medication,
    indication: row.indication,
    pediatricDose: row.pediatric_dose,
    route: row.route,
    frequency: row.frequency,
    maxDose: row.max_dose,
    notes: row.notes,
  }
}

function toRow(draft: Partial<DialysisRefEntry>) {
  return {
    medication: draft.medication,
    indication: draft.indication,
    pediatric_dose: draft.pediatricDose,
    route: draft.route,
    frequency: draft.frequency,
    max_dose: draft.maxDose,
    notes: draft.notes,
  }
}

export async function listDialysisReference(): Promise<DialysisRefEntry[]> {
  const { data, error } = await supabase.from('dialysis_reference').select('*').order('medication')
  if (error) throw error
  return (data as DialysisRefRow[]).map(toDomain)
}

export async function addDialysisReference(draft: DialysisRefEntryDraft): Promise<DialysisRefEntry> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('dialysis_reference')
    .insert({ ...toRow(draft), owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as DialysisRefRow)
}

export async function updateDialysisReference(
  id: string,
  patch: Partial<DialysisRefEntry>
): Promise<DialysisRefEntry> {
  const { data, error } = await supabase
    .from('dialysis_reference')
    .update(toRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as DialysisRefRow)
}

export async function deleteDialysisReference(id: string): Promise<void> {
  const { error } = await supabase.from('dialysis_reference').delete().eq('id', id)
  if (error) throw error
}
