import { supabase } from '../supabaseClient'
import type { ProgressNote, ProgressNoteDraft } from '../../types/domain'

interface ProgressNoteRow {
  id: string
  patient_id: string
  date: string
  weight: number | null
  bp: string | null
  uo: string | null
  subjective: string | null
  objective: string | null
  assessment: string | null
  plan: string | null
}

function toDomain(row: ProgressNoteRow): ProgressNote {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    weight: row.weight,
    bp: row.bp,
    uo: row.uo,
    S: row.subjective,
    O: row.objective,
    A: row.assessment,
    P: row.plan,
  }
}

export async function listProgressNotes(patientId: string): Promise<ProgressNote[]> {
  const { data, error } = await supabase
    .from('progress_notes')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data as ProgressNoteRow[]).map(toDomain)
}

export async function addProgressNote(draft: ProgressNoteDraft): Promise<ProgressNote> {
  const { data, error } = await supabase
    .from('progress_notes')
    .insert({
      patient_id: draft.patientId,
      date: draft.date,
      weight: draft.weight,
      bp: draft.bp,
      uo: draft.uo,
      subjective: draft.S,
      objective: draft.O,
      assessment: draft.A,
      plan: draft.P,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ProgressNoteRow)
}

export async function deleteProgressNote(id: string): Promise<void> {
  const { error } = await supabase.from('progress_notes').delete().eq('id', id)
  if (error) throw error
}
