import { describe, expect, it } from 'vitest'
import {
  computeChapterCoverage,
  computeDueForecast,
  computeReviewActivityByDay,
  computeReviewStreak,
  computeStaleChapters,
  daysUntil,
} from './examPlan'
import { emptyFsrsState } from './fsrs'
import type { LibraryCard, LibraryChapter } from '../types/domain'

const NOW = new Date('2026-01-10T00:00:00.000Z')

function makeCard(overrides: Partial<LibraryCard> = {}): LibraryCard {
  return {
    ...emptyFsrsState(NOW),
    id: overrides.id ?? 'card-1',
    chapterId: overrides.chapterId ?? 'ch-1',
    kind: 'basic',
    front: 'Q',
    back: 'A',
    status: 'approved',
    tags: [],
    highYield: false,
    createdAt: NOW.toISOString(),
    ...overrides,
  }
}

function makeChapter(overrides: Partial<LibraryChapter> = {}): LibraryChapter {
  return {
    id: overrides.id ?? 'ch-1',
    bookId: 'book-1',
    partRoman: 'I',
    partTitle: 'Part',
    chapterNumber: 1,
    title: 'Chapter',
    status: 'reading',
    readingPct: 0,
    ...overrides,
  }
}

describe('computeReviewActivityByDay / computeReviewStreak', () => {
  it('counts reviews per day and finds a consecutive streak ending today', () => {
    const cards = [
      makeCard({
        reviewHistory: [
          { date: '2026-01-10T08:00:00.000Z', rating: 'good' },
          { date: '2026-01-09T08:00:00.000Z', rating: 'good' },
          { date: '2026-01-07T08:00:00.000Z', rating: 'again' },
        ],
      }),
    ]
    const activity = computeReviewActivityByDay(cards)
    expect(activity.get('2026-01-10')).toBe(1)
    expect(computeReviewStreak(activity, NOW)).toBe(2) // 01-10, 01-09; 01-08 is missing
  })

  it('streak is 0 with no activity today', () => {
    const activity = computeReviewActivityByDay([])
    expect(computeReviewStreak(activity, NOW)).toBe(0)
  })
})

describe('computeDueForecast', () => {
  it('folds overdue cards into today and buckets future due dates', () => {
    const cards = [
      makeCard({ id: 'a', reps: 1, due: '2026-01-05T00:00:00.000Z' }), // overdue -> today
      makeCard({ id: 'b', reps: 1, due: '2026-01-12T00:00:00.000Z' }),
      makeCard({ id: 'c', reps: 0, due: '2026-01-12T00:00:00.000Z' }), // not introduced yet -- excluded
    ]
    const forecast = computeDueForecast(cards, 5, NOW)
    expect(forecast[0].date).toBe('2026-01-10')
    expect(forecast[0].count).toBe(1)
    expect(forecast.find((d) => d.date === '2026-01-12')?.count).toBe(1)
  })
})

describe('computeChapterCoverage', () => {
  it('computes chapter and item coverage percentages', () => {
    const chapters = [makeChapter({ id: 'ch-1' }), makeChapter({ id: 'ch-2' })]
    const cards = [makeCard({ chapterId: 'ch-1', reps: 1 }), makeCard({ id: 'card-2', chapterId: 'ch-1', reps: 0 })]
    const coverage = computeChapterCoverage(chapters, cards)
    expect(coverage.chaptersWithItemsPct).toBe(50)
    expect(coverage.itemsReviewedPct).toBe(50)
  })
})

describe('computeStaleChapters', () => {
  it('flags a chapter never reviewed and one reviewed long ago, not a fresh one', () => {
    const chapters = [makeChapter({ id: 'never' }), makeChapter({ id: 'stale' }), makeChapter({ id: 'fresh' })]
    const cards = [
      makeCard({ chapterId: 'never', reps: 0 }),
      makeCard({ id: 'c2', chapterId: 'stale', reps: 3, lastReview: '2025-11-01T00:00:00.000Z' }),
      makeCard({ id: 'c3', chapterId: 'fresh', reps: 3, lastReview: '2026-01-09T00:00:00.000Z' }),
    ]
    const stale = computeStaleChapters(chapters, cards, NOW, 21)
    const ids = stale.map((s) => s.chapter.id)
    expect(ids).toContain('never')
    expect(ids).toContain('stale')
    expect(ids).not.toContain('fresh')
  })
})

describe('daysUntil', () => {
  it('counts whole days to a future date', () => {
    expect(daysUntil('2026-01-20', NOW)).toBe(10)
  })
  it('is negative for a past date', () => {
    expect(daysUntil('2026-01-01', NOW)).toBeLessThan(0)
  })
})
