import { supabase } from '../supabaseClient'
import { isAbnormal } from '../labRange'
import { schwartzEGFR } from '../formulas'

export interface AbnormalLab {
  id: string
  patientId: string
  patientName: string
  date: string
  test: string
  value: number | null
  unit: string | null
  ref: string | null
}

interface LabRow {
  id: string
  patient_id: string
  date: string
  test: string
  value: number | null
  unit: string | null
  ref: string | null
  patients: { name: string } | null
}

export async function listRecentAbnormalLabs(sinceDays = 14): Promise<AbnormalLab[]> {
  const since = new Date()
  since.setDate(since.getDate() - sinceDays)

  const { data, error } = await supabase
    .from('lab_entries')
    .select('id, patient_id, date, test, value, unit, ref, patients(name)')
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })
  if (error) throw error

  return (data as unknown as LabRow[])
    .filter((row) => isAbnormal(row.value, row.ref))
    .map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patients?.name ?? 'Unknown',
      date: row.date,
      test: row.test,
      value: row.value,
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

export async function listPatientsOverview(limit = 6): Promise<PatientGlance[]> {
  const { data: patientRows, error: patientsError } = await supabase
    .from('patients')
    .select('id, name, age, bed, diagnosis, height')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (patientsError) throw patientsError

  const patients = patientRows as PatientOverviewRow[]
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

export interface EGFRTrendPoint {
  date: string
  avgEGFR: number
  patientCount: number
}

interface HeightRow {
  id: string
  height: number | null
}

export async function listEGFRTrend(sinceDays = 90): Promise<EGFRTrendPoint[]> {
  const since = new Date()
  since.setDate(since.getDate() - sinceDays)

  const { data: patientRows, error: patientsError } = await supabase
    .from('patients')
    .select('id, height')
  if (patientsError) throw patientsError

  const heightByPatient = new Map<string, number>()
  for (const p of patientRows as HeightRow[]) {
    if (p.height) heightByPatient.set(p.id, p.height)
  }
  if (heightByPatient.size === 0) return []

  const { data: labRows, error: labsError } = await supabase
    .from('lab_entries')
    .select('patient_id, date, value')
    .eq('test', 'Creatinine')
    .gte('date', since.toISOString().slice(0, 10))
    .in('patient_id', Array.from(heightByPatient.keys()))
  if (labsError) throw labsError

  const byDate = new Map<string, number[]>()
  for (const row of labRows as CreatinineRow[]) {
    const height = heightByPatient.get(row.patient_id)
    if (!height || row.value == null) continue
    const list = byDate.get(row.date) ?? []
    list.push(schwartzEGFR(height, row.value))
    byDate.set(row.date, list)
  }

  return Array.from(byDate.entries())
    .map(([date, values]) => ({
      date,
      avgEGFR: values.reduce((a, b) => a + b, 0) / values.length,
      patientCount: values.length,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
}
