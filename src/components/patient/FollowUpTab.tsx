import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  addFollowUpItem,
  deleteFollowUpItem,
  listFollowUpItems,
  setFollowUpAttachment,
  setFollowUpResolved,
} from '../../lib/api/followUps'
import { listImagingEntries } from '../../lib/api/imaging'
import {
  deleteFollowUpAttachmentFile,
  getFollowUpAttachmentSignedUrl,
  uploadFollowUpAttachmentFile,
} from '../../lib/storage'
import { FOLLOW_UP_WINDOW_DAYS } from '../../lib/procedureChecks'
import { daysSince } from '../../lib/dates'
import { toShamsi } from '../../lib/shamsi'
import { useAuth } from '../../context/AuthContext'
import type { FollowUpCategory, FollowUpItem, ImagingEntry, Patient } from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
}

export const CATEGORY_LABELS: Record<FollowUpCategory, string> = {
  culture: 'Culture',
  imaging: 'Imaging (CT/MRI/US)',
  document: 'Document (e.g. operative note)',
  specialized_lab: 'Specialized lab (C3, C4, ANA, dsDNA, etc.)',
  pathology: 'Pathology (biopsy result)',
  other: 'Other',
}

const emptyDraft = {
  category: 'culture' as FollowUpCategory,
  description: '',
  orderedDate: new Date().toISOString().slice(0, 10),
  notes: '',
}

export function FollowUpTab({ patientId, patient }: Props) {
  const { session } = useAuth()
  const [items, setItems] = useState<FollowUpItem[]>([])
  const [imagingEntries, setImagingEntries] = useState<ImagingEntry[]>([])
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [showResolved, setShowResolved] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listFollowUpItems(patientId)
      .then((rows) => {
        setItems(rows)
        rows.forEach((item) => {
          if (!item.storagePath) return
          getFollowUpAttachmentSignedUrl(item.storagePath)
            .then((url) => setAttachmentUrls((prev) => ({ ...prev, [item.id]: url })))
            .catch(() => undefined)
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load follow-up items'))
      .finally(() => setLoading(false))
    listImagingEntries(patientId)
      .then(setImagingEntries)
      .catch(() => undefined)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.description.trim()) return
    try {
      const item = await addFollowUpItem({
        patientId,
        category: draft.category,
        description: draft.description.trim(),
        orderedDate: draft.orderedDate,
        resolved: false,
        resolvedDate: null,
        notes: draft.notes || null,
        storagePath: null,
        filename: null,
      })
      setItems((prev) => [item, ...prev])
      setDraft({ ...emptyDraft, orderedDate: draft.orderedDate })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add follow-up item')
    }
  }

  async function handleResolve(item: FollowUpItem) {
    try {
      await setFollowUpResolved(item.id, !item.resolved)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFollowUpItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleUpload(item: FollowUpItem, file: File | undefined) {
    if (!file || !session) return
    setUploadingId(item.id)
    setError(null)
    try {
      const path = await uploadFollowUpAttachmentFile(session.user.id, item.id, file)
      await setFollowUpAttachment(item.id, path, file.name)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, storagePath: path, filename: file.name } : i)))
      const url = await getFollowUpAttachmentSignedUrl(path)
      setAttachmentUrls((prev) => ({ ...prev, [item.id]: url }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload result')
    } finally {
      setUploadingId(null)
    }
  }

  async function handleRemoveAttachment(item: FollowUpItem) {
    if (!item.storagePath) return
    try {
      await setFollowUpAttachment(item.id, null, null)
      await deleteFollowUpAttachmentFile(item.storagePath).catch(() => undefined)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, storagePath: null, filename: null } : i)))
      setAttachmentUrls((prev) => {
        const next = { ...prev }
        delete next[item.id]
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove attachment')
    }
  }

  const pending = items.filter((i) => !i.resolved).sort((a, b) => a.orderedDate.localeCompare(b.orderedDate))
  const resolved = items.filter((i) => i.resolved).sort((a, b) => b.orderedDate.localeCompare(a.orderedDate))
  const unreportedImaging = imagingEntries.filter((e) => !e.report && !e.impression)
  const showRejectionGuide = !!patient.transplantStatus && items.some((i) => i.category === 'pathology')

  return (
    <div>
      <p className="empty-state">
        Track orders sent out that haven't come back yet — cultures, specialized serologies, operative notes,
        imaging, pathology. Cultures and pathology results are flagged once{' '}
        {FOLLOW_UP_WINDOW_DAYS.culture} days have passed since they were sent. Attach the result file (e.g. a
        multi-page pathology report) directly to its row once it's back.
      </p>

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as FollowUpCategory })}>
          {(Object.keys(CATEGORY_LABELS) as FollowUpCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          placeholder="Description (e.g. Blood culture, C3/C4/ANA/dsDNA, Operative note)"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          required
        />
        <input
          type="date"
          value={draft.orderedDate}
          onChange={(e) => setDraft({ ...draft, orderedDate: e.target.value || new Date().toISOString().slice(0, 10) })}
          required
        />
        <input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        <button type="submit">Add</button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : pending.length === 0 ? (
        <p className="empty-state">No pending follow-ups.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Description</th>
              <th>Ordered</th>
              <th>Status</th>
              <th>Result</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((item) => {
              const days = daysSince(item.orderedDate)
              const windowDays = FOLLOW_UP_WINDOW_DAYS[item.category]
              const overdue = windowDays != null && days >= windowDays
              return (
                <tr key={item.id} className={overdue ? 'row-abnormal' : ''}>
                  <td>{CATEGORY_LABELS[item.category]}</td>
                  <td>{item.description}</td>
                  <td>{toShamsi(item.orderedDate)}</td>
                  <td className={overdue ? 'value-abnormal' : undefined}>
                    {overdue
                      ? `⚠ Follow up — sent ${days} day${days === 1 ? '' : 's'} ago`
                      : `Sent ${days} day${days === 1 ? '' : 's'} ago`}
                  </td>
                  <td>
                    <input
                      ref={(el) => {
                        fileInputRefs.current[item.id] = el
                      }}
                      type="file"
                      accept=".pdf,application/pdf,image/*"
                      hidden
                      onChange={(e) => void handleUpload(item, e.target.files?.[0])}
                    />
                    {item.storagePath ? (
                      <div className="micro-summary">
                        {attachmentUrls[item.id] && (
                          <a href={attachmentUrls[item.id]} target="_blank" rel="noreferrer" className="study-link">
                            {item.filename ?? 'Open result'}
                          </a>
                        )}
                        <button type="button" className="link-button" onClick={() => void handleRemoveAttachment(item)}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={uploadingId === item.id}
                        onClick={() => fileInputRefs.current[item.id]?.click()}
                      >
                        {uploadingId === item.id ? 'Uploading…' : 'Attach result'}
                      </button>
                    )}
                  </td>
                  <td>{item.notes}</td>
                  <td>
                    <button className="link-button" onClick={() => void handleResolve(item)}>
                      Mark resolved
                    </button>
                    <button className="link-button" onClick={() => void handleDelete(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {showRejectionGuide && (
        <div className="dash-card" style={{ marginTop: 16 }}>
          <div className="dash-card-header">
            <h2 className="dash-card-title">If the pathology shows rejection — pediatric treatment guide</h2>
          </div>
          <p className="patient-meta">
            Transplant patient with a pathology result on file. Once the biopsy report is back, if it shows
            rejection:
          </p>
          <ul className="study-link-list">
            <li>
              <strong>T-cell–mediated (acute cellular) rejection:</strong> first-line is IV methylprednisolone pulse
              (10–30 mg/kg/day, max 1 g, x3 days). Steroid-resistant or Banff ≥IIA → anti-thymocyte globulin (ATG),
              ~1.5 mg/kg/day for 5–14 days guided by response and lymphocyte counts.
            </li>
            <li>
              <strong>Antibody-mediated rejection:</strong> plasmapheresis (PLEX) + IVIG, ± rituximab; bortezomib or
              eculizumab reserved for refractory cases. Treat the underlying DSA and check for concurrent TCMR.
            </li>
            <li>
              Before treating: check the current tacrolimus/FK trough and adherence — nonadherence (common in
              adolescents) is a frequent cause of rejection and changes the plan.
            </li>
            <li>
              Screen for infection (viral load, CBC) before pulse steroids/ATG — both raise the risk of opportunistic
              infection in an already immunosuppressed child.
            </li>
            <li>Optimize maintenance immunosuppression (raise tacrolimus target, add/increase MMF) alongside acute therapy.</li>
            <li>Consider repeat biopsy if there's no clinical/lab response to guide further therapy.</li>
          </ul>
          <p className="patient-meta">
            This is a quick reference, not a substitute for the full Banff classification and center protocol.
          </p>
        </div>
      )}

      {unreportedImaging.length > 0 && (
        <div className="dash-card" style={{ marginTop: 16 }}>
          <div className="dash-card-header">
            <h2 className="dash-card-title">Imaging awaiting report</h2>
          </div>
          <p className="patient-meta">Auto-detected from the Imaging tab — no report or impression entered yet.</p>
          <ul className="study-link-list">
            {unreportedImaging.map((e) => (
              <li key={e.id} className="value-abnormal">
                {e.category || 'Imaging'} ({toShamsi(e.date ?? '')}) — not yet reported
              </li>
            ))}
          </ul>
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="link-button" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? 'Hide' : 'Show'} resolved ({resolved.length})
          </button>
          {showResolved && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Ordered</th>
                  <th>Resolved</th>
                  <th>Result</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((item) => (
                  <tr key={item.id} style={{ opacity: 0.6 }}>
                    <td>{CATEGORY_LABELS[item.category]}</td>
                    <td>{item.description}</td>
                    <td>{toShamsi(item.orderedDate)}</td>
                    <td>{item.resolvedDate ? toShamsi(item.resolvedDate) : '—'}</td>
                    <td>
                      {attachmentUrls[item.id] && (
                        <a href={attachmentUrls[item.id]} target="_blank" rel="noreferrer" className="study-link">
                          {item.filename ?? 'Open result'}
                        </a>
                      )}
                    </td>
                    <td>
                      <button className="link-button" onClick={() => void handleResolve(item)}>
                        Reopen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
