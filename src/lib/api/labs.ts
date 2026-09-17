import { supabase } from '../supabaseClient'
import type { LabEntry, LabEntryDraft, MicroDetails } from '../../types/domain'

interface LabEntryRow {
  id: string
  patient_id: string
  date: string
  category: string | null
  test: string
  value: number | null
  value_text: string | null
  micro_details: MicroDetails | null
  unit: string | null
  ref: string | null
  comment: string | null
}

function toDomain(row: LabEntryRow): LabEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    category: row.category,
    test: row.test,
    value: row.value,
    valueText: row.value_text,
    microDetails: row.micro_details,
    unit: row.unit,
    ref: row.ref,
    comment: row.comment,
  }
}

export async function listLabEntries(patientId: string): Promise<LabEntry[]> {
  const { data, error } = await supabase
    .from('lab_entries')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data as LabEntryRow[]).map(toDomain)
}

export async function addLabEntry(draft: LabEntryDraft): Promise<LabEntry> {
  const { data, error } = await supabase
    .from('lab_entries')
    .insert({
      patient_id: draft.patientId,
      date: draft.date,
      category: draft.category,
      test: draft.test,
      value: draft.value,
      value_text: draft.valueText,
      micro_details: draft.microDetails,
      unit: draft.unit,
      ref: draft.ref,
      comment: draft.comment,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as LabEntryRow)
}

export async function deleteLabEntry(id: string): Promise<void> {
  const { error } = await supabase.from('lab_entries').delete().eq('id', id)
  if (error) throw error
}
