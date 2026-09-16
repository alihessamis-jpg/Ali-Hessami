import { supabase } from '../supabaseClient'
import type { PersonalCase, PersonalCaseDraft } from '../../types/domain'

interface PersonalCaseRow {
  id: string
  source_patient_id: string | null
  title: string
  created_date: string
  diagnosis_context: string | null
  presentation: string | null
  findings: string | null
  lab_pattern: string | null
  imaging: string | null
  working_dx: string | null
  pearls: string | null
  what_learned: string | null
  questions_for_further_study: string | null
}

function toDomain(row: PersonalCaseRow): PersonalCase {
  return {
    id: row.id,
    sourcePatientId: row.source_patient_id,
    title: row.title,
    createdDate: row.created_date,
    diagnosisContext: row.diagnosis_context,
    presentation: row.presentation,
    findings: row.findings,
    labPattern: row.lab_pattern,
    imaging: row.imaging,
    workingDx: row.working_dx,
    pearls: row.pearls,
    whatLearned: row.what_learned,
    questionsForFurtherStudy: row.questions_for_further_study,
  }
}

export async function listPersonalCases(): Promise<PersonalCase[]> {
  const { data, error } = await supabase
    .from('personal_cases')
    .select('*')
    .order('created_date', { ascending: false })
  if (error) throw error
  return (data as PersonalCaseRow[]).map(toDomain)
}

export async function addPersonalCase(draft: PersonalCaseDraft): Promise<PersonalCase> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('personal_cases')
    .insert({
      source_patient_id: draft.sourcePatientId,
      title: draft.title,
      created_date: draft.createdDate,
      diagnosis_context: draft.diagnosisContext,
      presentation: draft.presentation,
      findings: draft.findings,
      lab_pattern: draft.labPattern,
      imaging: draft.imaging,
      working_dx: draft.workingDx,
      pearls: draft.pearls,
      what_learned: draft.whatLearned,
      questions_for_further_study: draft.questionsForFurtherStudy,
      user_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as PersonalCaseRow)
}

export async function deletePersonalCase(id: string): Promise<void> {
  const { error } = await supabase.from('personal_cases').delete().eq('id', id)
  if (error) throw error
}
