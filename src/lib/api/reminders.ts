import { supabase } from '../supabaseClient'
import type { PatientReminder, PatientReminderDraft } from '../../types/domain'

interface ReminderRow {
  id: string
  patient_id: string
  type: PatientReminder['type']
  title: string
  note: string | null
  event_date: string
  done: boolean
}

function toDomain(row: ReminderRow): PatientReminder {
  return {
    id: row.id,
    patientId: row.patient_id,
    type: row.type,
    title: row.title,
    note: row.note,
    eventDate: row.event_date,
    done: row.done,
  }
}

export async function listRemindersForPatient(patientId: string): Promise<PatientReminder[]> {
  const { data, error } = await supabase
    .from('patient_reminders')
    .select('*')
    .eq('patient_id', patientId)
    .order('event_date')
  if (error) throw error
  return (data as ReminderRow[]).map(toDomain)
}

export async function addReminder(draft: PatientReminderDraft): Promise<PatientReminder> {
  const { data, error } = await supabase
    .from('patient_reminders')
    .insert({
      patient_id: draft.patientId,
      type: draft.type,
      title: draft.title,
      note: draft.note,
      event_date: draft.eventDate,
      done: draft.done,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReminderRow)
}

export async function setReminderDone(id: string, done: boolean): Promise<void> {
  const { error } = await supabase.from('patient_reminders').update({ done }).eq('id', id)
  if (error) throw error
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from('patient_reminders').delete().eq('id', id)
  if (error) throw error
}

export interface ActiveReminder extends PatientReminder {
  patientName: string
}

export async function listActiveReminders(): Promise<ActiveReminder[]> {
  const { data, error } = await supabase
    .from('patient_reminders')
    .select('*, patients(name)')
    .eq('done', false)
    .order('event_date')
  if (error) throw error
  return (data as Array<ReminderRow & { patients: { name: string } | null }>).map((row) => ({
    ...toDomain(row),
    patientName: row.patients?.name ?? 'Unknown',
  }))
}
