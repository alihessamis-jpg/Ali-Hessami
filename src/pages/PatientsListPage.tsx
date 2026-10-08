import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { createPatient, listPatients, updatePatient } from '../lib/api/patients'
import { listLabEntriesByTest } from '../lib/api/labs'
import { DEFAULT_USER_SETTINGS, getUserSettings } from '../lib/api/settings'
import { formatAge } from '../lib/patientAge'
import { KidneyIcon, PatientsIcon, SearchIcon } from '../components/icons'
import { EmptyState } from '../components/illustrations/EmptyState'
import type { Patient, PatientCareStatus } from '../types/domain'

const WARDS: Array<{ id: PatientCareStatus; label: string }> = [
  { id: 'inpatient', label: 'Inpatient F1 (Pediatric Nephrology)' },
  { id: 'outpatient', label: 'Outpatient / Dialysis clinic' },
  { id: 'discharged', label: 'Discharged patients' },
]

const CARE_STATUS_LABELS: Record<PatientCareStatus, string> = {
  inpatient: 'Inpatient',
  outpatient: 'Outpatient',
  discharged: 'Discharged',
}

export function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [ward, setWard] = useState<PatientCareStatus>('inpatient')
  const [query, setQuery] = useState('')
  const [latestHbByPatient, setLatestHbByPatient] = useState<Record<string, number>>({})
  const [anemiaHbThreshold, setAnemiaHbThreshold] = useState(DEFAULT_USER_SETTINGS.anemiaHbThreshold)
  const navigate = useNavigate()

  useEffect(() => {
    refresh()
    getUserSettings()
      .then((s) => setAnemiaHbThreshold(s.anemiaHbThreshold))
      .catch(() => undefined)
  }, [])

  function refresh() {
    setLoading(true)
    listPatients()
      .then(setPatients)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patients'))
      .finally(() => setLoading(false))
    listLabEntriesByTest('Hemoglobin')
      .then((entries) => {
        const latestByPatient = new Map<string, { date: string; value: number }>()
        for (const e of entries) {
          if (e.value == null) continue
          const current = latestByPatient.get(e.patientId)
          if (!current || e.date >= current.date) latestByPatient.set(e.patientId, { date: e.date, value: e.value })
        }
        const latest: Record<string, number> = {}
        for (const [patientId, entry] of latestByPatient) latest[patientId] = entry.value
        setLatestHbByPatient(latest)
      })
      .catch(() => undefined)
  }

  const lowHbByPatient = useMemo(() => {
    const alerts: Record<string, number> = {}
    for (const [patientId, value] of Object.entries(latestHbByPatient)) {
      if (value < anemiaHbThreshold) alerts[patientId] = value
    }
    return alerts
  }, [latestHbByPatient, anemiaHbThreshold])

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
        <div className="page-header-actions">
          <Link to="/patients/quick-aki" className="button-link">
            Quick AKI entry
          </Link>
          <button onClick={() => setShowNewForm((v) => !v)}>
            {showNewForm ? 'Cancel' : 'New patient'}
          </button>
        </div>
      </div>

      {showNewForm && (
        <div className="dash-card new-patient-card">
          <p className="patient-meta" style={{ marginTop: 0 }}>
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
        </div>
      )}

      <nav className="ward-tabs" aria-label="Care ward">
        {WARDS.map((w) => {
          const active = w.id === ward
          return (
            <button
              key={w.id}
              type="button"
              className={active ? 'ward-tab active' : 'ward-tab'}
              onClick={() => setWard(w.id)}
            >
              {active && (
                <motion.span
                  layoutId="ward-tab-pill"
                  className="ward-tab-pill"
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                />
              )}
              <span className="ward-tab-label">{w.label}</span>
              <span className="ward-tab-count">{patients.filter((p) => p.careStatus === w.id).length}</span>
            </button>
          )
        })}
      </nav>

      <label className="search-field">
        <SearchIcon />
        <input
          placeholder="Search by patient name or diagnosis…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : visiblePatients.length === 0 ? (
        <div className="dash-card">
          <EmptyState>
            {wardPatients.length === 0 ? 'No patients here yet.' : 'No patients match your search.'}
          </EmptyState>
        </div>
      ) : (
        <>
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
                {visiblePatients.map((p, i) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/patients/${p.id}`)}
                    style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                  >
                    <td>
                      <Link to={`/patients/${p.id}`} className="patient-table-name">
                        <span
                          className={
                            lowHbByPatient[p.id] != null
                              ? 'glance-avatar glance-avatar--icon glance-avatar--critical'
                              : 'glance-avatar glance-avatar--icon'
                          }
                        >
                          <KidneyIcon />
                        </span>
                        <span>
                          <span className="patient-name">{p.name}</span>
                          {p.code && <span className="patient-meta">{p.code}</span>}
                        </span>
                      </Link>
                    </td>
                    <td>{formatAge(p.age) ?? '—'}</td>
                    <td>{p.bed || '—'}</td>
                    <td>{p.diagnosis || '—'}</td>
                    <td>
                      {lowHbByPatient[p.id] != null && (
                        <span className="status-badge status-badge--alert">⚠ Hb {lowHbByPatient[p.id]}</span>
                      )}
                      {p.dialysisStatus && <span className="status-badge status-badge--dialysis">{p.dialysisStatus}</span>}
                      {p.transplantStatus && (
                        <span className="status-badge status-badge--transplant">{p.transplantStatus}</span>
                      )}
                      {!p.dialysisStatus && !p.transplantStatus && lowHbByPatient[p.id] == null && '—'}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select value={p.careStatus} onChange={(e) => void handleSetCareStatus(p, e.target.value as PatientCareStatus)}>
                        {(Object.keys(CARE_STATUS_LABELS) as PatientCareStatus[]).map((status) => (
                          <option key={status} value={status}>
                            {CARE_STATUS_LABELS[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="patient-card-list">
            {visiblePatients.map((p, i) => (
              <li key={p.id} style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                <Link to={`/patients/${p.id}`} className="patient-card">
                  <span
                    className={
                      lowHbByPatient[p.id] != null
                        ? 'glance-avatar glance-avatar--icon glance-avatar--critical'
                        : 'glance-avatar glance-avatar--icon'
                    }
                  >
                    <KidneyIcon />
                  </span>
                  <span className="patient-card-body">
                    <span className="patient-card-top">
                      <span className="patient-name">{p.name}</span>
                      {lowHbByPatient[p.id] != null && (
                        <span className="status-badge status-badge--alert">⚠ Hb {lowHbByPatient[p.id]}</span>
                      )}
                    </span>
                    <span className="patient-meta">
                      {[formatAge(p.age), p.bed, p.diagnosis].filter(Boolean).join(' · ') || 'No details yet'}
                    </span>
                    {(p.dialysisStatus || p.transplantStatus) && (
                      <span className="patient-card-badges">
                        {p.dialysisStatus && <span className="status-badge status-badge--dialysis">{p.dialysisStatus}</span>}
                        {p.transplantStatus && (
                          <span className="status-badge status-badge--transplant">{p.transplantStatus}</span>
                        )}
                      </span>
                    )}
                  </span>
                  <select
                    value={p.careStatus}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => void handleSetCareStatus(p, e.target.value as PatientCareStatus)}
                  >
                    {(Object.keys(CARE_STATUS_LABELS) as PatientCareStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {CARE_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
