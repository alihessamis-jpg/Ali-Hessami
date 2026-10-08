import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPatient, listPatients, updatePatient } from '../lib/api/patients'
import { listLabEntriesByTest } from '../lib/api/labs'
import { DEFAULT_USER_SETTINGS, getUserSettings } from '../lib/api/settings'
import { formatAge } from '../lib/patientAge'
import { useCountUp } from '../hooks/useCountUp'
import { PersonIcon, PlusIcon, SearchIcon, WarningIcon, ZapIcon } from '../components/icons'
import { EmptyState } from '../components/illustrations/EmptyState'
import type { Patient, PatientCareStatus } from '../types/domain'

const WARDS: Array<{ id: PatientCareStatus; label: string; chipLabel: string }> = [
  { id: 'inpatient', label: 'Inpatient F1 (Pediatric Nephrology)', chipLabel: 'Inpatient F1' },
  { id: 'outpatient', label: 'Outpatient / Dialysis clinic', chipLabel: 'Outpatient / Dialysis' },
  { id: 'discharged', label: 'Discharged patients', chipLabel: 'Discharged' },
]

const CARE_STATUS_LABELS: Record<PatientCareStatus, string> = {
  inpatient: 'Inpatient',
  outpatient: 'Outpatient',
  discharged: 'Discharged',
}

function StatCount({ value, label }: { value: number; label: string }) {
  const animated = useCountUp(value, 1000)
  return (
    <div>
      <b>{Math.round(animated ?? 0)}</b>
      <span>{label}</span>
    </div>
  )
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

  const countByWard = (id: PatientCareStatus) => patients.filter((p) => p.careStatus === id).length

  return (
    <div className="np-page">
      <section className="pt-hero np-fade">
        <div className="pt-hero-glow" />
        <div className="pt-hero-top">
          <h1>Patients</h1>
          <div className="pt-hero-actions">
            <Link to="/patients/quick-aki" className="pt-glass">
              <ZapIcon />
              Quick AKI entry
            </Link>
            <button type="button" className="pt-solid" onClick={() => setShowNewForm((v) => !v)}>
              <PlusIcon />
              New patient
            </button>
          </div>
        </div>
        <svg viewBox="0 0 700 40" width="100%" height="40" fill="none" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'relative', display: 'block' }}>
          <path
            d="M0 22H120l8-14 10 28 8-20 6 6H330l8-14 10 28 8-20 6 6H540l8-14 10 28 8-20 6 6H700"
            stroke="rgba(127,212,255,.25)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M0 22H120l8-14 10 28 8-20 6 6H330l8-14 10 28 8-20 6 6H540l8-14 10 28 8-20 6 6H700"
            stroke="#7FD4FF"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="120 480"
            vectorEffect="non-scaling-stroke"
            className="pt-ecg-path"
          />
        </svg>
        <div className="pt-stats">
          <StatCount value={countByWard('inpatient')} label="Inpatient F1" />
          <StatCount value={countByWard('outpatient')} label="Outpatient / HD" />
          <StatCount value={countByWard('discharged')} label="Discharged" />
        </div>
      </section>

      {showNewForm && (
        <div className="pt-new-form np-fade">
          <p className="patient-meta" style={{ margin: 0 }}>
            Will be added to: {WARDS.find((w) => w.id === ward)?.label}
          </p>
          <form className="inline-form" style={{ marginBottom: 0 }} onSubmit={(e) => void handleCreate(e)}>
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

      <div className="pt-toolbar np-fade" style={{ animationDelay: '.08s' }}>
        <nav className="pt-chips" aria-label="Care ward">
          {WARDS.map((w) => (
            <button
              key={w.id}
              type="button"
              className={w.id === ward ? 'pt-chip on' : 'pt-chip'}
              onClick={() => setWard(w.id)}
            >
              {w.chipLabel} · {countByWard(w.id)}
            </button>
          ))}
        </nav>

        <label className="pt-search">
          <SearchIcon />
          <input
            aria-label="Search patients"
            placeholder="Search by name or diagnosis"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : visiblePatients.length === 0 ? (
        <div className="pt-empty">
          <EmptyState>
            {wardPatients.length === 0 ? 'No patients here yet.' : 'No patients match your search.'}
          </EmptyState>
        </div>
      ) : (
        <div className="pt-list">
          {visiblePatients.map((p, i) => {
            const critical = lowHbByPatient[p.id] != null
            return (
              <Link
                key={p.id}
                to={`/patients/${p.id}`}
                className={critical ? 'pt-pt crit' : 'pt-pt'}
                style={{ animationDelay: `${Math.min(i, 8) * 0.07}s` }}
              >
                <span className="pt-av">
                  <PersonIcon />
                </span>
                <span className="pt-info">
                  <span className="pt-name" dir="rtl" style={{ textAlign: 'left' }}>
                    {p.name}
                  </span>
                  <span className="pt-sub">{[formatAge(p.age), p.diagnosis].filter(Boolean).join(' · ') || 'No details yet'}</span>
                </span>
                {critical && (
                  <span className="pt-alert">
                    <WarningIcon />
                    Hb {lowHbByPatient[p.id]}
                  </span>
                )}
                <select
                  className="pt-ward"
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
            )
          })}
        </div>
      )}

      <button type="button" className="pt-fab" onClick={() => setShowNewForm((v) => !v)}>
        <PlusIcon />
        {showNewForm ? 'Cancel' : 'New patient'}
      </button>
    </div>
  )
}
