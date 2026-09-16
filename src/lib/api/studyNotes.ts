import { supabase } from '../supabaseClient'
import type { StudyNote, StudyNoteDraft } from '../../types/domain'

interface StudyNoteRow {
  id: string
  title: string | null
  content: string | null
}

function toDomain(row: StudyNoteRow): StudyNote {
  return { id: row.id, title: row.title, content: row.content }
}

export async function listStudyNotes(): Promise<StudyNote[]> {
  const { data, error } = await supabase
    .from('study_notes')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as StudyNoteRow[]).map(toDomain)
}

export async function addStudyNote(draft: StudyNoteDraft): Promise<StudyNote> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('study_notes')
    .insert({ title: draft.title, content: draft.content, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as StudyNoteRow)
}

export async function updateStudyNote(id: string, patch: Partial<StudyNote>): Promise<StudyNote> {
  const { data, error } = await supabase
    .from('study_notes')
    .update({ title: patch.title, content: patch.content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as StudyNoteRow)
}

export async function deleteStudyNote(id: string): Promise<void> {
  const { error } = await supabase.from('study_notes').delete().eq('id', id)
  if (error) throw error
}
