import { supabase } from '../supabaseClient'
import { isAbnormal } from '../labRange'
import { isPositiveCulture } from '../labPresets'
import { schwartzEGFR } from '../formulas'
import type { MicroDetails } from '../../types/domain'

export interface AbnormalLab {
  id: string
  patientId: string
  patientName: string
  date: string
  test: string
  value: number | null
  valueText: string | null
  organism: string | null
  unit: string | null
  ref: string | null
}

interface LabRow {
  id: string
  patient_id: string
  date: string
  test: string
  value: number | null
  value_text: string | null
  micro_details: MicroDetails | null
  unit: string | null
  ref: string | null
  patients: { name: string } | null
}

export async function listRecentAbnormalLabs(sinceDays = 14): Promise<AbnormalLab[]> {
  const since = new Date()
  since.setDate(since.getDate() - sinceDays)

  const { data, error } = await supabase
    .from('lab_entries')
    .select('id, patient_id, date, test, value, value_text, micro_details, unit, ref, patients(name)')
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })
  if (error) throw error

  return (data as unknown as LabRow[])
    .filter(
      (row) =>
        isAbnormal(row.value, row.ref) ||
        (!!row.value_text && row.value_text !== 'Negative') ||
        (!!row.micro_details?.organism && isPositiveCulture(row.micro_details.organism))
    )
    .map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patients?.name ?? 'Unknown',
      date: row.date,
      test: row.test,
      value: row.value,
      valueText: row.value_text,
      organism: row.micro_details?.organism ?? null,
      unit: row.unit,
      ref: row.ref,
    }))
}

export interface PatientGlance {
  id: string
  name: string
  age: number | null
  bed: string | null
  diagnosis: string | null
  latestCreatinine: { value: number; date: string } | null
  latestEGFR: number | null
}

interface PatientOverviewRow {
  id: string
  name: string
  age: number | null
  bed: string | null
  diagnosis: string | null
  height: number | null
}

interface CreatinineRow {
  patient_id: string
  date: string
  value: number | null
}

async function buildPatientGlances(patients: PatientOverviewRow[]): Promise<PatientGlance[]> {
  if (patients.length === 0) return []

  const { data: labRows, error: labsError } = await supabase
    .from('lab_entries')
    .select('patient_id, date, value')
    .eq('test', 'Creatinine')
    .in(
      'patient_id',
      patients.map((p) => p.id)
    )
    .order('date', { ascending: false })
  if (labsError) throw labsError

  const latestByPatient = new Map<string, CreatinineRow>()
  for (const row of labRows as CreatinineRow[]) {
    if (!latestByPatient.has(row.patient_id)) latestByPatient.set(row.patient_id, row)
  }

  return patients.map((p) => {
    const latest = latestByPatient.get(p.id)
    const latestCreatinine =
      latest && latest.value != null ? { value: latest.value, date: latest.date } : null
    const latestEGFR =
      latestCreatinine && p.height ? schwartzEGFR(p.height, latestCreatinine.value) : null
    return {
      id: p.id,
      name: p.name,
      age: p.age,
      bed: p.bed,
      diagnosis: p.diagnosis,
      latestCreatinine,
      latestEGFR,
    }
  })
}

// Used by the Dashboard to show only the patients behind an active alert
// (abnormal lab, overdue/due reminder) instead of the whole panel.
export async function listPatientsByIds(ids: string[]): Promise<PatientGlance[]> {
  if (ids.length === 0) return []
  const { data: patientRows, error: patientsError } = await supabase
    .from('patients')
    .select('id, name, age, bed, diagnosis, height')
    .in('id', ids)
  if (patientsError) throw patientsError
  return buildPatientGlances(patientRows as PatientOverviewRow[])
}
