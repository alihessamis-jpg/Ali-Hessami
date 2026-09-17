import { supabase } from '../supabaseClient'
import type { UrineOutputEntry, UrineOutputEntryDraft } from '../../types/domain'

interface UrineOutputRow {
  id: string
  patient_id: string
  recorded_at: string
  volume_ml: number
  duration_hours: number
  notes: string | null
}

function toDomain(row: UrineOutputRow): UrineOutputEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    recordedAt: row.recorded_at,
    volumeMl: row.volume_ml,
    durationHours: row.duration_hours,
    notes: row.notes,
  }
}

export async function listUrineOutputEntries(patientId: string): Promise<UrineOutputEntry[]> {
  const { data, error } = await supabase
    .from('urine_output_entries')
    .select('*')
    .eq('patient_id', patientId)
    .order('recorded_at', { ascending: false })
  if (error) throw error
  return (data as UrineOutputRow[]).map(toDomain)
}

export async function addUrineOutputEntry(draft: UrineOutputEntryDraft): Promise<UrineOutputEntry> {
  const { data, error } = await supabase
    .from('urine_output_entries')
    .insert({
      patient_id: draft.patientId,
      recorded_at: draft.recordedAt,
      volume_ml: draft.volumeMl,
      duration_hours: draft.durationHours,
      notes: draft.notes,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as UrineOutputRow)
}

export async function deleteUrineOutputEntry(id: string): Promise<void> {
  const { error } = await supabase.from('urine_output_entries').delete().eq('id', id)
  if (error) throw error
}
