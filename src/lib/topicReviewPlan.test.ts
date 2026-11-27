import { describe, expect, it } from 'vitest'
import { categoryAccuracy, planTopicReview } from './topicReviewPlan'
import type { AcademyProgress, AcademyTopic } from '../types/domain'

const t = (id: string, category: string, parent: string | null = null, name = id) =>
  ({ id, name, category, parentTopicId: parent, keyPoints: [], studyLinks: [], caseQuestions: [] }) as AcademyTopic
const p = (topicId: string, nextReview: string | null, firstReview?: string): AcademyProgress => ({
  topicId,
  intervalIndex: 0,
  lastReviewed: firstReview ?? null,
  nextReview,
  reviewHistory: firstReview ? [{ date: firstReview, rating: 'moderate' }] : [],
})

const topics = [
  t('aki-root', 'AKI'),
  t('aki-sub', 'AKI', 'aki-root'),
  t('ckd-root', 'CKD & Dialysis'),
  t('ckd-sub', 'CKD & Dialysis', 'ckd-root'),
  t('glom-root', 'Glomerular Diseases'),
  t('hypoNa', 'Electrolytes', 'lytes-root'),
  t('lytes-root', 'Electrolytes'),
]
const acc = categoryAccuracy([
  { category: 'CKD & Dialysis', attempts: 116, correct_attempts: 77 },
  { category: 'Glomerular Diseases', attempts: 15, correct_attempts: 9 },
  { category: 'AKI', attempts: 0, correct_attempts: 0 },
])

describe('planTopicReview', () => {
  it('due = only topics with a progress row whose next_review has come', () => {
    const plan = planTopicReview(topics, [p('hypoNa', '2026-10-06', '2026-10-05')], acc, '2026-11-27')
    expect(plan.due.map((x) => x.id)).toEqual(['hypoNa'])
  })
  it('a topic reviewed for later is neither due nor new', () => {
    const plan = planTopicReview(topics, [p('hypoNa', '2026-12-01', '2026-11-20')], acc, '2026-11-27')
    expect(plan.due).toEqual([])
    expect(plan.fresh.map((x) => x.id)).not.toContain('hypoNa')
  })
  it('introduces 3 new topics, weakest category first, roots before sub-topics', () => {
    const plan = planTopicReview(topics, [p('hypoNa', '2026-10-06', '2026-10-05')], acc, '2026-11-27')
    // Glomerular 60% < CKD 66% < categories without attempts (AKI, Electrolytes)
    expect(plan.fresh.map((x) => x.id)).toEqual(['glom-root', 'ckd-root', 'ckd-sub'])
    expect(plan.backlog).toBe(3) // aki-root, aki-sub, lytes-root
  })
  it('topics started today use up the daily quota', () => {
    const plan = planTopicReview(topics, [p('glom-root', '2026-11-28', '2026-11-27'), p('ckd-root', '2026-11-28', '2026-11-27')], acc, '2026-11-27')
    expect(plan.fresh.map((x) => x.id)).toEqual(['ckd-sub'])
  })
})
