import { useState, type ChangeEvent } from 'react'
import { buildPatientWideExport } from '../lib/api/dataExport'
import { buildFullBackup, restoreFromBackup, type BackupBundle, type RestoreResult } from '../lib/api/dataBackup'
import { downloadCsv } from '../lib/csvExport'
import { downloadJson } from '../lib/fileDownload'
import { markBackupTaken } from '../lib/api/settings'
import { DownloadIcon } from '../components/icons'

export function ExportPage() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCount, setLastCount] = useState<number | null>(null)

  const [backingUp, setBackingUp] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupSummary, setBackupSummary] = useState<string | null>(null)

  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreResults, setRestoreResults] = useState<RestoreResult[] | null>(null)

  async function handleExport() {
    setExporting(true)
    setError(null)
    try {
      const { headers, rows } = await buildPatientWideExport()
      if (rows.length === 0) {
        setError('No patients to export yet.')
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      downloadCsv(`nephron-patients-${today}.csv`, headers, rows)
      setLastCount(rows.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build export')
    } finally {
      setExporting(false)
    }
  }

  async function handleBackup() {
    setBackingUp(true)
    setBackupError(null)
    try {
      const bundle = await buildFullBackup()
      const totalRows = Object.values(bundle.tables).reduce((sum, rows) => sum + rows.length, 0)
      const tableCount = Object.values(bundle.tables).filter((rows) => rows.length > 0).length
      const today = new Date().toISOString().slice(0, 10)
      downloadJson(`nephron-backup-${today}.json`, bundle)
      await markBackupTaken()
      setBackupSummary(`Backed up ${totalRows} record${totalRows === 1 ? '' : 's'} across ${tableCount} table${tableCount === 1 ? '' : 's'}, just now.`)
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to build backup')
    } finally {
      setBackingUp(false)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setRestoreFile(e.target.files?.[0] ?? null)
    setConfirmRestore(false)
    setRestoreResults(null)
    setRestoreError(null)
  }

  async function handleRestore() {
    if (!restoreFile) return
    setRestoring(true)
    setRestoreError(null)
    setRestoreResults(null)
    try {
      const text = await restoreFile.text()
      const bundle = JSON.parse(text) as BackupBundle
      if (!bundle || typeof bundle !== 'object' || !bundle.tables) {
        throw new Error('This file does not look like a Nephron backup.')
      }
      const results = await restoreFromBackup(bundle)
      setRestoreResults(results)
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Failed to restore backup')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <DownloadIcon />
        </span>
        Export
      </h1>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Full backup</h2>
        </div>
        <p className="patient-meta">
          Downloads every record you've entered — all patients, labs, notes, medications, Academy topics, Study
          Hub content, case log, research, and settings — as one JSON file. This does not include uploaded
          images/PDFs (imaging, documents, attachments) stored separately in file storage — only the database
          records. Keep the downloaded file somewhere safe (e.g. cloud storage on your phone/computer).
        </p>
        {backupError && <p className="form-error">{backupError}</p>}
        {backupSummary && !backupError && <p className="saved-hint">{backupSummary}</p>}
        <div className="form-actions">
          <button type="button" onClick={() => void handleBackup()} disabled={backingUp}>
            {backingUp ? 'Building backup…' : 'Download full backup (JSON)'}
          </button>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Restore from backup</h2>
        </div>
        <p className="patient-meta">
          Upload a previously downloaded backup file to restore it. Records in the file will overwrite any
          current record with the same ID; anything you've added since the backup was taken is left alone
          (nothing is deleted). Use this to recover from data loss or move to a new account.
        </p>
        <input type="file" accept="application/json" onChange={handleFileChange} />
        {restoreFile && (
          <div style={{ marginTop: 12 }}>
            <label className="checkbox-label">
              <input type="checkbox" checked={confirmRestore} onChange={(e) => setConfirmRestore(e.target.checked)} />
              I understand this will overwrite any current records that share an ID with this backup.
            </label>
            <div className="form-actions">
              <button type="button" onClick={() => void handleRestore()} disabled={!confirmRestore || restoring}>
                {restoring ? 'Restoring…' : 'Restore this backup'}
              </button>
            </div>
          </div>
        )}
        {restoreError && <p className="form-error">{restoreError}</p>}
        {restoreResults && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Restored</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {restoreResults
                .filter((r) => r.count > 0 || r.error)
                .map((r) => (
                  <tr key={r.table} className={r.error ? 'row-abnormal' : undefined}>
                    <td>{r.table}</td>
                    <td>{r.count}</td>
                    <td className={r.error ? 'value-abnormal' : undefined}>{r.error ?? ''}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="empty-state">
        One row per patient, wide format — demographics, baseline renal function, computed eGFR and AKI
        stage, nephrotic syndrome classification, case log count, and the latest value of every lab test
        you've ever recorded (each as its own column). Opens directly in Excel, and imports into SPSS via
        File → Import Data → CSV Data.
      </p>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Patients (wide format)</h2>
        </div>
        {error && <p className="form-error">{error}</p>}
        {lastCount != null && !error && (
          <p className="saved-hint">Downloaded {lastCount} patient{lastCount === 1 ? '' : 's'}.</p>
        )}
        <div className="form-actions">
          <button type="button" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? 'Building export…' : 'Download CSV'}
          </button>
        </div>
      </div>
    </div>
  )
}
