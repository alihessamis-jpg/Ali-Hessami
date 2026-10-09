import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
  deleteAcademyAttachmentFile,
  getAcademyAttachmentSignedUrl,
  uploadAcademyAttachmentFile,
} from '../lib/storage'
import { scheduleReview } from '../lib/srs'
import { sortSubTopics } from '../lib/sortSubTopics'
import { getAcademyDiagram } from '../lib/academyDiagrams'
import { formatAge } from '../lib/patientAge'
import { isolateLatinRuns } from '../lib/bidiText'
import { MarkdownSection, type MakeCardPayload } from '../components/MarkdownSection'
import { toShamsi } from '../lib/shamsi'
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

// A card counts as "learned" once it has survived into at least the third
// Leitner box (7+ day interval) — used for the header's mastery % only.
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

const emptyProgress: AcademyProgress = { topicId: '', intervalIndex: -1, lastReviewed: null, nextReview: null, reviewHistory: [] }

export function AcademyTopicPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
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

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [showBackToTop, setShowBackToTop] = useState(false)

  useEffect(() => {
    function onScroll() {
      setShowBackToTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    if (!id || !session) return
    Promise.all([listAcademyTopics(), listAcademyProgress(session.user.id)])
      .then(([topics, progressRows]) => {
        setAllTopics(topics)
        const found = topics.find((t) => t.id === id) ?? null
        setTopic(found)
        setDraft(found)
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
      const updated = await updateAcademyTopic(id, draft)
      setTopic(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleDelete() {
    if (!id || !topic) return
    if (!window.confirm(`Delete "${topic.name}"? This cannot be undone.`)) return
    try {
      await deleteAcademyTopic(id)
      navigate('/academy/topics')
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
  if (error) return <p className="form-error">{error}</p>
  if (!topic || !draft) return <p>Loading…</p>

  const linkedPatients = allPatients.filter((p) => linkedPatientIds.includes(p.id))
  const linkablePatients = allPatients.filter(
    (p) => !linkedPatientIds.includes(p.id) && (patientQuery === '' || p.name.toLowerCase().includes(patientQuery.toLowerCase()))
  )

  const parentTopic = allTopics.find((t) => t.id === topic.parentTopicId) ?? null
  const subTopics = sortSubTopics(allTopics.filter((t) => t.parentTopicId === id))
  const parentOptions = allTopics.filter((t) => t.id !== id && t.parentTopicId !== id)

  const today = new Date().toISOString().slice(0, 10)
  const dueCardCount = cards.filter((c) => !c.nextReview || c.nextReview <= today).length
  const masteredCardCount = cards.filter((c) => c.intervalIndex >= MASTERED_INTERVAL_INDEX).length
  const masteryPct = cards.length > 0 ? Math.round((masteredCardCount / cards.length) * 100) : null

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/academy/topics" className="back-link">
            ← My topics
          </Link>
          {parentTopic && (
            <div>
              <Link to={`/academy/${parentTopic.id}`} className="patient-meta">
                {parentTopic.name}
              </Link>
              <span className="patient-meta"> / </span>
            </div>
          )}
          <h1>{topic.name}</h1>
        </div>
        <div className="form-actions">
          <button onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</button>
          <button className="link-button" onClick={() => void handleDelete()}>
            Delete topic
          </button>
        </div>
      </div>

      <div className="form-actions" style={{ marginBottom: 20, alignItems: 'center' }}>
        <label className="patient-meta" htmlFor="parent-topic-select">
          Parent topic
        </label>
        <select id="parent-topic-select" value={topic.parentTopicId ?? ''} onChange={(e) => void handleParentChange(e.target.value)}>
          <option value="">None (top-level topic)</option>
          {parentOptions.map((t) => (
            <option key={t.id} value={t.id}>
              {t.category ? `${t.category} — ` : ''}
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="calc-strip">
        <div>
          <span className="calc-label">Next review</span>
          <span className="calc-value">{progress.nextReview ? toShamsi(progress.nextReview) : '—'}</span>
        </div>
        <div>
          <span className="calc-label">Interval</span>
          <span className="calc-value">{progress.intervalIndex >= 0 ? `${progress.intervalIndex + 1}` : '—'}</span>
        </div>
        <div>
          <span className="calc-label">Reviews</span>
          <span className="calc-value">{progress.reviewHistory.length}</span>
        </div>
      </div>

      <div className="calc-strip" style={{ marginBottom: 20 }}>
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

      {(() => {
        const Diagram = getAcademyDiagram(topic)
        return (
          Diagram && (
            <div className="dash-card">
              <div className="dash-card-header">
                <h2 className="dash-card-title">Pathophysiology</h2>
              </div>
              <div className="academy-diagram">
                <Diagram />
              </div>
            </div>
          )
        )
      })()}

      {topic.keyPoints.length > 0 && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Key points</h2>
          </div>
          <ul className="study-link-list">
            {topic.keyPoints.map((k, i) => (
              <li key={i} dir="rtl">
                {isolateLatinRuns(k)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Study links</h2>
        </div>
        {topic.studyLinks.length === 0 ? (
          <p className="empty-state">
            No links yet — save a reference from UpToDate, NotebookLM, or a Claude conversation about this topic.
          </p>
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
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              addLink(
                `UpToDate: ${topic.name}`,
                `https://www.uptodate.com/contents/search?search=${encodeURIComponent(topic.name)}`
              )
            }
          >
            + UpToDate search
          </button>
          <button type="button" className="button-secondary" onClick={() => addLink('NotebookLM', 'https://notebooklm.google.com/')}>
            + NotebookLM
          </button>
        </div>
        <form
          className="inline-form"
          style={{ marginTop: 10 }}
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
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Attachments</h2>
        </div>
        <p className="patient-meta">PDF summaries, NotebookLM-style podcast audio, reference diagrams/images, or your self-made tests.</p>
        {error && <p className="form-error">{error}</p>}
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
        {attachments.length === 0 ? (
          <p className="empty-state">No attachments yet.</p>
        ) : (
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
                        <img
                          src={attachmentUrls[a.id]}
                          alt={a.filename ?? 'attachment'}
                          style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}
                        />
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
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Linked patients</h2>
        </div>
        <p className="patient-meta">
          Link real patients you've managed with this diagnosis to review their presentation and course alongside
          this topic.
        </p>
        {linkedPatients.length === 0 ? (
          <p className="empty-state">No patients linked yet.</p>
        ) : (
          <ul className="study-link-list">
            {linkedPatients.map((p) => (
              <li key={p.id}>
                <div>
                  <Link to={`/patients/${p.id}`} className="study-link">
                    {p.name}
                  </Link>
                  <span className="patient-meta">
                    {' '}
                    {[p.diagnosis, formatAge(p.age)].filter(Boolean).join(' · ')}
                  </span>
                  {(p.chiefComplaint || p.hpi) && (
                    <p className="patient-meta" style={{ marginTop: 2 }}>
                      {excerpt(p.chiefComplaint || p.hpi)}
                    </p>
                  )}
                </div>
                <button className="link-button" onClick={() => void handleUnlinkPatient(p.id)}>
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="inline-form"
          style={{ marginTop: 10 }}
          onSubmit={(e) => {
            e.preventDefault()
            void handleLinkPatient()
          }}
        >
          <input placeholder="Search patients…" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} />
          <select value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
            <option value="">Select a patient…</option>
            {linkablePatients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.diagnosis ? ` — ${p.diagnosis}` : ''}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!selectedPatientId}>
            Link
          </button>
        </form>
      </div>

      {subTopics.length > 0 && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Sub-topics</h2>
          </div>
          <ul className="study-link-list">
            {subTopics.map((t) => (
              <li key={t.id}>
                <Link to={`/academy/${t.id}`} className="study-link">
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {linkedReadingItems.length > 0 && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Related reading</h2>
          </div>
          <p className="patient-meta">Linked from Reading Reviews in the Study Hub — reviews stay tracked there.</p>
          <ul className="study-link-list">
            {linkedReadingItems.map((r) => {
              const doneCount = [r.review3dDone, r.review7dDone, r.review14dDone, r.review30dDone, r.review90dDone].filter(
                Boolean
              ).length
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
        </div>
      )}

      {editing ? (
        <div>
          <label style={{ display: 'block', marginBottom: 12 }}>
            Key points (one per line)
            <textarea
              value={draft.keyPoints.join('\n')}
              onChange={(e) => setDraft({ ...draft, keyPoints: e.target.value.split('\n') })}
            />
          </label>
          {SECTIONS.map(({ key, label }) => (
            <label key={key} style={{ display: 'block', marginBottom: 12 }}>
              {label}
              <textarea
                value={(draft[key] as string) ?? ''}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <label style={{ display: 'block', marginBottom: 12 }}>
            Case questions (one per line)
            <textarea
              value={draft.caseQuestions.join('\n')}
              onChange={(e) => setDraft({ ...draft, caseQuestions: e.target.value.split('\n') })}
            />
          </label>
          <button onClick={() => void handleSave()}>Save topic</button>
        </div>
      ) : (
        <div>
          {cardMessage && <p className="patient-meta">{cardMessage}</p>}
          {SECTIONS.some(({ key }) => topic[key]) && (
            <nav className="academy-toc" aria-label="Table of contents">
              {SECTIONS.filter(({ key }) => topic[key]).map(({ key, label }) => (
                <a key={key} href={`#sec-${key}`}>
                  {label}
                </a>
              ))}
            </nav>
          )}
          {SECTIONS.map(({ key, label }) =>
            topic[key] ? (
              <section key={key} id={`sec-${key}`} style={{ marginBottom: 16 }}>
                <button type="button" className="academy-section-toggle" onClick={() => toggleSection(key)}>
                  <h3>{label}</h3>
                  <span className={collapsedSections.has(key) ? 'academy-chevron collapsed' : 'academy-chevron'}>▾</span>
                </button>
                {!collapsedSections.has(key) && (
                  <>
                    <MarkdownSection
                      text={topic[key] as string}
                      sectionKey={key}
                      onMakeCard={(payload) => void handleMakeCard(key, payload)}
                      onMakeCardsFromTable={(payloads) => void handleMakeCardsFromTable(key, payloads)}
                    />
                    {key === 'caseStem' && topic.caseQuestions.length > 0 && (
                      <ol>
                        {topic.caseQuestions.map((q, i) => (
                          <li key={i} dir="rtl">
                            {isolateLatinRuns(q)}
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )}
              </section>
            ) : null
          )}
          {SECTIONS.every(({ key }) => !topic[key]) && (
            <p className="empty-state">No content yet — click Edit to write this topic up.</p>
          )}
          <div className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">Rate your recall</h2>
            </div>
            <p className="patient-meta">
              Topic-level Leitner schedule (next review above) — reviewing individual cards above also builds mastery.
            </p>
            <div className="form-actions">
              <button onClick={() => void handleReview('difficult')}>Difficult</button>
              <button onClick={() => void handleReview('moderate')}>Moderate</button>
              <button onClick={() => void handleReview('easy')}>Easy</button>
            </div>
          </div>
        </div>
      )}
      {showBackToTop && (
        <button
          type="button"
          className="academy-back-to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑ Back to top
        </button>
      )}
    </div>
  )
}
