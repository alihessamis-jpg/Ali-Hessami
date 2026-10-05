import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { listFlashcards, updateFlashcardSrs } from '../lib/api/flashcards'
import { listReadingItems, setReadingItemCheckpoint, updateReadingItemSrs } from '../lib/api/readingItems'
import { listDueCheckpoints, listDueLeitnerItems } from '../lib/readingReview'
import { scheduleReview } from '../lib/srs'
import { toShamsi } from '../lib/shamsi'
import { useAuth } from '../context/AuthContext'
import { AcademyIcon, CalendarIcon, FlashcardsIcon, TodayIcon } from '../components/icons'
import type { AcademyTopic, Flashcard, ReadingItem, ReviewCheckpointKey } from '../types/domain'

type Rating = 'easy' | 'moderate' | 'difficult'

export function TodayPage() {
  const { session } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [topicNextReview, setTopicNextReview] = useState<Record<string, string | null>>({})

  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [flashcardShowBack, setFlashcardShowBack] = useState(false)

  const [readingItems, setReadingItems] = useState<ReadingItem[]>([])
  const [leitnerIndex, setLeitnerIndex] = useState(0)
  const [leitnerShowBack, setLeitnerShowBack] = useState(false)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([listAcademyTopics(), listAcademyProgress(session.user.id), listFlashcards(), listReadingItems()])
      .then(([topicRows, progressRows, flashcardRows, readingRows]) => {
        setTopics(topicRows)
        setTopicNextReview(Object.fromEntries(progressRows.map((p) => [p.topicId, p.nextReview])))
        setFlashcards(flashcardRows)
        setReadingItems(readingRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load today’s review'))
      .finally(() => setLoading(false))
  }, [session])

  const today = new Date().toISOString().slice(0, 10)

  const dueTopics = useMemo(
    () => topics.filter((t) => !topicNextReview[t.id] || (topicNextReview[t.id] as string) <= today),
    [topics, topicNextReview, today]
  )
  const dueFlashcards = useMemo(() => flashcards.filter((c) => !c.nextReview || c.nextReview <= today), [flashcards, today])
  const dueLeitnerItems = useMemo(() => listDueLeitnerItems(readingItems, today), [readingItems, today])
  const dueCheckpoints = useMemo(() => listDueCheckpoints(readingItems, today), [readingItems, today])

  const currentFlashcard = dueFlashcards[flashcardIndex % Math.max(dueFlashcards.length, 1)]
  const currentLeitner = dueLeitnerItems[leitnerIndex % Math.max(dueLeitnerItems.length, 1)]

  const totalDue = dueTopics.length + dueFlashcards.length + dueLeitnerItems.length + dueCheckpoints.length

  async function handleRateFlashcard(rating: Rating) {
    if (!currentFlashcard) return
    const next = scheduleReview(currentFlashcard, rating)
    try {
      const updated = await updateFlashcardSrs(currentFlashcard.id, next)
      setFlashcards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setFlashcardShowBack(false)
      setFlashcardIndex((i) => i + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    }
  }

  async function handleRateLeitner(rating: Rating) {
    if (!currentLeitner) return
    const next = scheduleReview(
      {
        intervalIndex: currentLeitner.intervalIndex ?? -1,
        lastReviewed: currentLeitner.lastReviewed ?? null,
        nextReview: currentLeitner.nextReview ?? null,
        reviewHistory: currentLeitner.reviewHistory ?? [],
      },
      rating
    )
    try {
      const updated = await updateReadingItemSrs(currentLeitner.id, next)
      setReadingItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      setLeitnerShowBack(false)
      setLeitnerIndex((i) => i + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    }
  }

  async function handleCompleteCheckpoint(item: ReadingItem, key: ReviewCheckpointKey) {
    try {
      const updated = await setReadingItemCheckpoint(item.id, key, true)
      setReadingItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <TodayIcon />
        </span>
        Today
      </h1>
      <p className="empty-state">
        Everything due for spaced-repetition review, in one place — work through each section instead of hunting
        across Academy, Flashcards, and Reading Review.
      </p>

      {error && <p className="form-error">{error}</p>}

      {totalDue === 0 ? (
        <div className="dash-card">
          <p className="empty-state">Nothing due today — you're all caught up.</p>
        </div>
      ) : (
        <>
          {dueFlashcards.length > 0 && currentFlashcard && (
            <div className="dash-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">
                  <span className="icon-chip">
                    <FlashcardsIcon />
                  </span>
                  Flashcards due ({dueFlashcards.length})
                </h2>
              </div>
              <p style={{ fontSize: '1.1rem' }}>{currentFlashcard.front}</p>
              {flashcardShowBack && <p style={{ color: 'var(--text-muted)' }}>{currentFlashcard.back}</p>}
              {!flashcardShowBack ? (
                <div className="form-actions">
                  <button type="button" onClick={() => setFlashcardShowBack(true)}>
                    Show answer
                  </button>
                </div>
              ) : (
                <div className="form-actions">
                  <button type="button" className="button-secondary" onClick={() => void handleRateFlashcard('difficult')}>
                    Difficult
                  </button>
                  <button type="button" className="button-secondary" onClick={() => void handleRateFlashcard('moderate')}>
                    Moderate
                  </button>
                  <button type="button" onClick={() => void handleRateFlashcard('easy')}>
                    Easy
                  </button>
                </div>
              )}
            </div>
          )}

          {dueLeitnerItems.length > 0 && currentLeitner && (
            <div className="dash-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">
                  <span className="icon-chip">
                    <CalendarIcon />
                  </span>
                  Saved questions due ({dueLeitnerItems.length})
                </h2>
              </div>
              <p className="patient-meta">{currentLeitner.origin}</p>
              <p style={{ fontSize: '1.1rem' }}>{currentLeitner.title}</p>
              {leitnerShowBack && currentLeitner.answer && <p style={{ color: 'var(--text-muted)' }}>{currentLeitner.answer}</p>}
              {!leitnerShowBack ? (
                <div className="form-actions">
                  <button type="button" onClick={() => setLeitnerShowBack(true)}>
                    Show answer
                  </button>
                </div>
              ) : (
                <div className="form-actions">
                  <button type="button" className="button-secondary" onClick={() => void handleRateLeitner('difficult')}>
                    Difficult
                  </button>
                  <button type="button" className="button-secondary" onClick={() => void handleRateLeitner('moderate')}>
                    Moderate
                  </button>
                  <button type="button" onClick={() => void handleRateLeitner('easy')}>
                    Easy
                  </button>
                </div>
              )}
            </div>
          )}

          {dueCheckpoints.length > 0 && (
            <div className="dash-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">
                  <span className="icon-chip">
                    <CalendarIcon />
                  </span>
                  Reading checkpoints due ({dueCheckpoints.length})
                </h2>
              </div>
              <ul className="note-timeline">
                {dueCheckpoints.map(({ item, checkpoint, dueDate }) => (
                  <li key={`${item.id}-${checkpoint.key}`}>
                    <div className="note-header">
                      <strong>{item.title}</strong>
                      <button className="link-button" onClick={() => void handleCompleteCheckpoint(item, checkpoint.key)}>
                        Mark done
                      </button>
                    </div>
                    <p className="patient-meta">
                      {checkpoint.label} checkpoint — due {toShamsi(dueDate)}
                      {item.source ? ` · ${item.source}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dueTopics.length > 0 && (
            <div className="dash-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">
                  <span className="icon-chip">
                    <AcademyIcon />
                  </span>
                  Academy topics due ({dueTopics.length})
                </h2>
              </div>
              <ul className="note-timeline">
                {dueTopics.map((t) => (
                  <li key={t.id}>
                    <div className="note-header">
                      <Link to={`/academy/${t.id}`}>
                        <strong>{t.name}</strong>
                      </Link>
                    </div>
                    <p className="patient-meta">
                      {[t.category, t.summary].filter(Boolean).join(' · ') || 'Open to review and rate yourself'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
