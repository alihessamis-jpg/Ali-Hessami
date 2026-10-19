// Shared due/new selection + time estimate for the FSRS review queue
// (library_cards) -- used by both TodayPage's "due today" widget and
// ReviewPage's actual session, so the numbers Today promises match what
// Review actually serves.
import type { LibraryCard } from '../types/domain'

export function selectDueLibraryCards(cards: LibraryCard[], now = new Date()): LibraryCard[] {
  return cards.filter((c) => c.status === 'approved' && c.reps > 0 && new Date(c.due).getTime() <= now.getTime())
}

export function selectNewLibraryCardPool(cards: LibraryCard[]): LibraryCard[] {
  return cards
    .filter((c) => c.status === 'approved' && c.reps === 0)
    .sort((a, b) => {
      if (a.highYield !== b.highYield) return a.highYield ? -1 : 1
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
}

// Rough estimate, not a promise: ~10s for a card already in review (you've
// seen it before, recall is quick) and ~20s for a new card (first exposure,
// more reading/thinking). Good enough for "about N min" on the Today widget.
const SECONDS_PER_DUE_CARD = 10
const SECONDS_PER_NEW_CARD = 20

export function estimateReviewMinutes(dueCount: number, newCount: number): number {
  const seconds = dueCount * SECONDS_PER_DUE_CARD + newCount * SECONDS_PER_NEW_CARD
  return Math.max(seconds > 0 ? 1 : 0, Math.round(seconds / 60))
}
