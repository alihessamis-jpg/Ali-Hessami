// Reused as-is from the prototype (NEPHRON_HANDOFF.md).
import type { ReviewHistoryEntry, SrsState } from '../types/domain'

export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60] // days

export function scheduleReview(state: SrsState, rating: ReviewHistoryEntry['rating']): SrsState {
  let idx = state.intervalIndex == null || state.intervalIndex < 0 ? -1 : state.intervalIndex
  if (rating === 'easy') idx = Math.min(idx + 2, REVIEW_INTERVALS.length - 1)
  else if (rating === 'moderate') idx = Math.min(idx + 1, REVIEW_INTERVALS.length - 1)
  else idx = 0 // difficult

  const today = new Date()
  const lastReviewed = today.toISOString().slice(0, 10)
  const next = new Date(today)
  next.setDate(next.getDate() + REVIEW_INTERVALS[idx])
  const nextReview = next.toISOString().slice(0, 10)

  return {
    intervalIndex: idx,
    lastReviewed,
    nextReview,
    reviewHistory: [...state.reviewHistory, { date: lastReviewed, rating }],
  }
}
