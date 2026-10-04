import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addResearchRecord,
  deleteResearchRecord,
  listResearchFields,
  listResearchRecords,
  setResearchRecordPatient,
} from '../../lib/api/research'
import { listPatients } from '../../lib/api/patients'
import { toShamsi } from '../../lib/shamsi'
import { computeResearchValues } from '../../lib/researchFormula'
import type { Patient, ResearchField, ResearchRecord } from '../../types/domain'

interface Props {
  projectId: string
}

function exportCsv(fields: ResearchField[], records: ResearchRecord[], patientsById: Map<string, Patient>) {
  const headers = ['date', 'patient', ...fields.map((f) => f.label)]
  const lines = [headers.join(',')]
  for (const r of records) {
    const patientName = r.patientId ? patientsById.get(r.patientId)?.name ?? '' : ''
    const cells = [r.date, patientName, ...fields.map((f) => String(r.values[f.id] ?? ''))]
    lines.push(cells.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'research-data.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function DataTab({ projectId }: Props) {
  const [fields, setFields] = useState<ResearchField[]>([])
  const [records, setRecords] = useState<ResearchRecord[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [patientDraft, setPatientDraft] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    Promise.all([listResearchFields(projectId), listResearchRecords(projectId), listPatients()])
      .then(([f, r, p]) => {
        setFields(f)
        setRecords(r)
        setPatients(p)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [projectId])

  const liveValues = useMemo(() => computeResearchValues(fields, draft), [fields, draft])
  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const sortedPatients = useMemo(() => [...patients].sort((a, b) => a.name.localeCompare(b.name)), [patients])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    try {
      const record = await addResearchRecord({
        projectId,
        date: new Date().toISOString().slice(0, 10),
        values: computeResearchValues(fields, draft),
        patientId: patientDraft || null,
      })
      setRecords((prev) => [record, ...prev])
      setDraft({})
      setPatientDraft('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add record')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteResearchRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handlePatientChange(record: ResearchRecord, patientId: string) {
    try {
      const updated = await setResearchRecordPatient(record.id, patientId || null)
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient link')
    }
  }

  if (loading) return <p>Loading…</p>
  if (fields.length === 0) return <p className="empty-state">Define fields in Form Builder first.</p>

  return (
    <div>
      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New record'}</button>
        <button onClick={() => exportCsv(fields, records, patientsById)}>Export CSV</button>
      </div>

      {showForm && (
        <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
          <label>
            Patient (optional)
            <select value={patientDraft} onChange={(e) => setPatientDraft(e.target.value)}>
              <option value="">No patient linked</option>
              {sortedPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {fields.map((f) => (
            <label key={f.id}>
              {f.label}
              {f.type === 'Calculated Field' ? (
                <input type="text" value={liveValues[f.id] ?? ''} disabled placeholder="Calculated automatically" />
              ) : f.type === 'Dropdown' || f.type === 'Radio' ? (
                <select
                  value={draft[f.id] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })}
                  required={f.required}
                >
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === 'Checkbox' ? (
                <input
                  type="checkbox"
                  checked={draft[f.id] === 'true'}
                  onChange={(e) => setDraft({ ...draft, [f.id]: String(e.target.checked) })}
                />
              ) : (
                <input
                  type={f.type === 'Number' || f.type === 'Laboratory' ? 'number' : f.type === 'Date' ? 'date' : 'text'}
                  value={draft[f.id] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [f.id]: e.target.value })}
                  required={f.required}
                />
              )}
            </label>
          ))}
          <div className="form-actions">
            <button type="submit">Save record</button>
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {records.length === 0 ? (
        <p className="empty-state">No records yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Patient</th>
              {fields.map((f) => (
                <th key={f.id}>{f.label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{toShamsi(r.date)}</td>
                <td>
                  <select value={r.patientId ?? ''} onChange={(e) => void handlePatientChange(r, e.target.value)}>
                    <option value="">—</option>
                    {sortedPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {r.patientId && patientsById.get(r.patientId) && (
                    <Link to={`/patients/${r.patientId}`} className="link-button" style={{ marginInlineStart: 6 }}>
                      View
                    </Link>
                  )}
                </td>
                {fields.map((f) => (
                  <td key={f.id}>{String(r.values[f.id] ?? '')}</td>
                ))}
                <td>
                  <button className="link-button" onClick={() => void handleDelete(r.id)}>
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
