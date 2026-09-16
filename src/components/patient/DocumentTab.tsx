import { useEffect, useRef, useState, type DragEvent } from 'react'
import { updatePatient } from '../../lib/api/patients'
import {
  deletePatientDocumentFile,
  getPatientDocumentSignedUrl,
  uploadPatientDocumentFile,
} from '../../lib/storage'
import { useAuth } from '../../context/AuthContext'
import type { Patient } from '../../types/domain'

interface Props {
  patient: Patient
  onUpdated: (patient: Patient) => void
}

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(path)
}

export function DocumentTab({ patient, onUpdated }: Props) {
  const { session } = useAuth()
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!patient.documentPath) {
      setUrl(null)
      return
    }
    setLoading(true)
    getPatientDocumentSignedUrl(patient.documentPath)
      .then(setUrl)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load document'))
      .finally(() => setLoading(false))
  }, [patient.documentPath])

  async function handleFile(file: File | undefined | null) {
    if (!file || !session) return
    setUploading(true)
    setError(null)
    try {
      const oldPath = patient.documentPath
      const path = await uploadPatientDocumentFile(session.user.id, patient.id, file)
      const updated = await updatePatient(patient.id, { documentPath: path })
      onUpdated(updated)
      if (oldPath) await deletePatientDocumentFile(oldPath).catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!patient.documentPath) return
    try {
      const oldPath = patient.documentPath
      const updated = await updatePatient(patient.id, { documentPath: null })
      onUpdated(updated)
      await deletePatientDocumentFile(oldPath).catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove document')
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    void handleFile(e.dataTransfer.files?.[0])
  }

  return (
    <div>
      <p className="empty-state">
        Attach the pre-filled chart/data-collection sheet for this patient — one photo or PDF, replacing
        the previous one if you upload again.
      </p>

      {error && <p className="form-error">{error}</p>}

      {patient.documentPath && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Current document</h2>
            <button className="link-button" onClick={() => void handleRemove()}>
              Remove
            </button>
          </div>
          {loading ? (
            <p>Loading…</p>
          ) : url ? (
            isImagePath(patient.documentPath) ? (
              <a href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="Patient document" style={{ maxWidth: '100%', borderRadius: 10 }} />
              </a>
            ) : (
              <a href={url} target="_blank" rel="noreferrer">
                Open document
              </a>
            )
          ) : null}
        </div>
      )}

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
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <span className="dropzone-icon">↑</span>
        <strong>{uploading ? 'Uploading…' : patient.documentPath ? 'Replace with a new photo or PDF' : 'Drop image or PDF here'}</strong>
        <span className="dropzone-hint">Choose file or use the camera</span>
      </div>
    </div>
  )
}
