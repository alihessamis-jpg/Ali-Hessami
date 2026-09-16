import { supabase } from '../supabaseClient'
import type { AcademyProgress, AcademyTopic, AcademyTopicDraft, SrsState } from '../../types/domain'

interface TopicRow {
  id: string
  category: string | null
  name: string
  summary: string | null
  key_points: string[]
  presentation: string | null
  reasoning: string | null
  tests: string | null
  interpretation: string | null
  imaging: string | null
  treatment: string | null
  red_flags: string | null
  pearls: string | null
  self_test: string | null
  case_stem: string | null
  case_questions: string[]
  case_discussion: string | null
}

interface ProgressRow {
  topic_id: string
  interval_index: number
  last_reviewed: string | null
  next_review: string | null
  review_history: AcademyProgress['reviewHistory']
}

function topicToDomain(row: TopicRow): AcademyTopic {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    summary: row.summary,
    keyPoints: row.key_points ?? [],
    presentation: row.presentation,
    reasoning: row.reasoning,
    tests: row.tests,
    interpretation: row.interpretation,
    imaging: row.imaging,
    treatment: row.treatment,
    redFlags: row.red_flags,
    pearls: row.pearls,
    selfTest: row.self_test,
    caseStem: row.case_stem,
    caseQuestions: row.case_questions ?? [],
    caseDiscussion: row.case_discussion,
  }
}

function topicToRow(draft: Partial<AcademyTopic>) {
  return {
    category: draft.category,
    name: draft.name,
    summary: draft.summary,
    key_points: draft.keyPoints,
    presentation: draft.presentation,
    reasoning: draft.reasoning,
    tests: draft.tests,
    interpretation: draft.interpretation,
    imaging: draft.imaging,
    treatment: draft.treatment,
    red_flags: draft.redFlags,
    pearls: draft.pearls,
    self_test: draft.selfTest,
    case_stem: draft.caseStem,
    case_questions: draft.caseQuestions,
    case_discussion: draft.caseDiscussion,
  }
}

function progressToDomain(row: ProgressRow): AcademyProgress {
  return {
    topicId: row.topic_id,
    intervalIndex: row.interval_index,
    lastReviewed: row.last_reviewed,
    nextReview: row.next_review,
    reviewHistory: row.review_history ?? [],
  }
}

export async function listAcademyTopics(): Promise<AcademyTopic[]> {
  const { data, error } = await supabase.from('academy_topics').select('*').order('name')
  if (error) throw error
  return (data as TopicRow[]).map(topicToDomain)
}

export async function addAcademyTopic(draft: AcademyTopicDraft): Promise<AcademyTopic> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('academy_topics')
    .insert({ ...topicToRow(draft), owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return topicToDomain(data as TopicRow)
}

export async function updateAcademyTopic(id: string, patch: Partial<AcademyTopic>): Promise<AcademyTopic> {
  const { data, error } = await supabase
    .from('academy_topics')
    .update(topicToRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return topicToDomain(data as TopicRow)
}

export async function deleteAcademyTopic(id: string): Promise<void> {
  const { error } = await supabase.from('academy_topics').delete().eq('id', id)
  if (error) throw error
}

export async function listAcademyProgress(userId: string): Promise<AcademyProgress[]> {
  const { data, error } = await supabase.from('academy_progress').select('*').eq('user_id', userId)
  if (error) throw error
  return (data as ProgressRow[]).map(progressToDomain)
}

export async function saveAcademyProgress(userId: string, topicId: string, state: SrsState): Promise<void> {
  const { error } = await supabase.from('academy_progress').upsert({
    user_id: userId,
    topic_id: topicId,
    interval_index: state.intervalIndex,
    last_reviewed: state.lastReviewed,
    next_review: state.nextReview,
    review_history: state.reviewHistory,
  })
  if (error) throw error
}
