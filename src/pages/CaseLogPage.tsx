import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addCaseLogEntry, deleteCaseLogEntry, listCaseLogEntries, type CaseLogEntryWithPatient } from '../lib/api/caseLog'
import { listPatients } from '../lib/api/patients'
import { CASE_LOG_CATEGORIES, CASE_LOG_ROLES, CASE_LOG_SETTINGS } from '../lib/caseLogPresets'
import { toShamsi } from '../lib/shamsi'
import { CaseLogIcon } from '../components/icons'
import type { Patient } from '../types/domain'

const emptyDraft = {
  date: new Date().toISOString().slice(0, 10),
  category: CASE_LOG_CATEGORIES[0],
  diagnosis: '',
  role: CASE_LOG_ROLES[0].value,
  procedure: '',
  setting: '',
  patientId: '',
  notes: '',
}

export function CaseLogPage() {
  const [entries, setEntries] = useState<CaseLogEntryWithPatient[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    setLoading(true)
    Promise.all([listCaseLogEntries(), listPatients()])
      .then(([entryRows, patientRows]) => {
        setEntries(entryRows)
        setPatients(patientRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load case log'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.diagnosis.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const entry = await addCaseLogEntry({
        patientId: draft.patientId || null,
        date: draft.date,
        category: draft.category,
        diagnosis: draft.diagnosis.trim(),
        role: draft.role as CaseLogEntryWithPatient['role'],
        procedure: draft.procedure || null,
        setting: draft.setting || null,
        notes: draft.notes || null,
      })
      setEntries((prev) => [entry, ...prev])
      setDraft({ ...emptyDraft, date: draft.date })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add case log entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCaseLogEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const categoryCounts = useMemo(() => {
    const counts = new Map(CASE_LOG_CATEGORIES.map((c) => [c, 0]))
    for (const e of entries) {
      counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.count - b.count)
  }, [entries])

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entries) counts.set(e.role, (counts.get(e.role) ?? 0) + 1)
    return CASE_LOG_ROLES.map((r) => ({ ...r, count: counts.get(r.value) ?? 0 }))
  }, [entries])

  const unexposedCount = categoryCounts.filter((c) => c.count === 0).length

  const visibleEntries = activeCategory === 'All' ? entries : entries.filter((e) => e.category === activeCategory)

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <CaseLogIcon />
        </span>
        Case Log
      </h1>
      <p className="empty-state">
        Track diagnoses, procedures and your role in each encounter — a personal record of clinical exposure
        for fellowship case-mix review, and a quick way to spot categories you haven't seen much of yet.
      </p>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Exposure by category</h2>
          <span className="patient-meta">
            {entries.length} entries logged
            {unexposedCount > 0 ? ` · ${unexposedCount} categor${unexposedCount === 1 ? 'y' : 'ies'} not yet seen` : ''}
          </span>
        </div>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={categoryCounts} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="category" width={160} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [value, 'Cases']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {categoryCounts.map((c) => (
                  <Cell key={c.category} fill={c.count === 0 ? 'var(--border)' : 'var(--accent)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="calc-strip">
        {roleCounts.map((r) => (
          <div key={r.value}>
            <span className="calc-label">{r.label}</span>
            <span className="calc-value">{r.count}</span>
          </div>
        ))}
      </div>

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
          {CASE_LOG_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          placeholder="Diagnosis"
          value={draft.diagnosis}
          onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })}
          required
        />
        <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
          {CASE_LOG_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Procedure (optional)"
          value={draft.procedure}
          onChange={(e) => setDraft({ ...draft, procedure: e.target.value })}
        />
        <select value={draft.setting} onChange={(e) => setDraft({ ...draft, setting: e.target.value })}>
          <option value="">Setting</option>
          {CASE_LOG_SETTINGS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={draft.patientId} onChange={(e) => setDraft({ ...draft, patientId: e.target.value })}>
          <option value="">Link patient (optional)</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No case log entries yet.</p>
      ) : (
        <>
          <div className="category-pills">
            <button
              type="button"
              className={`category-pill ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => setActiveCategory('All')}
            >
              All ({entries.length})
            </button>
            {CASE_LOG_CATEGORIES.filter((c) => entries.some((e) => e.category === c)).map((c) => (
              <button
                key={c}
                type="button"
                className={`category-pill ${activeCategory === c ? 'active' : ''}`}
                onClick={() => setActiveCategory(c)}
              >
                {c} ({entries.filter((e) => e.category === c).length})
              </button>
            ))}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Diagnosis</th>
                <th>Role</th>
                <th>Procedure</th>
                <th>Setting</th>
                <th>Patient</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => (
                <tr key={e.id}>
                  <td>{toShamsi(e.date)}</td>
                  <td>{e.category}</td>
                  <td>{e.diagnosis}</td>
                  <td>{CASE_LOG_ROLES.find((r) => r.value === e.role)?.label ?? e.role}</td>
                  <td>{e.procedure}</td>
                  <td>{e.setting}</td>
                  <td>{e.patientId && e.patientName ? <Link to={`/patients/${e.patientId}`}>{e.patientName}</Link> : ''}</td>
                  <td>
                    <button className="link-button" onClick={() => void handleDelete(e.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
