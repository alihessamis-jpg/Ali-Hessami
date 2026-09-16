import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPatient, listPatients } from '../lib/api/patients'
import { PatientsIcon } from '../components/icons'
import type { Patient } from '../types/domain'

export function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
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
      const patient = await createPatient({ name: name.trim() })
      setShowNewForm(false)
      setName('')
      navigate(`/patients/${patient.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient')
    } finally {
      setCreating(false)
    }
  }

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
      )}

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : patients.length === 0 ? (
        <p className="empty-state">No patients yet. Add one to get started.</p>
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
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
