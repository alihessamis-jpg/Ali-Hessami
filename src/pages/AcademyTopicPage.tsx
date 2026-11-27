import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  deleteAcademyTopic,
  listAcademyProgress,
  listAcademyTopics,
  saveAcademyProgress,
  updateAcademyTopic,
} from '../lib/api/academy'
import { addAcademyAttachment, deleteAcademyAttachment, listAcademyAttachments } from '../lib/api/academyAttachments'
import { linkTopicPatient, listPatientIdsForTopic, unlinkTopicPatient } from '../lib/api/academyTopicPatients'
import { addAcademyCard, addAcademyCards, listAcademyCardsForTopic } from '../lib/api/academyCards'
import { listPatients } from '../lib/api/patients'
import { listReadingItems } from '../lib/api/readingItems'
import {
  dailyCasesForCategories,
  getChapters,
  loadHub,
  pedNephRefs,
  type HubChapter,
  type HubData,
  type TopicDailyCase,
} from '../lib/api/topicHub'
import {
  deleteAcademyAttachmentFile,
  getAcademyAttachmentSignedUrl,
  uploadAcademyAttachmentFile,
} from '../lib/storage'
import { scheduleReview } from '../lib/srs'
import { sortSubTopics } from '../lib/sortSubTopics'
import { getAcademyDiagram } from '../lib/academyDiagrams'
import { formatAge } from '../lib/patientAge'
import { isolateLatinRuns } from '../lib/bidiText'
import {
  caseCategoriesForHub,
  categoryFa,
  linkChapterRefs,
  parseSummary,
  preserveLineBreaks,
  splitPersonalBlocks,
  statsForTopics,
  type ChapterRefResolver,
} from '../lib/topicHub'
import { DIFFICULTY_LABEL } from '../lib/dailyCase'
import { MarkdownSection, type MakeCardPayload } from '../components/MarkdownSection'
import { AccuracyBar, TopicBadges } from '../components/topicHub/TopicBadges'
import { useAssistant } from '../components/assistant/AssistantProvider'
import { toPersianDigits, toShamsi } from '../lib/shamsi'
import { useAuth } from '../context/AuthContext'
import type {
  AcademyAttachment,
  AcademyAttachmentKind,
  AcademyCard,
  AcademyProgress,
  AcademyTopic,
  Patient,
  ReadingItem,
  StudyLink,
} from '../types/domain'
import type { CaseDifficulty } from '../types/dailyCase'

// A card counts as "learned" once it has survived into at least the third
// Leitner box (7+ day interval) — used for the mastery % only.
const MASTERED_INTERVAL_INDEX = 2

function guessAttachmentKind(file: File): AcademyAttachmentKind {
  if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac)$/i.test(file.name)) return 'audio'
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
  if (file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg)$/i.test(file.name)) return 'image'
  return 'other'
}

function excerpt(text: string | null | undefined, max = 140): string {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// Fields of the edit form (unchanged from the previous topic page).
const SECTIONS: Array<{ key: keyof AcademyTopic; label: string }> = [
  { key: 'summary', label: 'Summary' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'reasoning', label: 'Clinical reasoning' },
  { key: 'tests', label: 'Tests' },
  { key: 'interpretation', label: 'Interpretation' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'redFlags', label: 'Red flags' },
  { key: 'pearls', label: 'Pearls' },
  { key: 'selfTest', label: 'Self test' },
  { key: 'caseStem', label: 'Case stem' },
  { key: 'caseDiscussion', label: 'Case discussion' },
]

// «بالینی» tab — accordion order; empty fields are hidden.
const CLINICAL: Array<{ key: keyof AcademyTopic; label: string }> = [
  { key: 'presentation', label: 'تظاهرات بالینی · Presentation' },
  { key: 'reasoning', label: 'استدلال بالینی · Reasoning' },
  { key: 'tests', label: 'آزمایش‌ها · Tests' },
  { key: 'interpretation', label: 'تفسیر · Interpretation' },
  { key: 'imaging', label: 'تصویربرداری · Imaging' },
  { key: 'treatment', label: 'درمان · Treatment' },
  { key: 'redFlags', label: 'Red flags' },
  { key: 'pearls', label: 'Pearls' },
  { key: 'selfTest', label: 'خودآزمایی · Self test' },
]

type TabKey = 'summary' | 'clinical' | 'sources' | 'questions' | 'patients' | 'case'
const TABS: [TabKey, string][] = [
  ['summary', 'خلاصه'],
  ['clinical', 'بالینی'],
  ['sources', 'منابع'],
  ['questions', 'سؤال‌ها'],
  ['patients', 'بیمارهای من'],
  ['case', 'کیس'],
]

// Same rule as the Library's part bars: unread 0, reading = its %, anything past it 100.
const chapterPct = (c: HubChapter) => (c.status === 'unread' ? 0 : c.status === 'reading' ? c.readingPct : 100)
const CHAPTER_STATUS: Record<string, string> = { unread: 'Unread', reading: 'Reading', read: 'Read', carded: 'Carded', mastered: 'Mastered' }

const emptyProgress: AcademyProgress = { topicId: '', intervalIndex: -1, lastReviewed: null, nextReview: null, reviewHistory: [] }

/** Chapter numbers referenced as «(Ch.N …)» anywhere in the topic's text. */
function referencedChapterNumbers(t: AcademyTopic): number[] {
  const text = [t.summary, t.presentation, t.reasoning, t.tests, t.interpretation, t.imaging, t.treatment, t.redFlags, t.pearls, t.selfTest, t.caseDiscussion]
    .filter(Boolean)
    .join('\n')
  const nums = new Set<number>()
  for (const m of text.matchAll(/\(Ch\.\s?(\d+)[^)]*\)/g)) {
    nums.add(Number(m[1]))
    for (const inner of m[0].matchAll(/Ch\.\s?(\d+)/g)) nums.add(Number(inner[1]))
  }
  return [...nums]
}

/**
 * Topic Hub · one topic: summary, clinical sections, linked chapters, board
 * questions, my patients and cases — plus the existing study tools (links,
 * attachments, cards, Leitner review, editing).
 */
export function AcademyTopicPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { open: openAssistant } = useAssistant()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as TabKey | null
  const tab: TabKey = TABS.some(([k]) => k === tabParam) ? (tabParam as TabKey) : 'summary'
  const setTab = (k: TabKey) => {
    const p = new URLSearchParams(params)
    if (k === 'summary') p.delete('tab')
    else p.set('tab', k)
    setParams(p, { replace: true })
  }

  const [topic, setTopic] = useState<AcademyTopic | null>(null)
  const [allTopics, setAllTopics] = useState<AcademyTopic[]>([])
  const [progress, setProgress] = useState<AcademyProgress>(emptyProgress)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AcademyTopic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkLabel, setLinkLabel] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  const [attachments, setAttachments] = useState<AcademyAttachment[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [linkedPatientIds, setLinkedPatientIds] = useState<string[]>([])
  const [patientQuery, setPatientQuery] = useState('')
  const [selectedPatientId, setSelectedPatientId] = useState('')

  const [linkedReadingItems, setLinkedReadingItems] = useState<ReadingItem[]>([])

  const [cards, setCards] = useState<AcademyCard[]>([])
  const [cardMessage, setCardMessage] = useState<string | null>(null)

  // Topic Hub data
  const [hub, setHub] = useState<HubData | null>(null)
  const [chapters, setChapters] = useState<HubChapter[] | null>(null)
  const [refs, setRefs] = useState<{ ids: Map<number, string>; anchors: Set<string> } | null>(null)
  const [dailyCases, setDailyCases] = useState<TopicDailyCase[] | null>(null)
  const [quickReview, setQuickReview] = useState(false)
  const [openClinical, setOpenClinical] = useState<Set<string>>(new Set(['presentation']))
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [notesSaved, setNotesSaved] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    function onScroll() {
      setShowBackToTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!id || !session) return
    setRevealed(false)
    setQuickReview(false)
    Promise.all([listAcademyTopics(), listAcademyProgress(session.user.id)])
      .then(([topics, progressRows]) => {
        setAllTopics(topics)
        const found = topics.find((t) => t.id === id) ?? null
        setTopic(found)
        setDraft(found)
        setNotesDraft(found?.myNotes ?? '')
        setProgress(progressRows.find((p) => p.topicId === id) ?? { ...emptyProgress, topicId: id })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load topic'))
  }, [id, session])

  useEffect(() => {
    if (!id) return
    listAcademyAttachments(id)
      .then((rows) => {
        setAttachments(rows)
        rows.forEach((a) => {
          getAcademyAttachmentSignedUrl(a.storagePath)
            .then((url) => setAttachmentUrls((prev) => ({ ...prev, [a.id]: url })))
            .catch(() => undefined)
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load attachments'))
    Promise.all([listPatients(), listPatientIdsForTopic(id)])
      .then(([patients, patientIds]) => {
        setAllPatients(patients)
        setLinkedPatientIds(patientIds)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load linked patients'))
    listReadingItems()
      .then((rows) => setLinkedReadingItems(rows.filter((r) => r.topicId === id)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load related reading'))
    listAcademyCardsForTopic(id)
      .then(setCards)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cards'))
  }, [id])

  // hub stats + linked chapters
  useEffect(() => {
    if (!id) return
    setChapters(null)
    loadHub()
      .then(async (h) => {
        setHub(h)
        setChapters(await getChapters(h.index.chaptersByTopic.get(id) ?? []))
      })
      .catch((err) => setError(`Topic Hub: ${err instanceof Error ? err.message : String(err)}`))
  }, [id])

  // «(Ch.N §M)» → Pediatric Nephrology chapter ids / anchors
  useEffect(() => {
    if (!topic) return
    pedNephRefs(referencedChapterNumbers(topic))
      .then(setRefs)
      .catch(() => setRefs({ ids: new Map(), anchors: new Set() }))
  }, [topic])

  // Daily Cases of the matching category
  useEffect(() => {
    if (!topic) return
    dailyCasesForCategories(caseCategoriesForHub(topic.category))
      .then(setDailyCases)
      .catch(() => setDailyCases([]))
  }, [topic])

  const resolver: ChapterRefResolver | null = useMemo(
    () =>
      refs
        ? { chapterId: (n) => refs.ids.get(n) ?? null, hasAnchor: (n, s) => refs.anchors.has(`ch${n}-s${s}`) }
        : null,
    [refs],
  )

  async function handleMakeCard(sectionKey: string, payload: MakeCardPayload) {
    if (!id) return
    try {
      const card = await addAcademyCard({ topicId: id, kind: 'cloze', sectionKey, bookPage: null, ...payload })
      setCards((prev) => [...prev, card])
      setCardMessage('Card added')
      setTimeout(() => setCardMessage((m) => (m === 'Card added' ? null : m)), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card')
    }
  }

  async function handleMakeCardsFromTable(sectionKey: string, payloads: MakeCardPayload[]) {
    if (!id) return
    try {
      const created = await addAcademyCards(
        payloads.map((p) => ({ topicId: id, kind: 'cell' as const, sectionKey, bookPage: null, ...p }))
      )
      setCards((prev) => [...prev, ...created])
      setCardMessage(`${created.length} card${created.length === 1 ? '' : 's'} added`)
      setTimeout(() => setCardMessage(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cards')
    }
  }

  async function handleAttachmentFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !id || !session) return
    setUploadingAttachment(true)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        const kind = guessAttachmentKind(file)
        const path = await uploadAcademyAttachmentFile(session.user.id, id, file)
        const attachment = await addAcademyAttachment(id, path, file.name, kind)
        setAttachments((prev) => [attachment, ...prev])
        getAcademyAttachmentSignedUrl(path)
          .then((url) => setAttachmentUrls((prev) => ({ ...prev, [attachment.id]: url })))
          .catch(() => undefined)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload attachment')
    } finally {
      setUploadingAttachment(false)
    }
  }

  function handleAttachmentDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    void handleAttachmentFiles(e.dataTransfer.files)
  }

  async function handleDeleteAttachment(a: AcademyAttachment) {
    try {
      await deleteAcademyAttachment(a.id)
      await deleteAcademyAttachmentFile(a.storagePath).catch(() => undefined)
      setAttachments((prev) => prev.filter((x) => x.id !== a.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment')
    }
  }

  async function handleLinkPatient() {
    if (!id || !selectedPatientId) return
    try {
      await linkTopicPatient(id, selectedPatientId)
      setLinkedPatientIds((prev) => [...prev, selectedPatientId])
      setSelectedPatientId('')
      setPatientQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link patient')
    }
  }

  async function handleUnlinkPatient(patientId: string) {
    if (!id) return
    try {
      await unlinkTopicPatient(id, patientId)
      setLinkedPatientIds((prev) => prev.filter((pid) => pid !== patientId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink patient')
    }
  }

  async function handleSave() {
    if (!draft || !id) return
    try {
      // A hand edit keeps the «✅ بازبینی‌شده» line in the summary and adds a
      // separate «ویرایش دستی — تاریخ» label (edited_at).
      const updated = await updateAcademyTopic(id, { ...draft, editedAt: new Date().toISOString() })
      setTopic(updated)
      setAllTopics((prev) => prev.map((t) => (t.id === id ? updated : t)))
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleSaveNotes() {
    if (!id || notesDraft == null) return
    try {
      const updated = await updateAcademyTopic(id, { myNotes: notesDraft.trim() ? notesDraft : null })
      setTopic(updated)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note')
    }
  }

  async function handleDelete() {
    if (!id || !topic) return
    if (!window.confirm(`Delete "${topic.name}"? This cannot be undone.`)) return
    try {
      await deleteAcademyTopic(id)
      navigate('/academy?tab=topics')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete topic')
    }
  }

  async function handleReview(rating: 'easy' | 'moderate' | 'difficult') {
    if (!id || !session) return
    const next = scheduleReview(progress, rating)
    setProgress({ ...next, topicId: id })
    try {
      await saveAcademyProgress(session.user.id, id, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    }
  }

  async function persistLinks(next: StudyLink[]) {
    if (!id || !topic) return
    try {
      const updated = await updateAcademyTopic(id, { studyLinks: next })
      setTopic(updated)
      setDraft((d) => (d ? { ...d, studyLinks: next } : d))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save study links')
    }
  }

  function addLink(label: string, url: string) {
    if (!topic || !url.trim()) return
    void persistLinks([...topic.studyLinks, { label: label.trim() || url.trim(), url: url.trim() }])
  }

  function removeLink(index: number) {
    if (!topic) return
    void persistLinks(topic.studyLinks.filter((_, i) => i !== index))
  }

  async function handleParentChange(parentTopicId: string) {
    if (!id) return
    try {
      const updated = await updateAcademyTopic(id, { parentTopicId: parentTopicId || null })
      setTopic(updated)
      setDraft((d) => (d ? { ...d, parentTopicId: updated.parentTopicId } : d))
      setAllTopics((prev) => prev.map((t) => (t.id === id ? updated : t)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update parent topic')
    }
  }

  if (!id) return null
  if (error && !topic) return <p className="form-error">{error}</p>
  if (!topic || !draft) return <p className="np-page">Loading…</p>

  /** Book text and personal blocks (pale blue), with «(Ch.N §M)» linked to the Reader. */
  const rich = (key: string, text: string | null | undefined) =>
    text ? (
      <div className="th-rich">
        {splitPersonalBlocks(text).map((seg, i) => {
          const lined = preserveLineBreaks(seg.text)
          const md = resolver ? linkChapterRefs(lined, resolver) : lined
          const body = (
            <MarkdownSection
              text={md}
              sectionKey={key}
              onMakeCard={(payload) => void handleMakeCard(key, payload)}
              onMakeCardsFromTable={(payloads) => void handleMakeCardsFromTable(key, payloads)}
            />
          )
          return seg.personal ? (
            <div key={i} className="th-personal">
              <span className="th-personal-tag">📝 یادداشت شخصی — متن کتاب نیست</span>
              {body}
            </div>
          ) : (
            <div key={i}>{body}</div>
          )
        })}
      </div>
    ) : null

  const summary = parseSummary(topic.summary)
  const linkedPatients = allPatients.filter((p) => linkedPatientIds.includes(p.id))
  const linkablePatients = allPatients.filter(
    (p) =>
      !linkedPatientIds.includes(p.id) &&
      (patientQuery === '' ||
        `${p.name} ${p.code ?? ''} ${p.diagnosis ?? ''}`.toLowerCase().includes(patientQuery.toLowerCase()))
  )
  const parentTopic = allTopics.find((t) => t.id === topic.parentTopicId) ?? null
  const subTopics = sortSubTopics(allTopics.filter((t) => t.parentTopicId === id))
  const parentOptions = allTopics.filter((t) => t.id !== id && t.parentTopicId !== id)
  const today = new Date().toISOString().slice(0, 10)
  const dueCardCount = cards.filter((c) => !c.nextReview || c.nextReview <= today).length
  const masteredCardCount = cards.filter((c) => c.intervalIndex >= MASTERED_INTERVAL_INDEX).length
  const masteryPct = cards.length > 0 ? Math.round((masteredCardCount / cards.length) * 100) : null
  const stats = hub ? statsForTopics(hub.index, [id]) : null
  const chapterIds = hub?.index.chaptersByTopic.get(id) ?? []
  const practiceHref = (filter: 'all' | 'wrong' | 'unanswered') =>
    `/study?tab=boardQuestions&chapterIds=${chapterIds.join(',')}${filter === 'all' ? '' : `&filter=${filter}`}&scope=${encodeURIComponent(topic.name)}`
  const Diagram = getAcademyDiagram(topic)
  // key points as a markdown list, so «(Ch.67 §2)» refs become links too
  const keyPointsMd = topic.keyPoints
    .filter((k) => k.trim())
    .map((k) => `- ${k.trim()}`)
    .join('\n')
  const clinicalFields = CLINICAL.filter(({ key }) => (topic[key] as string | null | undefined)?.trim())

  return (
    <div className="np-page th-page" dir="rtl">
      {/* ---------------------------------------------------------------- header */}
      <header className="np-card th-head np-fade">
        <nav className="th-crumbs np-small" aria-label="مسیر">
          <Link to="/academy?tab=topics">Topic Hub</Link>
          <span aria-hidden="true">›</span>
          <span>{categoryFa(topic.category)}</span>
          {parentTopic && (
            <>
              <span aria-hidden="true">›</span>
              <Link to={`/academy/${parentTopic.id}`} dir="auto">
                {parentTopic.name}
              </Link>
            </>
          )}
        </nav>
        <h1 className="th-title" dir="auto">
          {topic.name}
        </h1>
        <div className="th-head-meta">
          <span className="dc-chip">{categoryFa(topic.category)}</span>
          <TopicBadges topic={topic} showEdited />
          {stats && <AccuracyBar accuracy={stats.accuracy} attempts={stats.attempts} />}
        </div>
        <div className="th-head-actions">
          <button
            type="button"
            className="np-btn sm"
            onClick={() => openAssistant({ mode: 'study', topicId: id, chapterId: chapterIds[0] ?? null })}
          >
            ✨ بپرس از دستیار
          </button>
          <button type="button" className="np-btn ghost sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'انصراف' : 'ویرایش'}
          </button>
          <button type="button" className="np-btn ghost sm th-danger" onClick={() => void handleDelete()}>
            حذف
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </header>

      {editing ? (
        <EditForm
          draft={draft}
          setDraft={setDraft}
          topic={topic}
          parentOptions={parentOptions}
          onParentChange={(v) => void handleParentChange(v)}
          onSave={() => void handleSave()}
        />
      ) : (
        <>
          <div className="th-tabs np-fade" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {label}
                {k === 'questions' && stats ? <span className="th-tab-n">{toPersianDigits(stats.questions)}</span> : null}
                {k === 'patients' && linkedPatients.length ? <span className="th-tab-n">{toPersianDigits(linkedPatients.length)}</span> : null}
              </button>
            ))}
          </div>
          {cardMessage && <p className="np-small">{cardMessage}</p>}

          {/* ---------------------------------------------------------------- summary */}
          {tab === 'summary' && (
            <>
              <section className="np-card th-sec">
                <div className="np-head">
                  <h2>خلاصه</h2>
                  <button type="button" className={`np-chip ${quickReview ? 'on' : ''}`} onClick={() => setQuickReview((v) => !v)}>
                    ⚡ حالت مرور سریع
                  </button>
                </div>
                {quickReview ? (
                  <div className="th-quick">
                    {topic.keyPoints.filter(Boolean).length > 0 && (
                      <>
                        <h3>Key points</h3>
                        {rich('keyPoints', keyPointsMd)}
                      </>
                    )}
                    {topic.pearls && (
                      <>
                        <h3>Pearls</h3>
                        {rich('pearls', topic.pearls)}
                      </>
                    )}
                    {topic.redFlags && (
                      <>
                        <h3>Red flags</h3>
                        {rich('redFlags', topic.redFlags)}
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {summary.body ? rich('summary', summary.body) : <p className="empty-state">خلاصه‌ای ثبت نشده.</p>}
                    {(summary.statusText || summary.refs) && (
                      <p className="th-refs" dir="auto">
                        {summary.statusText && <span>{summary.status === 'reviewed' ? '✅' : '⚠️'} {summary.statusText}</span>}
                        {summary.refs && <span>{summary.refs}</span>}
                      </p>
                    )}
                    {topic.keyPoints.filter(Boolean).length > 0 && (
                      <>
                        <h3>Key points</h3>
                        {rich('keyPoints', keyPointsMd)}
                      </>
                    )}
                  </>
                )}
              </section>

              <section className="np-card th-sec th-mynotes">
                <h2>📝 یادداشت من</h2>
                <div className="np-field">
                  <textarea
                    rows={4}
                    dir="auto"
                    value={notesDraft ?? ''}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="نکته‌ی بالینی خودت، تجربه‌ی بیمار، چیزی که سر کلاس شنیدی…"
                  />
                </div>
                <div className="dc-actions">
                  <button type="button" className="np-btn sm" disabled={(notesDraft ?? '') === (topic.myNotes ?? '')} onClick={() => void handleSaveNotes()}>
                    ذخیره‌ی یادداشت
                  </button>
                  {notesSaved && <span className="np-small">ذخیره شد</span>}
                </div>
              </section>

              {Diagram && (
                <section className="np-card th-sec" dir="ltr">
                  <h2>Pathophysiology</h2>
                  <div className="academy-diagram">
                    <Diagram />
                  </div>
                </section>
              )}

              {subTopics.length > 0 && (
                <section className="np-card th-sec">
                  <h2>زیرمبحث‌ها</h2>
                  <div className="th-sublist">
                    {subTopics.map((t) => (
                      <Link key={t.id} to={`/academy/${t.id}`} className="th-row">
                        <span className="th-row-main">
                          <b dir="auto">{t.name}</b>
                          <TopicBadges topic={t} />
                        </span>
                        {hub && <SubTopicStat hub={hub} topicId={t.id} />}
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              <details className="np-card th-sec th-tools">
                <summary>
                  <h2>ابزارهای مطالعه</h2>
                  <span className="np-small">
                    {toPersianDigits(cards.length)} کارت · {toPersianDigits(dueCardCount)} موعد · {toPersianDigits(topic.studyLinks.length)} لینک ·{' '}
                    {toPersianDigits(attachments.length)} پیوست
                  </span>
                </summary>

                <div className="calc-strip" dir="ltr">
                  <div>
                    <span className="calc-label">Next review</span>
                    <span className="calc-value">{progress.nextReview ? toShamsi(progress.nextReview) : '—'}</span>
                  </div>
                  <div>
                    <span className="calc-label">Cards</span>
                    <span className="calc-value">{cards.length}</span>
                  </div>
                  <div>
                    <span className="calc-label">Due</span>
                    <span className="calc-value">{dueCardCount}</span>
                  </div>
                  <div>
                    <span className="calc-label">Mastery</span>
                    <span className="calc-value">{masteryPct != null ? `${masteryPct}%` : '—'}</span>
                  </div>
                </div>
                <div className="th-recall">
                  <span className="np-small">یادآوری این مبحث را ارزیابی کن (Leitner):</span>
                  <div className="dc-actions">
                    <button type="button" className="np-btn ghost sm" onClick={() => void handleReview('difficult')}>
                      Difficult
                    </button>
                    <button type="button" className="np-btn ghost sm" onClick={() => void handleReview('moderate')}>
                      Moderate
                    </button>
                    <button type="button" className="np-btn ghost sm" onClick={() => void handleReview('easy')}>
                      Easy
                    </button>
                  </div>
                </div>

                <h3>Study links</h3>
                {topic.studyLinks.length === 0 ? (
                  <p className="np-small">No links yet — save a reference from UpToDate, NotebookLM, or a Claude conversation about this topic.</p>
                ) : (
                  <ul className="study-link-list">
                    {topic.studyLinks.map((l, i) => (
                      <li key={i}>
                        <a href={l.url} target="_blank" rel="noreferrer" className="study-link">
                          {l.label}
                        </a>
                        <button className="link-button" onClick={() => removeLink(i)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="dc-actions">
                  <button
                    type="button"
                    className="np-btn ghost sm"
                    onClick={() => addLink(`UpToDate: ${topic.name}`, `https://www.uptodate.com/contents/search?search=${encodeURIComponent(topic.name)}`)}
                  >
                    + UpToDate search
                  </button>
                  <button type="button" className="np-btn ghost sm" onClick={() => addLink('NotebookLM', 'https://notebooklm.google.com/')}>
                    + NotebookLM
                  </button>
                </div>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    addLink(linkLabel, linkUrl)
                    setLinkLabel('')
                    setLinkUrl('')
                  }}
                >
                  <input placeholder="Label (e.g. Claude summary)" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
                  <input placeholder="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
                  <button type="submit">Add link</button>
                </form>

                <h3>Attachments</h3>
                <div
                  className={`dropzone ${dragOver ? 'dropzone--active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleAttachmentDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf,audio/*,.mp3,.wav,.m4a,.ogg,image/*,.jpg,.jpeg,.png,.gif,.webp,.svg"
                    multiple
                    hidden
                    onChange={(e) => void handleAttachmentFiles(e.target.files)}
                  />
                  <span className="dropzone-icon">↑</span>
                  <strong>{uploadingAttachment ? 'Uploading…' : 'Drop PDFs, audio, or images here'}</strong>
                  <span className="dropzone-hint">Choose one or more files</span>
                </div>
                {attachments.length > 0 && (
                  <ul className="study-link-list">
                    {attachments.map((a) => (
                      <li key={a.id}>
                        <div style={{ flex: 1 }}>
                          <strong>{a.filename ?? a.kind}</strong>
                          <span className="patient-meta"> · {a.kind} · {toShamsi(a.createdAt.slice(0, 10))}</span>
                          {a.kind === 'audio' && attachmentUrls[a.id] && (
                            <div style={{ marginTop: 6 }}>
                              <audio controls src={attachmentUrls[a.id]} style={{ width: '100%' }} />
                            </div>
                          )}
                          {a.kind === 'image' && attachmentUrls[a.id] && (
                            <div style={{ marginTop: 6 }}>
                              <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                                <img src={attachmentUrls[a.id]} alt={a.filename ?? 'attachment'} style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }} />
                              </a>
                            </div>
                          )}
                          {a.kind !== 'audio' && a.kind !== 'image' && attachmentUrls[a.id] && (
                            <div style={{ marginTop: 4 }}>
                              <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer" className="study-link">
                                Open {a.kind === 'pdf' ? 'PDF' : 'file'}
                              </a>
                            </div>
                          )}
                        </div>
                        <button className="link-button" onClick={() => void handleDeleteAttachment(a)}>
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {linkedReadingItems.length > 0 && (
                  <>
                    <h3>Related reading</h3>
                    <ul className="study-link-list">
                      {linkedReadingItems.map((r) => {
                        const doneCount = [r.review3dDone, r.review7dDone, r.review14dDone, r.review30dDone, r.review90dDone].filter(Boolean).length
                        return (
                          <li key={r.id}>
                            <div>
                              <strong>{r.title}</strong>
                              <span className="patient-meta">
                                {' '}
                                {[r.source, `Read ${toShamsi(r.dateRead)}`, `${doneCount}/5 reviews done`].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </details>
            </>
          )}

          {/* ---------------------------------------------------------------- clinical */}
          {tab === 'clinical' && (
            <section className="np-card th-sec">
              {clinicalFields.length === 0 ? (
                <p className="empty-state">بخش بالینی هنوز نوشته نشده — از «ویرایش» اضافه کن.</p>
              ) : (
                <>
                  <div className="dc-actions">
                    <button type="button" className="np-btn ghost sm" onClick={() => setOpenClinical(new Set(clinicalFields.map((f) => f.key as string)))}>
                      باز کردن همه
                    </button>
                    <button type="button" className="np-btn ghost sm" onClick={() => setOpenClinical(new Set())}>
                      بستن همه
                    </button>
                  </div>
                  {clinicalFields.map(({ key, label }) => {
                    const open = openClinical.has(key as string)
                    return (
                      <div key={key} className={`th-acc-item ${open ? 'open' : ''}`}>
                        <button
                          type="button"
                          className="th-acc-head"
                          aria-expanded={open}
                          onClick={() =>
                            setOpenClinical((prev) => {
                              const n = new Set(prev)
                              if (n.has(key as string)) n.delete(key as string)
                              else n.add(key as string)
                              return n
                            })
                          }
                        >
                          <span>{label}</span>
                          <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                        </button>
                        {open && rich(key as string, topic[key] as string)}
                      </div>
                    )
                  })}
                </>
              )}
            </section>
          )}

          {/* ---------------------------------------------------------------- sources */}
          {tab === 'sources' && (
            <section className="np-card th-sec">
              <h2>فصل‌های مرتبط</h2>
              {chapters == null ? (
                <p className="np-small">در حال بارگذاری…</p>
              ) : chapters.length === 0 ? (
                <p className="empty-state">هنوز فصلی به این مبحث وصل نشده.</p>
              ) : (
                <div className="th-chapters">
                  {chapters.map((c) => (
                    <Link key={c.id} to={`/academy/reader/${c.id}`} className="th-chapter" dir="ltr">
                      <span className="th-ch-num">{c.chapterNumber}</span>
                      <span className="th-ch-main">
                        <b>{c.title}</b>
                        <span className="np-small">
                          {c.bookTitle}
                          {c.startPage != null ? ` · pp. ${c.startPage}–${c.endPage ?? ''}` : ''}
                        </span>
                        <span className="th-ch-bar" aria-label={`reading ${c.readingPct}%`}>
                          <i style={{ width: `${chapterPct(c)}%` }} />
                        </span>
                      </span>
                      <span className="np-small th-ch-pct">{CHAPTER_STATUS[c.status] ?? c.status}{c.status === 'reading' ? ` ${c.readingPct}%` : ''}</span>
                    </Link>
                  ))}
                </div>
              )}
              {summary.refs && (
                <p className="th-refs" dir="auto">
                  {summary.refs}
                </p>
              )}
            </section>
          )}

          {/* ---------------------------------------------------------------- questions */}
          {tab === 'questions' && (
            <section className="np-card th-sec">
              <h2>سؤال‌های بورد</h2>
              {!stats ? (
                <p className="np-small">در حال بارگذاری…</p>
              ) : (
                <>
                  <div className="dc-kpis">
                    <div>
                      <b>{toPersianDigits(stats.questions)}</b>
                      <span>سؤال</span>
                    </div>
                    <div>
                      <b>{toPersianDigits(stats.attempted)}</b>
                      <span>جواب‌داده</span>
                    </div>
                    <div>
                      <b>{stats.accuracy == null ? '—' : `${toPersianDigits(Math.round(stats.accuracy))}٪`}</b>
                      <span>درصد درستی</span>
                    </div>
                    <div>
                      <b>{stats.lastAttemptAt ? toShamsi(stats.lastAttemptAt.slice(0, 10)) : '—'}</b>
                      <span>آخرین تمرین</span>
                    </div>
                  </div>
                  <p className="np-small">
                    از {toPersianDigits(stats.chapters)} فصل مرتبط · {toPersianDigits(stats.attempts)} پاسخ ثبت‌شده
                  </p>
                  <div className="th-practice">
                    <PracticeLink to={practiceHref('all')} n={stats.questions} label="تمرین سؤال‌های این مبحث" primary />
                    <PracticeLink to={practiceHref('wrong')} n={stats.wrongQuestions} label="فقط غلط‌ها" />
                    <PracticeLink to={practiceHref('unanswered')} n={stats.unanswered} label="فقط جواب‌نداده‌ها" />
                  </div>
                </>
              )}
            </section>
          )}

          {/* ---------------------------------------------------------------- patients */}
          {tab === 'patients' && (
            <section className="np-card th-sec">
              <h2>بیمارهای من</h2>
              {linkedPatients.length === 0 ? (
                <p className="empty-state">هنوز بیماری به این مبحث وصل نشده.</p>
              ) : (
                <div className="th-patients">
                  {linkedPatients.map((p) => (
                    <div key={p.id} className="th-patient">
                      <Link to={`/patients/${p.id}`} className="th-patient-main">
                        <b dir="auto">{p.name}</b>
                        <span className="np-small" dir="auto">
                          {[p.code, formatAge(p.age), p.diagnosis].filter(Boolean).join(' · ')}
                        </span>
                        {(p.chiefComplaint || p.hpi) && (
                          <span className="np-small" dir="auto">
                            {excerpt(p.chiefComplaint || p.hpi)}
                          </span>
                        )}
                      </Link>
                      <button type="button" className="link-button" onClick={() => void handleUnlinkPatient(p.id)}>
                        حذف لینک
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <h3>افزودن بیمار به این مبحث</h3>
              <div className="np-f2">
                <div className="np-field">
                  <input dir="auto" placeholder="جستجو (نام، کد، تشخیص)…" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
                </div>
                <div className="np-field">
                  <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
                    <option value="">انتخاب بیمار…</option>
                    {linkablePatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.diagnosis ? ` — ${p.diagnosis}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="button" className="np-btn sm" disabled={!selectedPatientId} onClick={() => void handleLinkPatient()}>
                افزودن
              </button>
            </section>
          )}

          {/* ---------------------------------------------------------------- case */}
          {tab === 'case' && (
            <>
              <section className="np-card th-sec">
                <h2>کیس این مبحث</h2>
                {!topic.caseStem ? (
                  <p className="empty-state">کیسی برای این مبحث نوشته نشده.</p>
                ) : (
                  <>
                    {rich('caseStem', topic.caseStem)}
                    {topic.caseQuestions.filter(Boolean).length > 0 && (
                      <ol className="th-caseq">
                        {topic.caseQuestions.filter(Boolean).map((q, i) => (
                          <li key={i}>{isolateLatinRuns(q)}</li>
                        ))}
                      </ol>
                    )}
                    {topic.caseDiscussion &&
                      (revealed ? (
                        <div className="th-reveal">
                          <h3>پاسخ و بحث</h3>
                          {rich('caseDiscussion', topic.caseDiscussion)}
                        </div>
                      ) : (
                        <button type="button" className="np-btn" onClick={() => setRevealed(true)}>
                          اول خودت جواب بده — بعد نمایش پاسخ
                        </button>
                      ))}
                  </>
                )}
              </section>
              <section className="np-card th-sec">
                <h2>Daily Caseهای مرتبط</h2>
                {dailyCases == null ? (
                  <p className="np-small">در حال بارگذاری…</p>
                ) : dailyCases.length === 0 ? (
                  <p className="empty-state">هنوز Daily Caseی در این دسته ساخته نشده.</p>
                ) : (
                  <div className="th-sublist">
                    {dailyCases.map((c) => (
                      <Link key={c.id} to={`/daily-case/${c.id}`} className="th-row">
                        <span className="th-row-main">
                          <b dir="auto">{c.title}</b>
                          <span className="th-row-sub np-small">
                            {toShamsi(c.caseDate)} · {DIFFICULTY_LABEL[c.difficulty as CaseDifficulty] ?? c.difficulty}
                            {c.finalDiagnosis ? <span dir="auto"> · {c.finalDiagnosis}</span> : null}
                          </span>
                        </span>
                        <span className="th-row-stat">
                          {c.bestScore != null ? (
                            <b className={c.bestScore >= 70 ? 'th-ok' : 'th-low'}>{toPersianDigits(c.bestScore)}</b>
                          ) : (
                            <span className="np-small">{c.inProgress ? 'در حال حل' : 'حل‌نشده'}</span>
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

      {showBackToTop && (
        <button type="button" className="academy-back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↑ Back to top
        </button>
      )}
    </div>
  )
}

function SubTopicStat({ hub, topicId }: { hub: HubData; topicId: string }) {
  const s = statsForTopics(hub.index, [topicId])
  return (
    <span className="th-row-stat">
      <AccuracyBar accuracy={s.accuracy} attempts={s.attempts} />
    </span>
  )
}

function PracticeLink({ to, n, label, primary = false }: { to: string; n: number; label: string; primary?: boolean }) {
  if (!n) {
    return (
      <span className={`np-btn ${primary ? '' : 'ghost'} sm th-disabled`} aria-disabled="true">
        {label} (۰)
      </span>
    )
  }
  return (
    <Link to={to} className={`np-btn ${primary ? '' : 'ghost'} sm`}>
      {label} ({toPersianDigits(n)})
    </Link>
  )
}

function EditForm({
  draft,
  setDraft,
  topic,
  parentOptions,
  onParentChange,
  onSave,
}: {
  draft: AcademyTopic
  setDraft: (d: AcademyTopic) => void
  topic: AcademyTopic
  parentOptions: AcademyTopic[]
  onParentChange: (id: string) => void
  onSave: () => void
}) {
  return (
    <section className="np-card th-sec th-edit" dir="ltr">
      <p className="np-small" dir="rtl">
        ذخیره‌ی دستی، خط «✅ بازبینی‌شده» را حذف نمی‌کند؛ فقط برچسب «ویرایش دستی — تاریخ» اضافه می‌شود.
      </p>
      <label className="np-field">
        <span className="np-lbl">Parent topic</span>
        <select value={topic.parentTopicId ?? ''} onChange={(e) => onParentChange(e.target.value)}>
          <option value="">None (top-level topic)</option>
          {parentOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.category ? `${t.category} — ` : ''}
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="np-field">
        <span className="np-lbl">Key points (one per line)</span>
        <textarea rows={6} dir="auto" value={draft.keyPoints.join('\n')} onChange={(e) => setDraft({ ...draft, keyPoints: e.target.value.split('\n') })} />
      </label>
      {SECTIONS.map(({ key, label }) => (
        <label key={key} className="np-field">
          <span className="np-lbl">{label}</span>
          <textarea rows={6} dir="auto" value={(draft[key] as string) ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
        </label>
      ))}
      <label className="np-field">
        <span className="np-lbl">Case questions (one per line)</span>
        <textarea rows={4} dir="auto" value={draft.caseQuestions.join('\n')} onChange={(e) => setDraft({ ...draft, caseQuestions: e.target.value.split('\n') })} />
      </label>
      <button type="button" className="np-btn" onClick={onSave}>
        Save topic
      </button>
    </section>
  )
}
