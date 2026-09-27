import { supabase } from '../supabaseClient'
import type { AttendingConsult, AttendingConsultDraft, ConsultSetting } from '../../types/domain'

interface AttendingConsultRow {
  id: string
  patient_id: string | null
  consult_date: string
  setting: string | null
  chief_complaint: string | null
  history_summary: string | null
  exam_summary: string | null
  labs_summary: string | null
  your_assessment: string | null
  attending_name: string | null
  attending_approach: string | null
  diagnosis_final: string | null
  notes: string | null
  built_case_id: string | null
}

function toDomain(row: AttendingConsultRow): AttendingConsult {
  return {
    id: row.id,
    patientId: row.patient_id,
    consultDate: row.consult_date,
    setting: row.setting as ConsultSetting | null,
    chiefComplaint: row.chief_complaint,
    historySummary: row.history_summary,
    examSummary: row.exam_summary,
    labsSummary: row.labs_summary,
    yourAssessment: row.your_assessment,
    attendingName: row.attending_name,
    attendingApproach: row.attending_approach,
    diagnosisFinal: row.diagnosis_final,
    notes: row.notes,
    builtCaseId: row.built_case_id,
  }
}

export async function listAttendingConsults(): Promise<AttendingConsult[]> {
  const { data, error } = await supabase
    .from('attending_consults')
    .select('*')
    .order('consult_date', { ascending: false })
  if (error) throw error
  return (data as AttendingConsultRow[]).map(toDomain)
}

export async function getAttendingConsult(id: string): Promise<AttendingConsult> {
  const { data, error } = await supabase.from('attending_consults').select('*').eq('id', id).single()
  if (error) throw error
  return toDomain(data as AttendingConsultRow)
}

export async function addAttendingConsult(draft: AttendingConsultDraft): Promise<AttendingConsult> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('attending_consults')
    .insert({
      owner_id: user.id,
      patient_id: draft.patientId || null,
      consult_date: draft.consultDate,
      setting: draft.setting || null,
      chief_complaint: draft.chiefComplaint || null,
      history_summary: draft.historySummary || null,
      exam_summary: draft.examSummary || null,
      labs_summary: draft.labsSummary || null,
      your_assessment: draft.yourAssessment || null,
      attending_name: draft.attendingName || null,
      attending_approach: draft.attendingApproach || null,
      diagnosis_final: draft.diagnosisFinal || null,
      notes: draft.notes || null,
      built_case_id: draft.builtCaseId || null,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as AttendingConsultRow)
}

export async function markConsultCaseBuilt(id: string, caseId: string): Promise<void> {
  const { error } = await supabase.from('attending_consults').update({ built_case_id: caseId }).eq('id', id)
  if (error) throw error
}

export async function deleteAttendingConsult(id: string): Promise<void> {
  const { error } = await supabase.from('attending_consults').delete().eq('id', id)
  if (error) throw error
}
