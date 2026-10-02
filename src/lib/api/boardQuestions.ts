import { supabase } from '../supabaseClient'
import type { BoardQuestion, BoardQuestionDraft, BoardQuestionMatchItem, BoardQuestionMatchPair } from '../../types/domain'

interface BoardQuestionRow {
  id: string
  topic: string
  question: string
  question_type: BoardQuestion['type']
  options: string[]
  correct_index: number | null
  fill_answers: string[] | null
  match_left: BoardQuestionMatchItem[] | null
  match_right: BoardQuestionMatchItem[] | null
  match_answer: BoardQuestionMatchPair[] | null
  allow_reuse: boolean | null
  tags: string[] | null
  difficulty: string | null
  taxonomy: number | null
  explanation: string | null
  created_at: string
}

function toDomain(row: BoardQuestionRow): BoardQuestion {
  return {
    id: row.id,
    topic: row.topic,
    question: row.question,
    type: row.question_type ?? 'mcq',
    options: row.options ?? [],
    correctIndex: row.correct_index,
    fillAnswers: row.fill_answers,
    matchLeft: row.match_left,
    matchRight: row.match_right,
    matchAnswer: row.match_answer,
    allowReuse: row.allow_reuse,
    tags: row.tags,
    difficulty: row.difficulty,
    taxonomy: row.taxonomy,
    explanation: row.explanation,
    createdAt: row.created_at,
  }
}

function toRow(draft: BoardQuestionDraft) {
  return {
    topic: draft.topic,
    question: draft.question,
    question_type: draft.type,
    options: draft.options,
    correct_index: draft.correctIndex,
    fill_answers: draft.fillAnswers ?? null,
    match_left: draft.matchLeft ?? null,
    match_right: draft.matchRight ?? null,
    match_answer: draft.matchAnswer ?? null,
    allow_reuse: draft.allowReuse ?? null,
    tags: draft.tags ?? null,
    difficulty: draft.difficulty ?? null,
    taxonomy: draft.taxonomy ?? null,
    explanation: draft.explanation,
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
    .insert({ ...toRow(draft), owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as BoardQuestionRow)
}

export async function updateBoardQuestion(id: string, draft: BoardQuestionDraft): Promise<BoardQuestion> {
  const { data, error } = await supabase
    .from('board_questions')
    .update(toRow(draft))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as BoardQuestionRow)
}

export async function deleteBoardQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('board_questions').delete().eq('id', id)
  if (error) throw error
}
