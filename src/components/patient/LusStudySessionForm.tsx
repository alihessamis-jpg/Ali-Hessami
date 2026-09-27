import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { deriveLusSessionFields, suggestLusGuidedDecision, EMPTY_LUS_ZONES } from '../../lib/lusStudy'
import type { LusStudySessionWithPatient } from '../../lib/api/lusStudy'
import type {
  InvestigatorVolumeAssessment,
  LusGuidedDecision,
  LusStudyGroup,
  LusStudySessionDraft,
  LusZoneScores,
  PhysicianConfirmation,
  SafetyCheck,
} from '../../types/domain'

interface Props {
  patientId: string
  studyGroup: LusStudyGroup
  defaultHeightCm?: number | null
  defaultWeightKg?: number | null
  defaultTargetWeightKg?: number | null
  previousPostHdWeightKg?: number | null
  existing?: LusStudySessionWithPatient | null
  onSaved: (draft: LusStudySessionDraft) => void
  onCancel: () => void
}

const today = () => new Date().toISOString().slice(0, 10)

const ZONE_ROWS = [1, 2, 3, 4, 5, 6] as const

const ZONE_OPTIONS = [
  { value: 0, label: '0 — No B-lines' },
  { value: 1, label: '1 — Isolated B-lines' },
  { value: 2, label: '2 — Confluent B-lines' },
  { value: 3, label: '3 — Consolidation' },
]

const ADJUSTMENT_REASONS = ['LUS findings', 'IVC findings', 'Clinical signs', 'Blood pressure', 'Combination of findings', 'Other']

function toNum(v: string): number | null {
  return v === '' ? null : Number(v)
}

function zoneGrid(title: string, zones: LusZoneScores, onChange: (key: keyof LusZoneScores, value: number) => void) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h3 className="dash-card-title">{title}</h3>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Zone</th>
            <th>Right lung</th>
            <th>Left lung</th>
          </tr>
        </thead>
        <tbody>
          {ZONE_ROWS.map((n) => {
            const rKey = `r${n}` as keyof LusZoneScores
            const lKey = `l${n}` as keyof LusZoneScores
            return (
              <tr key={n}>
                <td>Zone {n}</td>
                <td>
                  <select value={zones[rKey] ?? ''} onChange={(e) => onChange(rKey, Number(e.target.value))} required>
                    <option value="" disabled>
                      —
                    </option>
                    {ZONE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={zones[lKey] ?? ''} onChange={(e) => onChange(lKey, Number(e.target.value))} required>
                    <option value="" disabled>
                      —
                    </option>
                    {ZONE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function LusStudySessionForm({
  patientId,
  studyGroup,
  defaultHeightCm,
  defaultWeightKg,
  defaultTargetWeightKg,
  previousPostHdWeightKg,
  existing,
  onSaved,
  onCancel,
}: Props) {
  const [sessionDate, setSessionDate] = useState(existing?.sessionDate ?? today())
  const [heightCm, setHeightCm] = useState(String(existing?.heightCm ?? defaultHeightCm ?? ''))
  const [preHdWeightKg, setPreHdWeightKg] = useState(String(existing?.preHdWeightKg ?? defaultWeightKg ?? ''))
  const [targetWeightKg, setTargetWeightKg] = useState(String(existing?.targetWeightKg ?? defaultTargetWeightKg ?? ''))
  const [preHdEdema, setPreHdEdema] = useState(!!existing?.preHdEdema)
  const [preHdDyspnea, setPreHdDyspnea] = useState(!!existing?.preHdDyspnea)
  const [preHdCrackles, setPreHdCrackles] = useState(!!existing?.preHdCrackles)
  const [preLus, setPreLus] = useState<LusZoneScores>(existing?.preLus ?? { ...EMPTY_LUS_ZONES })
  const [preIvcMaxMm, setPreIvcMaxMm] = useState(String(existing?.preIvcMaxMm ?? ''))
  const [preIvcMinMm, setPreIvcMinMm] = useState(String(existing?.preIvcMinMm ?? ''))
  const [preIvcRespVariationPct, setPreIvcRespVariationPct] = useState(String(existing?.preIvcRespVariationPct ?? ''))
  const [preHdSbp, setPreHdSbp] = useState(String(existing?.preHdSbp ?? ''))
  const [preHdDbp, setPreHdDbp] = useState(String(existing?.preHdDbp ?? ''))
  const [residualUrineOutputMl, setResidualUrineOutputMl] = useState(String(existing?.residualUrineOutputMl ?? ''))

  const [showPostHd, setShowPostHd] = useState(!!existing?.postHdWeightKg)
  const [dialysisDurationHours, setDialysisDurationHours] = useState(String(existing?.dialysisDurationHours ?? ''))
  const [ufVolumeMl, setUfVolumeMl] = useState(String(existing?.ufVolumeMl ?? ''))
  const [previousPostHdWeightKgInput, setPreviousPostHdWeightKgInput] = useState(
    String(existing?.previousPostHdWeightKg ?? previousPostHdWeightKg ?? '')
  )
  const [intradialyticHypotension, setIntradialyticHypotension] = useState(!!existing?.intradialyticHypotension)
  const [intradialyticMuscleCramp, setIntradialyticMuscleCramp] = useState(!!existing?.intradialyticMuscleCramp)
  const [salineBolusRequired, setSalineBolusRequired] = useState(!!existing?.salineBolusRequired)
  const [ufInterruption, setUfInterruption] = useState(!!existing?.ufInterruption)
  const [earlyTermination, setEarlyTermination] = useState(!!existing?.earlyTermination)

  const [postHdWeightKg, setPostHdWeightKg] = useState(String(existing?.postHdWeightKg ?? ''))
  const [postLus, setPostLus] = useState<LusZoneScores>(existing?.postLus ?? { ...EMPTY_LUS_ZONES })
  const [postIvcMaxMm, setPostIvcMaxMm] = useState(String(existing?.postIvcMaxMm ?? ''))
  const [postIvcMinMm, setPostIvcMinMm] = useState(String(existing?.postIvcMinMm ?? ''))
  const [postIvcRespVariationPct, setPostIvcRespVariationPct] = useState(String(existing?.postIvcRespVariationPct ?? ''))
  const [postHdSbp, setPostHdSbp] = useState(String(existing?.postHdSbp ?? ''))
  const [postHdDbp, setPostHdDbp] = useState(String(existing?.postHdDbp ?? ''))
  const [postHdEdema, setPostHdEdema] = useState(!!existing?.postHdEdema)
  const [postHdDyspnea, setPostHdDyspnea] = useState(!!existing?.postHdDyspnea)
  const [postHdCrackles, setPostHdCrackles] = useState(!!existing?.postHdCrackles)
  const [investigatorVolumeAssessment, setInvestigatorVolumeAssessment] = useState<InvestigatorVolumeAssessment | ''>(
    existing?.investigatorVolumeAssessment ?? ''
  )

  const [dryWeightReassessmentNeeded, setDryWeightReassessmentNeeded] = useState(!!existing?.dryWeightReassessmentNeeded)
  const [lusGuidedDecision, setLusGuidedDecision] = useState<LusGuidedDecision | ''>(existing?.lusGuidedDecision ?? '')
  const [dryWeightAdjustmentKg, setDryWeightAdjustmentKg] = useState(String(existing?.dryWeightAdjustmentKg ?? ''))
  const [adjustmentReason, setAdjustmentReason] = useState<string[]>(existing?.adjustmentReason ?? [])
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheck | ''>(existing?.safetyCheck ?? '')
  const [physicianConfirmation, setPhysicianConfirmation] = useState<PhysicianConfirmation | ''>(
    existing?.physicianConfirmation ?? ''
  )
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const computed = useMemo(
    () =>
      deriveLusSessionFields({
        heightCm: toNum(heightCm),
        preHdWeightKg: toNum(preHdWeightKg),
        targetWeightKg: toNum(targetWeightKg),
        postHdWeightKg: showPostHd ? toNum(postHdWeightKg) : null,
        previousPostHdWeightKg: toNum(previousPostHdWeightKgInput),
        ufVolumeMl: toNum(ufVolumeMl),
        dialysisDurationHours: toNum(dialysisDurationHours),
        preLus,
        postLus: showPostHd ? postLus : { ...EMPTY_LUS_ZONES },
        preIvcMaxMm: toNum(preIvcMaxMm),
        postIvcMaxMm: showPostHd ? toNum(postIvcMaxMm) : null,
        preIvcMinMm: toNum(preIvcMinMm),
        postIvcMinMm: showPostHd ? toNum(postIvcMinMm) : null,
        preIvcRespVariationPct: toNum(preIvcRespVariationPct),
        postIvcRespVariationPct: showPostHd ? toNum(postIvcRespVariationPct) : null,
      }),
    [
      heightCm,
      preHdWeightKg,
      targetWeightKg,
      postHdWeightKg,
      previousPostHdWeightKgInput,
      ufVolumeMl,
      dialysisDurationHours,
      preLus,
      postLus,
      preIvcMaxMm,
      postIvcMaxMm,
      preIvcMinMm,
      postIvcMinMm,
      preIvcRespVariationPct,
      postIvcRespVariationPct,
      showPostHd,
    ]
  )

  const suggestion = useMemo(
    () =>
      showPostHd && studyGroup === 'group2_lus_guided'
        ? suggestLusGuidedDecision({
            postLusTotal: computed.postLusTotal,
            postIvcMaxBsa: computed.postIvcMaxBsa,
            intradialyticHypotension,
            intradialyticMuscleCramp,
            investigatorVolumeAssessment: investigatorVolumeAssessment || null,
          })
        : null,
    [showPostHd, studyGroup, computed.postLusTotal, computed.postIvcMaxBsa, intradialyticHypotension, intradialyticMuscleCramp, investigatorVolumeAssessment]
  )

  useEffect(() => {
    if (suggestion && !lusGuidedDecision) {
      setLusGuidedDecision(suggestion.decision === 'review' ? '' : suggestion.decision)
      setDryWeightReassessmentNeeded(suggestion.decision !== 'no_change')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestion?.decision])

  function toggleReason(reason: string) {
    setAdjustmentReason((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const draft: LusStudySessionDraft = {
      patientId,
      sessionDate,
      heightCm: toNum(heightCm),
      bsaM2: computed.bsaM2,
      preHdWeightKg: toNum(preHdWeightKg),
      targetWeightKg: toNum(targetWeightKg),
      preHdWeightAboveTargetKg: computed.preHdWeightAboveTargetKg,
      preHdEdema,
      preHdDyspnea,
      preHdCrackles,
      preLus,
      preLusTotal: computed.preLusTotal,
      preIvcMaxMm: toNum(preIvcMaxMm),
      preIvcMinMm: toNum(preIvcMinMm),
      preIvcRespVariationPct: toNum(preIvcRespVariationPct),
      preIvcMaxBsa: computed.preIvcMaxBsa,
      preHdSbp: toNum(preHdSbp),
      preHdDbp: toNum(preHdDbp),
      residualUrineOutputMl: toNum(residualUrineOutputMl),
      dialysisDurationHours: toNum(dialysisDurationHours),
      ufVolumeMl: toNum(ufVolumeMl),
      ufRateMlKgH: computed.ufRateMlKgH,
      previousPostHdWeightKg: toNum(previousPostHdWeightKgInput),
      interdialyticWeightGainKg: computed.interdialyticWeightGainKg,
      intradialyticHypotension,
      intradialyticMuscleCramp,
      salineBolusRequired,
      ufInterruption,
      earlyTermination,
      postHdWeightKg: showPostHd ? toNum(postHdWeightKg) : null,
      weightLossKg: showPostHd ? computed.weightLossKg : null,
      weightLossPct: showPostHd ? computed.weightLossPct : null,
      postHdWeightVsDryKg: showPostHd ? computed.postHdWeightVsDryKg : null,
      postLus: showPostHd ? postLus : { ...EMPTY_LUS_ZONES },
      postLusTotal: showPostHd ? computed.postLusTotal : null,
      lusChange: showPostHd ? computed.lusChange : null,
      lusChangePct: showPostHd ? computed.lusChangePct : null,
      postIvcMaxMm: showPostHd ? toNum(postIvcMaxMm) : null,
      postIvcMinMm: showPostHd ? toNum(postIvcMinMm) : null,
      postIvcRespVariationPct: showPostHd ? toNum(postIvcRespVariationPct) : null,
      postIvcMaxBsa: showPostHd ? computed.postIvcMaxBsa : null,
      ivcMaxChangeMm: showPostHd ? computed.ivcMaxChangeMm : null,
      ivcMinChangeMm: showPostHd ? computed.ivcMinChangeMm : null,
      ivcRespVariationChangePct: showPostHd ? computed.ivcRespVariationChangePct : null,
      postHdSbp: showPostHd ? toNum(postHdSbp) : null,
      postHdDbp: showPostHd ? toNum(postHdDbp) : null,
      postHdEdema: showPostHd ? postHdEdema : null,
      postHdDyspnea: showPostHd ? postHdDyspnea : null,
      postHdCrackles: showPostHd ? postHdCrackles : null,
      investigatorVolumeAssessment: showPostHd ? investigatorVolumeAssessment || null : null,
      dryWeightReassessmentNeeded: showPostHd ? dryWeightReassessmentNeeded : null,
      suggestedDecision: suggestion?.decision ?? null,
      lusGuidedDecision: showPostHd ? lusGuidedDecision || null : null,
      dryWeightAdjustmentKg: showPostHd ? toNum(dryWeightAdjustmentKg) : null,
      adjustmentReason: showPostHd ? adjustmentReason : [],
      safetyCheck: showPostHd ? safetyCheck || null : null,
      physicianConfirmation: showPostHd ? physicianConfirmation || null : null,
      notes: notes || null,
    }
    onSaved(draft)
  }

  return (
    <form className="soap-form" onSubmit={handleSubmit}>
      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Session &amp; Pre-HD assessment</h3>
        </div>
        <div className="field-grid">
          <label>
            Session date
            <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value || today())} required />
          </label>
          <label>
            Height (cm)
            <input type="number" step="any" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} required />
          </label>
          <label>
            Pre-HD weight (kg)
            <input type="number" step="any" value={preHdWeightKg} onChange={(e) => setPreHdWeightKg(e.target.value)} required />
          </label>
          <label>
            Target / dry weight (kg)
            <input type="number" step="any" value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} required />
          </label>
        </div>
        <p className="patient-meta">
          BSA (Mosteller): {computed.bsaM2 != null ? `${computed.bsaM2.toFixed(2)} m²` : '—'} · Pre-HD weight above target:{' '}
          {computed.preHdWeightAboveTargetKg != null ? `${computed.preHdWeightAboveTargetKg.toFixed(2)} kg` : '—'}
        </p>
        <div className="field-grid">
          <label className="checkbox-label">
            <input type="checkbox" checked={preHdEdema} onChange={(e) => setPreHdEdema(e.target.checked)} />
            Peripheral edema
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={preHdDyspnea} onChange={(e) => setPreHdDyspnea(e.target.checked)} />
            Dyspnea
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={preHdCrackles} onChange={(e) => setPreHdCrackles(e.target.checked)} />
            Crackles on auscultation
          </label>
        </div>
      </div>

      {zoneGrid(`Pre-HD lung ultrasound (total: ${computed.preLusTotal ?? '—'} / 36)`, preLus, (key, value) =>
        setPreLus((prev) => ({ ...prev, [key]: value }))
      )}

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Pre-HD IVC &amp; BP</h3>
        </div>
        <div className="field-grid">
          <label>
            IVC max diameter (mm)
            <input type="number" step="any" value={preIvcMaxMm} onChange={(e) => setPreIvcMaxMm(e.target.value)} />
          </label>
          <label>
            IVC min diameter (mm)
            <input type="number" step="any" value={preIvcMinMm} onChange={(e) => setPreIvcMinMm(e.target.value)} />
          </label>
          <label>
            IVC respiratory variation (%)
            <input type="number" step="any" value={preIvcRespVariationPct} onChange={(e) => setPreIvcRespVariationPct(e.target.value)} />
          </label>
          <label>
            Systolic BP (mmHg)
            <input type="number" step="any" value={preHdSbp} onChange={(e) => setPreHdSbp(e.target.value)} />
          </label>
          <label>
            Diastolic BP (mmHg)
            <input type="number" step="any" value={preHdDbp} onChange={(e) => setPreHdDbp(e.target.value)} />
          </label>
          <label>
            Residual urine output (mL/day)
            <input type="number" step="any" value={residualUrineOutputMl} onChange={(e) => setResidualUrineOutputMl(e.target.value)} />
          </label>
        </div>
        <p className="patient-meta">
          IVC max / BSA: {computed.preIvcMaxBsa != null ? `${computed.preIvcMaxBsa.toFixed(1)} mm/m²` : '—'}
        </p>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Dialysis session data</h3>
        </div>
        <div className="field-grid">
          <label>
            Duration (hours)
            <input type="number" step="any" value={dialysisDurationHours} onChange={(e) => setDialysisDurationHours(e.target.value)} />
          </label>
          <label>
            UF volume (mL)
            <input type="number" step="any" value={ufVolumeMl} onChange={(e) => setUfVolumeMl(e.target.value)} />
          </label>
          <label>
            Previous post-HD weight (kg)
            <input
              type="number"
              step="any"
              value={previousPostHdWeightKgInput}
              onChange={(e) => setPreviousPostHdWeightKgInput(e.target.value)}
            />
          </label>
        </div>
        <p className="patient-meta">
          UF rate: {computed.ufRateMlKgH != null ? `${computed.ufRateMlKgH.toFixed(1)} mL/kg/h` : '—'}
          {computed.ufRateMlKgH != null && computed.ufRateMlKgH > 13 ? ' — above 13 mL/kg/h planning cap' : ''} · Interdialytic
          weight gain: {computed.interdialyticWeightGainKg != null ? `${computed.interdialyticWeightGainKg.toFixed(2)} kg` : '—'}
        </p>
        <div className="field-grid">
          <label className="checkbox-label">
            <input type="checkbox" checked={intradialyticHypotension} onChange={(e) => setIntradialyticHypotension(e.target.checked)} />
            Intradialytic hypotension
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={intradialyticMuscleCramp} onChange={(e) => setIntradialyticMuscleCramp(e.target.checked)} />
            Intradialytic muscle cramp
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={salineBolusRequired} onChange={(e) => setSalineBolusRequired(e.target.checked)} />
            Saline bolus required
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={ufInterruption} onChange={(e) => setUfInterruption(e.target.checked)} />
            UF interruption during dialysis
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={earlyTermination} onChange={(e) => setEarlyTermination(e.target.checked)} />
            Early termination of dialysis
          </label>
        </div>
      </div>

      {!showPostHd ? (
        <div className="form-actions">
          <button type="button" onClick={() => setShowPostHd(true)}>
            Add post-HD assessment
          </button>
          <button type="submit">Save pre-HD only (complete later)</button>
        </div>
      ) : (
        <>
          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">Post-HD assessment</h3>
            </div>
            <label>
              Post-HD weight (kg)
              <input type="number" step="any" value={postHdWeightKg} onChange={(e) => setPostHdWeightKg(e.target.value)} required />
            </label>
            <p className="patient-meta">
              Weight loss: {computed.weightLossKg != null ? `${computed.weightLossKg.toFixed(2)} kg (${computed.weightLossPct?.toFixed(1)}%)` : '—'} ·
              Post-HD weight vs dry weight: {computed.postHdWeightVsDryKg != null ? `${computed.postHdWeightVsDryKg.toFixed(2)} kg` : '—'}
            </p>
          </div>

          {zoneGrid(`Post-HD lung ultrasound (total: ${computed.postLusTotal ?? '—'} / 36)`, postLus, (key, value) =>
            setPostLus((prev) => ({ ...prev, [key]: value }))
          )}
          <p className="patient-meta" style={{ marginTop: -8 }}>
            LUS change: {computed.lusChange != null ? `${computed.lusChange} points (${computed.lusChangePct?.toFixed(0)}%)` : '—'}
          </p>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">Post-HD IVC &amp; BP</h3>
            </div>
            <div className="field-grid">
              <label>
                IVC max diameter (mm)
                <input type="number" step="any" value={postIvcMaxMm} onChange={(e) => setPostIvcMaxMm(e.target.value)} />
              </label>
              <label>
                IVC min diameter (mm)
                <input type="number" step="any" value={postIvcMinMm} onChange={(e) => setPostIvcMinMm(e.target.value)} />
              </label>
              <label>
                IVC respiratory variation (%)
                <input type="number" step="any" value={postIvcRespVariationPct} onChange={(e) => setPostIvcRespVariationPct(e.target.value)} />
              </label>
              <label>
                Systolic BP (mmHg)
                <input type="number" step="any" value={postHdSbp} onChange={(e) => setPostHdSbp(e.target.value)} />
              </label>
              <label>
                Diastolic BP (mmHg)
                <input type="number" step="any" value={postHdDbp} onChange={(e) => setPostHdDbp(e.target.value)} />
              </label>
            </div>
            <p className="patient-meta">
              IVC max / BSA: {computed.postIvcMaxBsa != null ? `${computed.postIvcMaxBsa.toFixed(1)} mm/m²` : '—'} · Δ IVC max:{' '}
              {computed.ivcMaxChangeMm != null ? `${computed.ivcMaxChangeMm.toFixed(1)} mm` : '—'}
            </p>
          </div>

          <div className="dash-card">
            <div className="dash-card-header">
              <h3 className="dash-card-title">Post-HD clinical volume assessment</h3>
            </div>
            <div className="field-grid">
              <label className="checkbox-label">
                <input type="checkbox" checked={postHdEdema} onChange={(e) => setPostHdEdema(e.target.checked)} />
                Peripheral edema
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={postHdCrackles} onChange={(e) => setPostHdCrackles(e.target.checked)} />
                Crackles on auscultation
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={postHdDyspnea} onChange={(e) => setPostHdDyspnea(e.target.checked)} />
                Dyspnea
              </label>
            </div>
            <label>
              Investigator volume assessment
              <select
                value={investigatorVolumeAssessment}
                onChange={(e) => setInvestigatorVolumeAssessment(e.target.value as InvestigatorVolumeAssessment)}
                required
              >
                <option value="">—</option>
                <option value="euvolemia">Euvolemia</option>
                <option value="persistent_overload">Persistent volume overload</option>
                <option value="possible_hypovolemia">Possible hypovolemia</option>
                <option value="indeterminate">Indeterminate</option>
              </select>
            </label>
          </div>

          {studyGroup === 'group2_lus_guided' && (
            <div className="dash-card">
              <div className="dash-card-header">
                <h3 className="dash-card-title">LUS-guided dry weight adjustment</h3>
              </div>
              {suggestion && (
                <div className={`aki-banner ${suggestion.decision !== 'no_change' ? 'aki-banner--warning' : ''}`}>
                  <strong>Suggested decision: {suggestion.decision.replace('_', ' ')}</strong>
                  <span className="patient-meta">{suggestion.reasons.join(' · ')}</span>
                  <span className="patient-meta">This is a suggestion only — confirm or override below.</span>
                </div>
              )}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={dryWeightReassessmentNeeded}
                  onChange={(e) => setDryWeightReassessmentNeeded(e.target.checked)}
                />
                Is dry weight reassessment needed?
              </label>
              <label>
                LUS-guided dry weight decision
                <select value={lusGuidedDecision} onChange={(e) => setLusGuidedDecision(e.target.value as LusGuidedDecision)}>
                  <option value="">—</option>
                  <option value="decrease">Decrease dry weight</option>
                  <option value="increase">Increase dry weight</option>
                  <option value="no_change">No change</option>
                </select>
              </label>
              <label>
                Dry weight adjustment (kg)
                <input type="number" step="any" value={dryWeightAdjustmentKg} onChange={(e) => setDryWeightAdjustmentKg(e.target.value)} />
              </label>
              <label>Reason for dry weight adjustment</label>
              <div className="field-grid">
                {ADJUSTMENT_REASONS.map((r) => (
                  <label key={r} className="checkbox-label">
                    <input type="checkbox" checked={adjustmentReason.includes(r)} onChange={() => toggleReason(r)} />
                    {r}
                  </label>
                ))}
              </div>
              <label>
                Safety check before dry weight adjustment
                <select value={safetyCheck} onChange={(e) => setSafetyCheck(e.target.value as SafetyCheck)}>
                  <option value="">—</option>
                  <option value="stable">Clinically stable — adjustment acceptable</option>
                  <option value="concern">Clinical concern — no adjustment</option>
                  <option value="indeterminate">Indeterminate — physician review required</option>
                </select>
              </label>
              <label>
                Physician/investigator confirmation
                <select value={physicianConfirmation} onChange={(e) => setPhysicianConfirmation(e.target.value as PhysicianConfirmation)}>
                  <option value="">—</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="not_confirmed">Not confirmed</option>
                  <option value="required_review">Required review</option>
                </select>
              </label>
            </div>
          )}
        </>
      )}

      <label>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="form-actions">
        <button type="submit">{showPostHd ? 'Save complete session' : 'Save'}</button>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
