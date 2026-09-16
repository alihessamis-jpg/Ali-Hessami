import { supabase } from '../supabaseClient'
import { isAbnormal } from '../labRange'

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
