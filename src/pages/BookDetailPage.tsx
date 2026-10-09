import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addChapter,
  addSection,
  deleteBook,
  deleteChapter,
  deleteSection,
  linkSectionTopic,
  listBooks,
  listChaptersForBook,
  listSectionsForChapters,
  listTopicIdsForSections,
  setSectionStatus,
  unlinkSectionTopic,
} from '../lib/api/books'
import { listAllAcademyCards, updateAcademyCardSrs } from '../lib/api/academyCards'
import { listAcademyTopics } from '../lib/api/academy'
import { scheduleReview } from '../lib/srs'
import { SectionQuickCheck } from '../components/books/SectionQuickCheck'
import type { AcademyCard, AcademyTopic, Book, BookChapter, BookSection, BookSectionStatus } from '../types/domain'

const STATUS_LABEL: Record<BookSectionStatus, string> = {
  unread: 'Unread',
  read: 'Read',
  carded: 'Carded',
  mastered: 'Mastered',
}

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<BookChapter[]>([])
  const [sections, setSections] = useState<BookSection[]>([])
  const [topicLinks, setTopicLinks] = useState<Record<string, string[]>>({})
  const [allTopics, setAllTopics] = useState<AcademyTopic[]>([])
  const [allCards, setAllCards] = useState<AcademyCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [newChapterTitle, setNewChapterTitle] = useState('')
  const [newSectionTitle, setNewSectionTitle] = useState<Record<string, string>>({})
  const [topicPick, setTopicPick] = useState<Record<string, string>>({})
  const [quizSectionId, setQuizSectionId] = useState<string | null>(null)

  async function reload() {
    if (!id) return
    const [books, chapterRows, topicRows, cardRows] = await Promise.all([
      listBooks(),
      listChaptersForBook(id),
      listAcademyTopics(),
      listAllAcademyCards(),
    ])
    setBook(books.find((b) => b.id === id) ?? null)
    setChapters(chapterRows)
    setAllTopics(topicRows)
    setAllCards(cardRows)
    const sectionRows = await listSectionsForChapters(chapterRows.map((c) => c.id))
    setSections(sectionRows)
    setTopicLinks(await listTopicIdsForSections(sectionRows.map((s) => s.id)))
  }

  useEffect(() => {
    setLoading(true)
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load book'))
      .finally(() => setLoading(false))
  }, [id])

  const sectionsByChapter = useMemo(() => {
    const map: Record<string, BookSection[]> = {}
    for (const s of sections) (map[s.chapterId] ??= []).push(s)
    return map
  }, [sections])

  const totalSections = sections.length
  const completedSections = sections.filter((s) => s.status !== 'unread').length
  const progressPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0

  async function handleAddChapter(e: FormEvent) {
    e.preventDefault()
    if (!id || !newChapterTitle.trim()) return
    try {
      const chapter = await addChapter({ bookId: id, title: newChapterTitle.trim(), chapterIndex: chapters.length, pagesFrom: null, pagesTo: null })
      setChapters((prev) => [...prev, chapter])
      setNewChapterTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add chapter')
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    try {
      await deleteChapter(chapterId)
      setChapters((prev) => prev.filter((c) => c.id !== chapterId))
      setSections((prev) => prev.filter((s) => s.chapterId !== chapterId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chapter')
    }
  }

  async function handleAddSection(chapterId: string, e: FormEvent) {
    e.preventDefault()
    const title = (newSectionTitle[chapterId] ?? '').trim()
    if (!title) return
    try {
      const section = await addSection({
        chapterId,
        title,
        sectionIndex: (sectionsByChapter[chapterId] ?? []).length,
        pagesFrom: null,
        pagesTo: null,
      })
      setSections((prev) => [...prev, section])
      setNewSectionTitle((prev) => ({ ...prev, [chapterId]: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add section')
    }
  }

  async function handleDeleteSection(sectionId: string) {
    try {
      await deleteSection(sectionId)
      setSections((prev) => prev.filter((s) => s.id !== sectionId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete section')
    }
  }

  async function handleSetStatus(sectionId: string, status: BookSectionStatus) {
    try {
      const updated = await setSectionStatus(sectionId, status)
      setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleLinkTopic(sectionId: string) {
    const topicId = topicPick[sectionId]
    if (!topicId) return
    try {
      await linkSectionTopic(sectionId, topicId)
      setTopicLinks((prev) => ({ ...prev, [sectionId]: [...(prev[sectionId] ?? []), topicId] }))
      setTopicPick((prev) => ({ ...prev, [sectionId]: '' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link topic')
    }
  }

  async function handleUnlinkTopic(sectionId: string, topicId: string) {
    try {
      await unlinkSectionTopic(sectionId, topicId)
      setTopicLinks((prev) => ({ ...prev, [sectionId]: (prev[sectionId] ?? []).filter((t) => t !== topicId) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink topic')
    }
  }

  function cardsForSection(sectionId: string): AcademyCard[] {
    const topicIds = topicLinks[sectionId] ?? []
    return allCards.filter((c) => topicIds.includes(c.topicId))
  }

  async function handleQuizFinish(sectionId: string, results: Array<{ card: AcademyCard; correct: boolean }>) {
    try {
      for (const r of results) {
        const next = scheduleReview(r.card, r.correct ? 'moderate' : 'difficult')
        const updated = await updateAcademyCardSrs(r.card.id, next)
        setAllCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      await handleSetStatus(sectionId, 'read')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save quick check')
    } finally {
      setQuizSectionId(null)
    }
  }

  async function handleDeleteBook() {
    if (!id || !book) return
    if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) return
    try {
      await deleteBook(id)
      window.location.href = '/books'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete book')
    }
  }

  if (!id) return null
  if (loading) return <p>Loading…</p>
  if (!book) return <p className="empty-state">Book not found.</p>

  return (
    <div className="np-page">
      <Link to="/books" className="np-backlink">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Books
      </Link>
      {error && <p className="form-error">{error}</p>}

      <section className="np-card np-fade">
        <div className="np-head">
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>{book.title}</h1>
            {book.author && <span className="np-small">{book.author}</span>}
          </div>
          <button className="link-button" onClick={() => void handleDeleteBook()}>
            Delete book
          </button>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#EEF2F8', overflow: 'hidden', marginTop: 8 }}>
          <div style={{ width: `${progressPct}%`, height: '100%', background: '#1E5BD8' }} />
        </div>
        <span className="np-small">
          {completedSections} / {totalSections} sections read ({progressPct}%)
        </span>
      </section>

      <section className="np-card np-fade">
        <h2>Add a chapter</h2>
        <form className="inline-form" onSubmit={(e) => void handleAddChapter(e)}>
          <input placeholder="Chapter title" value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} />
          <button type="submit">Add chapter</button>
        </form>
      </section>

      {chapters.map((chapter) => (
        <section className="dash-card" key={chapter.id}>
          <div className="dash-card-header">
            <h2 className="dash-card-title">{chapter.title}</h2>
            <button className="link-button" onClick={() => void handleDeleteChapter(chapter.id)}>
              Delete chapter
            </button>
          </div>

          {(sectionsByChapter[chapter.id] ?? []).length === 0 ? (
            <p className="empty-state">No sections yet.</p>
          ) : (
            <ul className="study-link-list">
              {(sectionsByChapter[chapter.id] ?? []).map((section) => {
                const linkedTopicIds = topicLinks[section.id] ?? []
                const linkedTopics = allTopics.filter((t) => linkedTopicIds.includes(t.id))
                const linkableTopics = allTopics.filter((t) => !linkedTopicIds.includes(t.id))
                return (
                  <li key={section.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong>{section.title}</strong>
                      <span className="patient-meta">{STATUS_LABEL[section.status]}</span>
                    </div>

                    <div className="form-actions">
                      {section.status !== 'read' && section.status !== 'mastered' && (
                        <button onClick={() => setQuizSectionId(section.id)}>Mark section read</button>
                      )}
                      <select value={section.status} onChange={(e) => void handleSetStatus(section.id, e.target.value as BookSectionStatus)}>
                        {Object.entries(STATUS_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button className="link-button" onClick={() => void handleDeleteSection(section.id)}>
                        Delete
                      </button>
                    </div>

                    {quizSectionId === section.id && (
                      <SectionQuickCheck
                        cards={cardsForSection(section.id)}
                        onFinish={(results) => void handleQuizFinish(section.id, results)}
                        onCancel={() => setQuizSectionId(null)}
                      />
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {linkedTopics.map((t) => (
                        <span key={t.id} className="checkpoint-chip">
                          <Link to={`/academy/${t.id}`}>{t.name}</Link>
                          <button className="link-button" onClick={() => void handleUnlinkTopic(section.id, t.id)}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    {linkableTopics.length > 0 && (
                      <form
                        className="inline-form"
                        onSubmit={(e) => {
                          e.preventDefault()
                          void handleLinkTopic(section.id)
                        }}
                      >
                        <select
                          value={topicPick[section.id] ?? ''}
                          onChange={(e) => setTopicPick((prev) => ({ ...prev, [section.id]: e.target.value }))}
                        >
                          <option value="">Link an Academy topic…</option>
                          {linkableTopics.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" disabled={!topicPick[section.id]}>
                          Link
                        </button>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <form className="inline-form" style={{ marginTop: 10 }} onSubmit={(e) => void handleAddSection(chapter.id, e)}>
            <input
              placeholder="Section title"
              value={newSectionTitle[chapter.id] ?? ''}
              onChange={(e) => setNewSectionTitle((prev) => ({ ...prev, [chapter.id]: e.target.value }))}
            />
            <button type="submit">Add section</button>
          </form>
        </section>
      ))}
    </div>
  )
}
