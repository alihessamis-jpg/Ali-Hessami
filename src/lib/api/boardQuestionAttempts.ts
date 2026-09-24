import { supabase } from '../supabaseClient'
import type { BoardQuestionAttempt, BoardQuestionAttemptDraft } from '../../types/domain'

interface BoardQuestionAttemptRow {
  id: string
  question_id: string
  selected_index: number
  is_correct: boolean
  attempted_at: string
}

function toDomain(row: BoardQuestionAttemptRow): BoardQuestionAttempt {
  return {
    id: row.id,
    questionId: row.question_id,
    selectedIndex: row.selected_index,
    isCorrect: row.is_correct,
    attemptedAt: row.attempted_at,
  }
}

export async function listBoardQuestionAttempts(): Promise<BoardQuestionAttempt[]> {
  const { data, error } = await supabase
    .from('board_question_attempts')
    .select('*')
    .order('attempted_at', { ascending: true })
  if (error) throw error
  return (data as BoardQuestionAttemptRow[]).map(toDomain)
}

export async function addBoardQuestionAttempt(draft: BoardQuestionAttemptDraft): Promise<BoardQuestionAttempt> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('board_question_attempts')
    .insert({
      question_id: draft.questionId,
      selected_index: draft.selectedIndex,
      is_correct: draft.isCorrect,
      owner_id: user.id,
    })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as BoardQuestionAttemptRow)
}
