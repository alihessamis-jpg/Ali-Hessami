import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPatient, listPatients, resolvePedsHistory, updatePatient } from '../lib/api/patients'
import { STEPS } from '../lib/pedsHistory'
import { listLabEntriesByTest } from '../lib/api/labs'
import { DEFAULT_USER_SETTINGS, getUserSettings } from '../lib/api/settings'
import { formatAge } from '../lib/patientAge'
import { toShamsi } from '../lib/shamsi'
import { useCountUp } from '../hooks/useCountUp'
import {
  CalculatorIcon,
  ChecklistIcon,
  MedicationsIcon,
  PatientsIcon,
  PersonIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  WarningIcon,
  ZapIcon,
} from '../components/icons'
import { EmptyState } from '../components/illustrations/EmptyState'
import type { Patient, PatientCareStatus } from '../types/domain'

const WARDS: Array<{ id: PatientCareStatus; label: string; chipLabel: string }> = [
  { id: 'inpatient', label: 'Inpatient F1 (Pediatric Nephrology)', chipLabel: 'Inpatient F1' },
  { id: 'outpatient', label: 'Outpatient / Dialysis clinic', chipLabel: 'Outpatient / Dialysis' },
  { id: 'discharged', label: 'Discharged patients', chipLabel: 'Discharged' },
  { id: 'expired', label: 'Expired patients', chipLabel: 'Expired' },
]

// 'expired' is deliberately not a <select> option below -- it's only ever
// set from the dedicated "Mark as expired" flow on the patient's own page,
// which also records the date of death, instead of a casual dropdown pick.
const EDITABLE_CARE_STATUSES: PatientCareStatus[] = ['inpatient', 'outpatient', 'discharged']

const CARE_STATUS_LABELS: Record<PatientCareStatus, string> = {
  inpatient: 'Inpatient',
  outpatient: 'Outpatient',
  discharged: 'Discharged',
  expired: 'Expired',
}

function StatCount({ value, label, tone }: { value: number; label: string; tone: string }) {
  const animated = useCountUp(value, 1000)
  return (
    <div className={`pl-stat ${tone}`}>
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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const quick: Array<{ label: string; sub: string; tone: string; icon: ReactNode; onClick: () => void }> = [
    {
      label: 'شرح حال جدید',
      sub: 'Pediatric history',
      tone: 'teal',
      icon: <HistoryDocIcon />,
      onClick: () => navigate(`/patients/new/history?ward=${ward === 'expired' ? 'inpatient' : ward}`),
    },
    { label: 'Quick AKI', sub: 'KDIGO staging', tone: 'amber', icon: <ZapIcon />, onClick: () => navigate('/patients/quick-aki') },
    { label: 'دستیار', sub: 'Case analysis', tone: 'rose', icon: <SparkleIcon />, onClick: () => navigate('/assistant') },
    { label: 'Calculators', sub: 'eGFR, BSA, doses', tone: 'sky', icon: <CalculatorIcon />, onClick: () => navigate('/calculators') },
    { label: 'Drug reference', sub: 'Renal dosing', tone: 'pink', icon: <MedicationsIcon />, onClick: () => navigate('/reference') },
    { label: 'Checklists', sub: 'Workups', tone: 'violet', icon: <ChecklistIcon />, onClick: () => navigate('/checklists') },
  ]

  return (
    <div className="np-page pl-page">
      <header className="pl-head np-fade">
        <span className="pl-avatar" aria-hidden="true">
          <PatientsIcon />
        </span>
        <div className="pl-head-txt">
          <span>
            {greeting} · <span className="fa">{toShamsi(new Date().toISOString().slice(0, 10), 'long')}</span>
          </span>
          <h1>Patients</h1>
        </div>
        <button type="button" className="pl-iconbtn" aria-label="Quick add by name" onClick={() => setShowNewForm((v) => !v)}>
          <PlusIcon />
        </button>
      </header>

      <div className="pl-stats np-fade">
        <StatCount value={countByWard('inpatient')} label="Inpatient" tone="teal" />
        <StatCount value={countByWard('outpatient')} label="Outpatient / HD" tone="sky" />
        <StatCount value={Object.keys(lowHbByPatient).length} label="Low Hb alerts" tone="rose" />
      </div>

      {showNewForm && (
        <div className="pt-new-form np-fade">
          <p className="patient-meta" style={{ margin: 0 }}>
            Quick add to: {WARDS.find((w) => w.id === ward)?.label}
          </p>
          <form className="inline-form" style={{ marginBottom: 0 }} onSubmit={(e) => void handleCreate(e)}>
            <input placeholder="Patient name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <button type="submit" disabled={creating}>
              Add
            </button>
          </form>
        </div>
      )}

      <section className="pl-quick np-fade" style={{ animationDelay: '.05s' }}>
        <h2>Quick access · دسترسی سریع</h2>
        <div className="pl-grid">
          {quick.map((q) => (
            <button key={q.label} type="button" className="pl-q" onClick={q.onClick}>
              <span className={`pl-q-ic ${q.tone}`}>{q.icon}</span>
              <b>{q.label}</b>
              <small>{q.sub}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="pl-toolbar np-fade" style={{ animationDelay: '.08s' }}>
        <nav className="pl-seg" aria-label="Care ward">
          {WARDS.map((w) => (
            <button key={w.id} type="button" className={w.id === ward ? 'on' : ''} onClick={() => setWard(w.id)}>
              {w.chipLabel}
              <span>{countByWard(w.id)}</span>
            </button>
          ))}
        </nav>
        <label className="pl-search">
          <SearchIcon />
          <input aria-label="Search patients" placeholder="Search by name or diagnosis" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <div className="pl-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pl-card skel" />
          ))}
        </div>
      ) : visiblePatients.length === 0 ? (
        <div className="pt-empty">
          <EmptyState>{wardPatients.length === 0 ? 'No patients here yet.' : 'No patients match your search.'}</EmptyState>
        </div>
      ) : (
        <div className="pl-list">
          {visiblePatients.map((p, i) => {
            const critical = lowHbByPatient[p.id] != null
            const female = (p.sex ?? '').trim().toLowerCase().startsWith('f')
            const male = (p.sex ?? '').trim().toLowerCase().startsWith('m')
            const hxDone = resolvePedsHistory(p).completedSteps?.length ?? 0
            return (
              // A plain div + onClick here, not a <Link> wrapping the row: nesting
              // the <select> status picker inside an <a> is invalid HTML and some
              // mobile browsers (notably iOS Safari) resolve a tap anywhere on the
              // row to the nested control instead of the link.
              <div
                key={p.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/patients/${p.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/patients/${p.id}`)
                  }
                }}
                className={critical ? 'pl-card crit' : 'pl-card'}
                style={{ animationDelay: `${Math.min(i, 8) * 0.05}s` }}
              >
                <span className={`pl-av ${female ? 'f' : male ? 'm' : ''}`}>
                  <PersonIcon />
                </span>
                <span className="pl-info">
                  <span className="pl-name" dir="auto">
                    {p.name}
                  </span>
                  <span className="pl-sub">
                    {[formatAge(p.age), female ? 'F' : male ? 'M' : null, p.bed ? `Bed ${p.bed}` : null].filter(Boolean).join(' · ') || 'No details yet'}
                  </span>
                  {p.diagnosis && (
                    <span className="pl-dx" dir="auto">
                      {p.diagnosis}
                    </span>
                  )}
                  <span className="pl-hx" title="History steps completed">
                    <span className="pl-hx-bar">
                      <i style={{ width: `${(hxDone / STEPS.length) * 100}%` }} />
                    </span>
                    <button
                      type="button"
                      className="pl-hx-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/patients/${p.id}/history`)
                      }}
                    >
                      History {hxDone}/{STEPS.length}
                    </button>
                  </span>
                </span>
                <span className="pl-side">
                  {critical && (
                    <span className="pt-alert">
                      <WarningIcon />
                      Hb {lowHbByPatient[p.id]}
                    </span>
                  )}
                  {p.careStatus === 'expired' ? (
                    <span className="pt-ward pt-ward-expired" onClick={(e) => e.stopPropagation()}>
                      Expired{p.deceasedDate ? ` · ${toShamsi(p.deceasedDate)}` : ''}
                    </span>
                  ) : (
                    <select
                      className="pt-ward"
                      value={p.careStatus}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => void handleSetCareStatus(p, e.target.value as PatientCareStatus)}
                    >
                      {EDITABLE_CARE_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {CARE_STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <button
        type="button"
        className="pt-fab pl-fab"
        onClick={() => navigate(`/patients/new/history?ward=${ward === 'expired' ? 'inpatient' : ward}`)}
      >
        <PlusIcon />
        شرح حال جدید
      </button>
    </div>
  )
}

function HistoryDocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M12 12v6M9 15h6" />
    </svg>
  )
}
