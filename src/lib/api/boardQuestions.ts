import { supabase } from '../supabaseClient'
import type { BoardQuestion, BoardQuestionDraft } from '../../types/domain'

interface BoardQuestionRow {
  id: string
  topic: string
  question: string
  options: string[]
  correct_index: number
  explanation: string | null
  created_at: string
}

function toDomain(row: BoardQuestionRow): BoardQuestion {
  return {
    id: row.id,
    topic: row.topic,
    question: row.question,
    options: row.options ?? [],
    correctIndex: row.correct_index,
    explanation: row.explanation,
    createdAt: row.created_at,
  }
}

export async function listBoardQuestions(): Promise<BoardQuestion[]> {
  const { data, error } = await supabase.from('board_questions').select('*').order('topic')
  if (error) throw error
  return (data as BoardQuestionRow[]).map(toDomain)
}

export async function addBoardQuestion(draft: BoardQuestionDraft): Promise<BoardQuestion> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('board_questions')
    .insert({
      topic: draft.topic,
      question: draft.question,
      options: draft.options,
      correct_index: draft.correctIndex,
      explanation: draft.explanation,
      owner_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as BoardQuestionRow)
}

export async function deleteBoardQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('board_questions').delete().eq('id', id)
  if (error) throw error
}
