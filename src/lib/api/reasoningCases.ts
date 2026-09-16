import { supabase } from '../supabaseClient'
import type { ReasoningCase, ReasoningCaseDraft } from '../../types/domain'

interface ReasoningCaseRow {
  id: string
  title: string
  age: number | null
  sex: string | null
  chief: string | null
  history: string | null
  vitals: string | null
  exam: string | null
  labs: string | null
  imaging: string | null
  questions: string[]
  discussion: string | null
}

function toDomain(row: ReasoningCaseRow): ReasoningCase {
  return {
    id: row.id,
    title: row.title,
    age: row.age,
    sex: row.sex,
    chief: row.chief,
    history: row.history,
    vitals: row.vitals,
    exam: row.exam,
    labs: row.labs,
    imaging: row.imaging,
    questions: row.questions ?? [],
    discussion: row.discussion,
  }
}

export async function listReasoningCases(): Promise<ReasoningCase[]> {
  const { data, error } = await supabase.from('reasoning_cases').select('*').order('title')
  if (error) throw error
  return (data as ReasoningCaseRow[]).map(toDomain)
}

export async function addReasoningCase(draft: ReasoningCaseDraft): Promise<ReasoningCase> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('reasoning_cases')
    .insert({
      title: draft.title,
      age: draft.age,
      sex: draft.sex,
      chief: draft.chief,
      history: draft.history,
      vitals: draft.vitals,
      exam: draft.exam,
      labs: draft.labs,
      imaging: draft.imaging,
      questions: draft.questions,
      discussion: draft.discussion,
      owner_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReasoningCaseRow)
}

export async function deleteReasoningCase(id: string): Promise<void> {
  const { error } = await supabase.from('reasoning_cases').delete().eq('id', id)
  if (error) throw error
}
