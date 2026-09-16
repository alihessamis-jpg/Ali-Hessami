import { useEffect, useState } from 'react'
import { listResearchFields, listResearchRecords } from '../../lib/api/research'
import type { ResearchField, ResearchRecord } from '../../types/domain'

interface Props {
  projectId: string
}

const NUMERIC_TYPES: ResearchField['type'][] = ['Number', 'Laboratory', 'Calculated Field']
const CATEGORICAL_TYPES: ResearchField['type'][] = ['Radio', 'Dropdown', 'Multiple Choice', 'Checkbox']

export function AnalyticsTab({ projectId }: Props) {
  const [fields, setFields] = useState<ResearchField[]>([])
  const [records, setRecords] = useState<ResearchRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listResearchFields(projectId), listResearchRecords(projectId)])
      .then(([f, r]) => {
        setFields(f)
        setRecords(r)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  if (loading) return <p>Loading…</p>
  if (records.length === 0) return <p className="empty-state">No data collected yet.</p>

  return (
    <div>
      <p className="empty-state">n = {records.length} records</p>
      {fields.map((f) => {
        if (NUMERIC_TYPES.includes(f.type)) {
          const values = records.map((r) => Number(r.values[f.id])).filter((v) => !Number.isNaN(v))
          if (values.length === 0) return null
          const mean = values.reduce((a, b) => a + b, 0) / values.length
          const min = Math.min(...values)
          const max = Math.max(...values)
          return (
            <div key={f.id} className="calc-strip">
              <div>
                <span className="calc-label">{f.label} — n</span>
                <span className="calc-value">{values.length}</span>
              </div>
              <div>
                <span className="calc-label">Mean</span>
                <span className="calc-value">{mean.toFixed(2)}</span>
              </div>
              <div>
                <span className="calc-label">Range</span>
                <span className="calc-value">
                  {min.toFixed(1)}–{max.toFixed(1)}
                </span>
              </div>
            </div>
          )
        }
        if (CATEGORICAL_TYPES.includes(f.type)) {
          const counts = new Map<string, number>()
          for (const r of records) {
            const v = String(r.values[f.id] ?? '')
            if (!v) continue
            counts.set(v, (counts.get(v) ?? 0) + 1)
          }
          if (counts.size === 0) return null
          return (
            <div key={f.id} style={{ marginBottom: 20 }}>
              <h3>{f.label}</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Value</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(counts.entries()).map(([value, count]) => (
                    <tr key={value}>
                      <td>{value}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
