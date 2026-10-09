import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAcademyTopics } from '../lib/api/academy'
import { listAllAcademyCards } from '../lib/api/academyCards'
import { listBoardQuestionAttempts } from '../lib/api/boardQuestionAttempts'
import { listBoardQuestions } from '../lib/api/boardQuestions'
import { listFlashcards } from '../lib/api/flashcards'
import { ensureLibraryBookSeeded, listAllLibraryCards } from '../lib/api/library'
import { computeTopicReadiness, type TopicReadiness } from '../lib/examReadiness'
import { useCountUp } from '../hooks/useCountUp'
import { isolateLatinRuns } from '../lib/bidiText'

const STATUS_LABEL: Record<TopicReadiness['status'], string> = {
  'no-data': 'Not practiced',
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
}

const BAR_COLOR: Record<TopicReadiness['status'], string> = {
  'no-data': '#C3D0E4',
  weak: '#C9372C',
  moderate: '#C89A1E',
  strong: '#1A7F4E',
}

const RING_RADIUS = 54
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function BoardReadinessPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<TopicReadiness[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listBoardQuestions(),
      listBoardQuestionAttempts(),
      listFlashcards(),
      listAcademyTopics(),
      listAllAcademyCards(),
      listAllLibraryCards(),
      ensureLibraryBookSeeded(),
    ])
      .then(([questions, attempts, flashcards, topics, cards, libraryCards, seeded]) => {
        setReadiness(computeTopicReadiness(questions, attempts, flashcards, topics, cards, libraryCards, seeded.chapters))
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

  const weakTopics = readiness.filter((r) => r.status === 'weak')
  const notPracticed = readiness.filter((r) => r.status === 'no-data')
  const practicedOk = readiness.filter((r) => r.status === 'moderate' || r.status === 'strong')

  const accuracyDisplay = useCountUp(summary.overallAccuracy ?? 0)
  const practicedDisplay = useCountUp(summary.practicedCount)
  const attemptsDisplay = useCountUp(summary.totalAttempts)
  const weakDisplay = useCountUp(summary.weakCount)
  const ringOffset = RING_CIRCUMFERENCE * (1 - (summary.overallAccuracy ?? 0) / 100)

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow blue" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Board Readiness</h1>
            <p className="np-sub">
              Mastery per topic from Board Question accuracy and flashcard recall — weakest first.
            </p>
          </div>
          <svg
            className="np-art"
            width="128"
            height="128"
            viewBox="0 0 128 128"
            fill="none"
            role="img"
            aria-label={`Overall accuracy ${summary.overallAccuracy ?? 0} percent`}
          >
            <circle cx="64" cy="64" r={RING_RADIUS} stroke="rgba(255,255,255,.12)" strokeWidth={10} />
            <circle
              cx="64"
              cy="64"
              r={RING_RADIUS}
              stroke="#7FD4FF"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 64 64)"
              style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }}
            />
            <text x="64" y="66" textAnchor="middle" fill="#fff" fontSize="30" fontWeight="800" fontFamily="Plus Jakarta Sans">
              {Math.round(accuracyDisplay ?? 0)}%
            </text>
            <text x="64" y="86" textAnchor="middle" fill="#A9C6FF" fontSize="11" fontFamily="Plus Jakarta Sans">
              accuracy
            </text>
          </svg>
        </div>
        <div className="np-hstats" style={{ '--n': 3 } as CSSProperties}>
          <div>
            <b>{Math.round(practicedDisplay ?? 0)}</b>
            <span>of {summary.totalCount} topics practiced</span>
          </div>
          <div>
            <b>{Math.round(attemptsDisplay ?? 0)}</b>
            <span>question attempts</span>
          </div>
          <div>
            <b>{Math.round(weakDisplay ?? 0)}</b>
            <span>weak topics</span>
          </div>
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}

      {readiness.length === 0 ? (
        <section className="np-empty np-fade">
          <b style={{ fontSize: 15 }}>No topics yet</b>
          <span className="np-small">
            Add Board Questions, Flashcards, or Academy topics, then come back here to see your readiness
            breakdown.
          </span>
        </section>
      ) : (
        <>
          <div className="np-grid2">
            <section className="np-card np-fade" style={{ animationDelay: '.12s', gap: 10 }}>
              <div className="np-head">
                <h2>Focus first</h2>
                <span className="np-small">{weakTopics.length} weak topics</span>
              </div>
              {weakTopics.length === 0 ? (
                <span className="np-small">No weak topics right now — keep it up.</span>
              ) : (
                weakTopics.map((r) => (
                  <div key={r.topic} className="bd-weak">
                    <div className="np-head">
                      <b style={{ fontSize: 14 }}>{r.topic}</b>
                      <span className="np-tag" style={{ color: '#B42318', background: '#FDE1DE' }}>
                        Weak
                      </span>
                    </div>
                    <div className="bd-track">
                      <i style={{ width: `${r.masteryPct ?? 0}%` }} />
                    </div>
                    <span className="np-small">
                      {r.questionAttempts > 0
                        ? `${r.questionAccuracyPct}% · ${r.questionAttempts} attempt${r.questionAttempts === 1 ? '' : 's'}`
                        : 'No Board Question attempts yet'}
                    </span>
                  </div>
                ))
              )}
              <Link to="/study" className="np-btn" style={{ marginTop: 4 }}>
                Practice weak topics
              </Link>
            </section>

            <section className="np-card np-fade" style={{ animationDelay: '.18s', gap: 0 }}>
              <div className="np-head" style={{ paddingBottom: 8 }}>
                <h2>Not practiced yet</h2>
                <span className="np-small">{notPracticed.length} topics</span>
              </div>
              {notPracticed.length === 0 ? (
                <span className="np-small">Every tracked topic has at least one attempt.</span>
              ) : (
                notPracticed.map((r) => (
                  <div key={r.topic} className="bd-row">
                    <div className="np-head" dir="rtl">
                      <span className="np-fa" style={{ fontSize: 14, fontWeight: 600 }}>
                        {isolateLatinRuns(r.topic)}
                      </span>
                      <span className="np-tag" dir="ltr" style={{ color: '#52627A', background: '#EEF2F8' }}>
                        Not practiced
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#EEF2F8' }} />
                  </div>
                ))
              )}
            </section>
          </div>

          {practicedOk.length > 0 && (
            <section className="np-card np-fade" style={{ animationDelay: '.24s', gap: 0 }}>
              <div className="np-head" style={{ paddingBottom: 8 }}>
                <h2>Practiced topics</h2>
                <span className="np-small">{practicedOk.length} topics</span>
              </div>
              {practicedOk.map((r) => (
                <div key={r.topic} className="bd-row">
                  <div className="np-head">
                    <b style={{ fontSize: 14 }}>{r.topic}</b>
                    <span className="np-tag" style={{ color: r.status === 'strong' ? '#1A7F4E' : '#93590B', background: r.status === 'strong' ? '#E3F6EC' : '#FDF0DC' }}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: '#EEF2F8', overflow: 'hidden' }}>
                    <div style={{ width: `${r.masteryPct ?? 0}%`, height: '100%', borderRadius: 4, background: BAR_COLOR[r.status] }} />
                  </div>
                  <span className="np-small">
                    {r.questionAttempts > 0
                      ? `${r.questionCorrect}/${r.questionAttempts} correct (${r.questionAccuracyPct}%)`
                      : 'No Board Question attempts yet'}
                    {r.flashcardCount > 0 &&
                      ` · ${r.flashcardCount} flashcard${r.flashcardCount === 1 ? '' : 's'}${
                        r.flashcardConfidencePct != null ? ` (${r.flashcardConfidencePct}% confidence)` : ''
                      }`}
                    {r.cardCount > 0 &&
                      ` · ${r.cardCount} topic card${r.cardCount === 1 ? '' : 's'}${
                        r.cardConfidencePct != null ? ` (${r.cardConfidencePct}% confidence)` : ''
                      }`}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}
