import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  ensureLibraryBookSeeded,
  listAllLibraryCards,
  listReadingLog,
} from '../lib/api/library'
import { listAcademyCardsForTopic } from '../lib/api/academyCards'
import { listAcademyTopics } from '../lib/api/academy'
import { getUserSettings, updateUserSettings } from '../lib/api/settings'
import { computeReadingStreak } from '../lib/libraryNote'
import { AcademyIcon, BookIcon, QuizIcon, SearchIcon } from '../components/icons'
import type { AcademyTopic, LibraryBook, LibraryCard, LibraryChapter } from '../types/domain'

type LibraryTab = 'book' | 'topics'

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
  const [book, setBook] = useState<LibraryBook | null>(null)
  const [chapters, setChapters] = useState<LibraryChapter[]>([])
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [topicCardCounts, setTopicCardCounts] = useState<Record<string, { total: number; due: number }>>({})
  const [dailyGoal, setDailyGoal] = useState(20)
  const [todayPages, setTodayPages] = useState(0)
  const [streak, setStreak] = useState(0)
  const [tab, setTab] = useState<LibraryTab>('book')
  const [search, setSearch] = useState('')
  const [openParts, setOpenParts] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([ensureLibraryBookSeeded(), listAllLibraryCards(), listAcademyTopics(), getUserSettings(), listReadingLog()])
      .then(async ([seeded, cardRows, topicRows, settings, log]) => {
        setBook(seeded.book)
        setChapters(seeded.chapters)
        setCards(cardRows)
        setTopics(topicRows)
        setDailyGoal(settings.readingDailyGoal)
        const today = new Date().toISOString().slice(0, 10)
        setTodayPages(log.find((l) => l.logDate === today)?.pagesRead ?? 0)
        setStreak(computeReadingStreak(log))
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
        setTopicCardCounts(counts)
        const readingChapter = seeded.chapters.find((c) => c.status === 'reading')
        if (readingChapter) {
          const part = seeded.chapters.find((c) => c.id === readingChapter.id)?.partRoman
          if (part) setOpenParts(new Set([part]))
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load the Library'))
      .finally(() => setLoading(false))
  }, [])

  const cardsByChapter = useMemo(() => {
    const map = new Map<string, LibraryCard[]>()
    for (const c of cards) {
      const list = map.get(c.chapterId) ?? []
      list.push(c)
      map.set(c.chapterId, list)
    }
    return map
  }, [cards])

  const now = new Date()
  const dueByChapter = useMemo(() => {
    const map = new Map<string, number>()
    for (const [chapterId, list] of cardsByChapter) {
      map.set(chapterId, list.filter((c) => new Date(c.due) <= now).length)
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

  const totalCards = cards.length
  const dueTotal = cards.filter((c) => new Date(c.due) <= now).length
  const chaptersRead = chapters.filter((c) => c.status !== 'unread').length
  const bookPct = chapters.length > 0 ? Math.round(chapters.reduce((sum, c) => sum + effectivePct(c), 0) / chapters.length) : 0
  const totalPages = book?.totalPages ?? chapters.reduce((sum, c) => sum + (c.pages ?? 0), 0)

  const continueReading = chapters.find((c) => c.status === 'reading') ?? null

  async function saveDailyGoal(value: number) {
    setDailyGoal(value)
    try {
      await updateUserSettings({ readingDailyGoal: value })
    } catch {
      // non-critical
    }
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>
  if (!book) return null

  const goalPct = Math.min(100, Math.round((todayPages / Math.max(1, dailyGoal)) * 100))
  const q = search.trim().toLowerCase()

  return (
    <div className="np-page">
      <section className="np-hero np-fade" style={{ gap: 18 }}>
        <div className="np-glow amber" />
        <div className="libhero">
          <div className="cover" aria-hidden="true">
            <i>{book.edition} ed.</i>
            <b>{book.title}</b>
          </div>
          <div className="np-txt">
            <span className="eyebrow">ACADEMY · LIBRARY</span>
            <h1 style={{ fontSize: 24, lineHeight: 1.2 }}>{book.title}</h1>
            <p className="np-sub">
              {book.edition} ed. · {partsOrder.length} parts · {chapters.length} chapters · {totalPages.toLocaleString()} pages ·{' '}
              {bookPct}% read
            </p>
          </div>
        </div>
        <div className="lstats" style={{ '--n': 3 } as CSSProperties}>
          <div>
            <b>
              {chaptersRead}
              <span style={{ fontSize: 14, color: '#A9C6FF' }}> / {chapters.length}</span>
            </b>
            <span>chapters read</span>
          </div>
          <div>
            <b>{totalCards}</b>
            <span>cards made</span>
          </div>
          <div>
            <b style={{ color: '#FFC46B' }}>{dueTotal}</b>
            <span>due today</span>
          </div>
        </div>
        <div className="goal">
          <div className="np-head">
            <b style={{ fontSize: 13 }}>Today's goal</b>
            <span style={{ fontSize: 12, color: '#C9DAF8', display: 'flex', alignItems: 'center', gap: 6 }}>
              {todayPages} /{' '}
              <input
                type="number"
                min={1}
                value={dailyGoal}
                onChange={(e) => void saveDailyGoal(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 36, background: 'rgba(255,255,255,.12)', border: 'none', borderRadius: 6, color: '#fff', padding: '2px 4px' }}
              />{' '}
              pages · {streak}-day streak
            </span>
          </div>
          <div className="gbar">
            <i style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      </section>

      {continueReading && (
        <Link to={`/academy/reader/${continueReading.id}`} className="cont np-fade" style={{ animationDelay: '.08s' }}>
          <span className="num">
            <small>CH</small>
            {continueReading.chapterNumber}
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="small" style={{ fontWeight: 700, letterSpacing: '.06em', color: 'var(--accent)' }}>
              CONTINUE READING
            </span>
            <b style={{ fontSize: 15, lineHeight: 1.3 }}>{continueReading.title}</b>
            <span className="small">
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
              <label className="sr" htmlFor="lib-q">
                Search chapters
              </label>
              <input id="lib-q" placeholder="Search chapters (e.g. RTA, nephrotic, transplant)" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="seg" style={{ flexShrink: 0 }}>
              <button type="button" className={tab === 'book' ? 'on' : ''} onClick={() => setTab('book')}>
                Book
              </button>
              <button type="button" className={tab === 'topics' ? 'on' : ''} onClick={() => setTab('topics')}>
                My topics
              </button>
            </div>
          </div>

          {tab === 'book' ? (
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
                          <span className="small">
                            {allInPart.length} chapters · {partPct}%{partDue > 0 ? ` · ` : ''}
                            {partDue > 0 && <span className="due">{partDue} due</span>}
                          </span>
                          <span className="pbar">
                            <i style={{ width: `${partPct}%` }} />
                          </span>
                        </span>
                      </span>
                      <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>
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
                          const due = dueByChapter.get(c.id) ?? 0
                          const colors = STATUS_COLORS[c.status]
                          return (
                            <Link className="ch" to={`/academy/reader/${c.id}`} key={c.id}>
                              <span className="cn">{c.chapterNumber}</span>
                              <span>
                                <span className="ct">{c.title}</span>
                                <span className="cm">
                                  <span>
                                    p. {c.startPage}–{c.endPage} · {c.pages} pp
                                  </span>
                                  {c.status === 'reading' && (
                                    <span className="mini">
                                      <i style={{ width: `${c.readingPct}%` }} />
                                    </span>
                                  )}
                                  {cardCount > 0 && <span>{cardCount} cards</span>}
                                </span>
                              </span>
                              <span className="right">
                                <span className="pill" style={colors}>
                                  {c.status === 'reading' ? `Reading ${c.readingPct}%` : STATUS_LABEL[c.status]}
                                </span>
                                {due > 0 && <span className="due">{due} due</span>}
                              </span>
                            </Link>
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
          <span className="small">Chapter status and due counts update as you read and review.</span>
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
                    <span className="small">All due cards across the book</span>
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
                    <span className="small">{continueReading.title}</span>
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
                    <span className="small">{continueReading.title}</span>
                  </span>
                </Link>
              )}
              {dueTotal === 0 && !continueReading && <span className="small">Open a chapter to get started.</span>}
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
            <span className="small" style={{ lineHeight: 1.5 }}>
              Read → you finished the text. Carded → its key facts are cards. Mastered → every card is past a 21-day interval.
            </span>
          </section>
        </aside>
      </div>
    </div>
  )
}
