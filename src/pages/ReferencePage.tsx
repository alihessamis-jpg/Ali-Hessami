import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import {
  addDialysisReference,
  deleteDialysisReference,
  listDialysisReference,
} from '../lib/api/dialysisReference'
import { addDrugReference, deleteDrugReference, listDrugReference } from '../lib/api/drugReference'
import {
  addReferenceAttachment,
  deleteReferenceAttachment,
  listReferenceAttachments,
  setReferenceAttachmentEntry,
} from '../lib/api/referenceAttachments'
import {
  deleteReferenceAttachmentFile,
  getReferenceAttachmentSignedUrl,
  uploadReferenceAttachmentFile,
} from '../lib/storage'
import { useAuth } from '../context/AuthContext'
import { ReferenceIcon } from '../components/icons'
import type { DialysisRefEntry, DrugRefEntry, ReferenceAttachment } from '../types/domain'

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(path)
}

type Tab = 'drug' | 'dialysis'

const emptyDrugDraft = {
  medication: '',
  indication: '',
  normalDose: '',
  pediatricDose: '',
  maxDose: '',
  egfrRange: '',
  adjustedDose: '',
  frequency: '',
  notes: '',
}

const emptyDialysisDraft = {
  medication: '',
  indication: '',
  pediatricDose: '',
  route: '',
  frequency: '',
  maxDose: '',
  notes: '',
}

export function ReferencePage() {
  const { session } = useAuth()
  const [tab, setTab] = useState<Tab>('drug')
  const [search, setSearch] = useState('')

  const [drugs, setDrugs] = useState<DrugRefEntry[]>([])
  const [dialysis, setDialysis] = useState<DialysisRefEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drugDraft, setDrugDraft] = useState(emptyDrugDraft)
  const [dialysisDraft, setDialysisDraft] = useState(emptyDialysisDraft)
  const [showForm, setShowForm] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [attachments, setAttachments] = useState<Record<Tab, ReferenceAttachment[]>>({ drug: [], dialysis: [] })
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([listDrugReference(), listDialysisReference()])
      .then(([d, dial]) => {
        setDrugs(d)
        setDialysis(dial)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reference data'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    listReferenceAttachments(tab)
      .then((rows) => {
        setAttachments((prev) => ({ ...prev, [tab]: rows }))
        rows.forEach((a) => {
          getReferenceAttachmentSignedUrl(a.storagePath)
            .then((url) => setAttachmentUrls((prev) => ({ ...prev, [a.id]: url })))
            .catch(() => undefined)
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load attachments'))
  }, [tab])

  async function handleAttachmentFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !session) return
    setUploadingAttachment(true)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        const path = await uploadReferenceAttachmentFile(session.user.id, file)
        const attachment = await addReferenceAttachment(tab, path, file.name)
        setAttachments((prev) => ({ ...prev, [tab]: [attachment, ...prev[tab]] }))
        getReferenceAttachmentSignedUrl(path)
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

  async function handleDeleteAttachment(a: ReferenceAttachment) {
    try {
      await deleteReferenceAttachment(a.id)
      await deleteReferenceAttachmentFile(a.storagePath).catch(() => undefined)
      setAttachments((prev) => ({ ...prev, [tab]: prev[tab].filter((x) => x.id !== a.id) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete attachment')
    }
  }

  async function handleLinkAttachment(attachmentId: string, entryId: string) {
    try {
      const updated = await setReferenceAttachmentEntry(attachmentId, entryId || null)
      setAttachments((prev) => ({ ...prev, [tab]: prev[tab].map((x) => (x.id === updated.id ? updated : x)) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link attachment')
    }
  }

  async function handleAddDrug(e: FormEvent) {
    e.preventDefault()
    if (!drugDraft.medication.trim()) return
    try {
      const entry = await addDrugReference({
        medication: drugDraft.medication.trim(),
        indication: drugDraft.indication || null,
        normalDose: drugDraft.normalDose || null,
        pediatricDose: drugDraft.pediatricDose || null,
        doseKg: null,
        maxDose: drugDraft.maxDose || null,
        egfrRange: drugDraft.egfrRange || null,
        adjustedDose: drugDraft.adjustedDose || null,
        frequency: drugDraft.frequency || null,
        notes: drugDraft.notes || null,
      })
      setDrugs((prev) => [...prev, entry].sort((a, b) => a.medication.localeCompare(b.medication)))
      setDrugDraft(emptyDrugDraft)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    }
  }

  async function handleAddDialysis(e: FormEvent) {
    e.preventDefault()
    if (!dialysisDraft.medication.trim()) return
    try {
      const entry = await addDialysisReference({
        medication: dialysisDraft.medication.trim(),
        indication: dialysisDraft.indication || null,
        pediatricDose: dialysisDraft.pediatricDose || null,
        route: dialysisDraft.route || null,
        frequency: dialysisDraft.frequency || null,
        maxDose: dialysisDraft.maxDose || null,
        notes: dialysisDraft.notes || null,
      })
      setDialysis((prev) => [...prev, entry].sort((a, b) => a.medication.localeCompare(b.medication)))
      setDialysisDraft(emptyDialysisDraft)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    }
  }

  const filteredDrugs = drugs.filter((d) => d.medication.toLowerCase().includes(search.toLowerCase()))
  const filteredDialysis = dialysis.filter((d) => d.medication.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <ReferenceIcon />
          </span>
          Reference
        </h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'Add entry'}</button>
      </div>

      <p className="empty-state">
        This is your own personal reference list — nothing is pre-seeded. Add entries you've verified
        yourself; each clinician's list is private to them.
      </p>

      <nav className="tab-bar">
        <button className={tab === 'drug' ? 'tab active' : 'tab'} onClick={() => setTab('drug')}>
          Drug dosing
        </button>
        <button className={tab === 'dialysis' ? 'tab active' : 'tab'} onClick={() => setTab('dialysis')}>
          Dialysis medications
        </button>
      </nav>

      <input
        placeholder="Search medication…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, width: '100%', maxWidth: 320 }}
      />

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Attachments</h2>
        </div>
        <p className="patient-meta">
          Photos or PDFs of tables, protocols, or other reference material for{' '}
          {tab === 'drug' ? 'drug dosing' : 'dialysis medications'}.
        </p>
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
            accept="image/*,.pdf,application/pdf"
            multiple
            hidden
            onChange={(e) => void handleAttachmentFiles(e.target.files)}
          />
          <span className="dropzone-icon">↑</span>
          <strong>{uploadingAttachment ? 'Uploading…' : 'Drop images or PDFs here'}</strong>
          <span className="dropzone-hint">Choose one or more files</span>
        </div>
        {attachments[tab].length === 0 ? (
          <p className="empty-state">No attachments yet.</p>
        ) : (
          <ul className="document-grid">
            {attachments[tab].map((a) => (
              <li key={a.id} className="document-card">
                <div className="document-card-preview">
                  {attachmentUrls[a.id] ? (
                    isImagePath(a.storagePath) ? (
                      <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        <img src={attachmentUrls[a.id]} alt={a.filename ?? 'Attachment'} />
                      </a>
                    ) : (
                      <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer" className="document-card-pdf">
                        Open PDF
                      </a>
                    )
                  ) : (
                    <span className="empty-state">Loading…</span>
                  )}
                </div>
                <div className="document-card-meta">
                  <span className="patient-meta">{a.filename ?? 'Attachment'}</span>
                  <select
                    value={a.entryId ?? ''}
                    onChange={(e) => void handleLinkAttachment(a.id, e.target.value)}
                    style={{ width: '100%', margin: '6px 0' }}
                  >
                    <option value="">Not linked to a medication</option>
                    {(tab === 'drug' ? drugs : dialysis).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.medication}
                      </option>
                    ))}
                  </select>
                  <button className="link-button" onClick={() => void handleDeleteAttachment(a)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showForm && tab === 'drug' && (
        <form className="soap-form" onSubmit={(e) => void handleAddDrug(e)}>
          <div className="field-grid">
            <label>
              Medication
              <input value={drugDraft.medication} onChange={(e) => setDrugDraft({ ...drugDraft, medication: e.target.value })} required />
            </label>
            <label>
              Indication
              <input value={drugDraft.indication} onChange={(e) => setDrugDraft({ ...drugDraft, indication: e.target.value })} />
            </label>
            <label>
              Normal dose
              <input value={drugDraft.normalDose} onChange={(e) => setDrugDraft({ ...drugDraft, normalDose: e.target.value })} />
            </label>
            <label>
              Pediatric dose
              <input value={drugDraft.pediatricDose} onChange={(e) => setDrugDraft({ ...drugDraft, pediatricDose: e.target.value })} />
            </label>
            <label>
              Max dose
              <input value={drugDraft.maxDose} onChange={(e) => setDrugDraft({ ...drugDraft, maxDose: e.target.value })} />
            </label>
            <label>
              eGFR range
              <input value={drugDraft.egfrRange} onChange={(e) => setDrugDraft({ ...drugDraft, egfrRange: e.target.value })} />
            </label>
            <label>
              Adjusted dose
              <input value={drugDraft.adjustedDose} onChange={(e) => setDrugDraft({ ...drugDraft, adjustedDose: e.target.value })} />
            </label>
            <label>
              Frequency
              <input value={drugDraft.frequency} onChange={(e) => setDrugDraft({ ...drugDraft, frequency: e.target.value })} />
            </label>
          </div>
          <label>
            Notes
            <textarea value={drugDraft.notes} onChange={(e) => setDrugDraft({ ...drugDraft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {showForm && tab === 'dialysis' && (
        <form className="soap-form" onSubmit={(e) => void handleAddDialysis(e)}>
          <div className="field-grid">
            <label>
              Medication
              <input value={dialysisDraft.medication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, medication: e.target.value })} required />
            </label>
            <label>
              Indication
              <input value={dialysisDraft.indication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, indication: e.target.value })} />
            </label>
            <label>
              Pediatric dose
              <input value={dialysisDraft.pediatricDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, pediatricDose: e.target.value })} />
            </label>
            <label>
              Route
              <input value={dialysisDraft.route} onChange={(e) => setDialysisDraft({ ...dialysisDraft, route: e.target.value })} />
            </label>
            <label>
              Frequency
              <input value={dialysisDraft.frequency} onChange={(e) => setDialysisDraft({ ...dialysisDraft, frequency: e.target.value })} />
            </label>
            <label>
              Max dose
              <input value={dialysisDraft.maxDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, maxDose: e.target.value })} />
            </label>
          </div>
          <label>
            Notes
            <textarea value={dialysisDraft.notes} onChange={(e) => setDialysisDraft({ ...dialysisDraft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : tab === 'drug' ? (
        filteredDrugs.length === 0 ? (
          <p className="empty-state">No drug reference entries yet.</p>
        ) : (
          <div className="dash-card">
            {filteredDrugs.map((d) => {
              const linkedAttachments = attachments.drug.filter((a) => a.entryId === d.id)
              const unlinkedAttachments = attachments.drug.filter((a) => a.entryId !== d.id)
              const isOpen = expandedId === d.id
              return (
                <div key={d.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : d.id)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text)',
                      cursor: 'pointer',
                      textAlign: 'start',
                      padding: 0,
                    }}
                  >
                    <strong>{d.medication}</strong>
                    <span className={`topic-picker-caret ${isOpen ? 'open' : ''}`}>▸</span>
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 8 }}>
                      {[
                        ['Indication', d.indication],
                        ['Normal dose', d.normalDose],
                        ['Pediatric dose', d.pediatricDose],
                        ['eGFR range', d.egfrRange],
                        ['Adjusted dose', d.adjustedDose],
                        ['Max dose', d.maxDose],
                        ['Frequency', d.frequency],
                      ]
                        .filter(([, value]) => value)
                        .map(([label, value]) => (
                          <p className="patient-meta" key={label}>
                            <strong>{label}:</strong> {value}
                          </p>
                        ))}
                      {d.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{d.notes}</p>}
                      {linkedAttachments.length > 0 && (
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0' }}>
                          {linkedAttachments.map((a) =>
                            attachmentUrls[a.id] ? (
                              isImagePath(a.storagePath) ? (
                                <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                                  <img src={attachmentUrls[a.id]} alt={a.filename ?? 'Attachment'} style={{ maxWidth: 160, borderRadius: 8 }} />
                                </a>
                              ) : (
                                <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                                  Open PDF — {a.filename}
                                </a>
                              )
                            ) : (
                              <span key={a.id} className="empty-state">Loading…</span>
                            )
                          )}
                        </div>
                      )}
                      {unlinkedAttachments.length > 0 && (
                        <label className="patient-meta" style={{ display: 'block', marginBottom: 8 }}>
                          Link an uploaded photo/PDF:
                          <select value="" onChange={(e) => e.target.value && void handleLinkAttachment(e.target.value, d.id)}>
                            <option value="">Choose a file…</option>
                            {unlinkedAttachments.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.filename ?? 'Attachment'}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="form-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() =>
                            void deleteDrugReference(d.id).then(() => setDrugs((prev) => prev.filter((x) => x.id !== d.id)))
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : filteredDialysis.length === 0 ? (
        <p className="empty-state">No dialysis reference entries yet.</p>
      ) : (
        <div className="dash-card">
          {filteredDialysis.map((d) => {
            const linkedAttachments = attachments.dialysis.filter((a) => a.entryId === d.id)
            const unlinkedAttachments = attachments.dialysis.filter((a) => a.entryId !== d.id)
            const isOpen = expandedId === d.id
            return (
              <div key={d.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : d.id)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'start',
                    padding: 0,
                  }}
                >
                  <strong>{d.medication}</strong>
                  <span className={`topic-picker-caret ${isOpen ? 'open' : ''}`}>▸</span>
                </button>
                {isOpen && (
                  <div style={{ marginTop: 8 }}>
                    {[
                      ['Indication', d.indication],
                      ['Pediatric dose', d.pediatricDose],
                      ['Route', d.route],
                      ['Frequency', d.frequency],
                      ['Max dose', d.maxDose],
                    ]
                      .filter(([, value]) => value)
                      .map(([label, value]) => (
                        <p className="patient-meta" key={label}>
                          <strong>{label}:</strong> {value}
                        </p>
                      ))}
                    {d.notes && <p style={{ whiteSpace: 'pre-wrap' }}>{d.notes}</p>}
                    {linkedAttachments.length > 0 && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0' }}>
                        {linkedAttachments.map((a) =>
                          attachmentUrls[a.id] ? (
                            isImagePath(a.storagePath) ? (
                              <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                                <img src={attachmentUrls[a.id]} alt={a.filename ?? 'Attachment'} style={{ maxWidth: 160, borderRadius: 8 }} />
                              </a>
                            ) : (
                              <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                                Open PDF — {a.filename}
                              </a>
                            )
                          ) : (
                            <span key={a.id} className="empty-state">Loading…</span>
                          )
                        )}
                      </div>
                    )}
                    {unlinkedAttachments.length > 0 && (
                      <label className="patient-meta" style={{ display: 'block', marginBottom: 8 }}>
                        Link an uploaded photo/PDF:
                        <select value="" onChange={(e) => e.target.value && void handleLinkAttachment(e.target.value, d.id)}>
                          <option value="">Choose a file…</option>
                          {unlinkedAttachments.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.filename ?? 'Attachment'}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="form-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() =>
                          void deleteDialysisReference(d.id).then(() =>
                            setDialysis((prev) => prev.filter((x) => x.id !== d.id))
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
