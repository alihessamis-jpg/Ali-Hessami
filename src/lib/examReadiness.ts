import type { AcademyTopic, BoardQuestion, BoardQuestionAttempt, Flashcard } from '../types/domain'

export type ReadinessStatus = 'no-data' | 'weak' | 'moderate' | 'strong'

export interface TopicReadiness {
  topic: string
  questionAttempts: number
  questionCorrect: number
  questionAccuracyPct: number | null
  flashcardCount: number
  flashcardConfidencePct: number | null
  masteryPct: number | null
  status: ReadinessStatus
}

function normalizeTopic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

function ratingScore(rating: 'easy' | 'moderate' | 'difficult'): number {
  if (rating === 'easy') return 100
  if (rating === 'moderate') return 55
  return 15
}

function statusFor(masteryPct: number | null): ReadinessStatus {
  if (masteryPct == null) return 'no-data'
  if (masteryPct < 60) return 'weak'
  if (masteryPct < 80) return 'moderate'
  return 'strong'
}

export function computeTopicReadiness(
  questions: BoardQuestion[],
  attempts: BoardQuestionAttempt[],
  flashcards: Flashcard[],
  academyTopics: AcademyTopic[]
): TopicReadiness[] {
  const groups = new Map<
    string,
    { label: string; questionIds: Set<string>; accuracyScores: number[]; flashcardScores: number[] }
  >()

  function groupFor(key: string, label: string) {
    let g = groups.get(key)
    if (!g) {
      g = { label, questionIds: new Set(), accuracyScores: [], flashcardScores: [] }
      groups.set(key, g)
    }
    return g
  }

  for (const q of questions) {
    if (!q.topic || !q.topic.trim()) continue
    const key = normalizeTopic(q.topic)
    groupFor(key, q.topic).questionIds.add(q.id)
  }

  for (const t of academyTopics) {
    const key = normalizeTopic(t.name)
    groupFor(key, t.name)
  }

  const questionIdToKey = new Map<string, string>()
  for (const [key, g] of groups) {
    for (const id of g.questionIds) questionIdToKey.set(id, key)
  }

  const attemptStats = new Map<string, { attempts: number; correct: number }>()
  for (const a of attempts) {
    const key = questionIdToKey.get(a.questionId)
    if (!key) continue
    const stat = attemptStats.get(key) ?? { attempts: 0, correct: 0 }
    stat.attempts += 1
    if (a.isCorrect) stat.correct += 1
    attemptStats.set(key, stat)
  }

  const flashcardStats = new Map<string, { count: number; scores: number[] }>()
  for (const fc of flashcards) {
    if (!fc.deck || !fc.deck.trim()) continue
    const key = normalizeTopic(fc.deck)
    if (!groups.has(key)) groupFor(key, fc.deck)
    const latest = fc.reviewHistory.length > 0 ? fc.reviewHistory[fc.reviewHistory.length - 1] : null
    const stat = flashcardStats.get(key) ?? { count: 0, scores: [] }
    stat.count += 1
    if (latest) stat.scores.push(ratingScore(latest.rating))
    flashcardStats.set(key, stat)
  }

  const results: TopicReadiness[] = []
  for (const [key, g] of groups) {
    const attemptStat = attemptStats.get(key)
    const flashcardStat = flashcardStats.get(key)

    const questionAccuracyPct =
      attemptStat && attemptStat.attempts > 0 ? Math.round((attemptStat.correct / attemptStat.attempts) * 100) : null
    const flashcardConfidencePct =
      flashcardStat && flashcardStat.scores.length > 0
        ? Math.round(flashcardStat.scores.reduce((sum, s) => sum + s, 0) / flashcardStat.scores.length)
        : null

    let masteryPct: number | null = null
    if (questionAccuracyPct != null && flashcardConfidencePct != null) {
      masteryPct = Math.round(questionAccuracyPct * 0.7 + flashcardConfidencePct * 0.3)
    } else if (questionAccuracyPct != null) {
      masteryPct = questionAccuracyPct
    } else if (flashcardConfidencePct != null) {
      masteryPct = flashcardConfidencePct
    }

    results.push({
      topic: g.label,
      questionAttempts: attemptStat?.attempts ?? 0,
      questionCorrect: attemptStat?.correct ?? 0,
      questionAccuracyPct,
      flashcardCount: flashcardStat?.count ?? 0,
      flashcardConfidencePct,
      masteryPct,
      status: statusFor(masteryPct),
    })
  }

  const statusRank: Record<ReadinessStatus, number> = { 'no-data': 0, weak: 1, moderate: 2, strong: 3 }
  return results.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status]
    if (rankDiff !== 0) return rankDiff
    const aPct = a.masteryPct ?? -1
    const bPct = b.masteryPct ?? -1
    if (aPct !== bPct) return aPct - bPct
    return a.topic.localeCompare(b.topic)
  })
}
