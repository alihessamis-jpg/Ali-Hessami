import { useEffect, useState, type FormEvent } from 'react'
import { addResearchRecord, deleteResearchRecord, listResearchFields, listResearchRecords } from '../../lib/api/research'
import { toShamsi } from '../../lib/shamsi'
import type { ResearchField, ResearchRecord } from '../../types/domain'

interface Props {
  projectId: string
}

function exportCsv(fields: ResearchField[], records: ResearchRecord[]) {
  const headers = ['date', ...fields.map((f) => f.label)]
  const lines = [headers.join(',')]
  for (const r of records) {
    const cells = [r.date, ...fields.map((f) => String(r.values[f.id] ?? ''))]
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    Promise.all([listResearchFields(projectId), listResearchRecords(projectId)])
      .then(([f, r]) => {
        setFields(f)
        setRecords(r)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    try {
      const record = await addResearchRecord({
        projectId,
        date: new Date().toISOString().slice(0, 10),
        values: draft,
      })
      setRecords((prev) => [record, ...prev])
      setDraft({})
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

  if (loading) return <p>Loading…</p>
  if (fields.length === 0) return <p className="empty-state">Define fields in Form Builder first.</p>

  return (
    <div>
      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New record'}</button>
        <button onClick={() => exportCsv(fields, records)}>Export CSV</button>
      </div>

      {showForm && (
        <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
          {fields.map((f) => (
            <label key={f.id}>
              {f.label}
              {f.type === 'Dropdown' || f.type === 'Radio' ? (
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
