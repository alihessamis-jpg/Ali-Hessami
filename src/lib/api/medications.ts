import { supabase } from '../supabaseClient'
import type { Medication, MedicationDraft } from '../../types/domain'

interface MedicationRow {
  id: string
  patient_id: string
  name: string
  dose: string | null
  dose_kg: number | null
  route: string | null
  freq: string | null
  start_date: string | null
  stop_date: string | null
  indication: string | null
  renal_adj: string | null
  notes: string | null
  active: boolean
}

function toDomain(row: MedicationRow): Medication {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name,
    dose: row.dose,
    doseKg: row.dose_kg,
    route: row.route,
    freq: row.freq,
    start: row.start_date,
    stop: row.stop_date,
    indication: row.indication,
    renalAdj: row.renal_adj,
    notes: row.notes,
    active: row.active,
  }
}

export async function listMedications(patientId: string): Promise<Medication[]> {
  const { data, error } = await supabase
    .from('medications')
    .select('*')
    .eq('patient_id', patientId)
    .order('active', { ascending: false })
  if (error) throw error
  return (data as MedicationRow[]).map(toDomain)
}

export async function addMedication(draft: MedicationDraft): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .insert({
      patient_id: draft.patientId,
      name: draft.name,
      dose: draft.dose,
      dose_kg: draft.doseKg,
      route: draft.route,
      freq: draft.freq,
      start_date: draft.start,
      stop_date: draft.stop,
      indication: draft.indication,
      renal_adj: draft.renalAdj,
      notes: draft.notes,
      active: draft.active,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as MedicationRow)
}

export async function updateMedication(id: string, patch: Partial<Medication>): Promise<Medication> {
  const { data, error } = await supabase
    .from('medications')
    .update({
      name: patch.name,
      dose: patch.dose,
      dose_kg: patch.doseKg,
      route: patch.route,
      freq: patch.freq,
      start_date: patch.start,
      stop_date: patch.stop,
      indication: patch.indication,
      renal_adj: patch.renalAdj,
      notes: patch.notes,
      active: patch.active,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as MedicationRow)
}

export async function deleteMedication(id: string): Promise<void> {
  const { error } = await supabase.from('medications').delete().eq('id', id)
  if (error) throw error
}
