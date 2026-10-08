import { useEffect, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { buildPatientWideExport } from '../lib/api/dataExport'
import { buildFullBackup, restoreFromBackup, type BackupBundle, type RestoreResult } from '../lib/api/dataBackup'
import { downloadCsv } from '../lib/csvExport'
import { downloadJson } from '../lib/fileDownload'
import { getUserSettings, markBackupTaken } from '../lib/api/settings'

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
}

export function ExportPage() {
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCount, setLastCount] = useState<number | null>(null)

  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [backupStage, setBackupStage] = useState<'idle' | 'busy' | 'done'>('idle')
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupSummary, setBackupSummary] = useState<string | null>(null)

  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreResults, setRestoreResults] = useState<RestoreResult[] | null>(null)

  useEffect(() => {
    getUserSettings()
      .then((s) => setLastBackupAt(s.lastBackupAt ?? null))
      .catch(() => {})
  }, [])

  async function handleBackup() {
    setBackupStage('busy')
    setBackupError(null)
    try {
      const bundle = await buildFullBackup()
      const totalRows = Object.values(bundle.tables).reduce((sum, rows) => sum + rows.length, 0)
      const tableCount = Object.values(bundle.tables).filter((rows) => rows.length > 0).length
      const today = new Date().toISOString().slice(0, 10)
      downloadJson(`nephron-backup-${today}.json`, bundle)
      await markBackupTaken()
      setLastBackupAt(new Date().toISOString())
      setBackupSummary(`Backed up ${totalRows} record${totalRows === 1 ? '' : 's'} across ${tableCount} table${tableCount === 1 ? '' : 's'}.`)
      setBackupStage('done')
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to build backup')
      setBackupStage('idle')
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

  const backedUpToday = lastBackupAt ? daysSince(lastBackupAt) === 0 : false
  const bannerOk = backupStage === 'done' || backedUpToday
  const bannerTitle = backupStage === 'done' ? 'Backed up just now' : lastBackupAt == null ? 'No backup yet' : backedUpToday ? 'Backed up today' : `No backup in ${daysSince(lastBackupAt)} day${daysSince(lastBackupAt) === 1 ? '' : 's'}`
  const bannerSub =
    backupStage === 'done' || bannerOk ? 'Keep the file somewhere safe, like cloud storage.' : 'Download a full backup below.'

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow blue" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Export</h1>
            <p className="np-sub">Back up everything, restore it, or take your data to Excel and SPSS.</p>
          </div>
          <svg className="np-art" width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
            <path d="M14 50v12a6 6 0 0 0 6 6h40a6 6 0 0 0 6-6V50" stroke="#9CC2FF" strokeWidth={4} strokeLinecap="round" />
            <g className="exp-drop">
              <path d="M40 12v32M28 32l12 12 12-12" stroke="#FFC46B" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </svg>
        </div>
      </section>

      <div className={bannerOk ? 'exp-banner ok np-fade' : 'exp-banner np-fade'} role="status" style={{ animationDelay: '.08s' }}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke={bannerOk ? '#17663A' : '#93590B'}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          <path d="M12 3 2 21h20zM12 10v5M12 18h.01" />
        </svg>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <b style={{ fontSize: 14, color: bannerOk ? '#17663A' : '#6B4108' }}>{bannerTitle}</b>
          <span className="np-small" style={{ color: bannerOk ? '#2E6B47' : '#7A5418' }}>
            {bannerSub}
          </span>
        </span>
      </div>

      <div className="exp-grid">
        <section className="np-card np-fade" style={{ animationDelay: '.14s' }}>
          <div className="np-head">
            <h2>Full backup</h2>
            <span className="np-tag" style={{ color: '#1546A8', background: '#E3EDFD' }}>
              JSON
            </span>
          </div>
          <p>
            Every record — patients, labs, notes, medications, Academy, Study Hub, case log, research and
            settings. Uploaded images and PDFs are not included.
          </p>
          {backupError && <p className="form-error">{backupError}</p>}
          {backupStage === 'idle' && (
            <button type="button" className="np-btn" onClick={() => void handleBackup()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download full backup
            </button>
          )}
          {backupStage === 'busy' && (
            <div className="exp-busy">
              <span>Preparing backup…</span>
            </div>
          )}
          {backupStage === 'done' && (
            <>
              <div className="exp-done">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 5 5 9-10" />
                </svg>
                Backup saved
              </div>
              {backupSummary && <span className="np-small">{backupSummary}</span>}
              <button type="button" className="np-btn ghost sm" onClick={() => setBackupStage('idle')}>
                Back up again
              </button>
            </>
          )}
        </section>

        <section className="np-card np-fade" style={{ animationDelay: '.2s' }}>
          <h2>Restore from backup</h2>
          <p>Records with the same ID are overwritten; anything added since is left alone. Nothing is deleted.</p>
          <label htmlFor="exp-file" className="np-btn ghost" style={{ borderStyle: 'dashed', marginTop: 'auto', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: 'rotate(180deg)' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Choose backup file
          </label>
          <input id="exp-file" type="file" accept="application/json" className="np-sr" onChange={handleFileChange} />
          {restoreFile && (
            <>
              <span className="np-small">{restoreFile.name}</span>
              <label className="checkbox-label">
                <input type="checkbox" checked={confirmRestore} onChange={(e) => setConfirmRestore(e.target.checked)} />
                I understand this will overwrite any current records that share an ID with this backup.
              </label>
              <button type="button" className="np-btn" disabled={!confirmRestore || restoring} onClick={() => void handleRestore()}>
                {restoring ? 'Restoring…' : 'Restore this backup'}
              </button>
            </>
          )}
          {restoreError && <p className="form-error">{restoreError}</p>}
          {restoreResults && (
            <div style={{ overflowX: 'auto' }}>
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
            </div>
          )}
        </section>

        <section className="np-card np-fade" style={{ animationDelay: '.26s' }}>
          <div className="np-head">
            <h2>Patients (wide format)</h2>
            <span className="np-tag" style={{ color: '#17663A', background: '#DDF3E6' }}>
              CSV
            </span>
          </div>
          <p>
            One row per patient: demographics, baseline renal function, eGFR, AKI stage, nephrotic class and
            the latest value of every lab. Opens in Excel; imports into SPSS.
          </p>
          {error && <p className="form-error">{error}</p>}
          {lastCount != null && !error && <span className="np-small">Downloaded {lastCount} patient{lastCount === 1 ? '' : 's'}.</span>}
          <button type="button" className="np-btn ghost" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? 'Building export…' : 'Download CSV'}
          </button>
        </section>
      </div>
    </div>
  )
}
