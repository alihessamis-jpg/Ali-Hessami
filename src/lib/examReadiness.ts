import type { AcademyCard, AcademyTopic, BoardQuestion, BoardQuestionAttempt, Flashcard, FsrsRating, LibraryCard, LibraryChapter } from '../types/domain'

export type ReadinessStatus = 'no-data' | 'weak' | 'moderate' | 'strong'

export interface TopicReadiness {
  topic: string
  questionAttempts: number
  questionCorrect: number
  questionAccuracyPct: number | null
  flashcardCount: number
  flashcardConfidencePct: number | null
  cardCount: number
  cardConfidencePct: number | null
  masteryPct: number | null
  status: ReadinessStatus
}

// Weights used when blending whichever of the three signals (board-question
// accuracy, flashcard review confidence, card review confidence) a topic
// actually has data for; renormalized to sum to 1 over the present signals.
const SIGNAL_WEIGHTS = { question: 0.5, flashcard: 0.2, card: 0.3 }

function normalizeTopic(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

function ratingScore(rating: 'easy' | 'moderate' | 'difficult'): number {
  if (rating === 'easy') return 100
  if (rating === 'moderate') return 55
  return 15
}

// Same idea for Academy v2's FSRS cards (Again/Hard/Good/Easy), rescaled
// onto the same 0-100 confidence range so the two card systems can feed one
// blended "card confidence" signal below.
function fsrsRatingScore(rating: FsrsRating): number {
  if (rating === 'easy') return 100
  if (rating === 'good') return 75
  if (rating === 'hard') return 40
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
  academyTopics: AcademyTopic[],
  cards: AcademyCard[] = [],
  libraryCards: LibraryCard[] = [],
  libraryChapters: LibraryChapter[] = []
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

  // Cards are linked to a topic by id (not a free-text name), so map through
  // the Academy topic's own name to land in the same normalized group as its
  // board questions/flashcards.
  const topicIdToKey = new Map<string, string>()
  for (const t of academyTopics) topicIdToKey.set(t.id, normalizeTopic(t.name))

  const cardStats = new Map<string, { count: number; scores: number[] }>()
  for (const card of cards) {
    const key = topicIdToKey.get(card.topicId)
    if (!key) continue
    const latest = card.reviewHistory.length > 0 ? card.reviewHistory[card.reviewHistory.length - 1] : null
    const stat = cardStats.get(key) ?? { count: 0, scores: [] }
    stat.count += 1
    if (latest) stat.scores.push(ratingScore(latest.rating))
    cardStats.set(key, stat)
  }

  // Academy v2's book cards are linked to a chapter, not a topic — fold
  // them into the same "card confidence" pool, grouped by the chapter's own
  // title (creating a new group for chapters with no matching topic/question
  // name, the same way flashcard decks do above).
  const chapterIdToKey = new Map<string, string>()
  for (const c of libraryChapters) chapterIdToKey.set(c.id, normalizeTopic(c.title))
  for (const card of libraryCards) {
    const chapter = libraryChapters.find((c) => c.id === card.chapterId)
    if (!chapter) continue
    const key = chapterIdToKey.get(card.chapterId) as string
    if (!groups.has(key)) groupFor(key, chapter.title)
    const latest = card.reviewHistory.length > 0 ? card.reviewHistory[card.reviewHistory.length - 1] : null
    const stat = cardStats.get(key) ?? { count: 0, scores: [] }
    stat.count += 1
    if (latest) stat.scores.push(fsrsRatingScore(latest.rating))
    cardStats.set(key, stat)
  }

  const results: TopicReadiness[] = []
  for (const [key, g] of groups) {
    const attemptStat = attemptStats.get(key)
    const flashcardStat = flashcardStats.get(key)
    const cardStat = cardStats.get(key)

    const questionAccuracyPct =
      attemptStat && attemptStat.attempts > 0 ? Math.round((attemptStat.correct / attemptStat.attempts) * 100) : null
    const flashcardConfidencePct =
      flashcardStat && flashcardStat.scores.length > 0
        ? Math.round(flashcardStat.scores.reduce((sum, s) => sum + s, 0) / flashcardStat.scores.length)
        : null
    const cardConfidencePct =
      cardStat && cardStat.scores.length > 0
        ? Math.round(cardStat.scores.reduce((sum, s) => sum + s, 0) / cardStat.scores.length)
        : null

    const present = [
      { pct: questionAccuracyPct, weight: SIGNAL_WEIGHTS.question },
      { pct: flashcardConfidencePct, weight: SIGNAL_WEIGHTS.flashcard },
      { pct: cardConfidencePct, weight: SIGNAL_WEIGHTS.card },
    ].filter((s): s is { pct: number; weight: number } => s.pct != null)
    const weightSum = present.reduce((sum, s) => sum + s.weight, 0)
    const masteryPct = weightSum > 0 ? Math.round(present.reduce((sum, s) => sum + s.pct * s.weight, 0) / weightSum) : null

    results.push({
      topic: g.label,
      questionAttempts: attemptStat?.attempts ?? 0,
      questionCorrect: attemptStat?.correct ?? 0,
      questionAccuracyPct,
      flashcardCount: flashcardStat?.count ?? 0,
      flashcardConfidencePct,
      cardCount: cardStat?.count ?? 0,
      cardConfidencePct,
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
