import { supabase } from '../supabaseClient'
import type { ProgressNote, ProgressNoteDraft } from '../../types/domain'
import { applyPending, isOfflineError, newRowId, queueOp } from '../offlineOutbox'

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

// Notes can be added, edited and deleted offline: the change is kept on this
// device (lib/offlineOutbox.ts) and sent to Supabase once back online.

function draftToRow(draft: ProgressNoteDraft) {
  return {
    date: draft.date,
    weight: draft.weight ?? null,
    bp: draft.bp ?? null,
    uo: draft.uo ?? null,
    subjective: draft.S ?? null,
    objective: draft.O ?? null,
    assessment: draft.A ?? null,
    plan: draft.P ?? null,
  }
}

export async function listProgressNotes(patientId: string): Promise<ProgressNote[]> {
  const { data, error } = await supabase
    .from('progress_notes')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
  if (error && !isOfflineError(error)) throw error
  const rows = await applyPending('progress_notes', (data ?? []) as ProgressNoteRow[], (r) => r.patient_id === patientId)
  return rows.sort((a, b) => b.date.localeCompare(a.date)).map(toDomain)
}

export async function addProgressNote(draft: ProgressNoteDraft): Promise<ProgressNote> {
  const row = { id: newRowId(), patient_id: draft.patientId, ...draftToRow(draft) }
  const { data, error } = await supabase.from('progress_notes').insert(row).select().single()
  if (error) {
    if (!isOfflineError(error)) throw error
    await queueOp({ kind: 'insert', table: 'progress_notes', id: row.id, row })
    return toDomain(row)
  }
  return toDomain(data as ProgressNoteRow)
}

export async function updateProgressNote(id: string, draft: ProgressNoteDraft): Promise<ProgressNote> {
  const patch = draftToRow(draft)
  const { data, error } = await supabase.from('progress_notes').update(patch).eq('id', id).select().single()
  if (error) {
    if (!isOfflineError(error)) throw error
    await queueOp({ kind: 'update', table: 'progress_notes', id, row: patch })
    return toDomain({ id, patient_id: draft.patientId, ...patch })
  }
  return toDomain(data as ProgressNoteRow)
}

export async function deleteProgressNote(id: string): Promise<void> {
  const { error } = await supabase.from('progress_notes').delete().eq('id', id)
  if (error) {
    if (!isOfflineError(error)) throw error
    await queueOp({ kind: 'delete', table: 'progress_notes', id })
  }
}
