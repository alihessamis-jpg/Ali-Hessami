import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  deriveLusSessionFields,
  suggestLusGuidedDecision,
  EMPTY_LUS_ZONES,
  weightDeviationPct,
  ivcCollapsibilityPct,
  urrPct,
  spKtVDaugirdas,
  lusIvcAgreement,
  LUS_IVC_AGREEMENT_LABELS,
  bpIndex,
  newTargetWeight,
  bpGatePassed,
  STUDY_DAYS,
} from '../../lib/lusStudy'
import { formatAge, yearsSince } from '../../lib/patientAge'
import { ageInMonths, ageInYears, heightForAgePercentile, normalizeSex } from '../../lib/growth'
import type { LusStudySessionWithPatient } from '../../lib/api/lusStudy'
import type {
  InvestigatorVolumeAssessment,
  IvcImpression,
  LusGuidedDecision,
  LusImageQuality,
  LusStudyGroup,
  LusStudySessionDraft,
  LusZoneScores,
  PhysicianConfirmation,
  SafetyCheck,
} from '../../types/domain'

interface Props {
  patientId: string
  studyGroup: LusStudyGroup
  patientAge?: number | null
  patientSex?: string | null
  patientDob?: string | null
  underlyingDisease?: string | null
  dialysisStartDate?: string | null
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

const INTRADIALYTIC_SYMPTOMS = [
  'Dizziness / light-headedness',
  'Nausea / vomiting',
  'Headache',
  'Abdominal pain',
  'Muscle cramp',
  'Restlessness / yawning',
  'Chest pain',
  'Seizure',
]

// Free-entry numeric/text fields added for the thesis protocol; kept in one
// record so each one doesn't need its own useState pair.
const EXTRA_TEXT_KEYS = [
  'studyDay',
  'lusOperator',
  'lusImageQuality',
  'postLusMinutesAfterHd',
  'preHdHeartRate',
  'preHdRespRate',
  'preHdSpo2',
  'postHdHeartRate',
  'postHdSpo2',
  'preIvcImpression',
  'postIvcImpression',
  'intradialyticNadirSbp',
  'intradialyticNadirDbp',
  'interdialyticHomeSbp',
  'interdialyticHomeDbp',
  'antihypertensiveCount',
  'antihypertensiveChangeNote',
  'plannedUfMl',
  'bloodFlowMlMin',
  'dialysateSodium',
  'dialysateTempC',
  'salineVolumeMl',
  'adverseEventNote',
  'labUreaPre',
  'labUreaPost',
  'labHb',
  'labAlbumin',
  'labSodium',
  'labPotassium',
  'labNtProbnp',
  'adjustmentStep',
] as const
type ExtraTextKey = (typeof EXTRA_TEXT_KEYS)[number]
const EXTRA_TEXT_STRING_KEYS: ExtraTextKey[] = [
  'lusOperator',
  'lusImageQuality',
  'preIvcImpression',
  'postIvcImpression',
  'antihypertensiveChangeNote',
  'adverseEventNote',
]

const EXTRA_BOOL_KEYS = [
  'midWeekSession',
  'operatorBlinded',
  'preHdHepatomegaly',
  'antihypertensiveChanged',
  'hospitalization',
  'extraDialysisSession',
  'adjustmentImplemented',
] as const
type ExtraBoolKey = (typeof EXTRA_BOOL_KEYS)[number]

const BP_CATEGORY_LABEL: Record<string, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  stage1: 'Stage 1 HTN',
  stage2: 'Stage 2 HTN',
}

function fmtIdx(r: { sbpIndex: number | null; dbpIndex: number | null; category: string | null }): string {
  if (r.sbpIndex == null && r.category == null) return '—'
  return `SBP index ${r.sbpIndex?.toFixed(2) ?? '—'} · DBP index ${r.dbpIndex?.toFixed(2) ?? '—'} · ${r.category ? BP_CATEGORY_LABEL[r.category] ?? r.category : '—'}`
}

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
                  <select value={zones[rKey] ?? ''} onChange={(e) => onChange(rKey, Number(e.target.value))}>
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
                  <select value={zones[lKey] ?? ''} onChange={(e) => onChange(lKey, Number(e.target.value))}>
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
  patientAge,
  patientSex,
  patientDob,
  underlyingDisease,
  dialysisStartDate,
  defaultHeightCm,
  defaultWeightKg,
  defaultTargetWeightKg,
  previousPostHdWeightKg,
  existing,
  onSaved,
  onCancel,
}: Props) {
  const dialysisDuration = formatAge(yearsSince(dialysisStartDate))
  const patientSummary = [
    formatAge(patientAge) && `Age: ${formatAge(patientAge)}`,
    underlyingDisease && `Underlying cause: ${underlyingDisease}`,
    dialysisDuration && `On dialysis: ${dialysisDuration}`,
  ]
    .filter(Boolean)
    .join(' · ')
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

  const [extra, setExtra] = useState<Record<ExtraTextKey, string>>(() => {
    const src = (existing ?? {}) as Record<string, unknown>
    const init = {} as Record<ExtraTextKey, string>
    for (const k of EXTRA_TEXT_KEYS) init[k] = src[k] == null ? '' : String(src[k])
    return init
  })
  const [flags, setFlags] = useState<Record<ExtraBoolKey, boolean>>(() => {
    const src = (existing ?? {}) as Record<string, unknown>
    const init = {} as Record<ExtraBoolKey, boolean>
    for (const k of EXTRA_BOOL_KEYS) init[k] = !!src[k]
    return init
  })
  const [intradialyticSymptoms, setIntradialyticSymptoms] = useState<string[]>(existing?.intradialyticSymptoms ?? [])
  const setX = (k: ExtraTextKey, v: string) => setExtra((prev) => ({ ...prev, [k]: v }))
  const setF = (k: ExtraBoolKey, v: boolean) => setFlags((prev) => ({ ...prev, [k]: v }))
  const xNum = (k: ExtraTextKey) => toNum(extra[k])
  const numField = (k: ExtraTextKey, label: string) => (
    <label>
      {label}
      <input type="number" step="any" value={extra[k]} onChange={(e) => setX(k, e.target.value)} />
    </label>
  )
  const boolField = (k: ExtraBoolKey, label: string) => (
    <label className="checkbox-label">
      <input type="checkbox" checked={flags[k]} onChange={(e) => setF(k, e.target.checked)} />
      {label}
    </label>
  )

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

  const derivedExtra = useMemo(() => {
    const sex = normalizeSex(patientSex)
    const ageY = (patientDob ? ageInYears(patientDob, sessionDate) : null) ?? patientAge ?? null
    const ageM = (patientDob ? ageInMonths(patientDob, sessionDate) : null) ?? (patientAge != null ? patientAge * 12 : null)
    const h = toNum(heightCm)
    const heightPct = h != null && ageM != null && sex ? heightForAgePercentile(h, ageM, sex) : null
    const target = toNum(targetWeightKg)
    const preCi = ivcCollapsibilityPct(toNum(preIvcMaxMm), toNum(preIvcMinMm))
    const postCi = ivcCollapsibilityPct(toNum(postIvcMaxMm), toNum(postIvcMinMm))
    const ureaPre = xNum('labUreaPre')
    const ureaPost = xNum('labUreaPost')
    const decision = (lusGuidedDecision || null) as LusGuidedDecision | null
    return {
      heightPct,
      preWeightDeviationPct: weightDeviationPct(toNum(preHdWeightKg), target),
      postWeightDeviationPct: showPostHd ? weightDeviationPct(toNum(postHdWeightKg), target) : null,
      interdialyticWeightGainPct:
        computed.interdialyticWeightGainKg != null && target ? (computed.interdialyticWeightGainKg / target) * 100 : null,
      preCi,
      postCi,
      preBp: bpIndex(toNum(preHdSbp), toNum(preHdDbp), ageY, sex, heightPct),
      postBp: showPostHd ? bpIndex(toNum(postHdSbp), toNum(postHdDbp), ageY, sex, heightPct) : bpIndex(null, null, null, null, null),
      preAgreement: lusIvcAgreement(computed.preLusTotal, (extra.preIvcImpression || null) as IvcImpression | null),
      postAgreement: showPostHd ? lusIvcAgreement(computed.postLusTotal, (extra.postIvcImpression || null) as IvcImpression | null) : null,
      urr: urrPct(ureaPre, ureaPost),
      ktv: spKtVDaugirdas(
        ureaPre,
        ureaPost,
        toNum(dialysisDurationHours),
        computed.weightLossKg,
        showPostHd ? toNum(postHdWeightKg) : null
      ),
      newTarget: showPostHd ? newTargetWeight(target, decision, toNum(dryWeightAdjustmentKg)) : null,
      bpGate: showPostHd ? bpGatePassed(toNum(postHdSbp), toNum(postHdDbp), intradialyticHypotension) : null,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    patientSex,
    patientDob,
    patientAge,
    sessionDate,
    heightCm,
    targetWeightKg,
    preHdWeightKg,
    postHdWeightKg,
    showPostHd,
    computed,
    preIvcMaxMm,
    preIvcMinMm,
    postIvcMaxMm,
    postIvcMinMm,
    preHdSbp,
    preHdDbp,
    postHdSbp,
    postHdDbp,
    extra,
    lusGuidedDecision,
    dryWeightAdjustmentKg,
    dialysisDurationHours,
    intradialyticHypotension,
  ])

  function toggleSymptom(sym: string) {
    setIntradialyticSymptoms((prev) => (prev.includes(sym) ? prev.filter((x) => x !== sym) : [...prev, sym]))
  }

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
      preIvcRespVariationPct: toNum(preIvcRespVariationPct) ?? (derivedExtra.preCi != null ? Math.round(derivedExtra.preCi) : null),
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
      postIvcRespVariationPct: showPostHd
        ? toNum(postIvcRespVariationPct) ?? (derivedExtra.postCi != null ? Math.round(derivedExtra.postCi) : null)
        : null,
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

      // thesis protocol extras
      ...(() => {
        const o: Record<string, unknown> = {}
        for (const k of EXTRA_TEXT_KEYS) o[k] = EXTRA_TEXT_STRING_KEYS.includes(k) ? extra[k] || null : toNum(extra[k])
        for (const k of EXTRA_BOOL_KEYS) o[k] = flags[k]
        return o as Partial<LusStudySessionDraft>
      })(),
      intradialyticSymptoms,
      preWeightDeviationPct: derivedExtra.preWeightDeviationPct,
      postWeightDeviationPct: derivedExtra.postWeightDeviationPct,
      interdialyticWeightGainPct: derivedExtra.interdialyticWeightGainPct,
      preSbpIndex: derivedExtra.preBp.sbpIndex,
      preDbpIndex: derivedExtra.preBp.dbpIndex,
      preBpCategory: derivedExtra.preBp.category,
      postSbpIndex: derivedExtra.postBp.sbpIndex,
      postDbpIndex: derivedExtra.postBp.dbpIndex,
      postBpCategory: derivedExtra.postBp.category,
      preLusIvcAgreement: derivedExtra.preAgreement,
      postLusIvcAgreement: derivedExtra.postAgreement,
      urrPct: derivedExtra.urr,
      spKtV: derivedExtra.ktv,
      newTargetWeightKg: derivedExtra.newTarget,
      bpGatePassed: derivedExtra.bpGate,
    }
    onSaved(draft)
  }

  return (
    <form className="soap-form" onSubmit={handleSubmit}>
      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Protocol time point &amp; LUS operator</h3>
        </div>
        <div className="field-grid">
          <label>
            Study time point
            <select value={extra.studyDay} onChange={(e) => setX('studyDay', e.target.value)}>
              <option value="">—</option>
              {STUDY_DAYS.map((d) => (
                <option key={d} value={d}>
                  Day {d}
                </option>
              ))}
              <option value="0">Unscheduled / extra</option>
            </select>
          </label>
          <label>
            LUS/IVC operator
            <input value={extra.lusOperator} onChange={(e) => setX('lusOperator', e.target.value)} placeholder="Name / initials" />
          </label>
          <label>
            Image quality
            <select value={extra.lusImageQuality} onChange={(e) => setX('lusImageQuality', e.target.value as LusImageQuality)}>
              <option value="">—</option>
              <option value="adequate">Adequate</option>
              <option value="limited">Limited</option>
              <option value="inadequate">Inadequate (exclusion criterion)</option>
            </select>
          </label>
        </div>
        <div className="field-grid">
          {boolField('midWeekSession', 'Mid-week session')}
          {boolField('operatorBlinded', 'Operator blinded to group allocation')}
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Session &amp; Pre-HD assessment</h3>
        </div>
        {patientSummary && <p className="patient-meta">{patientSummary}</p>}
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
          {derivedExtra.preWeightDeviationPct != null ? ` (${derivedExtra.preWeightDeviationPct.toFixed(1)}% of target)` : ''}
          {derivedExtra.heightPct != null ? ` · Height percentile: ${derivedExtra.heightPct.toFixed(0)}` : ''}
        </p>
        <div className="field-grid">
          {numField('preHdHeartRate', 'Heart rate (/min)')}
          {numField('preHdRespRate', 'Respiratory rate (/min)')}
          {numField('preHdSpo2', 'SpO₂ (%)')}
        </div>
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
          {boolField('preHdHepatomegaly', 'Hepatomegaly')}
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
        <label>
          IVC impression
          <select value={extra.preIvcImpression} onChange={(e) => setX('preIvcImpression', e.target.value as IvcImpression)}>
            <option value="">—</option>
            <option value="plethoric">Plethoric / non-collapsing</option>
            <option value="normal">Normal</option>
            <option value="collapsed">Collapsed / flat</option>
          </select>
        </label>
        <p className="patient-meta">
          IVC max / BSA: {computed.preIvcMaxBsa != null ? `${computed.preIvcMaxBsa.toFixed(1)} mm/m²` : '—'} · Collapsibility (calc):{' '}
          {derivedExtra.preCi != null ? `${derivedExtra.preCi.toFixed(0)}%` : '—'} · LUS–IVC:{' '}
          {derivedExtra.preAgreement ? LUS_IVC_AGREEMENT_LABELS[derivedExtra.preAgreement] : '—'}
        </p>
        <p className="patient-meta">Pre-HD BP (AAP 2017): {fmtIdx(derivedExtra.preBp)}</p>
        <div className="field-grid">
          {numField('antihypertensiveCount', 'No. of antihypertensive drugs')}
          {boolField('antihypertensiveChanged', 'Antihypertensives changed since last time point')}
        </div>
        {flags.antihypertensiveChanged && (
          <label>
            Antihypertensive change (drug / dose)
            <input value={extra.antihypertensiveChangeNote} onChange={(e) => setX('antihypertensiveChangeNote', e.target.value)} />
          </label>
        )}
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
          {numField('plannedUfMl', 'Planned UF goal (mL)')}
          {numField('bloodFlowMlMin', 'Blood flow Qb (mL/min)')}
          {numField('dialysateSodium', 'Dialysate Na (mmol/L)')}
          {numField('dialysateTempC', 'Dialysate temp (°C)')}
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
          {derivedExtra.interdialyticWeightGainPct != null ? ` (${derivedExtra.interdialyticWeightGainPct.toFixed(1)}% of target)` : ''}
        </p>
        <div className="field-grid">
          {numField('intradialyticNadirSbp', 'Nadir SBP during HD (q30 min)')}
          {numField('intradialyticNadirDbp', 'Nadir DBP during HD')}
          {numField('salineVolumeMl', 'Saline given (mL)')}
        </div>
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
        <label>Intradialytic symptoms</label>
        <div className="field-grid">
          {INTRADIALYTIC_SYMPTOMS.map((sym) => (
            <label key={sym} className="checkbox-label">
              <input type="checkbox" checked={intradialyticSymptoms.includes(sym)} onChange={() => toggleSymptom(sym)} />
              {sym}
            </label>
          ))}
        </div>
        <p className="patient-meta">
          IDH (KDOQI): fall in SBP ≥20 mmHg or MAP ≥10 mmHg with symptoms or need for intervention.
        </p>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Labs (optional, at each time point)</h3>
        </div>
        <div className="field-grid">
          {numField('labUreaPre', 'Urea pre-HD (mg/dL)')}
          {numField('labUreaPost', 'Urea post-HD (mg/dL)')}
          {numField('labHb', 'Hemoglobin (g/dL)')}
          {numField('labAlbumin', 'Albumin (g/dL)')}
          {numField('labSodium', 'Na (mmol/L)')}
          {numField('labPotassium', 'K (mmol/L)')}
          {numField('labNtProbnp', 'NT-proBNP (pg/mL)')}
        </div>
        <p className="patient-meta">
          URR: {derivedExtra.urr != null ? `${derivedExtra.urr.toFixed(0)}%` : '—'} · spKt/V (Daugirdas II):{' '}
          {derivedExtra.ktv != null ? derivedExtra.ktv.toFixed(2) : '— (needs post-HD weight)'}
        </p>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Between sessions &amp; adverse events</h3>
        </div>
        <div className="field-grid">
          {numField('interdialyticHomeSbp', 'Interdialytic / home SBP (mean)')}
          {numField('interdialyticHomeDbp', 'Interdialytic / home DBP (mean)')}
        </div>
        <div className="field-grid">
          {boolField('hospitalization', 'Hospitalization since last time point')}
          {boolField('extraDialysisSession', 'Extra / emergency dialysis for fluid overload')}
        </div>
        <label>
          Adverse event details
          <input value={extra.adverseEventNote} onChange={(e) => setX('adverseEventNote', e.target.value)} />
        </label>
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
              {derivedExtra.postWeightDeviationPct != null ? ` (${derivedExtra.postWeightDeviationPct.toFixed(1)}%)` : ''}
            </p>
            <div className="field-grid">
              {numField('postLusMinutesAfterHd', 'LUS done … min after HD end')}
              {numField('postHdHeartRate', 'Heart rate (/min)')}
              {numField('postHdSpo2', 'SpO₂ (%)')}
            </div>
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
              {computed.ivcMaxChangeMm != null ? `${computed.ivcMaxChangeMm.toFixed(1)} mm` : '—'} · Collapsibility (calc):{' '}
              {derivedExtra.postCi != null ? `${derivedExtra.postCi.toFixed(0)}%` : '—'}
            </p>
            <label>
              IVC impression
              <select value={extra.postIvcImpression} onChange={(e) => setX('postIvcImpression', e.target.value as IvcImpression)}>
                <option value="">—</option>
                <option value="plethoric">Plethoric / non-collapsing</option>
                <option value="normal">Normal</option>
                <option value="collapsed">Collapsed / flat</option>
              </select>
            </label>
            <p className="patient-meta">
              LUS–IVC: {derivedExtra.postAgreement ? LUS_IVC_AGREEMENT_LABELS[derivedExtra.postAgreement] : '—'}
            </p>
            <p className="patient-meta">Post-HD BP (AAP 2017): {fmtIdx(derivedExtra.postBp)}</p>
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
                  {extra.studyDay !== '' && extra.studyDay !== '1' && extra.studyDay !== '15' && (
                    <span className="patient-meta">
                      Protocol: LUS-guided reductions (500 g) are made only at day 1 and day 15 — at this time point dry weight
                      follows standard care.
                    </span>
                  )}
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
              <p className="patient-meta">
                Protocol BP gate (end-session BP &gt; 110/60 and no IDH):{' '}
                {derivedExtra.bpGate == null ? '—' : derivedExtra.bpGate ? 'passed' : 'NOT passed — no reduction per protocol'} · New
                target weight: {derivedExtra.newTarget != null ? `${derivedExtra.newTarget.toFixed(2)} kg` : '—'}
              </p>
              <div className="field-grid">
                <label>
                  Adjustment step
                  <select value={extra.adjustmentStep} onChange={(e) => setX('adjustmentStep', e.target.value)}>
                    <option value="">—</option>
                    <option value="1">Step 1 (day 1)</option>
                    <option value="2">Step 2 (day 15)</option>
                    <option value="3">Additional (outside protocol)</option>
                  </select>
                </label>
                {boolField('adjustmentImplemented', 'Applied from the next session')}
              </div>
            </div>
          )}

          {studyGroup === 'group1_standard' && (
            <div className="dash-card">
              <div className="dash-card-header">
                <h3 className="dash-card-title">Dry weight change by treating physician (standard care)</h3>
              </div>
              <div className="field-grid">
                <label>
                  Dry weight decision
                  <select value={lusGuidedDecision} onChange={(e) => setLusGuidedDecision(e.target.value as LusGuidedDecision)}>
                    <option value="">—</option>
                    <option value="decrease">Decreased</option>
                    <option value="increase">Increased</option>
                    <option value="no_change">No change</option>
                  </select>
                </label>
                <label>
                  Change (kg)
                  <input type="number" step="any" value={dryWeightAdjustmentKg} onChange={(e) => setDryWeightAdjustmentKg(e.target.value)} />
                </label>
              </div>
              <p className="patient-meta">
                New target weight: {derivedExtra.newTarget != null ? `${derivedExtra.newTarget.toFixed(2)} kg` : '—'} · LUS/IVC findings
                are recorded but not shown to the treating team.
              </p>
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
