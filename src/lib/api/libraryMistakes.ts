import { supabase } from '../supabaseClient'
import type { LibraryCardMistake, MistakeReason } from '../../types/domain'

interface LibraryCardMistakeRow {
  id: string
  card_id: string
  chapter_id: string
  reason: MistakeReason
  created_at: string
}

function toDomain(row: LibraryCardMistakeRow): LibraryCardMistake {
  return {
    id: row.id,
    cardId: row.card_id,
    chapterId: row.chapter_id,
    reason: row.reason,
    createdAt: row.created_at,
  }
}

export async function listLibraryCardMistakes(): Promise<LibraryCardMistake[]> {
  const { data, error } = await supabase.from('library_card_mistakes').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return (data as LibraryCardMistakeRow[]).map(toDomain)
}

export async function addLibraryCardMistake(cardId: string, chapterId: string, reason: MistakeReason): Promise<LibraryCardMistake> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('library_card_mistakes')
    .insert({ owner_id: user.id, card_id: cardId, chapter_id: chapterId, reason })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as LibraryCardMistakeRow)
}
