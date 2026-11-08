import { supabase } from '../supabaseClient'
import { getAuthUser } from './authUser'
import { addDaysIso, pickNextVerse } from '../dailyVerse'
import type { DailyVerse, SrsState } from '../../types/domain'

interface DailyVerseRow {
  id: string
  shown_on: string
  verse_key: string
  poet: string
  line1: string
  line2: string
  source: string | null
  memorized: boolean
  interval_index: number
  last_reviewed: string | null
  next_review: string | null
  review_history: DailyVerse['reviewHistory']
}

function toDomain(row: DailyVerseRow): DailyVerse {
  return {
    id: row.id,
    shownOn: row.shown_on,
    verseKey: row.verse_key,
    poet: row.poet,
    line1: row.line1,
    line2: row.line2,
    source: row.source,
    memorized: row.memorized,
    intervalIndex: row.interval_index,
    lastReviewed: row.last_reviewed,
    nextReview: row.next_review,
    reviewHistory: row.review_history ?? [],
  }
}

export async function listDailyVerses(): Promise<DailyVerse[]> {
  const { data, error } = await supabase.from('daily_verses').select('*').order('shown_on', { ascending: false })
  if (error) throw error
  return (data as DailyVerseRow[]).map(toDomain)
}

// Returns today's saved verse, creating it on first visit of the day.
// The (user_id, shown_on) unique constraint makes concurrent first visits
// (two tabs, offline retry) collapse onto a single row.
export async function ensureTodayVerse(today: string, existing: DailyVerse[]): Promise<DailyVerse> {
  const found = existing.find((v) => v.shownOn === today)
  if (found) return found

  const {
    data: { user },
  } = await getAuthUser()
  if (!user) throw new Error('Not authenticated')

  const verse = pickNextVerse(
    existing.map((v) => v.verseKey),
    existing.length
  )
  const { error: insertError } = await supabase.from('daily_verses').upsert(
    {
      user_id: user.id,
      shown_on: today,
      verse_key: verse.key,
      poet: verse.poet,
      line1: verse.line1,
      line2: verse.line2,
      source: verse.source ?? null,
      // First spaced-repetition review tomorrow.
      next_review: addDaysIso(today, 1),
    },
    { onConflict: 'user_id,shown_on', ignoreDuplicates: true }
  )
  if (insertError) throw insertError

  const { data, error } = await supabase.from('daily_verses').select('*').eq('shown_on', today).single()
  if (error) throw error
  return toDomain(data as DailyVerseRow)
}

export async function updateDailyVerseSrs(id: string, state: SrsState): Promise<DailyVerse> {
  const { data, error } = await supabase
    .from('daily_verses')
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
  return toDomain(data as DailyVerseRow)
}

export async function setDailyVerseMemorized(id: string, memorized: boolean): Promise<DailyVerse> {
  const { data, error } = await supabase.from('daily_verses').update({ memorized }).eq('id', id).select().single()
  if (error) throw error
  return toDomain(data as DailyVerseRow)
}
