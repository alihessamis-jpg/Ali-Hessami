import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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

  function handleAttachmentDrop(e: DragEvent<HTMLButtonElement>) {
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
  const unlinkedTabAttachments = attachments[tab].filter((a) => !a.entryId)

  const activeList = tab === 'drug' ? filteredDrugs : filteredDialysis
  const activeAttachments = attachments[tab]

  function renderMed(d: DrugRefEntry | DialysisRefEntry) {
    const linkedAttachments = activeAttachments.filter((a) => a.entryId === d.id)
    const unlinkedAttachments = activeAttachments.filter((a) => !a.entryId)
    const isOpen = expandedId === d.id
    const fields: Array<[string, string | null | undefined]> =
      tab === 'drug'
        ? (() => {
            const drug = d as DrugRefEntry
            return [
              ['Indication', drug.indication],
              ['Normal dose', drug.normalDose],
              ['Pediatric dose', drug.pediatricDose],
              ['eGFR range', drug.egfrRange],
              ['Adjusted dose', drug.adjustedDose],
              ['Max dose', drug.maxDose],
              ['Frequency', drug.frequency],
            ]
          })()
        : (() => {
            const dial = d as DialysisRefEntry
            return [
              ['Indication', dial.indication],
              ['Pediatric dose', dial.pediatricDose],
              ['Route', dial.route],
              ['Frequency', dial.frequency],
              ['Max dose', dial.maxDose],
            ]
          })()
    return (
      <div key={d.id} className={isOpen ? 'ref-med open' : 'ref-med'}>
        <button type="button" className="ref-medb" onClick={() => setExpandedId(isOpen ? null : d.id)}>
          <span className="np-ic" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
              <path d="m9 9 6 6" />
            </svg>
          </span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'start' }}>
            <b style={{ fontSize: 14 }}>{d.medication}</b>
            {fields[0][1] && <span className="np-small">{fields[0][1]}</span>}
          </span>
          <svg className="ref-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        {isOpen && (
          <div className="ref-medbody">
            {fields
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <span key={label} style={{ fontSize: 13, color: '#3B4A60' }}>
                  <strong>{label}:</strong> {value}
                </span>
              ))}
            {d.notes && <span style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#3B4A60' }}>{d.notes}</span>}
            {linkedAttachments.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {linkedAttachments.map((a) =>
                  attachmentUrls[a.id] ? (
                    isImagePath(a.storagePath) ? (
                      <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        <img src={attachmentUrls[a.id]} alt={a.filename ?? 'Attachment'} style={{ maxWidth: 120, borderRadius: 10 }} />
                      </a>
                    ) : (
                      <a key={a.id} href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        Open PDF — {a.filename}
                      </a>
                    )
                  ) : (
                    <span key={a.id} className="np-small">Loading…</span>
                  )
                )}
              </div>
            )}
            <span className="np-small">Attachments: [{linkedAttachments.length}]</span>
            {unlinkedAttachments.length > 0 && (
              <label className="np-small" style={{ display: 'block' }}>
                Link an uploaded photo/PDF
                <select value="" onChange={(e) => e.target.value && void handleLinkAttachment(e.target.value, d.id)} style={{ marginTop: 4 }}>
                  <option value="">Choose a file…</option>
                  {unlinkedAttachments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.filename ?? 'Attachment'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="np-btn ghost sm"
              style={{ alignSelf: 'flex-start', color: '#B42318' }}
              onClick={() =>
                tab === 'drug'
                  ? void deleteDrugReference(d.id).then(() => setDrugs((prev) => prev.filter((x) => x.id !== d.id)))
                  : void deleteDialysisReference(d.id).then(() => setDialysis((prev) => prev.filter((x) => x.id !== d.id)))
              }
            >
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow cyan" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Reference</h1>
            <p className="np-sub">Your own verified dosing list — nothing pre-seeded, private to you.</p>
          </div>
          <svg className="np-art" width="84" height="84" viewBox="0 0 84 84" fill="none" aria-hidden="true">
            <g className="ref-pill">
              <rect x="14" y="30" width="56" height="24" rx="12" fill="#FFFFFF" />
              <path d="M42 30h16a12 12 0 0 1 0 24H42z" fill="#4F86E8" />
            </g>
            <circle cx="20" cy="18" r="4" fill="#7FD4FF" className="ref-dot-a" />
            <circle cx="66" cy="68" r="3" fill="#FFC46B" className="ref-dot-b" />
          </svg>
        </div>
      </section>

      <div className="np-toolbar np-fade" style={{ animationDelay: '.08s' }}>
        <div className="np-seg">
          <button type="button" className={tab === 'drug' ? 'on' : ''} onClick={() => setTab('drug')}>
            Drug dosing
          </button>
          <button type="button" className={tab === 'dialysis' ? 'on' : ''} onClick={() => setTab('dialysis')}>
            Dialysis medications
          </button>
        </div>
        <div className="np-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label className="np-sr" htmlFor="ref-search">
            Search medication
          </label>
          <input id="ref-search" placeholder="Search medication" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="np-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add entry
            </>
          )}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showForm && tab === 'drug' && (
        <form className="np-card np-fade" onSubmit={(e) => void handleAddDrug(e)}>
          <h2>Add drug dosing entry</h2>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="rd-med">Medication</label>
              <input id="rd-med" value={drugDraft.medication} onChange={(e) => setDrugDraft({ ...drugDraft, medication: e.target.value })} required />
            </div>
            <div className="np-field">
              <label htmlFor="rd-ind">Indication</label>
              <input id="rd-ind" value={drugDraft.indication} onChange={(e) => setDrugDraft({ ...drugDraft, indication: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-norm">Normal dose</label>
              <input id="rd-norm" value={drugDraft.normalDose} onChange={(e) => setDrugDraft({ ...drugDraft, normalDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-ped">Pediatric dose</label>
              <input id="rd-ped" value={drugDraft.pediatricDose} onChange={(e) => setDrugDraft({ ...drugDraft, pediatricDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-max">Max dose</label>
              <input id="rd-max" value={drugDraft.maxDose} onChange={(e) => setDrugDraft({ ...drugDraft, maxDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-egfr">eGFR range</label>
              <input id="rd-egfr" value={drugDraft.egfrRange} onChange={(e) => setDrugDraft({ ...drugDraft, egfrRange: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-adj">Adjusted dose</label>
              <input id="rd-adj" value={drugDraft.adjustedDose} onChange={(e) => setDrugDraft({ ...drugDraft, adjustedDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rd-freq">Frequency</label>
              <input id="rd-freq" value={drugDraft.frequency} onChange={(e) => setDrugDraft({ ...drugDraft, frequency: e.target.value })} />
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="rd-notes">Notes</label>
            <textarea id="rd-notes" rows={2} value={drugDraft.notes} onChange={(e) => setDrugDraft({ ...drugDraft, notes: e.target.value })} />
          </div>
          <button type="submit" className="np-btn">
            Save
          </button>
        </form>
      )}

      {showForm && tab === 'dialysis' && (
        <form className="np-card np-fade" onSubmit={(e) => void handleAddDialysis(e)}>
          <h2>Add dialysis medication entry</h2>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="rl-med">Medication</label>
              <input id="rl-med" value={dialysisDraft.medication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, medication: e.target.value })} required />
            </div>
            <div className="np-field">
              <label htmlFor="rl-ind">Indication</label>
              <input id="rl-ind" value={dialysisDraft.indication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, indication: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-ped">Pediatric dose</label>
              <input id="rl-ped" value={dialysisDraft.pediatricDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, pediatricDose: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-route">Route</label>
              <input id="rl-route" value={dialysisDraft.route} onChange={(e) => setDialysisDraft({ ...dialysisDraft, route: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-freq">Frequency</label>
              <input id="rl-freq" value={dialysisDraft.frequency} onChange={(e) => setDialysisDraft({ ...dialysisDraft, frequency: e.target.value })} />
            </div>
            <div className="np-field">
              <label htmlFor="rl-max">Max dose</label>
              <input id="rl-max" value={dialysisDraft.maxDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, maxDose: e.target.value })} />
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="rl-notes">Notes</label>
            <textarea id="rl-notes" rows={2} value={dialysisDraft.notes} onChange={(e) => setDialysisDraft({ ...dialysisDraft, notes: e.target.value })} />
          </div>
          <button type="submit" className="np-btn">
            Save
          </button>
        </form>
      )}

      <div className="np-grid2">
        {loading ? (
          <p>Loading…</p>
        ) : activeList.length === 0 ? (
          <section className="np-empty np-fade">
            <b style={{ fontSize: 15 }}>No entries yet</b>
            <span className="np-small">Add your first verified dosing entry above.</span>
          </section>
        ) : (
          <section className="np-card np-fade" style={{ animationDelay: '.14s', padding: '6px 16px', gap: 0 }}>
            {activeList.map((d) => renderMed(d))}
          </section>
        )}

        <section className="np-card np-fade" style={{ animationDelay: '.2s' }}>
          <h2>Attachments</h2>
          <span className="np-small">
            Photos or PDFs of tables, protocols or dosing charts for {tab === 'drug' ? 'drug dosing' : 'dialysis medications'}.
          </span>
          <button
            type="button"
            className="ref-drop"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e: DragEvent<HTMLButtonElement>) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleAttachmentDrop}
          >
            <svg className="ref-drop-frame" aria-hidden="true">
              <rect x="1" y="1" height="158" rx="17" style={{ width: 'calc(100% - 2px)' }} fill="none" stroke="#5B8EF0" strokeWidth={2} strokeDasharray="8 4" />
            </svg>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,application/pdf"
              multiple
              hidden
              onChange={(e) => void handleAttachmentFiles(e.target.files)}
            />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E5BD8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ref-drop-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <b style={{ fontSize: 14 }}>{uploadingAttachment ? 'Uploading…' : 'Drop images or PDFs'}</b>
            <span className="np-small">{dragOver ? 'Release to upload' : 'Choose one or more files'}</span>
          </button>
          {unlinkedTabAttachments.length === 0 ? (
            <span className="np-small">
              {attachments[tab].length === 0
                ? 'No attachments yet.'
                : 'Every attachment is linked to a medication — open it in the list to view.'}
            </span>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unlinkedTabAttachments.map((a) => (
                <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attachmentUrls[a.id] ? (
                    isImagePath(a.storagePath) ? (
                      <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        <img src={attachmentUrls[a.id]} alt={a.filename ?? 'Attachment'} style={{ maxWidth: '100%', borderRadius: 10 }} />
                      </a>
                    ) : (
                      <a href={attachmentUrls[a.id]} target="_blank" rel="noreferrer">
                        Open PDF — {a.filename}
                      </a>
                    )
                  ) : (
                    <span className="np-small">Loading…</span>
                  )}
                  <span className="np-small">{a.filename ?? 'Attachment'}</span>
                  <select value={a.entryId ?? ''} onChange={(e) => void handleLinkAttachment(a.id, e.target.value)}>
                    <option value="">Not linked to a medication</option>
                    {(tab === 'drug' ? drugs : dialysis).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.medication}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="link-button" style={{ alignSelf: 'flex-start' }} onClick={() => void handleDeleteAttachment(a)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
