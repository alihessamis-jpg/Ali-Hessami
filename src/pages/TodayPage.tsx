import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { listAllAcademyCards, updateAcademyCardSrs } from '../lib/api/academyCards'
import { listFlashcards, updateFlashcardSrs } from '../lib/api/flashcards'
import { listAllLibraryCards, listReadingLog } from '../lib/api/library'
import { listReadingItems, setReadingItemCheckpoint, updateReadingItemSrs } from '../lib/api/readingItems'
import { listDueCheckpoints, listDueLeitnerItems } from '../lib/readingReview'
import { getUserSettings } from '../lib/api/settings'
import { scheduleReview } from '../lib/srs'
import { toShamsi } from '../lib/shamsi'
import { useAuth } from '../context/AuthContext'
import { AcademyIcon, BookIcon, CalendarIcon, FlashcardsIcon } from '../components/icons'
import { EmptyState } from '../components/illustrations/EmptyState'
import type { AcademyCard, AcademyTopic, Flashcard, LibraryCard, ReadingItem, ReviewCheckpointKey } from '../types/domain'

type Rating = 'easy' | 'moderate' | 'difficult'

// The design's 4-point Again/Hard/Good/Easy grading maps onto the app's
// existing 3-tier scheduler (scheduleReview in lib/srs.ts): Again and Hard
// both reset the interval (not yet solid), Good advances one step, Easy
// advances two.
const GRADE_TO_RATING: Record<'again' | 'hard' | 'good' | 'easy', Rating> = {
  again: 'difficult',
  hard: 'difficult',
  good: 'moderate',
  easy: 'easy',
}

function DueReviewCard({
  icon,
  title,
  pillText,
  meta,
  question,
  answer,
  showBack,
  onShowBack,
  onGrade,
  animationDelay,
}: {
  icon: ReactNode
  title: string
  pillText: string
  meta?: string | null
  question: string
  answer: string | null | undefined
  showBack: boolean
  onShowBack: () => void
  onGrade: (rating: Rating) => void
  animationDelay: string
}) {
  return (
    <div className="np-card np-fade" style={{ animationDelay }}>
      <div className="np-head">
        <div className="np-head-l">
          <span className="np-ic">{icon}</span>
          <h2>{title}</h2>
        </div>
        <span className="np-pill" style={{ color: '#1E5BD8', background: '#E3EDFD' }}>
          {pillText}
        </span>
      </div>
      {meta && <p className="td-meta">{meta}</p>}
      <div className="td-flipwrap">
        <div className={showBack ? 'td-flip on' : 'td-flip'}>
          <div className="td-face td-front" dir="rtl">
            <span className="np-small">سؤال</span>
            <p className="td-q">{question}</p>
            <span className="np-small">&nbsp;</span>
          </div>
          <div className="td-face td-back" dir="rtl">
            <span className="np-small">پاسخ</span>
            <p className="td-q">{answer || '—'}</p>
          </div>
        </div>
      </div>
      {!showBack ? (
        <button type="button" className="td-btn" onClick={onShowBack}>
          Show answer
        </button>
      ) : (
        <div className="td-grades">
          <button type="button" className="td-grade-again" onClick={() => onGrade(GRADE_TO_RATING.again)}>
            Again
          </button>
          <button type="button" className="td-grade-hard" onClick={() => onGrade(GRADE_TO_RATING.hard)}>
            Hard
          </button>
          <button type="button" className="td-grade-good" onClick={() => onGrade(GRADE_TO_RATING.good)}>
            Good
          </button>
          <button type="button" className="td-grade-easy" onClick={() => onGrade(GRADE_TO_RATING.easy)}>
            Easy
          </button>
        </div>
      )}
    </div>
  )
}

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

  const [academyCards, setAcademyCards] = useState<AcademyCard[]>([])
  const [cardIndex, setCardIndex] = useState(0)
  const [cardShowBack, setCardShowBack] = useState(false)

  const [libraryCards, setLibraryCards] = useState<LibraryCard[]>([])
  const [todayPages, setTodayPages] = useState(0)
  const [pagesGoal, setPagesGoal] = useState(20)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([
      listAcademyTopics(),
      listAcademyProgress(session.user.id),
      listFlashcards(),
      listReadingItems(),
      listAllAcademyCards(),
      listAllLibraryCards(),
      listReadingLog(),
      getUserSettings(),
    ])
      .then(([topicRows, progressRows, flashcardRows, readingRows, cardRows, libraryCardRows, log, settings]) => {
        setTopics(topicRows)
        setTopicNextReview(Object.fromEntries(progressRows.map((p) => [p.topicId, p.nextReview])))
        setFlashcards(flashcardRows)
        setReadingItems(readingRows)
        setAcademyCards(cardRows)
        setLibraryCards(libraryCardRows)
        const todayStr = new Date().toISOString().slice(0, 10)
        setTodayPages(log.find((l) => l.logDate === todayStr)?.pagesRead ?? 0)
        setPagesGoal(settings.readingDailyGoal)
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
  const dueAcademyCards = useMemo(
    () => academyCards.filter((c) => !c.nextReview || c.nextReview <= today),
    [academyCards, today]
  )
  const dueLibraryCards = useMemo(() => libraryCards.filter((c) => new Date(c.due).getTime() <= Date.now()), [libraryCards])

  const currentFlashcard = dueFlashcards[flashcardIndex % Math.max(dueFlashcards.length, 1)]
  const currentLeitner = dueLeitnerItems[leitnerIndex % Math.max(dueLeitnerItems.length, 1)]
  const currentCard = dueAcademyCards[cardIndex % Math.max(dueAcademyCards.length, 1)]

  const totalDue =
    dueTopics.length +
    dueFlashcards.length +
    dueLeitnerItems.length +
    dueCheckpoints.length +
    dueAcademyCards.length +
    dueLibraryCards.length

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

  async function handleRateCard(rating: Rating) {
    if (!currentCard) return
    const next = scheduleReview(currentCard, rating)
    try {
      const updated = await updateAcademyCardSrs(currentCard.id, next)
      setAcademyCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setCardShowBack(false)
      setCardIndex((i) => i + 1)
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
    <div className="np-page">
      <section className="td-hero np-fade">
        <div className="td-hero-glow" />
        <div className="td-hero-body">
          <span className="td-eyebrow">TODAY</span>
          <h1>Review queue</h1>
          <p>Everything due for spaced repetition, in one place.</p>
        </div>
        <svg width="112" height="112" viewBox="0 0 112 112" fill="none" aria-hidden="true" style={{ position: 'relative', flexShrink: 0 }}>
          <circle cx="56" cy="56" r="48" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
          <circle
            cx="56"
            cy="56"
            r="48"
            stroke="#FFC46B"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray="302"
            strokeDashoffset="60"
            transform="rotate(-90 56 56)"
            style={{ animation: 'td-ring 1.4s cubic-bezier(.2,.8,.2,1) both' }}
          />
          <g className="td-ring-dots">
            <circle cx="56" cy="20" r="3" fill="#FFE2B0" />
            <circle cx="92" cy="56" r="2" fill="#FFE2B0" />
            <circle cx="20" cy="56" r="2" fill="#FFE2B0" />
          </g>
          <text x="56" y="56" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="800" fontFamily="Plus Jakarta Sans">
            {totalDue}
          </text>
          <text x="56" y="73" textAnchor="middle" fill="#A9C6FF" fontSize="10" fontFamily="Plus Jakarta Sans">
            items due
          </text>
        </svg>
      </section>

      {error && <p className="form-error">{error}</p>}

      {totalDue === 0 ? (
        <div className="np-card np-fade">
          <EmptyState>Nothing due today — you're all caught up.</EmptyState>
        </div>
      ) : (
        <div className="td-cols">
          {dueFlashcards.length > 0 && currentFlashcard && (
            <DueReviewCard
              icon={<FlashcardsIcon />}
              title="Flashcards due"
              pillText={`${(flashcardIndex % dueFlashcards.length) + 1} / ${dueFlashcards.length}`}
              question={currentFlashcard.front}
              answer={currentFlashcard.back}
              showBack={flashcardShowBack}
              onShowBack={() => setFlashcardShowBack(true)}
              onGrade={(rating) => void handleRateFlashcard(rating)}
              animationDelay="0.1s"
            />
          )}

          {dueAcademyCards.length > 0 && currentCard && (
            <DueReviewCard
              icon={<AcademyIcon />}
              title="Topic cards due"
              pillText={`${(cardIndex % dueAcademyCards.length) + 1} / ${dueAcademyCards.length}`}
              meta={currentCard.kind === 'cell' ? 'Table card' : 'Cloze card'}
              question={currentCard.prompt}
              answer={currentCard.answer}
              showBack={cardShowBack}
              onShowBack={() => setCardShowBack(true)}
              onGrade={(rating) => void handleRateCard(rating)}
              animationDelay="0.15s"
            />
          )}

          {dueLeitnerItems.length > 0 && currentLeitner && (
            <DueReviewCard
              icon={<CalendarIcon />}
              title="Saved questions due"
              pillText={`${(leitnerIndex % dueLeitnerItems.length) + 1} / ${dueLeitnerItems.length}`}
              meta={currentLeitner.origin}
              question={currentLeitner.title}
              answer={currentLeitner.answer}
              showBack={leitnerShowBack}
              onShowBack={() => setLeitnerShowBack(true)}
              onGrade={(rating) => void handleRateLeitner(rating)}
              animationDelay="0.2s"
            />
          )}

          {dueCheckpoints.length > 0 && (
            <div className="np-card np-fade" style={{ animationDelay: '0.26s' }}>
              <div className="np-head">
                <div className="np-head-l">
                  <span className="np-ic">
                    <CalendarIcon />
                  </span>
                  <h2>Reading checkpoints due</h2>
                </div>
                <span className="np-pill" style={{ color: '#1E5BD8', background: '#E3EDFD' }}>
                  {dueCheckpoints.length}
                </span>
              </div>
              {dueCheckpoints.map(({ item, checkpoint, dueDate }) => (
                <div className="td-row" key={`${item.id}-${checkpoint.key}`}>
                  <span className="td-dot" style={{ background: '#1E5BD8' }} />
                  <b>
                    {item.title} — {checkpoint.label} · {toShamsi(dueDate)}
                  </b>
                  <button
                    type="button"
                    className="td-row-action"
                    onClick={() => void handleCompleteCheckpoint(item, checkpoint.key)}
                  >
                    Mark done
                  </button>
                </div>
              ))}
            </div>
          )}

          {dueTopics.length > 0 && (
            <div className="np-card np-fade" style={{ animationDelay: '0.32s' }}>
              <div className="np-head">
                <div className="np-head-l">
                  <span className="np-ic">
                    <AcademyIcon />
                  </span>
                  <h2>Academy topics due</h2>
                </div>
                <span className="np-pill" style={{ color: '#93590B', background: '#FDF0DC' }}>
                  {dueTopics.length}
                </span>
              </div>
              {dueTopics.slice(0, 3).map((t) => (
                <Link key={t.id} to={`/academy/${t.id}`} className="td-row">
                  <span className="td-dot" />
                  <b>{t.name}</b>
                  <span className="np-small">{t.category}</span>
                </Link>
              ))}
              <Link to="/academy/topics" className="td-outline">
                {dueTopics.length > 3 ? `Start review · ${dueTopics.length - 3} more` : 'Start review'}
              </Link>
            </div>
          )}

          {(dueLibraryCards.length > 0 || todayPages > 0) && (
            <div className="np-card np-fade" style={{ animationDelay: '0.36s' }}>
              <div className="np-head">
                <div className="np-head-l">
                  <span className="np-ic">
                    <BookIcon />
                  </span>
                  <h2>Academy</h2>
                </div>
                <span className="np-pill" style={{ color: '#5131B5', background: '#ECE6FD' }}>
                  {dueLibraryCards.length}
                </span>
              </div>
              <div className="td-row">
                <span className="td-dot" />
                <b>{dueLibraryCards.length} book cards due</b>
                <span className="np-small">FSRS review</span>
              </div>
              <div className="td-row">
                <span className="td-dot" style={{ background: '#0B6670' }} />
                <b>
                  {todayPages} / {pagesGoal} pages today
                </b>
              </div>
              <Link to="/academy/review" className="td-outline">
                {dueLibraryCards.length > 0 ? 'Review due cards' : 'Keep reading'}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
