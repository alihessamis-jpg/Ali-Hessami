import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ensureLibraryBookSeeded,
  listAllLibraryCards,
  listLibraryBooks,
  listLibraryChapters,
  listReadingLog,
} from '../lib/api/library'
import { listAcademyCardsForTopic } from '../lib/api/academyCards'
import { listAcademyTopics } from '../lib/api/academy'
import { listBoardQuestions } from '../lib/api/boardQuestions'
import { listBoardQuestionAttempts } from '../lib/api/boardQuestionAttempts'
import { getUserSettings, updateUserSettings } from '../lib/api/settings'
import { computeReadingStreak } from '../lib/libraryNote'
import { cacheLibrarySnapshot, getCachedLibrarySnapshot } from '../lib/offlineCache'
import { AcademyIcon, BookIcon, QuizIcon, SearchIcon, UploadIcon } from '../components/icons'
import { QuestionImportPanel } from '../components/library/QuestionImportPanel'
import { BulkCardImportPanel } from '../components/library/BulkCardImportPanel'
import { BookSwitcher, type LibraryBookStats } from '../components/library/BookSwitcher'
import type { AcademyTopic, BoardQuestion, BoardQuestionAttempt, LibraryBook, LibraryCard, LibraryChapter, ReadingLogEntry } from '../types/domain'

type LibraryTab = 'book' | 'topics'

const LAST_BOOK_KEY = 'np-library-last-book-id'

const STATUS_LABEL: Record<LibraryChapter['status'], string> = {
  unread: 'Unread',
  reading: 'Reading',
  read: 'Read',
  carded: 'Carded',
  mastered: 'Mastered',
}

const STATUS_COLORS: Record<LibraryChapter['status'], { color: string; background: string }> = {
  unread: { color: '#5B6B82', background: '#EEF2F8' },
  reading: { color: '#1546A8', background: '#E3EDFD' },
  read: { color: '#0B6670', background: '#DDF2F3' },
  carded: { color: '#5131B5', background: '#ECE6FD' },
  mastered: { color: '#17663A', background: '#DDF3E6' },
}

function effectivePct(chapter: LibraryChapter): number {
  if (chapter.status === 'unread') return 0
  if (chapter.status === 'reading') return chapter.readingPct
  return 100
}

export function LibraryPage() {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [chaptersByBookId, setChaptersByBookId] = useState<Record<string, LibraryChapter[]>>({})
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [questions, setQuestions] = useState<BoardQuestion[]>([])
  const [questionAttempts, setQuestionAttempts] = useState<BoardQuestionAttempt[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [topicCardCounts, setTopicCardCounts] = useState<Record<string, { total: number; due: number }>>({})
  const [dailyGoal, setDailyGoal] = useState(10)
  const [goalSheetOpen, setGoalSheetOpen] = useState(false)
  const [goalDraft, setGoalDraft] = useState('10')
  const [todayPages, setTodayPages] = useState(0)
  const [streak, setStreak] = useState(0)
  const [tab, setTab] = useState<LibraryTab>('book')
  const [search, setSearch] = useState('')
  const [openParts, setOpenParts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [bookUnavailable, setBookUnavailable] = useState(false)
  const [offlineFallback, setOfflineFallback] = useState(false)

  useEffect(() => {
    setLoading(true)

    const topicsPromise = listAcademyTopics()
      .then(async (topicRows) => {
        const counts: Record<string, { total: number; due: number }> = {}
        const now = new Date()
        await Promise.all(
          topicRows.map(async (t) => {
            const topicCards = await listAcademyCardsForTopic(t.id)
            counts[t.id] = {
              total: topicCards.length,
              due: topicCards.filter((c) => !c.nextReview || new Date(c.nextReview) <= now).length,
            }
          })
        )
        return { topicRows, counts }
      })
      .catch((err) => {
        console.error('Academy topics failed to load', err)
        return { topicRows: [] as AcademyTopic[], counts: {} as Record<string, { total: number; due: number }> }
      })

    // The bundled textbook (book #1) is seeded/ensured as before; any other
    // books the user has added (e.g. a second handbook, chapters added by
    // hand) are just listed and their chapters fetched alongside it, so the
    // page can offer a book switcher instead of assuming a single book.
    const bookPromise = Promise.all([ensureLibraryBookSeeded(), listAllLibraryCards(), listReadingLog(), listLibraryBooks()])
      .then(async ([seeded, cardRows, log, allBooks]) => {
        void cacheLibrarySnapshot(seeded.book, seeded.chapters)
        const chaptersByBookId: Record<string, LibraryChapter[]> = { [seeded.book.id]: seeded.chapters }
        const otherBooks = allBooks.filter((b) => b.id !== seeded.book.id)
        const otherChapters = await Promise.all(otherBooks.map((b) => listLibraryChapters(b.id).catch(() => [] as LibraryChapter[])))
        otherBooks.forEach((b, i) => {
          chaptersByBookId[b.id] = otherChapters[i]
        })
        const books = allBooks.length > 0 ? allBooks : [seeded.book]
        let selectedBookId = seeded.book.id
        try {
          const saved = window.localStorage.getItem(LAST_BOOK_KEY)
          if (saved && books.some((b) => b.id === saved)) selectedBookId = saved
        } catch {
          // ignore storage errors
        }
        return { ok: true as const, books, chaptersByBookId, selectedBookId, cardRows, log, offline: false }
      })
      .catch(async (err) => {
        console.error('Academy v2 (Library) data failed to load', err)
        // Offline (or Supabase unreachable): fall back to whatever the last
        // successful load cached, so the chapter list still shows instead
        // of silently dropping to the Topics tab.
        const cached = await getCachedLibrarySnapshot()
        if (cached) {
          return {
            ok: true as const,
            books: [cached.book],
            chaptersByBookId: { [cached.book.id]: cached.chapters },
            selectedBookId: cached.book.id,
            cardRows: [] as LibraryCard[],
            log: [] as ReadingLogEntry[],
            offline: true,
          }
        }
        return {
          ok: false as const,
          books: [] as LibraryBook[],
          chaptersByBookId: {} as Record<string, LibraryChapter[]>,
          selectedBookId: null as string | null,
          cardRows: [] as LibraryCard[],
          log: [] as ReadingLogEntry[],
          offline: false,
        }
      })

    const questionsPromise = listBoardQuestions().catch((err) => {
      console.error('Board questions failed to load', err)
      return [] as BoardQuestion[]
    })
    const attemptsPromise = listBoardQuestionAttempts().catch((err) => {
      console.error('Board question attempts failed to load', err)
      return [] as BoardQuestionAttempt[]
    })

    Promise.all([topicsPromise, bookPromise, getUserSettings().catch(() => null), questionsPromise, attemptsPromise])
      .then(([{ topicRows, counts }, bookResult, settings, questionRows, attemptRows]) => {
        setTopics(topicRows)
        setTopicCardCounts(counts)
        setQuestions(questionRows)
        setQuestionAttempts(attemptRows)
        setBookUnavailable(!bookResult.ok)
        setOfflineFallback(bookResult.offline)
        if (bookResult.ok && bookResult.selectedBookId) {
          setBooks(bookResult.books)
          setChaptersByBookId(bookResult.chaptersByBookId)
          setSelectedBookId(bookResult.selectedBookId)
          setCards(bookResult.cardRows)
          const today = new Date().toISOString().slice(0, 10)
          setTodayPages(bookResult.log.find((l) => l.logDate === today)?.pagesRead ?? 0)
          setStreak(computeReadingStreak(bookResult.log))
          const selectedChapters = bookResult.chaptersByBookId[bookResult.selectedBookId] ?? []
          const readingChapter = selectedChapters.find((c) => c.status === 'reading')
          if (readingChapter) setOpenParts(new Set([readingChapter.partRoman]))
        } else {
          setTab('topics')
        }
        if (settings) setDailyGoal(settings.readingDailyGoal)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the Library'))
      .finally(() => setLoading(false))
  }, [])

  const book = books.find((b) => b.id === selectedBookId) ?? null
  const chapters = useMemo(() => (selectedBookId && chaptersByBookId[selectedBookId]) || [], [selectedBookId, chaptersByBookId])

  function selectBook(bookId: string) {
    setSelectedBookId(bookId)
    setOpenParts(new Set())
    setSearch('')
    try {
      window.localStorage.setItem(LAST_BOOK_KEY, bookId)
    } catch {
      // ignore storage errors
    }
  }

  const cardsByChapter = useMemo(() => {
    const map = new Map<string, LibraryCard[]>()
    for (const c of cards) {
      const list = map.get(c.chapterId) ?? []
      list.push(c)
      map.set(c.chapterId, list)
    }
    return map
  }, [cards])

  // Imported exam questions are linked to a chapter the same way cards are
  // (chapterId), but a question also carries a free-text topic -- older
  // manually-entered questions never set chapterId, so only chapter-linked
  // ones count here.
  const questionsByChapter = useMemo(() => {
    const map = new Map<string, BoardQuestion[]>()
    for (const q of questions) {
      if (!q.chapterId) continue
      const list = map.get(q.chapterId) ?? []
      list.push(q)
      map.set(q.chapterId, list)
    }
    return map
  }, [questions])

  // Practice score per chapter, from every recorded attempt on that
  // chapter's questions (not just the most recent session) -- shown next to
  // the "N questions" badge on the chapter row.
  const scoreByChapter = useMemo(() => {
    const questionToChapter = new Map<string, string>()
    for (const [chapterId, qs] of questionsByChapter) for (const q of qs) questionToChapter.set(q.id, chapterId)
    const map = new Map<string, { correct: number; total: number }>()
    for (const a of questionAttempts) {
      const chapterId = questionToChapter.get(a.questionId)
      if (!chapterId) continue
      const stat = map.get(chapterId) ?? { correct: 0, total: 0 }
      stat.total += 1
      if (a.isCorrect) stat.correct += 1
      map.set(chapterId, stat)
    }
    return map
  }, [questionsByChapter, questionAttempts])

  const now = new Date()
  const dueByChapter = useMemo(() => {
    const map = new Map<string, number>()
    for (const [chapterId, list] of cardsByChapter) {
      map.set(chapterId, list.filter((c) => c.status === 'approved' && c.reps > 0 && new Date(c.due) <= now).length)
    }
    return map
  }, [cardsByChapter]) // eslint-disable-line react-hooks/exhaustive-deps

  const partsOrder = useMemo(() => {
    const seen = new Map<string, string>()
    for (const c of chapters) if (!seen.has(c.partRoman)) seen.set(c.partRoman, c.partTitle)
    return Array.from(seen.entries())
  }, [chapters])

  const chaptersByPart = useMemo(() => {
    const map = new Map<string, LibraryChapter[]>()
    for (const c of chapters) {
      const list = map.get(c.partRoman) ?? []
      list.push(c)
      map.set(c.partRoman, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.chapterNumber - b.chapterNumber)
    return map
  }, [chapters])

  const statsByBookId = useMemo(() => {
    const map: Record<string, LibraryBookStats> = {}
    for (const b of books) {
      const bChapters = chaptersByBookId[b.id] ?? []
      const parts = new Set(bChapters.map((c) => c.partRoman))
      const totalCards = bChapters.reduce((sum, c) => sum + (cardsByChapter.get(c.id)?.length ?? 0), 0)
      const dueToday = bChapters.reduce((sum, c) => {
        const list = cardsByChapter.get(c.id) ?? []
        return sum + list.filter((card) => card.status === 'approved' && card.reps > 0 && new Date(card.due) <= now).length
      }, 0)
      const chaptersRead = bChapters.filter((c) => c.status !== 'unread').length
      const pctRead = bChapters.length > 0 ? Math.round(bChapters.reduce((sum, c) => sum + effectivePct(c), 0) / bChapters.length) : 0
      const totalPages = b.totalPages ?? bChapters.reduce((sum, c) => sum + (c.pages ?? 0), 0)
      map[b.id] = {
        partsCount: parts.size,
        chaptersCount: bChapters.length,
        totalPages,
        chaptersRead,
        totalCards,
        dueToday,
        pctRead,
      }
    }
    return map
  }, [books, chaptersByBookId, cardsByChapter]) // eslint-disable-line react-hooks/exhaustive-deps

  const dueTotal = selectedBookId ? statsByBookId[selectedBookId]?.dueToday ?? 0 : 0

  const continueReading = chapters.find((c) => c.status === 'reading') ?? null

  async function saveDailyGoal(value: number) {
    setDailyGoal(value)
    setGoalSheetOpen(false)
    try {
      await updateUserSettings({ readingDailyGoal: value })
    } catch {
      // non-critical
    }
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  const q = search.trim().toLowerCase()

  return (
    <div className="np-page">
      {bookUnavailable && (
        <p className="np-small" style={{ color: '#9B3A31', background: '#FDECEB', padding: '8px 12px', borderRadius: 10 }}>
          Academy data unavailable — the Academy v2 database migration hasn't been applied yet. The book library is hidden
          until it is; your topics below are unaffected.
        </p>
      )}

      {offlineFallback && (
        <p className="np-small" style={{ color: '#93590B', background: '#FDF0D5', padding: '8px 12px', borderRadius: 10 }}>
          Offline — showing your last downloaded chapter list. Due/card counts refresh once you're back online.
        </p>
      )}

      {book && selectedBookId && (
        <BookSwitcher
          books={books}
          stats={statsByBookId}
          selectedBookId={selectedBookId}
          onSelect={selectBook}
          dailyGoal={dailyGoal}
          todayPages={todayPages}
          streak={streak}
          onEditGoal={() => {
            setGoalDraft(String(dailyGoal))
            setGoalSheetOpen(true)
          }}
        />
      )}

      {continueReading && (
        <Link to={`/academy/reader/${continueReading.id}`} className="cont np-fade" style={{ animationDelay: '.08s' }}>
          <span className="num">
            <small>CH</small>
            {continueReading.chapterNumber}
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="np-small" style={{ fontWeight: 700, letterSpacing: '.06em', color: 'var(--accent)' }}>
              CONTINUE READING
            </span>
            <b style={{ fontSize: 15, lineHeight: 1.3 }}>{continueReading.title}</b>
            <span className="np-small">
              p. {continueReading.startPage} · {continueReading.readingPct}% of chapter
            </span>
          </span>
          <span className="np-btn sm" style={{ flexShrink: 0 }}>
            Resume
          </span>
        </Link>
      )}

      <div className="lib">
        <div className="stack">
          <div className="toolbar np-fade" style={{ animationDelay: '.12s' }}>
            <div className="search">
              <SearchIcon width={18} height={18} />
              <label className="np-sr" htmlFor="lib-q">
                Search chapters
              </label>
              <input id="lib-q" placeholder="Search chapters (e.g. RTA, nephrotic, transplant)" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="seg" style={{ flexShrink: 0 }}>
              <button type="button" className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')} disabled={bookUnavailable}>
                Book
              </button>
              <button type="button" className={tab === 'topics' ? 'on' : ''} onClick={() => setTab('topics')}>
                My topics
              </button>
            </div>
            <button type="button" className="np-btn ghost sm" style={{ flexShrink: 0 }} onClick={() => setImportOpen(true)}>
              <UploadIcon width={16} height={16} />
              Import questions
            </button>
            <button type="button" className="np-btn ghost sm" style={{ flexShrink: 0 }} onClick={() => setBulkImportOpen(true)}>
              <UploadIcon width={16} height={16} />
              Bulk import
            </button>
          </div>

          {tab === 'book' && bookUnavailable ? (
            <div className="parts np-fade" style={{ animationDelay: '.16s' }}>
              <p className="empty-state">
                Academy data unavailable — the book library can't load right now. Switch to "My topics" or try again later.
              </p>
            </div>
          ) : tab === 'book' ? (
            <div className="parts np-fade" style={{ animationDelay: '.16s' }}>
              {partsOrder.map(([roman, title]) => {
                const partChapters = (chaptersByPart.get(roman) ?? []).filter(
                  (c) => !q || c.title.toLowerCase().includes(q) || String(c.chapterNumber).includes(q)
                )
                if (q && partChapters.length === 0) return null
                const allInPart = chaptersByPart.get(roman) ?? []
                const partPct = allInPart.length > 0 ? Math.round(allInPart.reduce((s, c) => s + effectivePct(c), 0) / allInPart.length) : 0
                const partDue = allInPart.reduce((s, c) => s + (dueByChapter.get(c.id) ?? 0), 0)
                const isOpen = openParts.has(roman) || Boolean(q)
                return (
                  <section className={isOpen ? 'part open' : 'part'} key={roman}>
                    <button
                      type="button"
                      className="ph"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenParts((prev) => {
                          const next = new Set(prev)
                          if (next.has(roman)) next.delete(roman)
                          else next.add(roman)
                          return next
                        })
                      }
                    >
                      <span className="rn">{roman}</span>
                      <span>
                        <b>{title}</b>
                        <span className="pmeta">
                          <span className="np-small">
                            {allInPart.length} chapters · {partPct}%{partDue > 0 ? ` · ` : ''}
                            {partDue > 0 && <span className="due">{partDue} due</span>}
                          </span>
                          <span className="pbar">
                            <i style={{ width: `${partPct}%` }} />
                          </span>
                        </span>
                      </span>
                      <span className="np-small" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        p. {allInPart[0]?.startPage ?? ''}
                      </span>
                      <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="chs">
                        {partChapters.map((c) => {
                          const cardCount = cardsByChapter.get(c.id)?.length ?? 0
                          const questionCount = questionsByChapter.get(c.id)?.length ?? 0
                          const score = scoreByChapter.get(c.id)
                          const scorePct = score && score.total > 0 ? Math.round((score.correct / score.total) * 100) : null
                          const due = dueByChapter.get(c.id) ?? 0
                          const colors = STATUS_COLORS[c.status]
                          return (
                            <div className="ch" key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Link to={`/academy/reader/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
                                <span className="cn">{c.chapterNumber}</span>
                                <span>
                                  <span className="ct">{c.title}</span>
                                  <span className="cm">
                                    {c.startPage != null && (
                                      <span>
                                        p. {c.startPage}–{c.endPage}
                                        {c.pages != null ? ` · ${c.pages} pp` : ''}
                                      </span>
                                    )}
                                    {c.status === 'reading' && (
                                      <span className="mini">
                                        <i style={{ width: `${c.readingPct}%` }} />
                                      </span>
                                    )}
                                    {cardCount > 0 && <span>{cardCount} cards</span>}
                                    {questionCount > 0 && <span>{questionCount} questions</span>}
                                    {scorePct != null && <span>{scorePct}% score</span>}
                                  </span>
                                </span>
                              </Link>
                              <span className="right">
                                <span className="pill" style={colors}>
                                  {c.status === 'reading' ? `Reading ${c.readingPct}%` : STATUS_LABEL[c.status]}
                                </span>
                                {due > 0 && <span className="due">{due} due</span>}
                                {questionCount > 0 && (
                                  <Link to={`/study?tab=boardQuestions&chapterId=${c.id}`} className="pill" style={{ color: '#5131B5', background: '#ECE6FD' }}>
                                    Practice
                                  </Link>
                                )}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="parts np-fade" style={{ animationDelay: '.16s' }}>
              {topics
                .filter((t) => !q || t.name.toLowerCase().includes(q))
                .map((t) => {
                  const stats = topicCardCounts[t.id] ?? { total: 0, due: 0 }
                  return (
                    <Link className="ch" to={`/academy/${t.id}`} key={t.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--line)' }}>
                      <span className="cn" style={{ width: 'auto' }}>
                        <AcademyIcon width={18} height={18} />
                      </span>
                      <span>
                        <span className="ct" dir="rtl">
                          {t.name}
                        </span>
                        <span className="cm">{t.category && <span>{t.category}</span>}{stats.total > 0 && <span>{stats.total} cards</span>}</span>
                      </span>
                      <span className="right">{stats.due > 0 && <span className="due">{stats.due} due</span>}</span>
                    </Link>
                  )
                })}
              {topics.length === 0 && <p className="empty-state">No topics yet — build one from the old Academy flow.</p>}
            </div>
          )}
          <span className="np-small">Chapter status and due counts update as you read and review.</span>
        </div>

        <aside className="side-col">
          <section className="np-card np-fade" style={{ animationDelay: '.2s' }}>
            <h2>Today's plan</h2>
            <div className="plan">
              {dueTotal > 0 && (
                <Link className="task" to="/academy/review">
                  <span className="np-ic" style={{ background: '#FDF0DC', color: '#93590B' }}>
                    <QuizIcon width={17} height={17} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <b>Review {dueTotal} cards</b>
                    <span className="np-small">All due cards across the book</span>
                  </span>
                </Link>
              )}
              {continueReading && (
                <Link className="task" to={`/academy/reader/${continueReading.id}#qc`}>
                  <span className="np-ic">
                    <QuizIcon width={17} height={17} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <b>Quick check</b>
                    <span className="np-small">{continueReading.title}</span>
                  </span>
                </Link>
              )}
              {continueReading && (
                <Link className="task" to={`/academy/reader/${continueReading.id}`}>
                  <span className="np-ic" style={{ background: '#DDF2F3', color: '#0B6670' }}>
                    <BookIcon width={17} height={17} />
                  </span>
                  <span style={{ flex: 1 }}>
                    <b>Keep reading</b>
                    <span className="np-small">{continueReading.title}</span>
                  </span>
                </Link>
              )}
              {dueTotal === 0 && !continueReading && <span className="np-small">Open a chapter to get started.</span>}
              <Link className="task" to="/academy/practice">
                <span className="np-ic" style={{ background: '#ECE6FD', color: '#5131B5' }}>
                  <QuizIcon width={17} height={17} />
                </span>
                <span style={{ flex: 1 }}>
                  <b>Practice</b>
                  <span className="np-small">By chapter, mixed random, or a timed mock exam</span>
                </span>
              </Link>
              <Link className="task" to="/academy/mistakes">
                <span className="np-ic" style={{ background: '#FDEBDD', color: '#9A3412' }}>
                  <AcademyIcon width={17} height={17} />
                </span>
                <span style={{ flex: 1 }}>
                  <b>My mistakes</b>
                  <span className="np-small">Everything missed, tagged by reason</span>
                </span>
              </Link>
              <Link className="task" to="/academy/stats">
                <span className="np-ic" style={{ background: '#DDF2F3', color: '#0B6670' }}>
                  <AcademyIcon width={17} height={17} />
                </span>
                <span style={{ flex: 1 }}>
                  <b>Chapter stats</b>
                  <span className="np-small">Accuracy and retention, weakest first</span>
                </span>
              </Link>
            </div>
          </section>
          <section className="np-card np-fade" style={{ animationDelay: '.26s', gap: 10 }}>
            <h2>Chapter status</h2>
            <div className="legend">
              {(Object.keys(STATUS_LABEL) as Array<LibraryChapter['status']>).map((s) => (
                <span className="pill" style={STATUS_COLORS[s]} key={s}>
                  {STATUS_LABEL[s]}
                </span>
              ))}
            </div>
            <span className="np-small" style={{ lineHeight: 1.5 }}>
              Read → you finished the text. Carded → its key facts are cards. Mastered → every card is past a 21-day interval.
            </span>
          </section>
        </aside>
      </div>

      {goalSheetOpen && (
        <>
          <div className="more-sheet-backdrop" onClick={() => setGoalSheetOpen(false)} />
          <div className="more-sheet" role="dialog" aria-label="Edit daily reading goal">
            <div className="more-sheet-handle" />
            <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Daily reading goal</h2>
            <div className="np-field" style={{ marginBottom: 16 }}>
              <label htmlFor="daily-goal-input">Pages per day</label>
              <input
                id="daily-goal-input"
                type="number"
                min={1}
                inputMode="numeric"
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="np-btn ghost" style={{ flex: 1 }} onClick={() => setGoalSheetOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="np-btn"
                style={{ flex: 1 }}
                onClick={() => void saveDailyGoal(Math.max(1, Number(goalDraft) || 1))}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      <QuestionImportPanel
        open={importOpen}
        chapters={chapters}
        onClose={() => setImportOpen(false)}
        onImported={(imported) => setQuestions((prev) => [...prev.filter((q) => !imported.some((n) => n.importKey === q.importKey)), ...imported])}
      />
      <BulkCardImportPanel open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} />
    </div>
  )
}
