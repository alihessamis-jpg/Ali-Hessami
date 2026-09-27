import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, Legend, XAxis, YAxis } from 'recharts'
import { listAllLusStudySessions, listLusStudyEnrollments } from '../lib/api/lusStudy'
import { buildGroupPostLusTrend } from '../lib/lusStudy'
import { downloadCsv } from '../lib/csvExport'
import { matchesSearch } from '../lib/textFilter'
import { toShamsi } from '../lib/shamsi'
import { FormBuilderIcon } from '../components/icons'
import type { LusStudySessionWithPatient } from '../lib/api/lusStudy'
import type { LusStudyEnrollment, LusStudyGroup } from '../types/domain'

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
  const [sessions, setSessions] = useState<LusStudySessionWithPatient[]>([])
  const [enrollments, setEnrollments] = useState<LusStudyEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([listAllLusStudySessions(), listLusStudyEnrollments()])
      .then(([s, e]) => {
        setSessions(s)
        setEnrollments(e)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load study data'))
      .finally(() => setLoading(false))
  }, [])

  const groupByPatientId = useMemo(() => new Map(enrollments.map((e) => [e.patientId, e.studyGroup])), [enrollments])

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

  if (loading) return <p>Loading…</p>

  const g1 = bySessionGroup.group1_standard.filter((s) => s.postLusTotal != null)
  const g2 = bySessionGroup.group2_lus_guided.filter((s) => s.postLusTotal != null)
  const decreaseCount = bySessionGroup.group2_lus_guided.filter((s) => s.lusGuidedDecision === 'decrease').length
  const increaseCount = bySessionGroup.group2_lus_guided.filter((s) => s.lusGuidedDecision === 'increase').length
  const g2Complete = bySessionGroup.group2_lus_guided.filter((s) => s.postHdWeightKg != null).length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <FormBuilderIcon />
          </span>
          Thesis Data Collection — LUS Volume-Assessment Study
        </h1>
      </div>
      <p className="empty-state">
        Log sessions from each enrolled patient's own chart (their "LUS Study" tab). This page is the study-level
        view: every session across patients, and a Group 1 vs Group 2 comparison.
      </p>

      {error && <p className="form-error">{error}</p>}

      <div className="calc-strip">
        <div>
          <span className="calc-label">Patients enrolled</span>
          <span className="calc-value">{enrollments.length}</span>
        </div>
        <div>
          <span className="calc-label">Sessions logged</span>
          <span className="calc-value">{sessions.length}</span>
        </div>
        <div>
          <span className="calc-label">Group 1 mean post-HD LUS</span>
          <span className="calc-value">{fmt(mean(g1.map((s) => s.postLusTotal as number)))}</span>
        </div>
        <div>
          <span className="calc-label">Group 2 mean post-HD LUS</span>
          <span className="calc-value">{fmt(mean(g2.map((s) => s.postLusTotal as number)))}</span>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Group comparison</h2>
        </div>
        <table className="data-table">
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
              <td>{fmt(mean(g1.map((s) => s.preLusTotal as number).filter((v) => v != null)))}</td>
              <td>{fmt(mean(g2.map((s) => s.preLusTotal as number).filter((v) => v != null)))}</td>
            </tr>
            <tr>
              <td>Mean post-HD LUS</td>
              <td>{fmt(mean(g1.map((s) => s.postLusTotal as number)))}</td>
              <td>{fmt(mean(g2.map((s) => s.postLusTotal as number)))}</td>
            </tr>
            <tr>
              <td>Mean LUS change</td>
              <td>{fmt(mean(g1.map((s) => s.lusChange as number).filter((v) => v != null)))}</td>
              <td>{fmt(mean(g2.map((s) => s.lusChange as number).filter((v) => v != null)))}</td>
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

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Post-HD LUS by session number</h2>
          <span className="patient-meta">Aligned by each patient's 1st, 2nd, 3rd… session, not calendar date</span>
        </div>
        {trend.length < 2 ? (
          <p className="empty-state">Need at least two session numbers with data to plot a trend.</p>
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
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">All sessions</h2>
          <button type="button" className="link-button" onClick={() => exportSessionsCsv(sessions, groupByPatientId)}>
            Export CSV (all fields)
          </button>
        </div>
        <input
          placeholder="Search sessions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ margin: '12px 0', width: '100%', maxWidth: 360 }}
        />
        {visibleSessions.length === 0 ? (
          <p className="empty-state">No sessions logged yet — start from a patient's "LUS Study" tab.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Group</th>
                <th>Date</th>
                <th>Pre/Post LUS</th>
                <th>Weight loss</th>
                <th>Decision</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
