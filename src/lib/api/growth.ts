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

export async function updateGrowthEntry(id: string, patch: Partial<GrowthEntryDraft>): Promise<GrowthEntry> {
  const payload: Record<string, unknown> = {}
  if (patch.heightCm !== undefined) payload.height_cm = patch.heightCm
  if (patch.weightKg !== undefined) payload.weight_kg = patch.weightKg
  if (patch.headCircCm !== undefined) payload.head_circ_cm = patch.headCircCm
  if (patch.bpSystolic !== undefined) payload.bp_systolic = patch.bpSystolic
  if (patch.bpDiastolic !== undefined) payload.bp_diastolic = patch.bpDiastolic
  const { data, error } = await supabase.from('growth_entries').update(payload).eq('id', id).select().single()
  if (error) throw error
  return toDomain(data as GrowthEntryRow)
}

export async function deleteGrowthEntry(id: string): Promise<void> {
  const { error } = await supabase.from('growth_entries').delete().eq('id', id)
  if (error) throw error
}

// Called whenever height/weight is captured somewhere other than the Growth
// tab itself (Progress Notes, Assessment) so it lands in the same
// percentile-tracking timeline instead of being a duplicate, disconnected
// number. Merges into that date's existing entry if one exists.
export async function upsertGrowthMeasurement(
  patientId: string,
  date: string,
  patch: { heightCm?: number | null; weightKg?: number | null }
): Promise<GrowthEntry> {
  const existing = await listGrowthEntries(patientId)
  const match = existing.find((e) => e.date === date)
  if (match) return updateGrowthEntry(match.id, patch)
  return addGrowthEntry({
    patientId,
    date,
    heightCm: patch.heightCm ?? null,
    weightKg: patch.weightKg ?? null,
    headCircCm: null,
    bpSystolic: null,
    bpDiastolic: null,
  })
}
