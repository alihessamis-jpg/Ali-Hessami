import { supabase } from '../supabaseClient'
import type { ImagingEntry, ImagingEntryDraft } from '../../types/domain'

interface ImagingEntryRow {
  id: string
  patient_id: string
  category: string | null
  date: string | null
  notes: string | null
  report: string | null
  impression: string | null
  storage_path: string | null
}

function toDomain(row: ImagingEntryRow): ImagingEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    category: row.category,
    date: row.date,
    notes: row.notes,
    report: row.report,
    impression: row.impression,
    storagePath: row.storage_path,
  }
}

export async function listImagingEntries(patientId: string): Promise<ImagingEntry[]> {
  const { data, error } = await supabase
    .from('imaging_entries')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data as ImagingEntryRow[]).map(toDomain)
}

export async function addImagingEntry(draft: ImagingEntryDraft): Promise<ImagingEntry> {
  const { data, error } = await supabase
    .from('imaging_entries')
    .insert({
      patient_id: draft.patientId,
      category: draft.category,
      date: draft.date,
      notes: draft.notes,
      report: draft.report,
      impression: draft.impression,
      storage_path: draft.storagePath,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ImagingEntryRow)
}

export async function deleteImagingEntry(id: string): Promise<void> {
  const { error } = await supabase.from('imaging_entries').delete().eq('id', id)
  if (error) throw error
}
