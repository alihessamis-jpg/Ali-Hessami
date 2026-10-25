import { supabase } from '../supabaseClient'
import type { LabEntry, LabEntryDraft, MicroDetails } from '../../types/domain'
import { applyPending, isOfflineError, newRowId, queueOp } from '../offlineOutbox'

interface LabEntryRow {
  id: string
  patient_id: string
  date: string
  category: string | null
  test: string
  value: number | null
  value_text: string | null
  micro_details: MicroDetails | null
  unit: string | null
  ref: string | null
  comment: string | null
}

function toDomain(row: LabEntryRow): LabEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    category: row.category,
    test: row.test,
    value: row.value,
    valueText: row.value_text,
    microDetails: row.micro_details,
    unit: row.unit,
    ref: row.ref,
    comment: row.comment,
  }
}

// Lab results can be added and deleted offline: the change is kept on this
// device (lib/offlineOutbox.ts) and sent to Supabase once back online.

function byDateAsc(a: LabEntryRow, b: LabEntryRow) {
  return a.date.localeCompare(b.date)
}

export async function listLabEntries(patientId: string): Promise<LabEntry[]> {
  const { data, error } = await supabase
    .from('lab_entries')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: true })
  if (error && !isOfflineError(error)) throw error
  const rows = await applyPending('lab_entries', (data ?? []) as LabEntryRow[], (r) => r.patient_id === patientId)
  return rows.sort(byDateAsc).map(toDomain)
}

export async function listLabEntriesByTest(test: string): Promise<LabEntry[]> {
  const { data, error } = await supabase
    .from('lab_entries')
    .select('*')
    .eq('test', test)
    .order('date', { ascending: true })
  if (error && !isOfflineError(error)) throw error
  const rows = await applyPending('lab_entries', (data ?? []) as LabEntryRow[], (r) => r.test === test)
  return rows.sort(byDateAsc).map(toDomain)
}

export async function addLabEntry(draft: LabEntryDraft): Promise<LabEntry> {
  const row: LabEntryRow = {
    id: newRowId(),
    patient_id: draft.patientId,
    date: draft.date,
    category: draft.category ?? null,
    test: draft.test,
    value: draft.value ?? null,
    value_text: draft.valueText ?? null,
    micro_details: draft.microDetails ?? null,
    unit: draft.unit ?? null,
    ref: draft.ref ?? null,
    comment: draft.comment ?? null,
  }
  const { data, error } = await supabase.from('lab_entries').insert(row).select().single()
  if (error) {
    if (!isOfflineError(error)) throw error
    await queueOp({ kind: 'insert', table: 'lab_entries', id: row.id, row: { ...row } })
    return toDomain(row)
  }
  return toDomain(data as LabEntryRow)
}

export async function deleteLabEntry(id: string): Promise<void> {
  const { error } = await supabase.from('lab_entries').delete().eq('id', id)
  if (error) {
    if (!isOfflineError(error)) throw error
    await queueOp({ kind: 'delete', table: 'lab_entries', id })
  }
}
