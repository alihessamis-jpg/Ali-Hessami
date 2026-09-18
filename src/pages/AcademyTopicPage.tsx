import { useEffect, useRef, useState, type DragEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listAcademyProgress, listAcademyTopics, saveAcademyProgress, updateAcademyTopic } from '../lib/api/academy'
import { addAcademyAttachment, deleteAcademyAttachment, listAcademyAttachments } from '../lib/api/academyAttachments'
import { linkTopicPatient, listPatientIdsForTopic, unlinkTopicPatient } from '../lib/api/academyTopicPatients'
import { listPatients } from '../lib/api/patients'
import { listReadingItems } from '../lib/api/readingItems'
import {
  deleteAcademyAttachmentFile,
  getAcademyAttachmentSignedUrl,
  uploadAcademyAttachmentFile,
} from '../lib/storage'
import { scheduleReview } from '../lib/srs'
import { toShamsi } from '../lib/shamsi'
import { useAuth } from '../context/AuthContext'
import type {
  AcademyAttachment,
  AcademyAttachmentKind,
  AcademyProgress,
  AcademyTopic,
  Patient,
  ReadingItem,
  StudyLink,
} from '../types/domain'

function guessAttachmentKind(file: File): AcademyAttachmentKind {
  if (file.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac)$/i.test(file.name)) return 'audio'
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf'
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
  const { session } = useAuth()
  const [topic, setTopic] = useState<AcademyTopic | null>(null)
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

  useEffect(() => {
    if (!id || !session) return
    Promise.all([listAcademyTopics(), listAcademyProgress(session.user.id)])
      .then(([topics, progressRows]) => {
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
  }, [id])

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

  if (!id) return null
  if (error) return <p className="form-error">{error}</p>
  if (!topic || !draft) return <p>Loading…</p>

  const linkedPatients = allPatients.filter((p) => linkedPatientIds.includes(p.id))
  const linkablePatients = allPatients.filter(
    (p) => !linkedPatientIds.includes(p.id) && (patientQuery === '' || p.name.toLowerCase().includes(patientQuery.toLowerCase()))
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/academy" className="back-link">
            ← Academy
          </Link>
          <h1>{topic.name}</h1>
        </div>
        <button onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</button>
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

      <div className="form-actions" style={{ marginBottom: 20 }}>
        <button onClick={() => void handleReview('difficult')}>Difficult</button>
        <button onClick={() => void handleReview('moderate')}>Moderate</button>
        <button onClick={() => void handleReview('easy')}>Easy</button>
      </div>

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
        <p className="patient-meta">PDF summaries, NotebookLM-style podcast audio, or your self-made tests.</p>
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
            accept=".pdf,application/pdf,audio/*,.mp3,.wav,.m4a,.ogg"
            multiple
            hidden
            onChange={(e) => void handleAttachmentFiles(e.target.files)}
          />
          <span className="dropzone-icon">↑</span>
          <strong>{uploadingAttachment ? 'Uploading…' : 'Drop PDFs or audio files here'}</strong>
          <span className="dropzone-hint">Choose one or more files</span>
        </div>
        {attachments.length === 0 ? (
          <p className="empty-state">No attachments yet.</p>
        ) : (
          <ul className="study-link-list">
            {attachments.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.filename ?? a.kind}</strong>
                  <span className="patient-meta"> · {a.kind} · {toShamsi(a.createdAt.slice(0, 10))}</span>
                  {a.kind === 'audio' && attachmentUrls[a.id] && (
                    <div style={{ marginTop: 6 }}>
                      <audio controls src={attachmentUrls[a.id]} style={{ width: '100%' }} />
                    </div>
                  )}
                  {a.kind !== 'audio' && attachmentUrls[a.id] && (
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
                    {[p.diagnosis, p.age != null ? `${p.age}y` : null].filter(Boolean).join(' · ')}
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
          {SECTIONS.map(({ key, label }) => (
            <label key={key} style={{ display: 'block', marginBottom: 12 }}>
              {label}
              <textarea
                value={(draft[key] as string) ?? ''}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <button onClick={() => void handleSave()}>Save topic</button>
        </div>
      ) : (
        <div>
          {SECTIONS.map(({ key, label }) =>
            topic[key] ? (
              <section key={key} style={{ marginBottom: 16 }}>
                <h3>{label}</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{topic[key] as string}</p>
              </section>
            ) : null
          )}
          {SECTIONS.every(({ key }) => !topic[key]) && (
            <p className="empty-state">No content yet — click Edit to write this topic up.</p>
          )}
        </div>
      )}
    </div>
  )
}
