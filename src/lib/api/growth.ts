import { supabase } from '../supabaseClient'
import type { GrowthEntry, GrowthEntryDraft } from '../../types/domain'

interface GrowthEntryRow {
  id: string
  patient_id: string
  date: string
  height_cm: number | null
  weight_kg: number | null
  head_circ_cm: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
}

function toDomain(row: GrowthEntryRow): GrowthEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    headCircCm: row.head_circ_cm,
    bpSystolic: row.bp_systolic,
    bpDiastolic: row.bp_diastolic,
  }
}

export async function listGrowthEntries(patientId: string): Promise<GrowthEntry[]> {
  const { data, error } = await supabase
    .from('growth_entries')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data as GrowthEntryRow[]).map(toDomain)
}

export async function addGrowthEntry(draft: GrowthEntryDraft): Promise<GrowthEntry> {
  const { data, error } = await supabase
    .from('growth_entries')
    .insert({
      patient_id: draft.patientId,
      date: draft.date,
      height_cm: draft.heightCm,
      weight_kg: draft.weightKg,
      head_circ_cm: draft.headCircCm,
      bp_systolic: draft.bpSystolic,
      bp_diastolic: draft.bpDiastolic,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as GrowthEntryRow)
}

export async function deleteGrowthEntry(id: string): Promise<void> {
  const { error } = await supabase.from('growth_entries').delete().eq('id', id)
  if (error) throw error
}
