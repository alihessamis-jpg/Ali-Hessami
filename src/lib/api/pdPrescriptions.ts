import { supabase } from '../supabaseClient'
import type { PdPrescription, PdPrescriptionDraft } from '../../types/domain'

interface PdPrescriptionRow {
  id: string
  patient_id: string
  date: string
  modality: PdPrescription['modality']
  fill_volume_ml: number | null
  exchanges_per_day: number | null
  dwell_hours: number | null
  dextrose_pct: string | null
  notes: string | null
  created_at: string
}

function toDomain(row: PdPrescriptionRow): PdPrescription {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    modality: row.modality,
    fillVolumeMl: row.fill_volume_ml,
    exchangesPerDay: row.exchanges_per_day,
    dwellHours: row.dwell_hours,
    dextrosePct: row.dextrose_pct,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export async function listPdPrescriptions(patientId: string): Promise<PdPrescription[]> {
  const { data, error } = await supabase
    .from('pd_prescriptions')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data as PdPrescriptionRow[]).map(toDomain)
}

export async function addPdPrescription(draft: PdPrescriptionDraft): Promise<PdPrescription> {
  const { data, error } = await supabase
    .from('pd_prescriptions')
    .insert({
      patient_id: draft.patientId,
      date: draft.date,
      modality: draft.modality,
      fill_volume_ml: draft.fillVolumeMl,
      exchanges_per_day: draft.exchangesPerDay,
      dwell_hours: draft.dwellHours,
      dextrose_pct: draft.dextrosePct,
      notes: draft.notes,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as PdPrescriptionRow)
}

export async function deletePdPrescription(id: string): Promise<void> {
  const { error } = await supabase.from('pd_prescriptions').delete().eq('id', id)
  if (error) throw error
}
