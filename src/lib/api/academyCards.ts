import { supabase } from '../supabaseClient'
import type { AcademyCard, AcademyCardDraft, SrsState } from '../../types/domain'

interface AcademyCardRow {
  id: string
  topic_id: string
  kind: AcademyCard['kind']
  section_key: string | null
  book_page: number | null
  prompt: string
  answer: string
  interval_index: number
  last_reviewed: string | null
  next_review: string | null
  review_history: AcademyCard['reviewHistory']
  created_at: string
}

function toDomain(row: AcademyCardRow): AcademyCard {
  return {
    id: row.id,
    topicId: row.topic_id,
    kind: row.kind,
    sectionKey: row.section_key,
    bookPage: row.book_page,
    prompt: row.prompt,
    answer: row.answer,
    intervalIndex: row.interval_index,
    lastReviewed: row.last_reviewed,
    nextReview: row.next_review,
    reviewHistory: row.review_history ?? [],
    createdAt: row.created_at,
  }
}

export async function listAcademyCardsForTopic(topicId: string): Promise<AcademyCard[]> {
  const { data, error } = await supabase
    .from('academy_cards')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at')
  if (error) throw error
  return (data as AcademyCardRow[]).map(toDomain)
}

export async function listAllAcademyCards(): Promise<AcademyCard[]> {
  const { data, error } = await supabase.from('academy_cards').select('*').order('created_at')
  if (error) throw error
  return (data as AcademyCardRow[]).map(toDomain)
}

export async function addAcademyCard(draft: AcademyCardDraft): Promise<AcademyCard> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('academy_cards')
    .insert({
      owner_id: user.id,
      topic_id: draft.topicId,
      kind: draft.kind,
      section_key: draft.sectionKey ?? null,
      book_page: draft.bookPage ?? null,
      prompt: draft.prompt,
      answer: draft.answer,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as AcademyCardRow)
}

export async function addAcademyCards(drafts: AcademyCardDraft[]): Promise<AcademyCard[]> {
  if (drafts.length === 0) return []
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('academy_cards')
    .insert(
      drafts.map((draft) => ({
        owner_id: user.id,
        topic_id: draft.topicId,
        kind: draft.kind,
        section_key: draft.sectionKey ?? null,
        book_page: draft.bookPage ?? null,
        prompt: draft.prompt,
        answer: draft.answer,
      }))
    )
    .select()
  if (error) throw error
  return (data as AcademyCardRow[]).map(toDomain)
}

export async function updateAcademyCardSrs(id: string, state: SrsState): Promise<AcademyCard> {
  const { data, error } = await supabase
    .from('academy_cards')
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
  return toDomain(data as AcademyCardRow)
}

export async function deleteAcademyCard(id: string): Promise<void> {
  const { error } = await supabase.from('academy_cards').delete().eq('id', id)
  if (error) throw error
}
