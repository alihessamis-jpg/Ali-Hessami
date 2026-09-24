import { supabase } from '../supabaseClient'
import type { PdPeritonitisEpisode, PdPeritonitisEpisodeDraft } from '../../types/domain'

interface PdPeritonitisEpisodeRow {
  id: string
  patient_id: string
  onset_date: string
  organism: string | null
  antibiotic_regimen: string | null
  resolution_date: string | null
  outcome: PdPeritonitisEpisode['outcome']
  notes: string | null
  created_at: string
}

function toDomain(row: PdPeritonitisEpisodeRow): PdPeritonitisEpisode {
  return {
    id: row.id,
    patientId: row.patient_id,
    onsetDate: row.onset_date,
    organism: row.organism,
    antibioticRegimen: row.antibiotic_regimen,
    resolutionDate: row.resolution_date,
    outcome: row.outcome,
    notes: row.notes,
    createdAt: row.created_at,
  }
}

export async function listPdPeritonitisEpisodes(patientId: string): Promise<PdPeritonitisEpisode[]> {
  const { data, error } = await supabase
    .from('pd_peritonitis_episodes')
    .select('*')
    .eq('patient_id', patientId)
    .order('onset_date', { ascending: false })
  if (error) throw error
  return (data as PdPeritonitisEpisodeRow[]).map(toDomain)
}

export async function addPdPeritonitisEpisode(draft: PdPeritonitisEpisodeDraft): Promise<PdPeritonitisEpisode> {
  const { data, error } = await supabase
    .from('pd_peritonitis_episodes')
    .insert({
      patient_id: draft.patientId,
      onset_date: draft.onsetDate,
      organism: draft.organism,
      antibiotic_regimen: draft.antibioticRegimen,
      resolution_date: draft.resolutionDate,
      outcome: draft.outcome,
      notes: draft.notes,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as PdPeritonitisEpisodeRow)
}

export async function deletePdPeritonitisEpisode(id: string): Promise<void> {
  const { error } = await supabase.from('pd_peritonitis_episodes').delete().eq('id', id)
  if (error) throw error
}
