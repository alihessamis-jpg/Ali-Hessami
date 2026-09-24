import { supabase } from '../supabaseClient'
import type { HdSession, HdSessionDraft } from '../../types/domain'

interface HdSessionRow {
  id: string
  patient_id: string
  date: string
  pre_weight_kg: number | null
  post_weight_kg: number | null
  uf_goal_ml: number | null
  uf_achieved_ml: number | null
  duration_hours: number | null
  bp_pre: string | null
  bp_post: string | null
  access_type: string | null
  complications: string | null
  notes: string | null
  created_at: string
}

function toDomain(row: HdSessionRow): HdSession {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    preWeightKg: row.pre_weight_kg,
    postWeightKg: row.post_weight_kg,
    ufGoalMl: row.uf_goal_ml,
    ufAchievedMl: row.uf_achieved_ml,
    durationHours: row.duration_hours,
    bpPre: row.bp_pre,
    bpPost: row.bp_post,
    accessType: row.access_type,
    complications: row.complications,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export async function listHdSessions(patientId: string): Promise<HdSession[]> {
  const { data, error } = await supabase
    .from('hd_sessions')
    .select('*')
    .eq('patient_id', patientId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data as HdSessionRow[]).map(toDomain)
}

export async function addHdSession(draft: HdSessionDraft): Promise<HdSession> {
  const { data, error } = await supabase
    .from('hd_sessions')
    .insert({
      patient_id: draft.patientId,
      date: draft.date,
      pre_weight_kg: draft.preWeightKg,
      post_weight_kg: draft.postWeightKg,
      uf_goal_ml: draft.ufGoalMl,
      uf_achieved_ml: draft.ufAchievedMl,
      duration_hours: draft.durationHours,
      bp_pre: draft.bpPre,
      bp_post: draft.bpPost,
      access_type: draft.accessType,
      complications: draft.complications,
      notes: draft.notes,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as HdSessionRow)
}

export async function deleteHdSession(id: string): Promise<void> {
  const { error } = await supabase.from('hd_sessions').delete().eq('id', id)
  if (error) throw error
}
