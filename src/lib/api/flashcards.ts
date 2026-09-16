import { supabase } from '../supabaseClient'
import type { Flashcard, FlashcardDraft, SrsState } from '../../types/domain'

interface FlashcardRow {
  id: string
  front: string
  back: string
  deck: string | null
  interval_index: number
  last_reviewed: string | null
  next_review: string | null
  review_history: Flashcard['reviewHistory']
}

function toDomain(row: FlashcardRow): Flashcard {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
    deck: row.deck,
    intervalIndex: row.interval_index,
    lastReviewed: row.last_reviewed,
    nextReview: row.next_review,
    reviewHistory: row.review_history ?? [],
  }
}

export async function listFlashcards(): Promise<Flashcard[]> {
  const { data, error } = await supabase.from('flashcards').select('*').order('created_at')
  if (error) throw error
  return (data as FlashcardRow[]).map(toDomain)
}

export async function addFlashcard(draft: FlashcardDraft): Promise<Flashcard> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('flashcards')
    .insert({ front: draft.front, back: draft.back, deck: draft.deck, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as FlashcardRow)
}

export async function updateFlashcardSrs(id: string, state: SrsState): Promise<Flashcard> {
  const { data, error } = await supabase
    .from('flashcards')
    .update({
      interval_index: state.intervalIndex,
      last_reviewed: state.lastReviewed,
      next_review: state.nextReview,
      review_history: state.reviewHistory,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as FlashcardRow)
}

export async function deleteFlashcard(id: string): Promise<void> {
  const { error } = await supabase.from('flashcards').delete().eq('id', id)
  if (error) throw error
}
