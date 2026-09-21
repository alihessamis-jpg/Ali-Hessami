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
          <table className="data-table">
            <thead>
              <tr>
                <th>Medication</th>
                <th>Indication</th>
                <th>Normal dose</th>
                <th>Pediatric dose</th>
                <th>eGFR range</th>
                <th>Adjusted dose</th>
                <th>Max dose</th>
                <th>Frequency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDrugs.map((d) => (
                <tr key={d.id}>
                  <td>{d.medication}</td>
                  <td>{d.indication}</td>
                  <td>{d.normalDose}</td>
                  <td>{d.pediatricDose}</td>
                  <td>{d.egfrRange}</td>
                  <td>{d.adjustedDose}</td>
                  <td>{d.maxDose}</td>
                  <td>{d.frequency}</td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() =>
                        void deleteDrugReference(d.id).then(() => setDrugs((prev) => prev.filter((x) => x.id !== d.id)))
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : filteredDialysis.length === 0 ? (
        <p className="empty-state">No dialysis reference entries yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Indication</th>
              <th>Pediatric dose</th>
              <th>Route</th>
              <th>Frequency</th>
              <th>Max dose</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredDialysis.map((d) => (
              <tr key={d.id}>
                <td>{d.medication}</td>
                <td>{d.indication}</td>
                <td>{d.pediatricDose}</td>
                <td>{d.route}</td>
                <td>{d.frequency}</td>
                <td>{d.maxDose}</td>
                <td>
                  <button
                    className="link-button"
                    onClick={() =>
                      void deleteDialysisReference(d.id).then(() =>
                        setDialysis((prev) => prev.filter((x) => x.id !== d.id))
                      )
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
