import { useEffect, useRef, useState, type DragEvent } from 'react'
import {
  addPatientDocument,
  deletePatientDocument,
  listPatientDocuments,
} from '../../lib/api/patientDocuments'
import {
  deletePatientDocumentFile,
  getPatientDocumentSignedUrl,
  uploadPatientDocumentFile,
} from '../../lib/storage'
import { toShamsi } from '../../lib/shamsi'
import { useAuth } from '../../context/AuthContext'
import type { PatientDocument } from '../../types/domain'

interface Props {
  patientId: string
}

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(path)
}

export function DocumentTab({ patientId }: Props) {
  const { session } = useAuth()
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listPatientDocuments(patientId)
      .then((rows) => {
        setDocuments(rows)
        rows.forEach((doc) => {
          getPatientDocumentSignedUrl(doc.storagePath)
            .then((url) => setUrls((prev) => ({ ...prev, [doc.id]: url })))
            .catch(() => undefined)
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load documents'))
      .finally(() => setLoading(false))
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !session) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(fileList)) {
        const path = await uploadPatientDocumentFile(session.user.id, patientId, file)
        const doc = await addPatientDocument(patientId, path, file.name)
        setDocuments((prev) => [doc, ...prev])
        getPatientDocumentSignedUrl(path)
          .then((url) => setUrls((prev) => ({ ...prev, [doc.id]: url })))
          .catch(() => undefined)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(doc: PatientDocument) {
    try {
      await deletePatientDocument(doc.id)
      await deletePatientDocumentFile(doc.storagePath).catch(() => undefined)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    void handleFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <p className="empty-state">
        Attach scanned charts, data-collection sheets, or any photo/PDF for this patient — upload as many as
        you need.
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
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          hidden
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <span className="dropzone-icon">↑</span>
        <strong>{uploading ? 'Uploading…' : 'Drop images or PDFs here'}</strong>
        <span className="dropzone-hint">Choose one or more files, or use the camera</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : documents.length === 0 ? (
        <p className="empty-state">No documents uploaded yet.</p>
      ) : (
        <ul className="document-grid">
          {documents.map((doc) => (
            <li key={doc.id} className="document-card">
              <div className="document-card-preview">
                {urls[doc.id] ? (
                  isImagePath(doc.storagePath) ? (
                    <a href={urls[doc.id]} target="_blank" rel="noreferrer">
                      <img src={urls[doc.id]} alt={doc.filename ?? 'Document'} />
                    </a>
                  ) : (
                    <a href={urls[doc.id]} target="_blank" rel="noreferrer" className="document-card-pdf">
                      Open PDF
                    </a>
                  )
                ) : (
                  <span className="empty-state">Loading…</span>
                )}
              </div>
              <div className="document-card-meta">
                <span className="patient-meta">{toShamsi(doc.createdAt.slice(0, 10))}</span>
                <button className="link-button" onClick={() => void handleDelete(doc)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
