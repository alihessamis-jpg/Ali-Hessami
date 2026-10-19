import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAllLibraryCards, listAllLibraryChapters, listLibraryBooks } from '../lib/api/library'
import { QuizIcon } from '../components/icons'
import type { LibraryBook, LibraryCard, LibraryChapter } from '../types/domain'

type Mode = 'chapter' | 'random' | 'mock'

const MODE_LABEL: Record<Mode, string> = {
  chapter: 'By chapter',
  random: 'Mixed random',
  mock: 'Timed mock exam',
}

export function PracticePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [chapters, setChapters] = useState<LibraryChapter[]>([])
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [mode, setMode] = useState<Mode>('chapter')
  const [chapterId, setChapterId] = useState<string | null>(null)
  const [mockCount, setMockCount] = useState('20')
  const [mockTimer, setMockTimer] = useState('15')

  useEffect(() => {
    Promise.all([listAllLibraryChapters(), listLibraryBooks(), listAllLibraryCards()])
      .then(([chapterRows, bookRows, cardRows]) => {
        setChapters(chapterRows)
        setBooks(bookRows)
        setCards(cardRows.filter((c) => c.status === 'approved'))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load practice options'))
      .finally(() => setLoading(false))
  }, [])

  const chapterCardCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of cards) counts[c.chapterId] = (counts[c.chapterId] ?? 0) + 1
    return counts
  }, [cards])

  const chaptersWithCards = useMemo(
    () => chapters.filter((c) => (chapterCardCounts[c.id] ?? 0) > 0).sort((a, b) => a.chapterNumber - b.chapterNumber),
    [chapters, chapterCardCounts]
  )

  const booksById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books])
  const mockQuestionCount = useMemo(() => cards.filter((c) => c.kind === 'mcq').length, [cards])

  function start() {
    const params = new URLSearchParams()
    params.set('mode', mode)
    if (mode === 'chapter' && chapterId) params.set('chapter', chapterId)
    if (mode === 'mock') {
      params.set('count', String(Math.max(1, Number(mockCount) || 20)))
      params.set('timer', String(Math.max(1, Number(mockTimer) || 15)))
    }
    navigate(`/academy/review?${params.toString()}`)
  }

  const canStart = (mode !== 'chapter' || !!chapterId) && (mode !== 'mock' || mockQuestionCount > 0)

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page">
      <section className="np-card np-fade">
        <div className="np-head">
          <div className="np-head-l">
            <span className="np-ic">
              <QuizIcon />
            </span>
            <h2>Practice</h2>
          </div>
        </div>
        <p className="np-small">
          Outside the daily queue — nothing here is gated by what's due today, but grading still updates the FSRS
          schedule.
        </p>

        {error && <p className="form-error">{error}</p>}

        <div className="chapter-parts">
          {(['chapter', 'random', 'mock'] as Mode[]).map((m) => (
            <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        {mode === 'chapter' && (
          <div className="practice-chapter-list">
            {chaptersWithCards.map((c) => (
              <button
                key={c.id}
                type="button"
                className={chapterId === c.id ? 'practice-chapter-row on' : 'practice-chapter-row'}
                onClick={() => setChapterId(c.id)}
              >
                <span>
                  <b>
                    Ch {c.chapterNumber} · {c.title}
                  </b>
                  <span className="np-small">
                    {booksById.get(c.bookId)?.title ?? ''} · {chapterCardCounts[c.id] ?? 0} cards
                  </span>
                </span>
              </button>
            ))}
            {chaptersWithCards.length === 0 && <p className="empty-state">No chapters with cards yet.</p>}
          </div>
        )}

        {mode === 'mock' && (
          <>
            <div className="np-field set-unit">
              <label htmlFor="mockCount">Questions</label>
              <input
                id="mockCount"
                type="number"
                min="1"
                max={String(Math.max(1, mockQuestionCount))}
                inputMode="numeric"
                value={mockCount}
                onChange={(e) => setMockCount(e.target.value)}
              />
              <span>of {mockQuestionCount} board MCQs</span>
            </div>
            <div className="np-field set-unit">
              <label htmlFor="mockTimer">Time limit</label>
              <input
                id="mockTimer"
                type="number"
                min="1"
                inputMode="numeric"
                value={mockTimer}
                onChange={(e) => setMockTimer(e.target.value)}
              />
              <span>minutes</span>
            </div>
            {mockQuestionCount === 0 && <p className="empty-state">No board MCQs available yet.</p>}
          </>
        )}

        <button type="button" className="np-btn" disabled={!canStart} onClick={start}>
          Start
        </button>
      </section>
    </div>
  )
}
