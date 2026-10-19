import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllLibraryCards, listAllLibraryChapters, listLibraryBooks } from '../lib/api/library'
import { listLibraryCardMistakes } from '../lib/api/libraryMistakes'
import { isolateLatinRuns } from '../lib/bidiText'
import { toShamsi } from '../lib/shamsi'
import { AcademyIcon } from '../components/icons'
import type { LibraryBook, LibraryCard, LibraryCardMistake, LibraryChapter, MistakeReason } from '../types/domain'

const REASON_LABEL: Record<MistakeReason, string> = {
  knowledge_gap: "Didn't know it",
  misread: 'Misread the question',
  confused_similar: 'Confused with similar',
  guessed: 'Guessed',
}

export function MistakesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mistakes, setMistakes] = useState<LibraryCardMistake[]>([])
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [chapters, setChapters] = useState<LibraryChapter[]>([])
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [chapterFilter, setChapterFilter] = useState<string>('')
  const [reasonFilter, setReasonFilter] = useState<MistakeReason | null>(null)

  useEffect(() => {
    Promise.all([listLibraryCardMistakes(), listAllLibraryCards(), listAllLibraryChapters(), listLibraryBooks()])
      .then(([mistakeRows, cardRows, chapterRows, bookRows]) => {
        setMistakes(mistakeRows)
        setCards(cardRows)
        setChapters(chapterRows)
        setBooks(bookRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load mistakes'))
      .finally(() => setLoading(false))
  }, [])

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])
  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])

  const chaptersWithMistakes = useMemo(() => {
    const ids = new Set(mistakes.map((m) => m.chapterId))
    return chapters.filter((c) => ids.has(c.id)).sort((a, b) => a.chapterNumber - b.chapterNumber)
  }, [mistakes, chapters])

  const filtered = useMemo(
    () =>
      mistakes.filter(
        (m) => (!chapterFilter || m.chapterId === chapterFilter) && (!reasonFilter || m.reason === reasonFilter)
      ),
    [mistakes, chapterFilter, reasonFilter]
  )

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page">
      <section className="np-card np-fade">
        <div className="np-head">
          <div className="np-head-l">
            <span className="np-ic">
              <AcademyIcon />
            </span>
            <h2>My mistakes</h2>
          </div>
          <span className="np-pill" style={{ color: '#9A3412', background: '#FDEBDD' }}>
            {filtered.length}
          </span>
        </div>

        {error && <p className="form-error">{error}</p>}

        {chaptersWithMistakes.length > 0 && (
          <select
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            aria-label="Filter by chapter"
          >
            <option value="">All chapters</option>
            {chaptersWithMistakes.map((c) => (
              <option key={c.id} value={c.id}>
                Ch {c.chapterNumber} · {c.title}
              </option>
            ))}
          </select>
        )}

        <div className="chapter-parts">
          <button type="button" className={reasonFilter === null ? 'on' : ''} onClick={() => setReasonFilter(null)}>
            All reasons
          </button>
          {(Object.keys(REASON_LABEL) as MistakeReason[]).map((r) => (
            <button key={r} type="button" className={reasonFilter === r ? 'on' : ''} onClick={() => setReasonFilter(r)}>
              {REASON_LABEL[r]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="empty-state">
            {mistakes.length === 0 ? 'No mistakes logged yet — nice work.' : 'No mistakes match this filter.'}
          </p>
        ) : (
          <div className="td-cols" style={{ gap: 8 }}>
            {filtered.map((m) => {
              const card = cardById.get(m.cardId)
              const chapter = chapterById.get(m.chapterId)
              const book = chapter ? bookById.get(chapter.bookId) : undefined
              return (
                <Link
                  key={m.id}
                  to={`/academy/reader/${m.chapterId}${card?.sectionNumber ? `#s${card.sectionNumber}` : ''}`}
                  className="td-row"
                >
                  <span className="td-dot" style={{ background: '#C2410C' }} />
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <b dir="rtl">{card ? isolateLatinRuns(card.front.slice(0, 70)) : '(card removed)'}</b>
                    <span className="np-small">
                      {chapter ? `Ch ${chapter.chapterNumber}` : ''} {book ? `· ${book.title}` : ''} · {toShamsi(m.createdAt)}
                    </span>
                  </span>
                  <span className="np-pill" style={{ color: '#9A3412', background: '#FDEBDD', flexShrink: 0 }}>
                    {REASON_LABEL[m.reason]}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
