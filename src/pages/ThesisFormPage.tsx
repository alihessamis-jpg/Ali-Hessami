import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis } from 'recharts'
import {
  addLusStudySession,
  deleteLusStudySession,
  enrollPatientInLusStudy,
  listAllLusStudySessions,
  listLusStudyEnrollments,
  updateLusStudySession,
} from '../lib/api/lusStudy'
import { createPatient, listPatients } from '../lib/api/patients'
import { buildGroupPostLusTrend } from '../lib/lusStudy'
import { downloadCsv } from '../lib/csvExport'
import { matchesSearch } from '../lib/textFilter'
import { toShamsi } from '../lib/shamsi'
import { describeError } from '../lib/describeError'
import { useCountUp } from '../hooks/useCountUp'
import { LusStudySessionForm } from '../components/patient/LusStudySessionForm'
import type { LusStudySessionWithPatient } from '../lib/api/lusStudy'
import type { LusStudyEnrollment, LusStudyGroup, LusStudySessionDraft, Patient, PatientCareStatus } from '../types/domain'

const GROUP_LABELS: Record<LusStudyGroup, string> = {
  group1_standard: 'Group 1 — Standard care',
  group2_lus_guided: 'Group 2 — LUS/IVC-guided',
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
}

function fmt(n: number | null, digits = 1): string {
  return n == null ? '—' : n.toFixed(digits)
}

function exportSessionsCsv(sessions: LusStudySessionWithPatient[], groupByPatientId: Map<string, LusStudyGroup>) {
  const headers = [
    'Patient',
    'Group',
    'Session date',
    'Height (cm)',
    'BSA (m2)',
    'Pre-HD weight (kg)',
    'Target weight (kg)',
    'Pre-HD weight above target (kg)',
    'Pre-HD edema',
    'Pre-HD dyspnea',
    'Pre-HD crackles',
    'Pre LUS total (0-36)',
    'Pre IVC max (mm)',
    'Pre IVC min (mm)',
    'Pre IVC resp variation (%)',
    'Pre IVC max/BSA (mm/m2)',
    'Pre SBP',
    'Pre DBP',
    'Residual UOP (mL/day)',
    'Dialysis duration (h)',
    'UF volume (mL)',
    'UF rate (mL/kg/h)',
    'Interdialytic weight gain (kg)',
    'Intradialytic hypotension',
    'Intradialytic muscle cramp',
    'Saline bolus required',
    'UF interruption',
    'Early termination',
    'Post-HD weight (kg)',
    'Weight loss (kg)',
    'Weight loss (%)',
    'Post-HD weight vs dry weight (kg)',
    'Post LUS total (0-36)',
    'LUS change',
    'LUS change (%)',
    'Post IVC max (mm)',
    'Post IVC min (mm)',
    'Post IVC resp variation (%)',
    'Post IVC max/BSA (mm/m2)',
    'IVC max change (mm)',
    'Post SBP',
    'Post DBP',
    'Post-HD edema',
    'Post-HD dyspnea',
    'Post-HD crackles',
    'Investigator volume assessment',
    'Dry weight reassessment needed',
    'Suggested decision',
    'LUS-guided decision',
    'Dry weight adjustment (kg)',
    'Adjustment reason',
    'Safety check',
    'Physician confirmation',
    'Notes',
  ]
  const rows = sessions.map((s) => [
    s.patientName ?? '',
    GROUP_LABELS[groupByPatientId.get(s.patientId) as LusStudyGroup] ?? '',
    s.sessionDate,
    s.heightCm ?? '',
    s.bsaM2?.toFixed(2) ?? '',
    s.preHdWeightKg ?? '',
    s.targetWeightKg ?? '',
    s.preHdWeightAboveTargetKg?.toFixed(2) ?? '',
    s.preHdEdema ? 'Yes' : 'No',
    s.preHdDyspnea ? 'Yes' : 'No',
    s.preHdCrackles ? 'Yes' : 'No',
    s.preLusTotal ?? '',
    s.preIvcMaxMm ?? '',
    s.preIvcMinMm ?? '',
    s.preIvcRespVariationPct ?? '',
    s.preIvcMaxBsa?.toFixed(1) ?? '',
    s.preHdSbp ?? '',
    s.preHdDbp ?? '',
    s.residualUrineOutputMl ?? '',
    s.dialysisDurationHours ?? '',
    s.ufVolumeMl ?? '',
    s.ufRateMlKgH?.toFixed(1) ?? '',
    s.interdialyticWeightGainKg?.toFixed(2) ?? '',
    s.intradialyticHypotension ? 'Yes' : 'No',
    s.intradialyticMuscleCramp ? 'Yes' : 'No',
    s.salineBolusRequired ? 'Yes' : 'No',
    s.ufInterruption ? 'Yes' : 'No',
    s.earlyTermination ? 'Yes' : 'No',
    s.postHdWeightKg ?? '',
    s.weightLossKg?.toFixed(2) ?? '',
    s.weightLossPct?.toFixed(1) ?? '',
    s.postHdWeightVsDryKg?.toFixed(2) ?? '',
    s.postLusTotal ?? '',
    s.lusChange ?? '',
    s.lusChangePct?.toFixed(0) ?? '',
    s.postIvcMaxMm ?? '',
    s.postIvcMinMm ?? '',
    s.postIvcRespVariationPct ?? '',
    s.postIvcMaxBsa?.toFixed(1) ?? '',
    s.ivcMaxChangeMm?.toFixed(1) ?? '',
    s.postHdSbp ?? '',
    s.postHdDbp ?? '',
    s.postHdEdema ? 'Yes' : 'No',
    s.postHdDyspnea ? 'Yes' : 'No',
    s.postHdCrackles ? 'Yes' : 'No',
    s.investigatorVolumeAssessment ?? '',
    s.dryWeightReassessmentNeeded ? 'Yes' : 'No',
    s.suggestedDecision ?? '',
    s.lusGuidedDecision ?? '',
    s.dryWeightAdjustmentKg ?? '',
    s.adjustmentReason.join('; '),
    s.safetyCheck ?? '',
    s.physicianConfirmation ?? '',
    s.notes ?? '',
  ])
  downloadCsv(`lus-study-sessions-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows)
}

export function ThesisFormPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<LusStudySessionWithPatient[]>([])
  const [enrollments, setEnrollments] = useState<LusStudyEnrollment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [enrollPatientId, setEnrollPatientId] = useState('')
  const [enrollGroup, setEnrollGroup] = useState<LusStudyGroup>('group1_standard')
  const [enrollNotes, setEnrollNotes] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [showNewPatientForm, setShowNewPatientForm] = useState(false)
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientCareStatus, setNewPatientCareStatus] = useState<PatientCareStatus>('outpatient')
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [logPatientId, setLogPatientId] = useState('')
  const [formMode, setFormMode] = useState<'closed' | 'new' | string>('closed')
  const logSessionCardRef = useRef<HTMLDivElement>(null)

  function handleEditSession(session: LusStudySessionWithPatient) {
    setError(null)
    setLogPatientId(session.patientId)
    setFormMode(session.id)
    logSessionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    Promise.all([listAllLusStudySessions(), listLusStudyEnrollments(), listPatients()])
      .then(([s, e, p]) => {
        setSessions(s)
        setEnrollments(e)
        setPatients(p)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load study data'))
      .finally(() => setLoading(false))
  }, [])

  const groupByPatientId = useMemo(() => new Map(enrollments.map((e) => [e.patientId, e.studyGroup])), [enrollments])
  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const enrolledPatientIds = useMemo(() => new Set(enrollments.map((e) => e.patientId)), [enrollments])
  const unenrolledPatients = useMemo(
    () => [...patients].filter((p) => !enrolledPatientIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [patients, enrolledPatientIds]
  )
  const enrolledPatients = useMemo(
    () => [...patients].filter((p) => enrolledPatientIds.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)),
    [patients, enrolledPatientIds]
  )
  const logPatient = logPatientId ? patientsById.get(logPatientId) : undefined
  const logEnrollment = logPatientId ? enrollments.find((e) => e.patientId === logPatientId) : undefined
  const logPatientSessions = useMemo(() => sessions.filter((s) => s.patientId === logPatientId), [sessions, logPatientId])

  async function handleCreatePatient() {
    if (!newPatientName.trim()) return
    setCreatingPatient(true)
    setError(null)
    try {
      const patient = await createPatient({ name: newPatientName.trim(), careStatus: newPatientCareStatus })
      setPatients((prev) => [...prev, patient])
      setEnrollPatientId(patient.id)
      setNewPatientName('')
      setShowNewPatientForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient')
    } finally {
      setCreatingPatient(false)
    }
  }

  async function handleEnroll() {
    if (!enrollPatientId) return
    setEnrolling(true)
    setError(null)
    try {
      const e = await enrollPatientInLusStudy({
        patientId: enrollPatientId,
        studyGroup: enrollGroup,
        enrollmentDate: new Date().toISOString().slice(0, 10),
        notes: enrollNotes || null,
      })
      setEnrollments((prev) => [...prev, e])
      setLogPatientId(enrollPatientId)
      setEnrollPatientId('')
      setEnrollNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll patient')
    } finally {
      setEnrolling(false)
    }
  }

  async function handleSaveSession(draft: LusStudySessionDraft) {
    try {
      if (formMode !== 'new' && formMode !== 'closed') {
        const updated = await updateLusStudySession(formMode, draft)
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      } else {
        const created = await addLusStudySession(draft)
        setSessions((prev) => [created, ...prev])
      }
      setFormMode('closed')
    } catch (err) {
      setError(describeError(err, 'Failed to save session — check your connection and try again'))
    }
  }

  async function handleDeleteSession(id: string) {
    try {
      await deleteLusStudySession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
    }
  }

  const bySessionGroup = useMemo(() => {
    const groups: Record<LusStudyGroup, LusStudySessionWithPatient[]> = { group1_standard: [], group2_lus_guided: [] }
    for (const s of sessions) {
      const g = groupByPatientId.get(s.patientId)
      if (g) groups[g].push(s)
    }
    return groups
  }, [sessions, groupByPatientId])

  const trend = useMemo(
    () =>
      buildGroupPostLusTrend(
        sessions.map((s) => ({ patientId: s.patientId, sessionDate: s.sessionDate, postLusTotal: s.postLusTotal ?? null })),
        groupByPatientId
      ),
    [sessions, groupByPatientId]
  )

  const visibleSessions = sessions.filter((s) => matchesSearch([s.patientName, s.notes, s.sessionDate], search))

  const g1 = bySessionGroup.group1_standard.filter((s) => s.postLusTotal != null)
  const g2 = bySessionGroup.group2_lus_guided.filter((s) => s.postLusTotal != null)
  const decreaseCount = bySessionGroup.group2_lus_guided.filter((s) => s.lusGuidedDecision === 'decrease').length
  const increaseCount = bySessionGroup.group2_lus_guided.filter((s) => s.lusGuidedDecision === 'increase').length
  const g2Complete = bySessionGroup.group2_lus_guided.filter((s) => s.postHdWeightKg != null).length
  const g1MeanPostLus = mean(g1.map((s) => s.postLusTotal as number))
  const g2MeanPostLus = mean(g2.map((s) => s.postLusTotal as number))
  const g1MeanPreLus = mean(g1.map((s) => s.preLusTotal as number).filter((v) => v != null))
  const g2MeanPreLus = mean(g2.map((s) => s.preLusTotal as number).filter((v) => v != null))
  const g1MeanChange = mean(g1.map((s) => s.lusChange as number).filter((v) => v != null))
  const g2MeanChange = mean(g2.map((s) => s.lusChange as number).filter((v) => v != null))
  const lusBarMax = Math.max(1, ...[g1MeanPreLus, g1MeanPostLus, g2MeanPreLus, g2MeanPostLus].filter((v): v is number => v != null)) * 1.15
  const barPct = (v: number | null) => (v == null ? 0 : Math.min(100, Math.round((v / lusBarMax) * 100)))

  const enrolledDisplay = useCountUp(enrollments.length)
  const sessionsDisplay = useCountUp(sessions.length)
  const g1MeanDisplay = useCountUp(g1MeanPostLus ?? 0)
  const g2MeanDisplay = useCountUp(g2MeanPostLus ?? 0)

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero th-hero np-fade">
        <div className="np-hrow">
          <div className="np-txt">
            <span className="np-eyebrow" style={{ color: '#7FD4FF' }}>
              THESIS DATA COLLECTION
            </span>
            <h1 style={{ lineHeight: 1.2 }}>LUS Volume-Assessment Study</h1>
            <p className="np-sub">
              Study-level view: every session across patients, and Group 1 vs Group 2. Log sessions from each
              patient's own "LUS Study" tab.
            </p>
          </div>
          <svg className="np-art th-us" viewBox="0 0 350 120" fill="none" aria-hidden="true">
            <defs>
              <clipPath id="th-sec">
                <path d="M175 6 70 116h210z" />
              </clipPath>
            </defs>
            <path d="M175 6 70 116h210z" fill="#0E1E3E" />
            <g clipPath="url(#th-sec)">
              <path d="M90 40h170" stroke="#5E7BB0" strokeWidth={3} opacity={0.7} />
              <path d="M95 62h160" stroke="#4A6496" strokeWidth={2} opacity={0.45} />
              <path d="M150 40V120" stroke="#DCE8FF" strokeWidth={5} className="th-bline" />
              <path d="M188 40V120" stroke="#DCE8FF" strokeWidth={5} className="th-bline" style={{ animationDelay: '.6s' }} />
              <path d="M222 40V120" stroke="#DCE8FF" strokeWidth={5} className="th-bline" style={{ animationDelay: '1.2s' }} />
              <path d="M175 6v114" stroke="#7FD4FF" strokeWidth={1.5} opacity={0.6} className="th-sweep" />
            </g>
            <text x="292" y="112" fill="#7F93B8" fontSize="10" fontFamily="Plus Jakarta Sans">
              B-lines
            </text>
          </svg>
        </div>
      </section>

      <div className="th-sgrid">
        <div className="th-sbox np-fade" style={{ animationDelay: '.08s' }}>
          <b>{Math.round(enrolledDisplay ?? 0)}</b>
          <span className="np-small">Patients enrolled</span>
        </div>
        <div className="th-sbox np-fade" style={{ animationDelay: '.12s' }}>
          <b>{Math.round(sessionsDisplay ?? 0)}</b>
          <span className="np-small">Sessions logged</span>
        </div>
        <div className="th-sbox np-fade" style={{ animationDelay: '.16s' }}>
          <b>{g1.length ? fmt(g1MeanDisplay) : '—'}</b>
          <span className="np-small">Group 1 mean post-HD LUS</span>
        </div>
        <div className="th-sbox np-fade" style={{ animationDelay: '.2s' }}>
          <b>{g2.length ? fmt(g2MeanDisplay) : '—'}</b>
          <span className="np-small">Group 2 mean post-HD LUS</span>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="np-grid2">
        <section className="np-card np-fade" style={{ animationDelay: '.14s' }}>
          <h2>Group comparison</h2>

          {g1.length > 0 && (
            <>
              <div className="np-head">
                <b style={{ fontSize: 13 }}>{GROUP_LABELS.group1_standard}</b>
                <span className="np-small">{g1.length} complete session{g1.length === 1 ? '' : 's'}</span>
              </div>
              <div className="th-cmp">
                <span className="np-small">Pre-HD</span>
                <div className="th-tr">
                  <i style={{ width: `${barPct(g1MeanPreLus)}%`, background: '#9CB8E8', animationDelay: '.3s' }} />
                </div>
                <b>{fmt(g1MeanPreLus)}</b>
                <span className="np-small">Post-HD</span>
                <div className="th-tr">
                  <i style={{ width: `${barPct(g1MeanPostLus)}%`, background: 'var(--accent)', animationDelay: '.5s' }} />
                </div>
                <b>{fmt(g1MeanPostLus)}</b>
              </div>
              {g1MeanChange != null && (
                <span className="np-tag" style={{ alignSelf: 'flex-start', fontSize: 12, color: '#17663A', background: '#DDF3E6', padding: '4px 10px' }}>
                  Mean change {g1MeanChange > 0 ? '+' : ''}
                  {g1MeanChange.toFixed(1)}
                </span>
              )}
              <div style={{ height: 1, background: '#EDF1F7' }} />
            </>
          )}

          <div className="np-head">
            <b style={{ fontSize: 13 }}>{GROUP_LABELS.group2_lus_guided}</b>
            <span className="np-small">{g2.length > 0 ? `${g2.length} complete session${g2.length === 1 ? '' : 's'}` : 'No complete sessions'}</span>
          </div>
          {g2.length > 0 && (
            <>
              <div className="th-cmp">
                <span className="np-small">Pre-HD</span>
                <div className="th-tr">
                  <i style={{ width: `${barPct(g2MeanPreLus)}%`, background: '#9CB8E8', animationDelay: '.3s' }} />
                </div>
                <b>{fmt(g2MeanPreLus)}</b>
                <span className="np-small">Post-HD</span>
                <div className="th-tr">
                  <i style={{ width: `${barPct(g2MeanPostLus)}%`, background: 'var(--accent)', animationDelay: '.5s' }} />
                </div>
                <b>{fmt(g2MeanPostLus)}</b>
              </div>
              {g2MeanChange != null && (
                <span className="np-tag" style={{ alignSelf: 'flex-start', fontSize: 12, color: '#17663A', background: '#DDF3E6', padding: '4px 10px' }}>
                  Mean change {g2MeanChange > 0 ? '+' : ''}
                  {g2MeanChange.toFixed(1)}
                </span>
              )}
            </>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table className="th-tbl">
              <thead>
                <tr>
                  <th></th>
                  <th>{GROUP_LABELS.group1_standard}</th>
                  <th>{GROUP_LABELS.group2_lus_guided}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Sessions (complete)</td>
                  <td>{g1.length}</td>
                  <td>{g2.length}</td>
                </tr>
                <tr>
                  <td>Mean pre-HD LUS</td>
                  <td>{fmt(g1MeanPreLus)}</td>
                  <td>{fmt(g2MeanPreLus)}</td>
                </tr>
                <tr>
                  <td>Mean post-HD LUS</td>
                  <td>{fmt(g1MeanPostLus)}</td>
                  <td>{fmt(g2MeanPostLus)}</td>
                </tr>
                <tr>
                  <td>Mean LUS change</td>
                  <td>{fmt(g1MeanChange)}</td>
                  <td>{fmt(g2MeanChange)}</td>
                </tr>
                <tr>
                  <td>Mean weight loss (%)</td>
                  <td>{fmt(mean(g1.map((s) => s.weightLossPct as number).filter((v) => v != null)))}</td>
                  <td>{fmt(mean(g2.map((s) => s.weightLossPct as number).filter((v) => v != null)))}</td>
                </tr>
                <tr>
                  <td>Intradialytic hypotension rate</td>
                  <td>{g1.length ? `${((g1.filter((s) => s.intradialyticHypotension).length / g1.length) * 100).toFixed(0)}%` : '—'}</td>
                  <td>{g2.length ? `${((g2.filter((s) => s.intradialyticHypotension).length / g2.length) * 100).toFixed(0)}%` : '—'}</td>
                </tr>
                <tr>
                  <td>Muscle cramp rate</td>
                  <td>{g1.length ? `${((g1.filter((s) => s.intradialyticMuscleCramp).length / g1.length) * 100).toFixed(0)}%` : '—'}</td>
                  <td>{g2.length ? `${((g2.filter((s) => s.intradialyticMuscleCramp).length / g2.length) * 100).toFixed(0)}%` : '—'}</td>
                </tr>
                <tr>
                  <td>Dry weight decreased / increased (Group 2 process)</td>
                  <td>—</td>
                  <td>
                    {decreaseCount} / {increaseCount} of {g2Complete} sessions
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div className="np-stack">
          <section className="np-card np-fade" style={{ animationDelay: '.2s' }}>
            <div className="np-head">
              <h2>Enroll a patient</h2>
              <button type="button" className="link-button" onClick={() => setShowNewPatientForm((v) => !v)}>
                {showNewPatientForm ? 'Cancel' : '+ New patient'}
              </button>
            </div>

            {showNewPatientForm && (
              <div className="np-f2">
                <div className="np-field">
                  <label htmlFor="th-new-name">Name</label>
                  <input
                    id="th-new-name"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="Patient name"
                  />
                </div>
                <div className="np-field">
                  <label htmlFor="th-new-status">Care status</label>
                  <select
                    id="th-new-status"
                    value={newPatientCareStatus}
                    onChange={(e) => setNewPatientCareStatus(e.target.value as PatientCareStatus)}
                  >
                    <option value="outpatient">Outpatient (e.g. dialysis-only, not admitted)</option>
                    <option value="inpatient">Inpatient</option>
                  </select>
                </div>
                <button
                  type="button"
                  className="np-btn sm"
                  style={{ gridColumn: '1 / -1', justifySelf: 'start' }}
                  disabled={!newPatientName.trim() || creatingPatient}
                  onClick={() => void handleCreatePatient()}
                >
                  {creatingPatient ? 'Adding…' : 'Add patient'}
                </button>
              </div>
            )}

            {unenrolledPatients.length === 0 ? (
              <span className="np-small">
                {patients.length === 0 ? 'Add a patient above first.' : 'Every patient is already enrolled — add a new one above.'}
              </span>
            ) : (
              <>
                <div className="np-field">
                  <label htmlFor="th-enroll-patient">Patient</label>
                  <select id="th-enroll-patient" value={enrollPatientId} onChange={(e) => setEnrollPatientId(e.target.value)}>
                    <option value="">Choose a patient…</option>
                    {unenrolledPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="np-small" style={{ fontWeight: 600 }}>
                  Study group
                </span>
                <div className="np-seg">
                  <button
                    type="button"
                    className={enrollGroup === 'group1_standard' ? 'on' : ''}
                    onClick={() => setEnrollGroup('group1_standard')}
                  >
                    Group 1 · Standard
                  </button>
                  <button
                    type="button"
                    className={enrollGroup === 'group2_lus_guided' ? 'on' : ''}
                    onClick={() => setEnrollGroup('group2_lus_guided')}
                  >
                    Group 2 · LUS/IVC
                  </button>
                </div>
                <div className="np-field">
                  <label htmlFor="th-enroll-notes">Notes</label>
                  <textarea
                    id="th-enroll-notes"
                    rows={2}
                    value={enrollNotes}
                    onChange={(e) => setEnrollNotes(e.target.value)}
                    placeholder="Consent, randomization reference, etc."
                  />
                </div>
                <button type="button" className="np-btn" disabled={!enrollPatientId || enrolling} onClick={() => void handleEnroll()}>
                  {enrolling ? 'Enrolling…' : 'Enroll patient'}
                </button>
              </>
            )}
          </section>

          <section className="np-card np-fade" ref={logSessionCardRef} style={{ animationDelay: '.26s' }}>
            <h2>Log a session</h2>
            {enrolledPatients.length === 0 ? (
              <span className="np-small">Enroll a patient above first.</span>
            ) : (
              <>
                <div className="np-field">
                  <label htmlFor="th-log-patient">Patient</label>
                  <select
                    id="th-log-patient"
                    value={logPatientId}
                    onChange={(e) => {
                      setLogPatientId(e.target.value)
                      setFormMode('closed')
                    }}
                  >
                    <option value="">Choose a patient…</option>
                    {enrolledPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({GROUP_LABELS[groupByPatientId.get(p.id) as LusStudyGroup]})
                      </option>
                    ))}
                  </select>
                </div>
                {logPatient &&
                  logEnrollment &&
                  (formMode === 'closed' ? (
                    <button
                      type="button"
                      className="np-btn"
                      onClick={() => {
                        setError(null)
                        setFormMode('new')
                      }}
                    >
                      Log new session
                    </button>
                  ) : (
                    <LusStudySessionForm
                      patientId={logPatient.id}
                      studyGroup={logEnrollment.studyGroup}
                      patientAge={logPatient.age}
                      underlyingDisease={logPatient.underlyingDisease}
                      dialysisStartDate={logPatient.dialysisStartDate}
                      defaultHeightCm={logPatient.height}
                      defaultWeightKg={logPatient.weight}
                      defaultTargetWeightKg={logPatientSessions[0]?.targetWeightKg ?? logPatient.weight}
                      previousPostHdWeightKg={logPatientSessions[0]?.postHdWeightKg}
                      existing={formMode === 'new' ? null : logPatientSessions.find((s) => s.id === formMode) ?? null}
                      onSaved={(draft) => void handleSaveSession(draft)}
                      onCancel={() => setFormMode('closed')}
                    />
                  ))}
              </>
            )}
          </section>
        </div>
      </div>

      <section className="np-card np-fade" style={{ animationDelay: '.3s' }}>
        <div className="np-head">
          <h2>Post-HD LUS by session number</h2>
          <span className="np-small">Aligned by each patient's 1st, 2nd, 3rd… session, not calendar date</span>
        </div>
        {trend.length < 2 ? (
          <span className="np-small">Need at least two session numbers with data to plot a trend.</span>
        ) : (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="sessionIndex" tick={{ fontSize: 11 }} label={{ value: 'Session #', position: 'insideBottom', offset: -4, fontSize: 11 }} />
                <YAxis domain={[0, 36]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="group1Mean" name={GROUP_LABELS.group1_standard} stroke="var(--text-muted)" strokeWidth={2} connectNulls />
                <Line type="monotone" dataKey="group2Mean" name={GROUP_LABELS.group2_lus_guided} stroke="var(--accent)" strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="np-card np-fade" style={{ animationDelay: '.34s' }}>
        <div className="np-head">
          <h2>All sessions</h2>
          <button type="button" className="link-button" onClick={() => exportSessionsCsv(sessions, groupByPatientId)}>
            Export CSV (all fields)
          </button>
        </div>
        <div className="np-search" style={{ maxWidth: 360 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label className="np-sr" htmlFor="th-search">
            Search sessions
          </label>
          <input id="th-search" placeholder="Search sessions…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {visibleSessions.length === 0 ? (
          <span className="np-small">No sessions logged yet — start from a patient's "LUS Study" tab.</span>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="th-tbl">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Group</th>
                  <th>Date</th>
                  <th>Pre/Post LUS</th>
                  <th>Weight loss</th>
                  <th>Decision</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/patients/${s.patientId}`}>{s.patientName ?? 'Unknown'}</Link>
                    </td>
                    <td>{GROUP_LABELS[groupByPatientId.get(s.patientId) as LusStudyGroup] ?? '—'}</td>
                    <td>{toShamsi(s.sessionDate)}</td>
                    <td>
                      {s.preLusTotal ?? '—'} → {s.postLusTotal ?? '—'}
                    </td>
                    <td>{s.weightLossKg != null ? `${s.weightLossKg.toFixed(2)} kg` : '—'}</td>
                    <td>{s.lusGuidedDecision ? s.lusGuidedDecision.replace('_', ' ') : '—'}</td>
                    <td>
                      <button className="link-button" onClick={() => handleEditSession(s)}>
                        Edit
                      </button>
                      <button className="link-button" onClick={() => void handleDeleteSession(s.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
