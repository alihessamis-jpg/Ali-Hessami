import { supabase } from '../supabaseClient'
import type { LabChallenge, LabChallengeDraft } from '../../types/domain'

interface LabChallengeRow {
  id: string
  title: string
  values: Array<[string, string, string]>
  prompt: string | null
  discussion: string | null
}

function toDomain(row: LabChallengeRow): LabChallenge {
  return {
    id: row.id,
    title: row.title,
    values: row.values ?? [],
    prompt: row.prompt,
    discussion: row.discussion,
  }
}

export async function listLabChallenges(): Promise<LabChallenge[]> {
  const { data, error } = await supabase.from('lab_challenges').select('*').order('title')
  if (error) throw error
  return (data as LabChallengeRow[]).map(toDomain)
}

export async function addLabChallenge(draft: LabChallengeDraft): Promise<LabChallenge> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('lab_challenges')
    .insert({
      title: draft.title,
      values: draft.values,
      prompt: draft.prompt,
      discussion: draft.discussion,
      owner_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as LabChallengeRow)
}

export async function deleteLabChallenge(id: string): Promise<void> {
  const { error } = await supabase.from('lab_challenges').delete().eq('id', id)
  if (error) throw error
}
