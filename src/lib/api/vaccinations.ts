import { supabase } from '../supabaseClient'
import type { Vaccination, VaccinationDraft } from '../../types/domain'

interface VaccinationRow {
  id: string
  patient_id: string
  vaccine_name: string
  is_live: boolean
  dose_number: string | null
  date_given: string
  notes: string | null
  created_at: string
}

function toDomain(row: VaccinationRow): Vaccination {
  return {
    id: row.id,
    patientId: row.patient_id,
    vaccineName: row.vaccine_name,
    isLive: row.is_live,
    doseNumber: row.dose_number,
    dateGiven: row.date_given,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export async function listVaccinations(patientId: string): Promise<Vaccination[]> {
  const { data, error } = await supabase
    .from('vaccinations')
    .select('*')
    .eq('patient_id', patientId)
    .order('date_given', { ascending: false })
  if (error) throw error
  return (data as VaccinationRow[]).map(toDomain)
}

export async function addVaccination(draft: VaccinationDraft): Promise<Vaccination> {
  const { data, error } = await supabase
    .from('vaccinations')
    .insert({
      patient_id: draft.patientId,
      vaccine_name: draft.vaccineName,
      is_live: draft.isLive,
      dose_number: draft.doseNumber,
      date_given: draft.dateGiven,
      notes: draft.notes,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as VaccinationRow)
}

export async function deleteVaccination(id: string): Promise<void> {
  const { error } = await supabase.from('vaccinations').delete().eq('id', id)
  if (error) throw error
}
