import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  addLibraryChapterFigure,
  ensureLibraryBookSeeded,
  listAllLibraryCards,
  listAllLibraryChapterFigures,
  listAllLibraryChapters,
  listLibraryBooks,
  listReadingLog,
  setLibraryCardFigure,
  updateLibraryCardFsrs,
} from '../lib/api/library'
import { getChapterFigureSignedUrl } from '../lib/storage'
import { isolateLatinRuns } from '../lib/bidiText'
import { getUserSettings } from '../lib/api/settings'
import { addLibraryCardMistake } from '../lib/api/libraryMistakes'
import { computeReadingStreak } from '../lib/libraryNote'
import { DEFAULT_REQUEST_RETENTION, fsrsPreviewAll, isCardMastered, scheduleFsrs, type FsrsPreviewMap } from '../lib/fsrs'
import { shuffle } from '../lib/reviewQueue'
import { HeroScene } from '../components/hero/HeroScene'
import type {
  ClinicalScenarioOptions,
  FsrsRating,
  LibraryBook,
  LibraryCard,
  LibraryChapter,
  McqOptions,
  MistakeReason,
  PatientCaseVignette,
} from '../types/domain'

type PracticeMode = 'chapter' | 'random' | 'mock'

const TYPE_FILTER_OPTIONS: Array<{ kind: LibraryCard['kind']; label: string }> = [
  { kind: 'basic', label: 'Cards' },
  { kind: 'cloze', label: 'Cloze' },
  { kind: 'table_cell', label: 'Tables' },
  { kind: 'mcq', label: 'Board MCQ' },
  { kind: 'patient_case', label: 'Patient cases' },
  { kind: 'clinical_scenario', label: 'Scenarios' },
]

const MISTAKE_REASONS: Array<{ reason: MistakeReason; label: string }> = [
  { reason: 'knowledge_gap', label: "Didn't know it" },
  { reason: 'misread', label: 'Misread the question' },
  { reason: 'confused_similar', label: 'Confused with similar' },
  { reason: 'guessed', label: 'Guessed' },
]

function todayStorageKey() {
  const d = new Date()
  return `nephron-new-cards-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadIntroducedToday(): Set<string> {
  try {
    const raw = localStorage.getItem(todayStorageKey())
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveIntroducedToday(ids: Set<string>) {
  try {
    localStorage.setItem(todayStorageKey(), JSON.stringify([...ids]))
  } catch {
    // per-viewer convenience only -- fine if storage is unavailable
  }
}

const TYPE_LABEL: Record<LibraryCard['kind'], string> = {
  cloze: 'CLOZE',
  table_cell: 'TABLE',
  mcq: 'BOARD MCQ',
  patient_case: 'PATIENT CASE',
  basic: 'CARD',
  clinical_scenario: 'SCENARIO',
}

const TYPE_STYLE: Record<LibraryCard['kind'], { stripe: string; color: string; background: string }> = {
  cloze: { stripe: '#7C5CE0', color: '#5131B5', background: '#ECE6FD' },
  table_cell: { stripe: '#0B6670', color: '#0B6670', background: '#DDF2F3' },
  mcq: { stripe: '#1E5BD8', color: '#1546A8', background: '#E3EDFD' },
  patient_case: { stripe: '#C2410C', color: '#9A3412', background: '#FDEBDD' },
  basic: { stripe: '#5B6B82', color: '#3B4A60', background: '#EEF2F8' },
  clinical_scenario: { stripe: '#17663A', color: '#17663A', background: '#DDF3E6' },
}

function isMcqOptions(o: LibraryCard['options']): o is McqOptions {
  return !!o && 'choices' in o
}
function isVignette(o: LibraryCard['options']): o is PatientCaseVignette {
  return !!o && 'stats' in o
}
function isScenarioOptions(o: LibraryCard['options']): o is ClinicalScenarioOptions {
  return !!o && 'steps' in o
}

function clozeParts(front: string): [string, string] {
  const idx = front.indexOf('_____')
  if (idx < 0) return [front, '']
  return [front.slice(0, idx), front.slice(idx + 5)]
}

export function ReviewPage() {
  const [searchParams] = useSearchParams()
  const chapterScope = searchParams.get('chapter')
  const modeParam = searchParams.get('mode')
  const mode: PracticeMode | null = modeParam === 'chapter' || modeParam === 'random' || modeParam === 'mock' ? modeParam : null
  const isPractice = mode !== null
  const mockCount = Math.max(1, Number(searchParams.get('count')) || 20)
  const mockTimerMinutes = Math.max(1, Number(searchParams.get('timer')) || 15)

  const [allDue, setAllDue] = useState<LibraryCard[]>([])
  const [chapters, setChapters] = useState<LibraryChapter[]>([])
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [figureUrls, setFigureUrls] = useState<Record<string, string>>({})
  const [streak, setStreak] = useState(0)
  const [targetRetention, setTargetRetention] = useState(DEFAULT_REQUEST_RETENTION)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hyOnly, setHyOnly] = useState(false)
  const [bookFilter, setBookFilter] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<LibraryCard['kind'] | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [mcqChoice, setMcqChoice] = useState<number | null>(null)
  const [mcqCorrect, setMcqCorrect] = useState<boolean | null>(null)
  const [grades, setGrades] = useState<Array<{ card: LibraryCard; rating: FsrsRating }>>([])
  const [startedAt] = useState(() => Date.now())
  const [pendingAgain, setPendingAgain] = useState(false)
  const [mockSecondsLeft, setMockSecondsLeft] = useState<number | null>(null)
  const [scenarioStep, setScenarioStep] = useState(0)
  const [scenarioStepAnswerShown, setScenarioStepAnswerShown] = useState(false)
  const [attachingFigure, setAttachingFigure] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listAllLibraryCards(),
      ensureLibraryBookSeeded(),
      listAllLibraryChapters(),
      listLibraryBooks(),
      listReadingLog(),
      getUserSettings(),
      listAllLibraryChapterFigures().catch(() => []),
    ])
      .then(([cardRows, , chapterRows, bookRows, log, settings, figureRows]) => {
        Promise.all(
          figureRows.map(async (f) => [f.figureKey, await getChapterFigureSignedUrl(f.storagePath).catch(() => null)] as const)
        ).then((entries) => setFigureUrls(Object.fromEntries(entries.filter((e): e is [string, string] => e[1] !== null))))
        const now = new Date()
        let approved = cardRows.filter((c) => c.status === 'approved')
        if (chapterScope) approved = approved.filter((c) => c.chapterId === chapterScope)

        if (mode) {
          // Practice modes pull a fixed pool up front, out of band from the
          // daily due/new queue and its introduced-today bookkeeping --
          // grading still updates FSRS so practice still counts toward the
          // schedule, it just isn't gated by what's due today.
          let pool = approved
          if (mode === 'mock') pool = pool.filter((c) => c.kind === 'mcq')
          if (mode === 'chapter') {
            pool = [...pool].sort((a, b) => (a.page ?? Infinity) - (b.page ?? Infinity))
          } else {
            pool = shuffle(pool)
          }
          if (mode === 'mock') pool = pool.slice(0, mockCount)
          setAllDue(pool)
          setChapters(chapterRows)
          setBooks(bookRows)
          setStreak(computeReadingStreak(log))
          setTargetRetention(settings.targetRetention)
          return
        }

        const dueCards = approved.filter((c) => c.reps > 0 && new Date(c.due) <= now)
        dueCards.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
        const limitedDue = settings.dailyReviewLimit > 0 ? dueCards.slice(0, settings.dailyReviewLimit) : dueCards

        const introducedToday = loadIntroducedToday()
        const newPool = approved
          .filter((c) => c.reps === 0)
          .sort((a, b) => {
            if (a.highYield !== b.highYield) return a.highYield ? -1 : 1
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          })

        const alreadyIntroduced = newPool.filter((c) => introducedToday.has(c.id))
        const remainingSlots = Math.max(0, settings.dailyNewCardLimit - alreadyIntroduced.length)
        const freshNew = newPool.filter((c) => !introducedToday.has(c.id)).slice(0, remainingSlots)

        const nextIntroduced = new Set(introducedToday)
        for (const c of freshNew) nextIntroduced.add(c.id)
        saveIntroducedToday(nextIntroduced)

        setAllDue([...limitedDue, ...alreadyIntroduced, ...freshNew])
        setChapters(chapterRows)
        setBooks(bookRows)
        setStreak(computeReadingStreak(log))
        setTargetRetention(settings.targetRetention)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load review queue'))
      .finally(() => setLoading(false))
    // mockCount/mockTimerMinutes are read once per mount via searchParams, not re-read reactively
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterScope, mode])

  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])

  const cards = useMemo(() => {
    if (isPractice) return allDue
    let list = hyOnly ? allDue.filter((c) => c.highYield) : allDue
    if (bookFilter) list = list.filter((c) => chapterById.get(c.chapterId)?.bookId === bookFilter)
    if (typeFilter) list = list.filter((c) => c.kind === typeFilter)
    return list
  }, [allDue, hyOnly, bookFilter, typeFilter, chapterById, isPractice])
  const highYieldDueCount = useMemo(() => allDue.filter((c) => c.highYield).length, [allDue])
  const availableBooks = useMemo(() => {
    const ids = new Set(allDue.map((c) => chapterById.get(c.chapterId)?.bookId).filter((id): id is string => !!id))
    return books.filter((b) => ids.has(b.id))
  }, [allDue, chapterById, books])
  const availableKinds = useMemo(() => new Set(allDue.map((c) => c.kind)), [allDue])

  useEffect(() => {
    setIndex(0)
  }, [hyOnly, bookFilter, typeFilter])

  useEffect(() => {
    if (mode !== 'mock' || allDue.length === 0) return
    setMockSecondsLeft(mockTimerMinutes * 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, allDue.length])

  useEffect(() => {
    if (mockSecondsLeft === null || index >= cards.length) return
    if (mockSecondsLeft <= 0) {
      setIndex(cards.length)
      return
    }
    const t = setTimeout(() => setMockSecondsLeft((s) => (s !== null ? s - 1 : s)), 1000)
    return () => clearTimeout(t)
  }, [mockSecondsLeft, cards.length, index])

  const current = cards[index]
  const preview: FsrsPreviewMap | null = current ? fsrsPreviewAll(current, new Date(), targetRetention) : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return
      if (current.kind === 'mcq') {
        if (e.code === 'Space' && mcqChoice != null) {
          e.preventDefault()
          if (mcqCorrect) void handleGrade('good')
          else setPendingAgain(true)
        }
        return
      }
      if (current.kind === 'clinical_scenario' && isScenarioOptions(current.options) && !revealed) {
        if (e.code === 'Space') {
          e.preventDefault()
          handleScenarioStepAdvance(current.options.steps.length)
        }
        return
      }
      if (e.code === 'Space' && !revealed) {
        e.preventDefault()
        setRevealed(true)
      } else if (/^[1-4]$/.test(e.key) && revealed && !pendingAgain) {
        if (e.key === '1') {
          setPendingAgain(true)
          return
        }
        const ratings: FsrsRating[] = ['again', 'hard', 'good', 'easy']
        void handleGrade(ratings[Number(e.key) - 1])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, revealed, mcqChoice, mcqCorrect, pendingAgain, scenarioStep, scenarioStepAnswerShown])

  async function handleGrade(rating: FsrsRating, mistakeReason?: MistakeReason) {
    if (!current) return
    const { next } = scheduleFsrs(current, rating, new Date(), targetRetention)
    try {
      await updateLibraryCardFsrs(current.id, next)
    } catch {
      // keep the session moving even if persistence fails
    }
    if (rating === 'again' && mistakeReason) {
      try {
        await addLibraryCardMistake(current.id, current.chapterId, mistakeReason)
      } catch {
        // tagging the reason is a bonus -- never block the session on it
      }
    }
    setGrades((prev) => [...prev, { card: { ...current, ...next }, rating }])
    setRevealed(false)
    setMcqChoice(null)
    setMcqCorrect(null)
    setPendingAgain(false)
    setScenarioStep(0)
    setScenarioStepAnswerShown(false)
    setIndex((i) => i + 1)
  }

  // Lets a card missing its figure (e.g. a board-MCQ whose source options
  // were images) get one attached from inside the review session, reusing
  // the same chapter-figures upload the Reader uses for book figures.
  async function handleAttachFigure(card: LibraryCard, chapterNumber: number, file: File) {
    const figureKey = card.boardQuestionId ? `board-q-${card.boardQuestionId}` : `card-${card.id}`
    setAttachingFigure(true)
    try {
      const figure = await addLibraryChapterFigure(card.chapterId, chapterNumber, figureKey, null, file)
      await setLibraryCardFigure(card.id, figureKey)
      const url = await getChapterFigureSignedUrl(figure.storagePath).catch(() => null)
      if (url) setFigureUrls((prev) => ({ ...prev, [figureKey]: url }))
      setAllDue((prev) => prev.map((c) => (c.id === card.id ? { ...c, figureKey } : c)))
    } catch {
      // best-effort -- the attach button stays visible so the user can retry
    } finally {
      setAttachingFigure(false)
    }
  }

  // Clinical scenarios reveal their steps one at a time; once the last
  // step's answer is shown, fall through to the normal grade controls.
  function handleScenarioStepAdvance(totalSteps: number) {
    if (!scenarioStepAnswerShown) {
      setScenarioStepAnswerShown(true)
      return
    }
    if (scenarioStep + 1 >= totalSteps) {
      setRevealed(true)
    } else {
      setScenarioStep((s) => s + 1)
      setScenarioStepAnswerShown(false)
    }
  }

  // v1.2: tapping an option reveals right/wrong + the explanation; the
  // FSRS grade is decided by correctness alone (good/again), not a manual
  // 4-way choice -- the reveal still waits for "Continue" so the reader can
  // read the explanation before the card advances.
  function handleMcqPick(choiceIndex: number, correct: boolean) {
    setMcqChoice(choiceIndex)
    setMcqCorrect(correct)
    setRevealed(true)
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  if (cards.length === 0) {
    return (
      <div className="np-page">
        <div className="rv">
          <div className="rtop">
            <Link className="x" to="/academy" aria-label="Back to Library">
              ×
            </Link>
          </div>
          <div className="np-card np-fade">
            <p className="empty-state">
              {isPractice
                ? 'No cards match this practice session.'
                : hyOnly || bookFilter || typeFilter
                  ? 'No cards match this filter right now.'
                  : 'Nothing due right now — nice work.'}
            </p>
            {!isPractice && (hyOnly || bookFilter || typeFilter) && allDue.length > 0 ? (
              <button
                type="button"
                className="np-btn ghost"
                onClick={() => {
                  setHyOnly(false)
                  setBookFilter(null)
                  setTypeFilter(null)
                }}
              >
                Show all due cards ({allDue.length})
              </button>
            ) : (
              <Link className="np-btn" to={isPractice ? '/academy/practice' : '/academy'}>
                {isPractice ? 'Back to Practice' : 'Back to Library'}
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (index >= cards.length) {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
    const counts: Record<FsrsRating, number> = { again: 0, hard: 0, good: 0, easy: 0 }
    for (const g of grades) counts[g.rating]++
    const recallPct = grades.length > 0 ? Math.round(((counts.good + counts.easy) / grades.length) * 100) : 0
    const newlyMastered = grades.filter((g) => isCardMastered(g.card)).length
    const missed = grades.filter((g) => g.rating === 'again')
    const total = grades.length || 1
    const dist = [
      { key: 'Again', count: counts.again, color: '#F08A80' },
      { key: 'Hard', count: counts.hard, color: '#F5C26B' },
      { key: 'Good', count: counts.good, color: '#7FA8F0' },
      { key: 'Easy', count: counts.easy, color: '#7CCB9D' },
    ]
    return (
      <div className="np-page">
        <div className="rv">
          <section className="sum np-fade">
            <HeroScene scene="channels" page="review" className="hero-scene" />
            <div className="hero-scrim" />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="eyebrow" style={{ color: '#B9A6F5' }}>
                {mode === 'mock' ? 'MOCK EXAM COMPLETE' : 'SESSION COMPLETE'}
              </span>
              <h1 style={{ fontSize: 26 }}>
                {grades.length} cards · {minutes} min
              </h1>
            </div>
            <div className="sgrid">
              <div>
                <b>{recallPct}%</b>
                <span>{mode === 'mock' ? 'score' : 'recall'}</span>
              </div>
              <div>
                <b style={{ color: '#9ED9B6' }}>+{newlyMastered}</b>
                <span>to Mastered</span>
              </div>
              <div>
                <b style={{ color: '#FFC46B' }}>{streak}</b>
                <span>streak days</span>
              </div>
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="dist" aria-label={dist.map((d) => `${d.key} ${d.count}`).join(', ')}>
                {dist.map((d) => (
                  <i key={d.key} style={{ width: `${(d.count / total) * 100}%`, background: d.color }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#A9C6FF' }}>
                {dist.map((d) => (
                  <span key={d.key}>
                    {d.key} {d.count}
                  </span>
                ))}
              </div>
            </div>
            {missed.length > 0 && (
              <div className="weak">
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: '#A9C6FF' }}>MISSED — REREAD THE SOURCE</span>
                {missed.map((g) => {
                  const chapter = chapterById.get(g.card.chapterId)
                  return (
                    <Link key={g.card.id} to={`/academy/reader/${g.card.chapterId}${g.card.sectionNumber ? `#s${g.card.sectionNumber}` : ''}`}>
                      <span style={{ flex: 1 }}>
                        {chapter ? `Ch ${chapter.chapterNumber}` : ''} {g.card.sectionNumber ? `§ ${g.card.sectionNumber}` : ''} ·{' '}
                        {isolateLatinRuns(g.card.front.slice(0, 40))}
                      </span>
                      <span style={{ color: '#A9C6FF' }}>{g.card.page ? `p. ${g.card.page}` : ''}</span>
                    </Link>
                  )
                })}
              </div>
            )}
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
              <Link className="np-btn white" to="/academy">
                Back to Library
              </Link>
              {isPractice ? (
                <Link className="np-btn glass" to="/academy/practice">
                  Practice again
                </Link>
              ) : (
                chapterScope && (
                  <Link className="np-btn glass" to={`/academy/reader/${chapterScope}`}>
                    Continue reading
                  </Link>
                )
              )}
            </div>
          </section>
        </div>
      </div>
    )
  }

  const chapter = chapterById.get(current.chapterId)
  const style = TYPE_STYLE[current.kind]
  const [before, after] = current.kind === 'cloze' ? clozeParts(current.front) : ['', '']
  const activeFilterCount = (bookFilter ? 1 : 0) + (typeFilter ? 1 : 0)
  const scenarioOptions = current.kind === 'clinical_scenario' && isScenarioOptions(current.options) ? current.options : null

  return (
    <div className="np-page">
      <div className="rv">
        <div className="rtop np-fade">
          <Link className="x" to="/academy" aria-label="End session">
            ×
          </Link>
          <div className="rbar" aria-label="Progress">
            <i style={{ width: `${(index / cards.length) * 100}%` }} />
          </div>
          <span className="rcount">
            {index + 1} / {cards.length}
          </span>
          {mode === 'mock' && mockSecondsLeft !== null && (
            <span
              className="np-pill"
              style={{
                color: mockSecondsLeft <= 60 ? '#B3261E' : '#5B6B82',
                background: mockSecondsLeft <= 60 ? '#FBE3E1' : 'rgba(255,255,255,.12)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ⏱ {String(Math.floor(mockSecondsLeft / 60)).padStart(2, '0')}:{String(mockSecondsLeft % 60).padStart(2, '0')}
            </span>
          )}
          {!isPractice && (
            <button
              type="button"
              className="np-pill"
              style={{
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: activeFilterCount > 0 ? '#93590B' : '#5B6B82',
                background: activeFilterCount > 0 ? '#FDF0D5' : 'rgba(255,255,255,.12)',
              }}
              onClick={() => setFilterOpen(true)}
              title="Filter by book or type"
            >
              ⚙︎ Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
          )}
          {!isPractice && highYieldDueCount > 0 && (
            <button
              type="button"
              className="np-pill"
              style={{
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: hyOnly ? '#93590B' : '#5B6B82',
                background: hyOnly ? '#FDF0D5' : 'rgba(255,255,255,.12)',
              }}
              onClick={() => setHyOnly((v) => !v)}
              title="High-yield only"
            >
              ⭐ High-yield only
            </button>
          )}
        </div>

        <AnimatePresence>
          {filterOpen && (
            <>
              <motion.div
                className="more-sheet-backdrop"
                onClick={() => setFilterOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
              <motion.div
                className="more-sheet"
                role="dialog"
                aria-label="Filter review queue"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              >
                <div className="more-sheet-handle" />
                {availableBooks.length > 1 && (
                  <>
                    <h2 className="more-sheet-group-heading">Book</h2>
                    <div className="chapter-parts">
                      <button type="button" className={bookFilter === null ? 'on' : ''} onClick={() => setBookFilter(null)}>
                        All books
                      </button>
                      {availableBooks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={bookFilter === b.id ? 'on' : ''}
                          onClick={() => setBookFilter(b.id)}
                        >
                          {b.title}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <h2 className="more-sheet-group-heading">Type</h2>
                <div className="chapter-parts">
                  <button type="button" className={typeFilter === null ? 'on' : ''} onClick={() => setTypeFilter(null)}>
                    All types
                  </button>
                  {TYPE_FILTER_OPTIONS.filter((t) => availableKinds.has(t.kind)).map((t) => (
                    <button
                      key={t.kind}
                      type="button"
                      className={typeFilter === t.kind ? 'on' : ''}
                      onClick={() => setTypeFilter(t.kind)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="more-sheet-footer">
                  <button type="button" className="np-btn" onClick={() => setFilterOpen(false)}>
                    Done
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="stage">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              className={revealed ? 'cardx on revealed' : 'cardx on'}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            >
            <div className="face" style={{ '--stripe': style.stripe } as React.CSSProperties}>
              <div className="src">
                <span className="chip2">
                  {chapter ? `Ch ${chapter.chapterNumber}` : 'Chapter'} {current.sectionNumber ? `· § ${current.sectionNumber}` : ''}{' '}
                  {current.page ? `· p. ${current.page}` : ''}
                </span>
                <span className="typ" style={{ color: style.color, background: style.background }}>
                  {TYPE_LABEL[current.kind]}
                </span>
              </div>

              {current.kind === 'patient_case' && isVignette(current.options) && (
                <div className="vig" dir="ltr">
                  {current.options.stats.map((s) => (
                    <div key={s.label}>
                      <span>{s.label}</span>
                      <b className={s.flag === 'hi' ? 'hi' : s.flag === 'lo' ? 'lo' : ''}>{s.value}</b>
                    </div>
                  ))}
                </div>
              )}

              {current.kind === 'mcq' && isMcqOptions(current.options) ? (
                <>
                  <p className="q" dir="rtl">
                    {isolateLatinRuns(current.front)}
                  </p>
                  {current.figureKey && figureUrls[current.figureKey] && (
                    <img className="cardfig" src={figureUrls[current.figureKey]} alt="" />
                  )}
                  {!current.figureKey && chapter && (
                    <label className="attach-fig">
                      {attachingFigure ? 'در حال آپلود...' : 'افزودن تصویر سوال'}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={attachingFigure}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          e.target.value = ''
                          if (file) void handleAttachFigure(current, chapter.chapterNumber, file)
                        }}
                      />
                    </label>
                  )}
                  <div className="opts" dir="rtl">
                    {current.options.choices.map((choice, i) => {
                      const cls =
                        mcqChoice == null
                          ? 'opt'
                          : choice.correct
                            ? 'opt right'
                            : i === mcqChoice
                              ? 'opt wrong'
                              : 'opt dim'
                      return (
                        <button key={i} className={cls} disabled={mcqChoice != null} onClick={() => handleMcqPick(i, choice.correct)}>
                          <span className="k">{choice.label}</span>
                          <span className="tx">{isolateLatinRuns(choice.text)}</span>
                        </button>
                      )
                    })}
                  </div>
                  {revealed && current.options.explanation && (
                    <div className="expl on" dir="rtl">
                      <span className="h">EXPLANATION</span>
                      {isolateLatinRuns(current.options.explanation)}
                    </div>
                  )}
                </>
              ) : scenarioOptions ? (
                <>
                  <p className="q" dir="rtl">
                    {isolateLatinRuns(current.front)}
                  </p>
                  {scenarioOptions.steps.slice(0, scenarioStep + 1).map((step, i) => (
                    <div className="scenario-step" key={i}>
                      <span className="h">{step.label.toUpperCase()}</span>
                      <p className="q" dir="rtl" style={{ fontSize: 15.5 }}>
                        {isolateLatinRuns(step.question)}
                      </p>
                      {(i < scenarioStep || scenarioStepAnswerShown) && (
                        <p className="ctx" dir="rtl">
                          {isolateLatinRuns(step.answer)}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <p className="q" dir="rtl">
                    {current.kind === 'cloze' ? (
                      <>
                        {isolateLatinRuns(before)}
                        <span className="blank">{isolateLatinRuns(current.back)}</span>
                        {isolateLatinRuns(after)}
                      </>
                    ) : (
                      isolateLatinRuns(current.front)
                    )}
                  </p>
                  {current.kind !== 'cloze' && revealed && (
                    <p className="ctx" dir="rtl">
                      {isolateLatinRuns(current.back)}
                    </p>
                  )}
                  {revealed && current.figureKey && figureUrls[current.figureKey] && (
                    <img className="cardfig" src={figureUrls[current.figureKey]} alt="" />
                  )}
                </>
              )}
            </div>

            {current.kind === 'mcq' && mcqChoice != null && mcqCorrect === false ? (
              <motion.div
                className="mistake-reasons on"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <span className="np-small">Why did you miss this?</span>
                <div className="chapter-parts">
                  {MISTAKE_REASONS.map((r) => (
                    <button key={r.reason} type="button" onClick={() => void handleGrade('again', r.reason)}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="np-btn ghost sm" onClick={() => void handleGrade('again')}>
                  Skip
                </button>
              </motion.div>
            ) : current.kind === 'mcq' ? (
              mcqChoice != null && (
                <button className="reveal" onClick={() => void handleGrade('good')}>
                  Continue <kbd>Space</kbd>
                </button>
              )
            ) : scenarioOptions && !revealed ? (
              <button className="reveal" onClick={() => handleScenarioStepAdvance(scenarioOptions.steps.length)}>
                {!scenarioStepAnswerShown
                  ? 'Show answer'
                  : scenarioStep + 1 >= scenarioOptions.steps.length
                    ? 'Finish'
                    : 'Next step'}
              </button>
            ) : !revealed ? (
              <button className="reveal" onClick={() => setRevealed(true)}>
                Show answer <kbd>Space</kbd>
              </button>
            ) : pendingAgain ? (
              <motion.div
                className="mistake-reasons on"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <span className="np-small">Why did you miss this?</span>
                <div className="chapter-parts">
                  {MISTAKE_REASONS.map((r) => (
                    <button key={r.reason} type="button" onClick={() => void handleGrade('again', r.reason)}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="np-btn ghost sm" onClick={() => void handleGrade('again')}>
                  Skip
                </button>
              </motion.div>
            ) : (
              <motion.div
                className="grade on"
                initial={{ opacity: 0, y: 10, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                {(['again', 'hard', 'good', 'easy'] as FsrsRating[]).map((r, i) => (
                  <button
                    key={r}
                    className={`g${i + 1}`}
                    onClick={() => (r === 'again' ? setPendingAgain(true) : void handleGrade(r))}
                  >
                    <b>{r[0].toUpperCase() + r.slice(1)}</b>
                    <span>{preview?.[r].label}</span>
                  </button>
                ))}
              </motion.div>
            )}
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="hint">Keyboard: Space = show · 1 Again · 2 Hard · 3 Good · 4 Easy.</p>
      </div>
    </div>
  )
}
