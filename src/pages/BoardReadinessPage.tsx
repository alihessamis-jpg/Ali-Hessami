import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAcademyTopics } from '../lib/api/academy'
import { listBoardQuestionAttempts } from '../lib/api/boardQuestionAttempts'
import { listBoardQuestions } from '../lib/api/boardQuestions'
import { listFlashcards } from '../lib/api/flashcards'
import { computeTopicReadiness, type TopicReadiness } from '../lib/examReadiness'
import { AnalyticsIcon } from '../components/icons'

const STATUS_LABEL: Record<TopicReadiness['status'], string> = {
  'no-data': 'Not practiced yet',
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
}

const BAR_COLOR: Record<TopicReadiness['status'], string> = {
  'no-data': 'var(--border)',
  weak: 'var(--danger)',
  moderate: 'var(--warning)',
  strong: '#15803d',
}

export function BoardReadinessPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<TopicReadiness[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([listBoardQuestions(), listBoardQuestionAttempts(), listFlashcards(), listAcademyTopics()])
      .then(([questions, attempts, flashcards, topics]) => {
        setReadiness(computeTopicReadiness(questions, attempts, flashcards, topics))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load readiness data'))
      .finally(() => setLoading(false))
  }, [])

  const summary = useMemo(() => {
    const practiced = readiness.filter((r) => r.status !== 'no-data')
    const weakCount = readiness.filter((r) => r.status === 'weak').length
    const totalAttempts = readiness.reduce((sum, r) => sum + r.questionAttempts, 0)
    const totalCorrect = readiness.reduce((sum, r) => sum + r.questionCorrect, 0)
    const overallAccuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null
    return { practicedCount: practiced.length, totalCount: readiness.length, weakCount, totalAttempts, overallAccuracy }
  }, [readiness])

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <AnalyticsIcon />
        </span>
        Board Readiness
      </h1>
      <p className="empty-state">
        Mastery per topic, built from your Board Question accuracy and Flashcard recall — weakest topics first,
        so you know exactly where to focus before the exam.
      </p>

      {error && <p className="form-error">{error}</p>}

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Overview</h2>
        </div>
        <p className="patient-meta">
          {summary.practicedCount} of {summary.totalCount} tracked topic{summary.totalCount === 1 ? '' : 's'}{' '}
          practiced · {summary.totalAttempts} question attempt{summary.totalAttempts === 1 ? '' : 's'} total
          {summary.overallAccuracy != null && ` · ${summary.overallAccuracy}% overall accuracy`}
          {summary.weakCount > 0 && ` · ${summary.weakCount} weak topic${summary.weakCount === 1 ? '' : 's'} to prioritize`}
        </p>
      </div>

      {readiness.length === 0 ? (
        <div className="dash-card">
          <p className="empty-state">
            No topics yet. Add Board Questions, Flashcards, or Academy topics, then come back here to see your
            readiness breakdown.
          </p>
        </div>
      ) : (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">By topic ({readiness.length})</h2>
          </div>
          <ul className="note-timeline">
            {readiness.map((r) => (
              <li key={r.topic}>
                <div className="note-header">
                  <strong>{r.topic}</strong>
                  <span className={`status-badge status-badge--${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 999, height: 8, overflow: 'hidden', margin: '6px 0' }}>
                  <div
                    style={{
                      width: `${r.masteryPct ?? 0}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: BAR_COLOR[r.status],
                    }}
                  />
                </div>
                <p className="patient-meta">
                  {r.questionAttempts > 0
                    ? `${r.questionCorrect}/${r.questionAttempts} correct (${r.questionAccuracyPct}%)`
                    : 'No Board Question attempts yet'}
                  {r.flashcardCount > 0 &&
                    ` · ${r.flashcardCount} flashcard${r.flashcardCount === 1 ? '' : 's'}${
                      r.flashcardConfidencePct != null ? ` (${r.flashcardConfidencePct}% confidence)` : ''
                    }`}
                </p>
              </li>
            ))}
          </ul>
          <p className="patient-meta" style={{ marginTop: 12 }}>
            Practice weak topics in <Link to="/study">Study Hub</Link> — Board Questions, Mock Exam, and
            Flashcards all feed back into this page.
          </p>
        </div>
      )}
    </div>
  )
}
