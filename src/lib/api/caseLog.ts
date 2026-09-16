import { supabase } from '../supabaseClient'
import type { CaseLogEntry, CaseLogEntryDraft } from '../../types/domain'

interface CaseLogRow {
  id: string
  patient_id: string | null
  date: string
  category: string
  diagnosis: string
  role: string
  procedure: string | null
  setting: string | null
  notes: string | null
  patients: { name: string } | null
}

export interface CaseLogEntryWithPatient extends CaseLogEntry {
  patientName: string | null
}

function toDomain(row: CaseLogRow): CaseLogEntryWithPatient {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    category: row.category,
    diagnosis: row.diagnosis,
    role: row.role as CaseLogEntry['role'],
    procedure: row.procedure,
    setting: row.setting,
    notes: row.notes,
    patientName: row.patients?.name ?? null,
  }
}

export async function listCaseLogEntries(): Promise<CaseLogEntryWithPatient[]> {
  const { data, error } = await supabase
    .from('case_log_entries')
    .select('id, patient_id, date, category, diagnosis, role, procedure, setting, notes, patients(name)')
    .order('date', { ascending: false })
  if (error) throw error
  return (data as unknown as CaseLogRow[]).map(toDomain)
}

export async function addCaseLogEntry(draft: CaseLogEntryDraft): Promise<CaseLogEntryWithPatient> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('case_log_entries')
    .insert({
      owner_id: user.id,
      patient_id: draft.patientId || null,
      date: draft.date,
      category: draft.category,
      diagnosis: draft.diagnosis,
      role: draft.role,
      procedure: draft.procedure || null,
      setting: draft.setting || null,
      notes: draft.notes || null,
    })
    .select('id, patient_id, date, category, diagnosis, role, procedure, setting, notes, patients(name)')
    .single()
  if (error) throw error
  return toDomain(data as unknown as CaseLogRow)
}

export async function deleteCaseLogEntry(id: string): Promise<void> {
  const { error } = await supabase.from('case_log_entries').delete().eq('id', id)
  if (error) throw error
}
