// Academy topic review plan for Today / Dashboard.
//
// - Due   = topics that HAVE an academy_progress row with next_review <= today.
// - New   = topics with no progress row yet. At most NEW_TOPICS_PER_DAY are
//           introduced per day; topics first reviewed today (their first
//           review_history entry is dated today) count against that quota.
//           Weakest categories first (lowest accuracy_pct in
//           topic_question_stats); categories never practised come after,
//           and within a category the root topic comes before its sub-topics.

import type { AcademyProgress, AcademyTopic } from '../types/domain'
import { leadingNumber } from './sortSubTopics'

export const NEW_TOPICS_PER_DAY = 3

export interface TopicReviewPlan {
  due: AcademyTopic[]
  fresh: AcademyTopic[]
  /** topics without progress still waiting to be introduced (beyond today's quota) */
  backlog: number
}

/** Category accuracy from topic_question_stats rows (attempt-weighted). */
export function categoryAccuracy(rows: { category: string | null; attempts: number; correct_attempts: number }[]): Map<string, number> {
  const acc = new Map<string, { a: number; c: number }>()
  for (const r of rows) {
    if (!r.category || !r.attempts) continue
    const s = acc.get(r.category) ?? { a: 0, c: 0 }
    s.a += Number(r.attempts)
    s.c += Number(r.correct_attempts)
    acc.set(r.category, s)
  }
  return new Map([...acc].map(([k, s]) => [k, (100 * s.c) / s.a]))
}

export function planTopicReview(
  topics: AcademyTopic[],
  progress: AcademyProgress[],
  catAccuracy: Map<string, number>,
  today: string,
  newPerDay = NEW_TOPICS_PER_DAY,
): TopicReviewPlan {
  const byTopic = new Map(progress.map((p) => [p.topicId, p]))
  const due = topics
    .filter((t) => {
      const p = byTopic.get(t.id)
      return !!p?.nextReview && p.nextReview <= today
    })
    .sort((a, b) => (byTopic.get(a.id)!.nextReview as string).localeCompare(byTopic.get(b.id)!.nextReview as string))

  const startedToday = progress.filter((p) => p.reviewHistory?.[0]?.date === today).length
  const quota = Math.max(0, newPerDay - startedToday)

  const unseen = topics.filter((t) => !byTopic.has(t.id))
  const accOf = (t: AcademyTopic) => (t.category != null ? catAccuracy.get(t.category) : undefined)
  const ranked = [...unseen].sort((a, b) => {
    const aa = accOf(a)
    const ab = accOf(b)
    if (aa != null && ab != null && aa !== ab) return aa - ab
    if ((aa != null) !== (ab != null)) return aa != null ? -1 : 1
    const ca = a.category ?? '￿'
    const cb = b.category ?? '￿'
    if (ca !== cb) return ca.localeCompare(cb)
    // root topic before its sub-topics, then the book's numbering
    if (!a.parentTopicId !== !b.parentTopicId) return a.parentTopicId ? 1 : -1
    const na = leadingNumber(a.name)
    const nb = leadingNumber(b.name)
    if (na != null && nb != null && na !== nb) return na - nb
    return a.name.localeCompare(b.name, 'fa')
  })
  return { due, fresh: ranked.slice(0, quota), backlog: Math.max(0, ranked.length - quota) }
}
