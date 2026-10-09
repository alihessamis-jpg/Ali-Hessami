import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addLibraryCard,
  addLibraryCards,
  addLibraryHighlight,
  getLibraryChapter,
  listLibraryCardsForChapter,
  listLibraryHighlights,
  listTopicIdsForChapter,
  logPagesRead,
  updateLibraryCardFsrs,
  updateLibraryChapter,
} from '../lib/api/library'
import { listAcademyTopics } from '../lib/api/academy'
import { listPatientIdsForTopic } from '../lib/api/academyTopicPatients'
import { listPatients } from '../lib/api/patients'
import { ChapterProse, type MakeCardPayload, type MakeCardsFromTablePayload } from '../components/library/ChapterProse'
import { PatientCaseCardForm } from '../components/library/PatientCaseCardForm'
import { parseSections, estimateMinutesLeft } from '../lib/libraryNote'
import { scheduleFsrs, isCardMastered } from '../lib/fsrs'
import { AcademyIcon, CalendarIcon, PatientsIcon, QuizIcon } from '../components/icons'
import type { AcademyTopic, FsrsRating, LibraryCard, LibraryChapter, LibraryHighlight, Patient } from '../types/domain'

const QUICK_CHECK_SIZE = 4

interface QuickCheckQuestion {
  card: LibraryCard
  options: string[]
  correctIndex: number
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function buildQuickCheck(cards: LibraryCard[]): QuickCheckQuestion[] {
  const pool = cards.filter((c) => c.kind !== 'patient_case' && c.kind !== 'table_cell')
  const picked = shuffle(pool).slice(0, QUICK_CHECK_SIZE)
  const allBacks = cards.map((c) => c.back)
  return picked.map((card) => {
    const distractorPool = allBacks.filter((b) => b !== card.back)
    const distractors = shuffle(distractorPool).slice(0, 3)
    const options = shuffle([card.back, ...distractors])
    return { card, options, correctIndex: options.indexOf(card.back) }
  })
}

export function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [chapter, setChapter] = useState<LibraryChapter | null>(null)
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [highlights, setHighlights] = useState<LibraryHighlight[]>([])
  const [linkedTopics, setLinkedTopics] = useState<AcademyTopic[]>([])
  const [linkedPatients, setLinkedPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [quickCheck, setQuickCheck] = useState<QuickCheckQuestion[]>([])
  const [qcIndex, setQcIndex] = useState(0)
  const [qcAnswer, setQcAnswer] = useState<number | null>(null)

  const articleRef = useRef<HTMLDivElement>(null)
  const persistedPctRef = useRef(0)
  const livePctRef = useRef(0)

  async function reload() {
    if (!id) return
    const [chapterRow, cardRows, highlightRows, topicIds] = await Promise.all([
      getLibraryChapter(id),
      listLibraryCardsForChapter(id),
      listLibraryHighlights(id),
      listTopicIdsForChapter(id),
    ])
    setChapter(chapterRow)
    setCards(cardRows)
    setHighlights(highlightRows)
    persistedPctRef.current = chapterRow?.readingPct ?? 0
    livePctRef.current = chapterRow?.readingPct ?? 0
    setQuickCheck(buildQuickCheck(cardRows))
    setQcIndex(0)
    setQcAnswer(null)
    if (topicIds.length > 0) {
      const allTopics = await listAcademyTopics()
      setLinkedTopics(allTopics.filter((t) => topicIds.includes(t.id)))
      const patientIdSets = await Promise.all(topicIds.map((tid) => listPatientIdsForTopic(tid)))
      const patientIds = Array.from(new Set(patientIdSets.flat()))
      if (patientIds.length > 0) {
        const allPatients = await listPatients()
        setLinkedPatients(allPatients.filter((p) => patientIds.includes(p.id)))
      } else {
        setLinkedPatients([])
      }
    } else {
      setLinkedTopics([])
      setLinkedPatients([])
    }
  }

  useEffect(() => {
    setLoading(true)
    reload()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load chapter'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Track reading progress as a fraction of the article's scrolled height,
  // persisting the furthest point reached (never regresses) every ~15s and
  // on unmount, and logging the equivalent page count toward the daily goal.
  useEffect(() => {
    function onScroll() {
      const el = articleRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight * 0.5
      const scrolled = window.innerHeight * 0.5 - rect.top
      const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((scrolled / total) * 100))) : 0
      if (pct > livePctRef.current) livePctRef.current = pct
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    const interval = setInterval(() => void persistProgress(), 15000)
    return () => {
      window.removeEventListener('scroll', onScroll)
      clearInterval(interval)
      void persistProgress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id])

  async function persistProgress() {
    if (!chapter) return
    const pct = livePctRef.current
    if (pct <= persistedPctRef.current) return
    const deltaPct = pct - persistedPctRef.current
    const deltaPages = chapter.pages ? Math.round((deltaPct / 100) * chapter.pages) : 0
    persistedPctRef.current = pct
    try {
      const promotesToReading = chapter.status === 'unread'
      const updated = await updateLibraryChapter(chapter.id, {
        readingPct: pct,
        status: promotesToReading ? 'reading' : undefined,
      })
      setChapter(updated)
      if (deltaPages > 0) await logPagesRead(deltaPages)
    } catch {
      // best-effort — reading progress isn't critical path
    }
  }

  async function handleMakeCard(payload: MakeCardPayload) {
    if (!id) return
    try {
      const card = await addLibraryCard({
        chapterId: id,
        kind: 'cloze',
        front: payload.front,
        back: payload.back,
        options: null,
        sectionNumber: payload.sectionNumber,
        page: chapter?.startPage ?? null,
        sourceText: payload.sourceText,
        patientId: null,
      })
      setCards((prev) => [...prev, card])
      setMessage(`Card added: …${payload.sourceText.length > 28 ? payload.sourceText.slice(0, 28) + '…' : payload.sourceText}…`)
      setTimeout(() => setMessage(null), 2400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card')
    }
  }

  async function handleHighlight(payload: { sectionNumber: string | null; text: string }) {
    if (!id) return
    try {
      const h = await addLibraryHighlight({ chapterId: id, sectionNumber: payload.sectionNumber, kind: 'highlight', text: payload.text, noteText: null })
      setHighlights((prev) => [...prev, h])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save highlight')
    }
  }

  async function handleMakeCardsFromTable(payload: MakeCardsFromTablePayload) {
    if (!id) return
    try {
      const created = await addLibraryCards(
        payload.cards.map((c) => ({
          chapterId: id,
          kind: 'table_cell' as const,
          front: c.front,
          back: c.back,
          options: null,
          sectionNumber: payload.sectionNumber,
          page: chapter?.startPage ?? null,
          sourceText: null,
          patientId: null,
        }))
      )
      setCards((prev) => [...prev, ...created])
      setMessage(`${created.length} cards from table`)
      setTimeout(() => setMessage(null), 2400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cards')
    }
  }

  function handleQcAnswer(optionIndex: number) {
    setQcAnswer(optionIndex)
    const q = quickCheck[qcIndex]
    const correct = optionIndex === q.correctIndex
    const next = scheduleFsrs(q.card, correct ? 'good' : 'again')
    void updateLibraryCardFsrs(q.card.id, next.next).then((updated) => {
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    })
  }

  function handleQcNext() {
    setQcIndex((i) => i + 1)
    setQcAnswer(null)
  }

  async function handleFinishChapter(rating: FsrsRating) {
    if (!chapter) return
    try {
      const results = await Promise.all(
        cards.map(async (c) => {
          const next = scheduleFsrs(c, rating)
          return updateLibraryCardFsrs(c.id, next.next)
        })
      )
      setCards(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update cards')
    }
  }

  async function handleMarkRead() {
    if (!chapter) return
    try {
      const allMastered = cards.length > 0 && cards.every((c) => isCardMastered(c))
      const nextStatus = allMastered ? 'mastered' : cards.length > 0 ? 'carded' : 'read'
      const updated = await updateLibraryChapter(chapter.id, { status: nextStatus, readingPct: 100 })
      setChapter(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chapter')
    }
  }

  const sections = useMemo(() => parseSections(chapter?.note), [chapter?.note])
  const minutesLeft = useMemo(() => estimateMinutesLeft(chapter?.note, chapter?.readingPct ?? 0), [chapter?.note, chapter?.readingPct])
  const dueCount = cards.filter((c) => new Date(c.due) <= new Date()).length
  const masteredCount = cards.filter((c) => isCardMastered(c)).length
  const masteryPct = cards.length > 0 ? Math.round((masteredCount / cards.length) * 100) : null

  if (!id) return null
  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>
  if (!chapter) return <p className="empty-state">Chapter not found.</p>

  return (
    <div className="np-page">
      <div className="rd">
        <header className="rhead np-fade">
          <div className="crumb">
            <Link to="/academy">Library</Link>
            <span>›</span>
            <span>
              Part {chapter.partRoman} · {chapter.partTitle}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: 'var(--navy-800)',
                color: '#fff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                lineHeight: 1,
              }}
            >
              <span style={{ fontSize: 9, color: '#A9C6FF', fontWeight: 700, letterSpacing: '.08em' }}>CH</span>
              <b style={{ fontSize: 20 }}>{chapter.chapterNumber}</b>
            </span>
            <h1>{chapter.title}</h1>
          </div>
          <div className="rmeta">
            <span className="chip2">
              p. {chapter.startPage}–{chapter.endPage} · {chapter.pages} pp
            </span>
            <span className="chip2">
              <CalendarIcon width={14} height={14} />≈ {minutesLeft} min left
            </span>
            {cards.length > 0 && (
              <span className="chip2" style={{ color: '#5131B5', borderColor: '#E2D9FB' }}>
                <QuizIcon width={14} height={14} />
                {cards.length} cards · {dueCount} due
              </span>
            )}
            {masteryPct != null && (
              <span className="chip2" style={{ color: '#17663A', borderColor: '#CDEBD9' }}>
                Mastery {masteryPct}%
              </span>
            )}
          </div>
          <div className="prog" aria-label={`${chapter.readingPct}% of chapter read`}>
            <i style={{ width: `${chapter.readingPct}%` }} />
          </div>
        </header>

        {sections.length > 0 && (
          <>
            <nav className="toc np-fade" aria-label="Sections">
              <h2>Sections</h2>
              {sections.map((s) => (
                <a key={s.number} href={`#${s.anchor}`}>
                  <span className="n">{s.number}</span>
                  <span className="np-fa" dir="rtl">
                    {s.title}
                  </span>
                  <span className="st" />
                </a>
              ))}
              {quickCheck.length > 0 && (
                <div style={{ borderTop: '1px solid #EDF1F7', marginTop: 8, paddingTop: 8 }}>
                  <a href="#qc">
                    <span className="n">✓</span>
                    <span>Quick check</span>
                    <span />
                  </a>
                </div>
              )}
            </nav>
            <nav className="tocchips" aria-label="Sections">
              {sections.map((s) => (
                <a key={s.number} href={`#${s.anchor}`} dir="rtl">
                  <b style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.number}</b> {s.title}
                </a>
              ))}
              {quickCheck.length > 0 && <a href="#qc">✓ Quick check</a>}
            </nav>
          </>
        )}

        <div className="stack">
          <article className="art-card np-fade" ref={articleRef}>
            {message && <p className="patient-meta">{message}</p>}
            {chapter.note ? (
              <ChapterProse note={chapter.note} cards={cards} highlights={highlights} onMakeCard={handleMakeCard} onHighlight={handleHighlight} onMakeCardsFromTable={handleMakeCardsFromTable} />
            ) : (
              <p className="empty-state">No content written for this chapter yet.</p>
            )}
          </article>

          {quickCheck.length > 0 && qcIndex < quickCheck.length && (
            <section className="qc np-fade" id="qc">
              <div className="head" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span className="eyebrow" style={{ color: '#B9A6F5' }}>
                    QUICK CHECK
                  </span>
                  <h2>
                    Question {qcIndex + 1} of {quickCheck.length}
                  </h2>
                </div>
                <div className="qdots">
                  {quickCheck.map((_, i) => (
                    <i key={i} className={i === qcIndex ? 'on' : ''} />
                  ))}
                </div>
              </div>
              <p className="qq" dir="rtl">
                {quickCheck[qcIndex].card.front.replace(/_____/g, '؟')}
              </p>
              <div className="opts" dir="rtl">
                {quickCheck[qcIndex].options.map((opt, i) => (
                  <button
                    key={i}
                    className={qcAnswer == null ? 'opt' : i === quickCheck[qcIndex].correctIndex ? 'opt right' : i === qcAnswer ? 'opt wrong' : 'opt'}
                    disabled={qcAnswer != null}
                    onClick={() => handleQcAnswer(i)}
                  >
                    <span className="k">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                ))}
              </div>
              {qcAnswer != null && (
                <button className="np-btn white" onClick={handleQcNext}>
                  {qcIndex + 1 < quickCheck.length ? 'Next question' : 'Done'}
                </button>
              )}
            </section>
          )}

          <section className="np-card np-fade">
            <h2>Finish this chapter</h2>
            <span className="np-small">Rate how well you understood it — card intervals for this chapter adjust accordingly.</span>
            <div className="diff">
              <button type="button" onClick={() => void handleFinishChapter('hard')}>
                Difficult
              </button>
              <button type="button" onClick={() => void handleFinishChapter('good')}>
                Moderate
              </button>
              <button type="button" onClick={() => void handleFinishChapter('easy')}>
                Easy
              </button>
            </div>
            <div className="endrow">
              <button type="button" className="np-btn ghost" onClick={() => void handleMarkRead()}>
                Mark chapter read
              </button>
              <button type="button" className="np-btn" onClick={() => navigate(`/academy/review?chapter=${chapter.id}`)} disabled={dueCount === 0}>
                Review {dueCount} due cards
              </button>
            </div>
          </section>
        </div>

        <aside className="side-r">
          {cards.length > 0 && (
            <section className="np-card np-fade" style={{ gap: 10 }}>
              <h2>Cards from this chapter</h2>
              <div className="fcount">
                <b>{cards.length}</b>
                <span className="np-small">
                  cards · {dueCount} due today
                  <br />
                  Highlight text to add one
                </span>
              </div>
            </section>
          )}
          {(linkedTopics.length > 0 || linkedPatients.length > 0) && (
            <section className="np-card np-fade" style={{ gap: 8 }}>
              <h2>Linked</h2>
              {linkedTopics.map((t) => (
                <Link className="chip2" to={`/academy/${t.id}`} key={t.id} style={{ textDecoration: 'none' }}>
                  <AcademyIcon width={14} height={14} />
                  Academy: {t.name}
                </Link>
              ))}
              {linkedPatients.map((p) => (
                <Link className="chip2" to={`/patients/${p.id}`} key={p.id} style={{ textDecoration: 'none' }}>
                  <PatientsIcon width={14} height={14} />
                  <span className="np-fa">{p.name}</span>
                </Link>
              ))}
            </section>
          )}
          {linkedPatients.length > 0 && (
            <PatientCaseCardForm chapterId={chapter.id} patients={linkedPatients} onCreated={(card) => setCards((prev) => [...prev, card])} />
          )}
        </aside>
      </div>
    </div>
  )
}
