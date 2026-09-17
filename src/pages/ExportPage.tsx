import { useState } from 'react'
import { buildPatientWideExport } from '../lib/api/dataExport'
import { downloadCsv } from '../lib/csvExport'
import { DownloadIcon } from '../components/icons'

export function ExportPage() {
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastCount, setLastCount] = useState<number | null>(null)

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

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <DownloadIcon />
        </span>
        Export
      </h1>
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
