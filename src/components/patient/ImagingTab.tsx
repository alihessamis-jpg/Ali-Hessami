import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { addImagingEntry, deleteImagingEntry, listImagingEntries } from '../../lib/api/imaging'
import { getImagingSignedUrl, uploadImagingFile } from '../../lib/storage'
import { useAuth } from '../../context/AuthContext'
import type { ImagingEntry } from '../../types/domain'

interface Props {
  patientId: string
}

const emptyDraft = { category: '', date: new Date().toISOString().slice(0, 10), notes: '', report: '', impression: '' }

export function ImagingTab({ patientId }: Props) {
  const { session } = useAuth()
  const [entries, setEntries] = useState<ImagingEntry[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listImagingEntries(patientId)
      .then((rows) => {
        setEntries(rows)
        rows.forEach((row) => {
          if (row.storagePath) {
            getImagingSignedUrl(row.storagePath)
              .then((url) => setUrls((prev) => ({ ...prev, [row.id]: url })))
              .catch(() => undefined)
          }
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load imaging'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSubmitting(true)
    setError(null)
    try {
      const storagePath = file ? await uploadImagingFile(session.user.id, file) : null
      const entry = await addImagingEntry({
        patientId,
        category: draft.category || null,
        date: draft.date,
        notes: draft.notes || null,
        report: draft.report || null,
        impression: draft.impression || null,
        storagePath,
      })
      setEntries((prev) => [entry, ...prev])
      if (storagePath) {
        getImagingSignedUrl(storagePath)
          .then((url) => setUrls((prev) => ({ ...prev, [entry.id]: url })))
          .catch(() => undefined)
      }
      setDraft({ ...emptyDraft, date: draft.date })
      setFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add imaging entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteImagingEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
        <div className="field-grid">
          <label>
            Category
            <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="e.g. Renal US" />
          </label>
          <label>
            Date
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
          </label>
        </div>
        <div
          className={`dropzone ${dragOver ? 'dropzone--active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="dropzone-icon">↑</span>
          <strong>{file ? file.name : 'Drop image or PDF here'}</strong>
          <span className="dropzone-hint">{file ? 'Ready to upload' : 'Choose file or use the camera'}</span>
        </div>
        <label>
          Notes
          <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </label>
        <label>
          Report
          <textarea value={draft.report} onChange={(e) => setDraft({ ...draft, report: e.target.value })} />
        </label>
        <label>
          Impression
          <textarea value={draft.impression} onChange={(e) => setDraft({ ...draft, impression: e.target.value })} />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            Add imaging entry
          </button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No imaging recorded yet.</p>
      ) : (
        <ul className="note-timeline">
          {entries.map((entry) => (
            <li key={entry.id}>
              <div className="note-header">
                <strong>{entry.date}</strong>
                <span>{entry.category}</span>
                <button className="link-button" onClick={() => void handleDelete(entry.id)}>
                  Delete
                </button>
              </div>
              {urls[entry.id] && (
                <a href={urls[entry.id]} target="_blank" rel="noreferrer">
                  View file
                </a>
              )}
              {entry.impression && <p>{entry.impression}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
