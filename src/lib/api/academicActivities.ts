import { supabase } from '../supabaseClient'
import type { AcademicActivity, AcademicActivityDraft } from '../../types/domain'

interface AcademicActivityRow {
  id: string
  category: string
  title: string
  role: string | null
  venue: string | null
  date: string
  status: string | null
  notes: string | null
}

function toDomain(row: AcademicActivityRow): AcademicActivity {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    role: row.role,
    venue: row.venue,
    date: row.date,
    status: row.status as AcademicActivity['status'],
    notes: row.notes,
  }
}

export async function listAcademicActivities(): Promise<AcademicActivity[]> {
  const { data, error } = await supabase.from('academic_activities').select('*').order('date', { ascending: false })
  if (error) throw error
  return (data as AcademicActivityRow[]).map(toDomain)
}

export async function addAcademicActivity(draft: AcademicActivityDraft): Promise<AcademicActivity> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('academic_activities')
    .insert({
      owner_id: user.id,
      category: draft.category,
      title: draft.title,
      role: draft.role || null,
      venue: draft.venue || null,
      date: draft.date,
      status: draft.status || null,
      notes: draft.notes || null,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as AcademicActivityRow)
}

export async function deleteAcademicActivity(id: string): Promise<void> {
  const { error } = await supabase.from('academic_activities').delete().eq('id', id)
  if (error) throw error
}
