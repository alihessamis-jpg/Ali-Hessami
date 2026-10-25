import { supabase } from '../supabaseClient'
import { getAuthUser } from './authUser'
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
  chapter_id: string | null
  correct_bool: boolean | null
  model_answer: string | null
  source: string | null
  source_file: string | null
  source_date: string | null
  answer_verified: boolean
  import_key: string | null
  review_status: 'pending' | 'approved' | 'rejected'
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
    chapterId: row.chapter_id,
    correctBool: row.correct_bool,
    modelAnswer: row.model_answer,
    source: row.source,
    sourceFile: row.source_file,
    sourceDate: row.source_date,
    answerVerified: row.answer_verified,
    importKey: row.import_key,
    reviewStatus: row.review_status ?? 'approved',
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
    chapter_id: draft.chapterId ?? null,
    correct_bool: draft.correctBool ?? null,
    model_answer: draft.modelAnswer ?? null,
    source: draft.source ?? null,
    source_file: draft.sourceFile ?? null,
    source_date: draft.sourceDate ?? null,
    answer_verified: draft.answerVerified ?? true,
    import_key: draft.importKey ?? null,
    review_status: draft.reviewStatus ?? 'approved',
  }
}

// Only approved questions -- this is "the bank" everywhere (practice,
// Manage questions, Board Readiness/examReadiness, chapter counts). AI
// suggestions sit in review_status='pending' until approved and are never
// mixed in here; see listPendingBoardQuestions for the review queue.
export async function listBoardQuestions(): Promise<BoardQuestion[]> {
  const { data, error } = await supabase.from('board_questions').select('*').eq('review_status', 'approved').order('topic')
  if (error) throw error
  return (data as BoardQuestionRow[]).map(toDomain)
}

export async function listBoardQuestionsForChapter(chapterId: string): Promise<BoardQuestion[]> {
  const { data, error } = await supabase
    .from('board_questions')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('review_status', 'approved')
    .order('created_at')
  if (error) throw error
  return (data as BoardQuestionRow[]).map(toDomain)
}

export async function listPendingBoardQuestions(chapterId: string): Promise<BoardQuestion[]> {
  const { data, error } = await supabase
    .from('board_questions')
    .select('*')
    .eq('chapter_id', chapterId)
    .eq('review_status', 'pending')
    .order('created_at')
  if (error) throw error
  return (data as BoardQuestionRow[]).map(toDomain)
}

// Approving an AI suggestion also marks its answer verified -- the human
// reviewing it just confirmed the correct answer themselves, same as
// saving an edit to an imported question does.
export async function approveBoardQuestionSuggestion(id: string): Promise<BoardQuestion> {
  const { data, error } = await supabase
    .from('board_questions')
    .update({ review_status: 'approved', answer_verified: true })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as BoardQuestionRow)
}

export async function rejectBoardQuestionSuggestion(id: string): Promise<void> {
  const { error } = await supabase.from('board_questions').delete().eq('id', id)
  if (error) throw error
}

export async function addBoardQuestion(draft: BoardQuestionDraft): Promise<BoardQuestion> {
  const {
    data: { user },
  } = await getAuthUser()
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

// Idempotent bulk import: each draft must carry a stable `importKey`
// ("<chapterId>:<sourceFile>:<number>"). Re-importing the same file
// upserts on that key instead of duplicating rows (owner_id + import_key
// has a unique index -- see board_questions_chapter_link_and_types.sql).
export async function importBoardQuestions(drafts: BoardQuestionDraft[]): Promise<{ imported: number }> {
  if (drafts.length === 0) return { imported: 0 }
  const {
    data: { user },
  } = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  // Not a plain supabase-js .upsert(): the owner_id+import_key unique index
  // is partial (WHERE import_key IS NOT NULL, since manually-created
  // questions never set one), and upsert()'s onConflict can't express a
  // partial index's WHERE clause -- so re-importing would fail with
  // "no unique or exclusion constraint matching the ON CONFLICT
  // specification". Doing the existing/new split ourselves works with
  // that same partial index without needing to change it.
  const keys = drafts.map((d) => d.importKey).filter((k): k is string => !!k)
  const existingByKey = new Map<string, string>()
  if (keys.length > 0) {
    const { data: existing, error: existingError } = await supabase
      .from('board_questions')
      .select('id, import_key')
      .eq('owner_id', user.id)
      .in('import_key', keys)
    if (existingError) throw existingError
    for (const row of existing as Array<{ id: string; import_key: string }>) existingByKey.set(row.import_key, row.id)
  }

  const toInsert = drafts.filter((d) => !d.importKey || !existingByKey.has(d.importKey)).map((d) => ({ ...toRow(d), owner_id: user.id }))
  const toUpdate = drafts.filter((d) => d.importKey && existingByKey.has(d.importKey))

  if (toInsert.length > 0) {
    const { error } = await supabase.from('board_questions').insert(toInsert)
    if (error) throw error
  }
  for (const d of toUpdate) {
    const id = existingByKey.get(d.importKey as string) as string
    const { error } = await supabase.from('board_questions').update(toRow(d)).eq('id', id)
    if (error) throw error
  }
  return { imported: drafts.length }
}
