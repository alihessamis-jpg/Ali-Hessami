import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPatient, listPatients, updatePatient } from '../lib/api/patients'
import { PatientsIcon } from '../components/icons'
import type { Patient, PatientCareStatus } from '../types/domain'

const WARDS: Array<{ id: PatientCareStatus; label: string }> = [
  { id: 'inpatient', label: 'Inpatient F1 (Pediatric Nephrology)' },
  { id: 'discharged', label: 'Discharged patients' },
]

export function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [ward, setWard] = useState<PatientCareStatus>('inpatient')
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    setLoading(true)
    listPatients()
      .then(setPatients)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patients'))
      .finally(() => setLoading(false))
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const patient = await createPatient({ name: name.trim(), careStatus: ward })
      setShowNewForm(false)
      setName('')
      navigate(`/patients/${patient.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient')
    } finally {
      setCreating(false)
    }
  }

  async function handleSetCareStatus(p: Patient, careStatus: PatientCareStatus) {
    try {
      const updated = await updatePatient(p.id, { careStatus })
      setPatients((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update patient')
    }
  }

  const wardPatients = patients.filter((p) => p.careStatus === ward)
  const visiblePatients = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return wardPatients
    return wardPatients.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.diagnosis ?? '').toLowerCase().includes(q)
    )
  }, [wardPatients, query])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <PatientsIcon />
          </span>
          Patients
        </h1>
        <button onClick={() => setShowNewForm((v) => !v)}>
          {showNewForm ? 'Cancel' : 'New patient'}
        </button>
      </div>

      {showNewForm && (
        <>
          <p className="patient-meta">
            Will be added to: {WARDS.find((w) => w.id === ward)?.label}
          </p>
          <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
            <input
              placeholder="Patient name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={creating}>
              Add
            </button>
          </form>
        </>
      )}

      <nav className="tab-bar">
        {WARDS.map((w) => (
          <button
            key={w.id}
            className={w.id === ward ? 'tab active' : 'tab'}
            onClick={() => setWard(w.id)}
          >
            {w.label} ({patients.filter((p) => p.careStatus === w.id).length})
          </button>
        ))}
      </nav>

      <input
        placeholder="Search by patient name or diagnosis…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ margin: '12px 0', width: '100%', maxWidth: 360 }}
      />

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : visiblePatients.length === 0 ? (
        <p className="empty-state">
          {wardPatients.length === 0 ? 'No patients here yet.' : 'No patients match your search.'}
        </p>
      ) : (
        <div className="patient-table-wrap">
          <table className="patient-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Age</th>
                <th>Bed</th>
                <th>Diagnosis</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiblePatients.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/patients/${p.id}`)}>
                  <td>
                    <Link to={`/patients/${p.id}`} className="patient-table-name">
                      <span className="glance-avatar">{p.name.charAt(0).toUpperCase()}</span>
                      <span>
                        <span className="patient-name">{p.name}</span>
                        {p.code && <span className="patient-meta">{p.code}</span>}
                      </span>
                    </Link>
                  </td>
                  <td>{p.age != null ? `${p.age}y` : '—'}</td>
                  <td>{p.bed || '—'}</td>
                  <td>{p.diagnosis || '—'}</td>
                  <td>
                    {p.dialysisStatus && <span className="status-badge status-badge--dialysis">{p.dialysisStatus}</span>}
                    {p.transplantStatus && (
                      <span className="status-badge status-badge--transplant">{p.transplantStatus}</span>
                    )}
                    {!p.dialysisStatus && !p.transplantStatus && '—'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {p.careStatus === 'inpatient' ? (
                      <button className="link-button" onClick={() => void handleSetCareStatus(p, 'discharged')}>
                        Discharge
                      </button>
                    ) : (
                      <button className="link-button" onClick={() => void handleSetCareStatus(p, 'inpatient')}>
                        Re-admit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
