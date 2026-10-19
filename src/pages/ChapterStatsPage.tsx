import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllLibraryCards, listAllLibraryChapters, listLibraryBooks } from '../lib/api/library'
import { currentRetrievability } from '../lib/fsrs'
import { AcademyIcon } from '../components/icons'
import type { LibraryBook, LibraryCard, LibraryChapter } from '../types/domain'

interface ChapterStat {
  chapter: LibraryChapter
  book: LibraryBook | undefined
  total: number
  studied: number
  accuracyPct: number | null
  retentionPct: number | null
}

export function ChapterStatsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [chapters, setChapters] = useState<LibraryChapter[]>([])
  const [books, setBooks] = useState<LibraryBook[]>([])

  useEffect(() => {
    Promise.all([listAllLibraryCards(), listAllLibraryChapters(), listLibraryBooks()])
      .then(([cardRows, chapterRows, bookRows]) => {
        setCards(cardRows.filter((c) => c.status === 'approved'))
        setChapters(chapterRows)
        setBooks(bookRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load chapter stats'))
      .finally(() => setLoading(false))
  }, [])

  const stats: ChapterStat[] = useMemo(() => {
    const bookById = new Map(books.map((b) => [b.id, b]))
    const now = new Date()
    return chapters
      .map((chapter) => {
        const chapterCards = cards.filter((c) => c.chapterId === chapter.id)
        const studiedCards = chapterCards.filter((c) => c.reps > 0)
        const reps = studiedCards.reduce((sum, c) => sum + c.reps, 0)
        const lapses = studiedCards.reduce((sum, c) => sum + c.lapses, 0)
        const accuracyPct = reps > 0 ? Math.round((1 - lapses / reps) * 100) : null
        const retentions = studiedCards
          .map((c) => currentRetrievability(c, now))
          .filter((r): r is number => r !== null)
        const retentionPct = retentions.length > 0 ? Math.round((retentions.reduce((a, b) => a + b, 0) / retentions.length) * 100) : null
        return {
          chapter,
          book: bookById.get(chapter.bookId),
          total: chapterCards.length,
          studied: studiedCards.length,
          accuracyPct,
          retentionPct,
        }
      })
      .filter((s) => s.total > 0)
      .sort((a, b) => {
        const aWeak = a.accuracyPct ?? 101
        const bWeak = b.accuracyPct ?? 101
        return aWeak - bWeak
      })
  }, [cards, chapters, books])

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page">
      <section className="np-card np-fade">
        <div className="np-head">
          <div className="np-head-l">
            <span className="np-ic">
              <AcademyIcon />
            </span>
            <h2>Chapter stats</h2>
          </div>
        </div>
        <p className="np-small">Weakest chapters first — accuracy from every "Again" vs. total reviews, retention from FSRS right now.</p>

        {error && <p className="form-error">{error}</p>}

        {stats.length === 0 ? (
          <p className="empty-state">No studied chapters yet.</p>
        ) : (
          <div className="td-cols" style={{ gap: 8 }}>
            {stats.map((s) => (
              <Link key={s.chapter.id} to={`/academy/reader/${s.chapter.id}`} className="td-row">
                <span
                  className="td-dot"
                  style={{
                    background: s.accuracyPct === null ? '#5B6B82' : s.accuracyPct < 70 ? '#C2410C' : s.accuracyPct < 85 ? '#F5C26B' : '#17663A',
                  }}
                />
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <b>
                    Ch {s.chapter.chapterNumber} · {s.chapter.title}
                  </b>
                  <span className="np-small">
                    {s.book ? `${s.book.title} · ` : ''}
                    {s.total} items · {s.studied} studied
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 10, flexShrink: 0, fontSize: 13 }}>
                  <span>
                    <b>{s.accuracyPct ?? '—'}{s.accuracyPct !== null ? '%' : ''}</b>
                    <span className="np-small" style={{ display: 'block' }}>
                      accuracy
                    </span>
                  </span>
                  <span>
                    <b>{s.retentionPct ?? '—'}{s.retentionPct !== null ? '%' : ''}</b>
                    <span className="np-small" style={{ display: 'block' }}>
                      retention
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
