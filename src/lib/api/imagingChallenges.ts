import { supabase } from '../supabaseClient'
import type { ImagingChallenge, ImagingChallengeDraft } from '../../types/domain'

interface ImagingChallengeRow {
  id: string
  category: string | null
  context: string | null
  questions: string | null
  discussion: string | null
  storage_path: string | null
}

function toDomain(row: ImagingChallengeRow): ImagingChallenge {
  return {
    id: row.id,
    category: row.category,
    context: row.context,
    questions: row.questions,
    discussion: row.discussion,
    storagePath: row.storage_path,
  }
}

export async function listImagingChallenges(): Promise<ImagingChallenge[]> {
  const { data, error } = await supabase.from('imaging_challenges').select('*').order('category')
  if (error) throw error
  return (data as ImagingChallengeRow[]).map(toDomain)
}

export async function addImagingChallenge(draft: ImagingChallengeDraft): Promise<ImagingChallenge> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('imaging_challenges')
    .insert({
      category: draft.category,
      context: draft.context,
      questions: draft.questions,
      discussion: draft.discussion,
      storage_path: draft.storagePath,
      owner_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ImagingChallengeRow)
}

export async function deleteImagingChallenge(id: string): Promise<void> {
  const { error } = await supabase.from('imaging_challenges').delete().eq('id', id)
  if (error) throw error
}
