// Pure data-shaping for the Exam Plan page (Phase 5): coverage, the
// due-reviews forecast, review-streak/heatmap activity, and chapters
// going stale. No network calls -- callers pass in already-fetched
// cards/chapters.
import type { LibraryCard, LibraryChapter } from '../types/domain'

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Every FSRS review a card has ever had, bucketed by calendar day --
// the basis for both the streak and the heatmap.
export function computeReviewActivityByDay(cards: LibraryCard[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const c of cards) {
    for (const entry of c.reviewHistory) {
      const day = entry.date.slice(0, 10)
      counts.set(day, (counts.get(day) ?? 0) + 1)
    }
  }
  return counts
}

export function computeReviewStreak(activity: Map<string, number>, today = new Date()): number {
  let streak = 0
  const cursor = new Date(today)
  while ((activity.get(dayKey(cursor)) ?? 0) > 0) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface DueForecastDay {
  date: string
  count: number
}

// How many approved, already-introduced cards are due each of the next
// `days` days. Anything already overdue folds into "today" so the chart
// shows the real workload instead of a silent backlog.
export function computeDueForecast(cards: LibraryCard[], days = 30, now = new Date()): DueForecastDay[] {
  const todayStr = dayKey(now)
  const buckets = new Map<string, number>()
  const dates: string[] = []
  const cursor = new Date(now)
  for (let i = 0; i < days; i++) {
    const d = dayKey(cursor)
    dates.push(d)
    buckets.set(d, 0)
    cursor.setDate(cursor.getDate() + 1)
  }
  for (const c of cards) {
    if (c.status !== 'approved' || c.reps === 0) continue
    const dueDay = c.due.slice(0, 10)
    const bucketDay = dueDay < todayStr ? todayStr : dueDay
    if (buckets.has(bucketDay)) buckets.set(bucketDay, (buckets.get(bucketDay) as number) + 1)
  }
  return dates.map((d) => ({ date: d, count: buckets.get(d) ?? 0 }))
}

export interface ChapterCoverage {
  totalChapters: number
  chaptersWithItems: number
  chaptersWithItemsPct: number
  totalItems: number
  itemsReviewed: number
  itemsReviewedPct: number
}

export function computeChapterCoverage(chapters: LibraryChapter[], cards: LibraryCard[]): ChapterCoverage {
  const approved = cards.filter((c) => c.status === 'approved')
  const chapterIdsWithItems = new Set(approved.map((c) => c.chapterId))
  const itemsReviewed = approved.filter((c) => c.reps > 0).length
  return {
    totalChapters: chapters.length,
    chaptersWithItems: chapterIdsWithItems.size,
    chaptersWithItemsPct: chapters.length > 0 ? Math.round((chapterIdsWithItems.size / chapters.length) * 100) : 0,
    totalItems: approved.length,
    itemsReviewed,
    itemsReviewedPct: approved.length > 0 ? Math.round((itemsReviewed / approved.length) * 100) : 0,
  }
}

export interface StaleChapter {
  chapter: LibraryChapter
  daysSinceReview: number | null
}

// Chapters with at least one approved card that either has never been
// reviewed, or hasn't been touched in over `thresholdDays` -- stalest
// (longest ago, nulls -- never -- first) leading.
export function computeStaleChapters(
  chapters: LibraryChapter[],
  cards: LibraryCard[],
  now = new Date(),
  thresholdDays = 21
): StaleChapter[] {
  const approved = cards.filter((c) => c.status === 'approved')
  const result: StaleChapter[] = []
  for (const chapter of chapters) {
    const chapterCards = approved.filter((c) => c.chapterId === chapter.id)
    if (chapterCards.length === 0) continue
    const lastReviewTimes = chapterCards
      .map((c) => (c.lastReview ? new Date(c.lastReview).getTime() : null))
      .filter((t): t is number => t !== null)
    const daysSinceReview =
      lastReviewTimes.length > 0 ? Math.floor((now.getTime() - Math.max(...lastReviewTimes)) / 86_400_000) : null
    if (daysSinceReview === null || daysSinceReview > thresholdDays) {
      result.push({ chapter, daysSinceReview })
    }
  }
  return result.sort((a, b) => (b.daysSinceReview ?? Infinity) - (a.daysSinceReview ?? Infinity))
}

export function daysUntil(dateStr: string, now = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`)
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000)
}
