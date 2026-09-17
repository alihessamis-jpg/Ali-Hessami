import { supabase } from '../supabaseClient'
import type { NephroticEvent, NephroticEventDraft } from '../../types/domain'

interface NephroticEventRow {
  id: string
  patient_id: string
  date: string
  event_type: NephroticEvent['eventType']
  during_taper: boolean
  notes: string | null
}

function toDomain(row: NephroticEventRow): NephroticEvent {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    eventType: row.event_type,
    duringTaper: row.during_taper,
    notes: row.notes,
  }
}

export async function listNephroticEvents(patientId: string): Promise<NephroticEvent[]> {
  const { data, error } = await supabase
    .from('nephrotic_events')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data as NephroticEventRow[]).map(toDomain)
}

export async function addNephroticEvent(draft: NephroticEventDraft): Promise<NephroticEvent> {
  const { data, error } = await supabase
    .from('nephrotic_events')
    .insert({
      patient_id: draft.patientId,
      date: draft.date,
      event_type: draft.eventType,
      during_taper: draft.duringTaper,
      notes: draft.notes,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as NephroticEventRow)
}

export async function deleteNephroticEvent(id: string): Promise<void> {
  const { error } = await supabase.from('nephrotic_events').delete().eq('id', id)
  if (error) throw error
}
