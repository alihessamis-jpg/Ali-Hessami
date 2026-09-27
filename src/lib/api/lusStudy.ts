import { supabase } from '../supabaseClient'
import type { LusStudyEnrollment, LusStudyEnrollmentDraft, LusStudySession, LusStudySessionDraft, LusZoneScores } from '../../types/domain'

interface EnrollmentRow {
  id: string
  patient_id: string
  study_group: string
  enrollment_date: string
  notes: string | null
}

function enrollmentToDomain(row: EnrollmentRow): LusStudyEnrollment {
  return {
    id: row.id,
    patientId: row.patient_id,
    studyGroup: row.study_group as LusStudyEnrollment['studyGroup'],
    enrollmentDate: row.enrollment_date,
    notes: row.notes,
  }
}

export async function listLusStudyEnrollments(): Promise<LusStudyEnrollment[]> {
  const { data, error } = await supabase.from('lus_study_enrollments').select('*')
  if (error) throw error
  return (data as EnrollmentRow[]).map(enrollmentToDomain)
}

export async function getLusStudyEnrollment(patientId: string): Promise<LusStudyEnrollment | null> {
  const { data, error } = await supabase.from('lus_study_enrollments').select('*').eq('patient_id', patientId).maybeSingle()
  if (error) throw error
  return data ? enrollmentToDomain(data as EnrollmentRow) : null
}

export async function enrollPatientInLusStudy(draft: LusStudyEnrollmentDraft): Promise<LusStudyEnrollment> {
  const { data, error } = await supabase
    .from('lus_study_enrollments')
    .insert({
      patient_id: draft.patientId,
      study_group: draft.studyGroup,
      enrollment_date: draft.enrollmentDate,
      notes: draft.notes || null,
    })
    .select()
    .single()
  if (error) throw error
  return enrollmentToDomain(data as EnrollmentRow)
}

interface SessionRow {
  id: string
  patient_id: string
  session_date: string
  height_cm: number | null
  bsa_m2: number | null
  pre_hd_weight_kg: number | null
  target_weight_kg: number | null
  pre_hd_weight_above_target_kg: number | null
  pre_hd_edema: boolean | null
  pre_hd_dyspnea: boolean | null
  pre_hd_crackles: boolean | null
  pre_lus_r1: number | null
  pre_lus_r2: number | null
  pre_lus_r3: number | null
  pre_lus_r4: number | null
  pre_lus_r5: number | null
  pre_lus_r6: number | null
  pre_lus_l1: number | null
  pre_lus_l2: number | null
  pre_lus_l3: number | null
  pre_lus_l4: number | null
  pre_lus_l5: number | null
  pre_lus_l6: number | null
  pre_lus_total: number | null
  pre_ivc_max_mm: number | null
  pre_ivc_min_mm: number | null
  pre_ivc_resp_variation_pct: number | null
  pre_ivc_max_bsa: number | null
  pre_hd_sbp: number | null
  pre_hd_dbp: number | null
  residual_urine_output_ml: number | null
  dialysis_duration_hours: number | null
  uf_volume_ml: number | null
  uf_rate_ml_kg_h: number | null
  previous_post_hd_weight_kg: number | null
  interdialytic_weight_gain_kg: number | null
  intradialytic_hypotension: boolean | null
  intradialytic_muscle_cramp: boolean | null
  saline_bolus_required: boolean | null
  uf_interruption: boolean | null
  early_termination: boolean | null
  post_hd_weight_kg: number | null
  weight_loss_kg: number | null
  weight_loss_pct: number | null
  post_hd_weight_vs_dry_kg: number | null
  post_lus_r1: number | null
  post_lus_r2: number | null
  post_lus_r3: number | null
  post_lus_r4: number | null
  post_lus_r5: number | null
  post_lus_r6: number | null
  post_lus_l1: number | null
  post_lus_l2: number | null
  post_lus_l3: number | null
  post_lus_l4: number | null
  post_lus_l5: number | null
  post_lus_l6: number | null
  post_lus_total: number | null
  lus_change: number | null
  lus_change_pct: number | null
  post_ivc_max_mm: number | null
  post_ivc_min_mm: number | null
  post_ivc_resp_variation_pct: number | null
  post_ivc_max_bsa: number | null
  ivc_max_change_mm: number | null
  ivc_min_change_mm: number | null
  ivc_resp_variation_change_pct: number | null
  post_hd_sbp: number | null
  post_hd_dbp: number | null
  post_hd_edema: boolean | null
  post_hd_dyspnea: boolean | null
  post_hd_crackles: boolean | null
  investigator_volume_assessment: string | null
  dry_weight_reassessment_needed: boolean | null
  suggested_decision: string | null
  lus_guided_decision: string | null
  dry_weight_adjustment_kg: number | null
  adjustment_reason: string[] | null
  safety_check: string | null
  physician_confirmation: string | null
  notes: string | null
  created_at: string
  patients?: { name: string } | null
}

function zonesFromRow(row: SessionRow, prefix: 'pre' | 'post'): LusZoneScores {
  return {
    r1: row[`${prefix}_lus_r1`],
    r2: row[`${prefix}_lus_r2`],
    r3: row[`${prefix}_lus_r3`],
    r4: row[`${prefix}_lus_r4`],
    r5: row[`${prefix}_lus_r5`],
    r6: row[`${prefix}_lus_r6`],
    l1: row[`${prefix}_lus_l1`],
    l2: row[`${prefix}_lus_l2`],
    l3: row[`${prefix}_lus_l3`],
    l4: row[`${prefix}_lus_l4`],
    l5: row[`${prefix}_lus_l5`],
    l6: row[`${prefix}_lus_l6`],
  }
}

export interface LusStudySessionWithPatient extends LusStudySession {
  patientName: string | null
}

function sessionToDomain(row: SessionRow): LusStudySessionWithPatient {
  return {
    id: row.id,
    patientId: row.patient_id,
    sessionDate: row.session_date,
    heightCm: row.height_cm,
    bsaM2: row.bsa_m2,
    preHdWeightKg: row.pre_hd_weight_kg,
    targetWeightKg: row.target_weight_kg,
    preHdWeightAboveTargetKg: row.pre_hd_weight_above_target_kg,
    preHdEdema: row.pre_hd_edema,
    preHdDyspnea: row.pre_hd_dyspnea,
    preHdCrackles: row.pre_hd_crackles,
    preLus: zonesFromRow(row, 'pre'),
    preLusTotal: row.pre_lus_total,
    preIvcMaxMm: row.pre_ivc_max_mm,
    preIvcMinMm: row.pre_ivc_min_mm,
    preIvcRespVariationPct: row.pre_ivc_resp_variation_pct,
    preIvcMaxBsa: row.pre_ivc_max_bsa,
    preHdSbp: row.pre_hd_sbp,
    preHdDbp: row.pre_hd_dbp,
    residualUrineOutputMl: row.residual_urine_output_ml,
    dialysisDurationHours: row.dialysis_duration_hours,
    ufVolumeMl: row.uf_volume_ml,
    ufRateMlKgH: row.uf_rate_ml_kg_h,
    previousPostHdWeightKg: row.previous_post_hd_weight_kg,
    interdialyticWeightGainKg: row.interdialytic_weight_gain_kg,
    intradialyticHypotension: row.intradialytic_hypotension,
    intradialyticMuscleCramp: row.intradialytic_muscle_cramp,
    salineBolusRequired: row.saline_bolus_required,
    ufInterruption: row.uf_interruption,
    earlyTermination: row.early_termination,
    postHdWeightKg: row.post_hd_weight_kg,
    weightLossKg: row.weight_loss_kg,
    weightLossPct: row.weight_loss_pct,
    postHdWeightVsDryKg: row.post_hd_weight_vs_dry_kg,
    postLus: zonesFromRow(row, 'post'),
    postLusTotal: row.post_lus_total,
    lusChange: row.lus_change,
    lusChangePct: row.lus_change_pct,
    postIvcMaxMm: row.post_ivc_max_mm,
    postIvcMinMm: row.post_ivc_min_mm,
    postIvcRespVariationPct: row.post_ivc_resp_variation_pct,
    postIvcMaxBsa: row.post_ivc_max_bsa,
    ivcMaxChangeMm: row.ivc_max_change_mm,
    ivcMinChangeMm: row.ivc_min_change_mm,
    ivcRespVariationChangePct: row.ivc_resp_variation_change_pct,
    postHdSbp: row.post_hd_sbp,
    postHdDbp: row.post_hd_dbp,
    postHdEdema: row.post_hd_edema,
    postHdDyspnea: row.post_hd_dyspnea,
    postHdCrackles: row.post_hd_crackles,
    investigatorVolumeAssessment: row.investigator_volume_assessment as LusStudySession['investigatorVolumeAssessment'],
    dryWeightReassessmentNeeded: row.dry_weight_reassessment_needed,
    suggestedDecision: row.suggested_decision as LusStudySession['suggestedDecision'],
    lusGuidedDecision: row.lus_guided_decision as LusStudySession['lusGuidedDecision'],
    dryWeightAdjustmentKg: row.dry_weight_adjustment_kg,
    adjustmentReason: row.adjustment_reason ?? [],
    safetyCheck: row.safety_check as LusStudySession['safetyCheck'],
    physicianConfirmation: row.physician_confirmation as LusStudySession['physicianConfirmation'],
    notes: row.notes,
    createdAt: row.created_at,
    patientName: row.patients?.name ?? null,
  }
}

function zonesToColumns(zones: LusZoneScores, prefix: 'pre' | 'post') {
  return {
    [`${prefix}_lus_r1`]: zones.r1,
    [`${prefix}_lus_r2`]: zones.r2,
    [`${prefix}_lus_r3`]: zones.r3,
    [`${prefix}_lus_r4`]: zones.r4,
    [`${prefix}_lus_r5`]: zones.r5,
    [`${prefix}_lus_r6`]: zones.r6,
    [`${prefix}_lus_l1`]: zones.l1,
    [`${prefix}_lus_l2`]: zones.l2,
    [`${prefix}_lus_l3`]: zones.l3,
    [`${prefix}_lus_l4`]: zones.l4,
    [`${prefix}_lus_l5`]: zones.l5,
    [`${prefix}_lus_l6`]: zones.l6,
  }
}

function draftToColumns(draft: LusStudySessionDraft) {
  return {
    patient_id: draft.patientId,
    session_date: draft.sessionDate,
    height_cm: draft.heightCm ?? null,
    bsa_m2: draft.bsaM2 ?? null,
    pre_hd_weight_kg: draft.preHdWeightKg ?? null,
    target_weight_kg: draft.targetWeightKg ?? null,
    pre_hd_weight_above_target_kg: draft.preHdWeightAboveTargetKg ?? null,
    pre_hd_edema: draft.preHdEdema ?? null,
    pre_hd_dyspnea: draft.preHdDyspnea ?? null,
    pre_hd_crackles: draft.preHdCrackles ?? null,
    ...zonesToColumns(draft.preLus, 'pre'),
    pre_lus_total: draft.preLusTotal ?? null,
    pre_ivc_max_mm: draft.preIvcMaxMm ?? null,
    pre_ivc_min_mm: draft.preIvcMinMm ?? null,
    pre_ivc_resp_variation_pct: draft.preIvcRespVariationPct ?? null,
    pre_ivc_max_bsa: draft.preIvcMaxBsa ?? null,
    pre_hd_sbp: draft.preHdSbp ?? null,
    pre_hd_dbp: draft.preHdDbp ?? null,
    residual_urine_output_ml: draft.residualUrineOutputMl ?? null,
    dialysis_duration_hours: draft.dialysisDurationHours ?? null,
    uf_volume_ml: draft.ufVolumeMl ?? null,
    uf_rate_ml_kg_h: draft.ufRateMlKgH ?? null,
    previous_post_hd_weight_kg: draft.previousPostHdWeightKg ?? null,
    interdialytic_weight_gain_kg: draft.interdialyticWeightGainKg ?? null,
    intradialytic_hypotension: draft.intradialyticHypotension ?? null,
    intradialytic_muscle_cramp: draft.intradialyticMuscleCramp ?? null,
    saline_bolus_required: draft.salineBolusRequired ?? null,
    uf_interruption: draft.ufInterruption ?? null,
    early_termination: draft.earlyTermination ?? null,
    post_hd_weight_kg: draft.postHdWeightKg ?? null,
    weight_loss_kg: draft.weightLossKg ?? null,
    weight_loss_pct: draft.weightLossPct ?? null,
    post_hd_weight_vs_dry_kg: draft.postHdWeightVsDryKg ?? null,
    ...zonesToColumns(draft.postLus, 'post'),
    post_lus_total: draft.postLusTotal ?? null,
    lus_change: draft.lusChange ?? null,
    lus_change_pct: draft.lusChangePct ?? null,
    post_ivc_max_mm: draft.postIvcMaxMm ?? null,
    post_ivc_min_mm: draft.postIvcMinMm ?? null,
    post_ivc_resp_variation_pct: draft.postIvcRespVariationPct ?? null,
    post_ivc_max_bsa: draft.postIvcMaxBsa ?? null,
    ivc_max_change_mm: draft.ivcMaxChangeMm ?? null,
    ivc_min_change_mm: draft.ivcMinChangeMm ?? null,
    ivc_resp_variation_change_pct: draft.ivcRespVariationChangePct ?? null,
    post_hd_sbp: draft.postHdSbp ?? null,
    post_hd_dbp: draft.postHdDbp ?? null,
    post_hd_edema: draft.postHdEdema ?? null,
    post_hd_dyspnea: draft.postHdDyspnea ?? null,
    post_hd_crackles: draft.postHdCrackles ?? null,
    investigator_volume_assessment: draft.investigatorVolumeAssessment ?? null,
    dry_weight_reassessment_needed: draft.dryWeightReassessmentNeeded ?? null,
    suggested_decision: draft.suggestedDecision ?? null,
    lus_guided_decision: draft.lusGuidedDecision ?? null,
    dry_weight_adjustment_kg: draft.dryWeightAdjustmentKg ?? null,
    adjustment_reason: draft.adjustmentReason ?? [],
    safety_check: draft.safetyCheck ?? null,
    physician_confirmation: draft.physicianConfirmation ?? null,
    notes: draft.notes ?? null,
  }
}

const SESSION_SELECT = '*, patients(name)'

export async function listLusStudySessionsForPatient(patientId: string): Promise<LusStudySessionWithPatient[]> {
  const { data, error } = await supabase
    .from('lus_study_sessions')
    .select(SESSION_SELECT)
    .eq('patient_id', patientId)
    .order('session_date', { ascending: false })
  if (error) throw error
  return (data as unknown as SessionRow[]).map(sessionToDomain)
}

export async function listAllLusStudySessions(): Promise<LusStudySessionWithPatient[]> {
  const { data, error } = await supabase.from('lus_study_sessions').select(SESSION_SELECT).order('session_date', { ascending: false })
  if (error) throw error
  return (data as unknown as SessionRow[]).map(sessionToDomain)
}

export async function addLusStudySession(draft: LusStudySessionDraft): Promise<LusStudySessionWithPatient> {
  const { data, error } = await supabase.from('lus_study_sessions').insert(draftToColumns(draft)).select(SESSION_SELECT).single()
  if (error) throw error
  return sessionToDomain(data as unknown as SessionRow)
}

export async function updateLusStudySession(id: string, draft: LusStudySessionDraft): Promise<LusStudySessionWithPatient> {
  const { data, error } = await supabase
    .from('lus_study_sessions')
    .update(draftToColumns(draft))
    .eq('id', id)
    .select(SESSION_SELECT)
    .single()
  if (error) throw error
  return sessionToDomain(data as unknown as SessionRow)
}

export async function deleteLusStudySession(id: string): Promise<void> {
  const { error } = await supabase.from('lus_study_sessions').delete().eq('id', id)
  if (error) throw error
}
