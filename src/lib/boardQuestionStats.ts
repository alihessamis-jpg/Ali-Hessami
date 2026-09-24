import type { BoardQuestionAttempt } from '../types/domain'

export interface TopicAccuracy {
  topic: string
  attempts: number
  correct: number
  accuracyPct: number
}

export function accuracyByTopic(attempts: BoardQuestionAttempt[], topicByQuestionId: Map<string, string>): TopicAccuracy[] {
  const byTopic = new Map<string, { attempts: number; correct: number }>()
  for (const a of attempts) {
    const topic = topicByQuestionId.get(a.questionId) ?? 'Unknown'
    const entry = byTopic.get(topic) ?? { attempts: 0, correct: 0 }
    entry.attempts += 1
    if (a.isCorrect) entry.correct += 1
    byTopic.set(topic, entry)
  }
  return Array.from(byTopic.entries())
    .map(([topic, { attempts, correct }]) => ({
      topic,
      attempts,
      correct,
      accuracyPct: Math.round((correct / attempts) * 100),
    }))
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
}

export interface DailyAccuracy {
  date: string
  attempts: number
  accuracyPct: number
}

// One point per day a practice session happened, so the trend chart shows
// real progress over time rather than noise from single-question attempts.
export function dailyAccuracyTrend(attempts: BoardQuestionAttempt[]): DailyAccuracy[] {
  const byDate = new Map<string, { attempts: number; correct: number }>()
  for (const a of attempts) {
    const date = a.attemptedAt.slice(0, 10)
    const entry = byDate.get(date) ?? { attempts: 0, correct: 0 }
    entry.attempts += 1
    if (a.isCorrect) entry.correct += 1
    byDate.set(date, entry)
  }
  return Array.from(byDate.entries())
    .map(([date, { attempts, correct }]) => ({ date, attempts, accuracyPct: Math.round((correct / attempts) * 100) }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
