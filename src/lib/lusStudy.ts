import type { InvestigatorVolumeAssessment, LusStudyGroup, LusZoneScores, SuggestedLusDecision } from '../types/domain'

export const EMPTY_LUS_ZONES: LusZoneScores = {
  r1: null,
  r2: null,
  r3: null,
  r4: null,
  r5: null,
  r6: null,
  l1: null,
  l2: null,
  l3: null,
  l4: null,
  l5: null,
  l6: null,
}

// Body surface area (Mosteller) -- used to normalize IVC diameter the same
// way the reference cohort did (Moussler et al., Pediatr Nephrol 2026),
// since raw IVC millimeters aren't comparable across children of very
// different sizes.
export function bsaMosteller(heightCm: number, weightKg: number): number {
  return Math.sqrt((heightCm * weightKg) / 3600)
}

export function sumLusZones(zones: LusZoneScores): number | null {
  const values = Object.values(zones)
  if (values.some((v) => v == null)) return null
  return values.reduce((sum: number, v) => sum + (v as number), 0)
}

export function pctChange(before: number | null | undefined, after: number | null | undefined): number | null {
  if (before == null || after == null || before === 0) return null
  return ((before - after) / before) * 100
}

// Pre-specified pediatric thresholds for this study. No validated pediatric
// 12-zone LUS cutoff exists yet, so these are derived from the reference
// cohort's own descriptive statistics (12-zone protocol, same population
// type): median pre-HD LUS 7 (IQR 5-9), post-HD 4 (IQR 3-6). A post-HD LUS
// at or above the upper end of that post-HD IQR is treated as residual
// congestion. Revisit these once this study's own Group 1 (non-intervened)
// data accrues, the way Kaysi et al. (Kidney360 2026) derived their 8-zone
// BLS>5 cutoff from Reisinger et al.'s prior validation work rather than
// inventing one from scratch.
export const LUS_CONGESTION_THRESHOLD = 6
export const IVC_LOW_BSA_MM_M2 = 5

export interface LusSessionComputedInput {
  heightCm: number | null
  preHdWeightKg: number | null
  targetWeightKg: number | null
  postHdWeightKg: number | null
  previousPostHdWeightKg: number | null
  ufVolumeMl: number | null
  dialysisDurationHours: number | null
  preLus: LusZoneScores
  postLus: LusZoneScores
  preIvcMaxMm: number | null
  postIvcMaxMm: number | null
  preIvcMinMm: number | null
  postIvcMinMm: number | null
  preIvcRespVariationPct: number | null
  postIvcRespVariationPct: number | null
}

export interface LusSessionComputed {
  bsaM2: number | null
  preHdWeightAboveTargetKg: number | null
  preLusTotal: number | null
  preIvcMaxBsa: number | null
  postIvcMaxBsa: number | null
  interdialyticWeightGainKg: number | null
  ufRateMlKgH: number | null
  weightLossKg: number | null
  weightLossPct: number | null
  postHdWeightVsDryKg: number | null
  postLusTotal: number | null
  lusChange: number | null
  lusChangePct: number | null
  ivcMaxChangeMm: number | null
  ivcMinChangeMm: number | null
  ivcRespVariationChangePct: number | null
}

// Every derived field on a session, computed together so the live preview
// while filling the form and the values actually stored at save time can
// never drift apart. UF rate uses target/dry weight as the denominator,
// matching how the 13 mL/kg/h planning cap in Kaysi et al. is expressed.
export function deriveLusSessionFields(input: LusSessionComputedInput): LusSessionComputed {
  const bsaM2 =
    input.heightCm != null && input.preHdWeightKg != null ? bsaMosteller(input.heightCm, input.preHdWeightKg) : null

  const preLusTotal = sumLusZones(input.preLus)
  const postLusTotal = sumLusZones(input.postLus)

  const preIvcMaxBsa = input.preIvcMaxMm != null && bsaM2 ? input.preIvcMaxMm / bsaM2 : null
  const postIvcMaxBsa = input.postIvcMaxMm != null && bsaM2 ? input.postIvcMaxMm / bsaM2 : null

  const weightLossKg =
    input.preHdWeightKg != null && input.postHdWeightKg != null ? input.preHdWeightKg - input.postHdWeightKg : null
  const weightLossPct = weightLossKg != null && input.preHdWeightKg ? (weightLossKg / input.preHdWeightKg) * 100 : null

  const ufRateMlKgH =
    input.ufVolumeMl != null && input.dialysisDurationHours && input.targetWeightKg
      ? input.ufVolumeMl / input.targetWeightKg / input.dialysisDurationHours
      : null

  return {
    bsaM2,
    preHdWeightAboveTargetKg:
      input.preHdWeightKg != null && input.targetWeightKg != null ? input.preHdWeightKg - input.targetWeightKg : null,
    preLusTotal,
    preIvcMaxBsa,
    postIvcMaxBsa,
    interdialyticWeightGainKg:
      input.preHdWeightKg != null && input.previousPostHdWeightKg != null
        ? input.preHdWeightKg - input.previousPostHdWeightKg
        : null,
    ufRateMlKgH,
    weightLossKg,
    weightLossPct,
    postHdWeightVsDryKg:
      input.postHdWeightKg != null && input.targetWeightKg != null ? input.postHdWeightKg - input.targetWeightKg : null,
    postLusTotal,
    lusChange: preLusTotal != null && postLusTotal != null ? preLusTotal - postLusTotal : null,
    lusChangePct: pctChange(preLusTotal, postLusTotal),
    ivcMaxChangeMm:
      input.postIvcMaxMm != null && input.preIvcMaxMm != null ? input.postIvcMaxMm - input.preIvcMaxMm : null,
    ivcMinChangeMm:
      input.postIvcMinMm != null && input.preIvcMinMm != null ? input.postIvcMinMm - input.preIvcMinMm : null,
    ivcRespVariationChangePct:
      input.postIvcRespVariationPct != null && input.preIvcRespVariationPct != null
        ? input.postIvcRespVariationPct - input.preIvcRespVariationPct
        : null,
  }
}

export interface LusDecisionInput {
  postLusTotal: number | null
  postIvcMaxBsa: number | null
  intradialyticHypotension: boolean
  intradialyticMuscleCramp: boolean
  investigatorVolumeAssessment: InvestigatorVolumeAssessment | null
}

export interface LusDecisionSuggestion {
  decision: SuggestedLusDecision
  reasons: string[]
}

// Suggests -- never applies -- a dry-weight direction for the LUS/IVC-
// guided arm (Group 2). Combines LUS (interstitial/extravascular marker)
// with IVC (intravascular marker) because Moussler et al. found the two
// measure discordant compartments in children (no correlation between LUS
// and IVC, r=0.01-0.19); a safety brake (hypotension, cramp, or a
// hypovolemia impression) always wins and routes to physician review,
// mirroring the safety gate in Kaysi et al. (Kidney360 2026) -- physician
// confirmation (see the session's physicianConfirmation field) is still
// required before any change is actually made.
export function suggestLusGuidedDecision(input: LusDecisionInput): LusDecisionSuggestion {
  const unstable =
    input.intradialyticHypotension ||
    input.intradialyticMuscleCramp ||
    input.investigatorVolumeAssessment === 'possible_hypovolemia'

  if (unstable) {
    return {
      decision: 'review',
      reasons: [
        'Safety brake: intradialytic hypotension/cramp or a possible-hypovolemia impression -- physician review required before any dry weight change',
      ],
    }
  }

  const congested = input.postLusTotal != null && input.postLusTotal >= LUS_CONGESTION_THRESHOLD
  const ivcSmall = input.postIvcMaxBsa != null && input.postIvcMaxBsa < IVC_LOW_BSA_MM_M2

  if (congested && !ivcSmall) {
    return {
      decision: 'decrease',
      reasons: [`Post-HD LUS ${input.postLusTotal} ≥ ${LUS_CONGESTION_THRESHOLD} with IVC not small — residual interstitial congestion`],
    }
  }
  if (congested && ivcSmall) {
    return {
      decision: 'no_change',
      reasons: ['LUS elevated but IVC small (discordant) — hold dry weight this cycle, reassess sooner than usual'],
    }
  }
  if (!congested && ivcSmall) {
    return {
      decision: 'increase',
      reasons: ['Low LUS with a small IVC — possible early hypovolemia'],
    }
  }
  return { decision: 'no_change', reasons: ['LUS and IVC both reassuring'] }
}

export interface GroupTrendPoint {
  sessionIndex: number
  group1Mean: number | null
  group1N: number
  group2Mean: number | null
  group2N: number
}

interface TrendableSession {
  patientId: string
  sessionDate: string
  postLusTotal: number | null
}

// Aligns each patient's completed sessions by sequence number (1st, 2nd,
// 3rd... since enrollment) rather than by calendar date, since patients in
// a real pediatric HD panel enroll and are seen on different schedules --
// unlike Kaysi et al.'s fixed day-1/15/30/45/60 protocol. Averaging post-HD
// LUS at each sequence number, per group, reproduces the same kind of
// group-trend comparison (their Figure 4) despite that irregularity.
export function buildGroupPostLusTrend(sessions: TrendableSession[], groupByPatientId: Map<string, LusStudyGroup>): GroupTrendPoint[] {
  const byPatient = new Map<string, TrendableSession[]>()
  for (const s of sessions) {
    if (s.postLusTotal == null) continue
    const list = byPatient.get(s.patientId) ?? []
    list.push(s)
    byPatient.set(s.patientId, list)
  }

  const sequencesByGroup: Record<LusStudyGroup, number[][]> = {
    group1_standard: [],
    group2_lus_guided: [],
  }
  for (const [patientId, list] of byPatient) {
    const group = groupByPatientId.get(patientId)
    if (!group) continue
    const sorted = [...list].sort((a, b) => a.sessionDate.localeCompare(b.sessionDate))
    sorted.forEach((s, i) => {
      sequencesByGroup[group][i] = sequencesByGroup[group][i] ?? []
      sequencesByGroup[group][i].push(s.postLusTotal as number)
    })
  }

  const maxLen = Math.max(sequencesByGroup.group1_standard.length, sequencesByGroup.group2_lus_guided.length)
  const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

  const points: GroupTrendPoint[] = []
  for (let i = 0; i < maxLen; i++) {
    const g1 = sequencesByGroup.group1_standard[i] ?? []
    const g2 = sequencesByGroup.group2_lus_guided[i] ?? []
    points.push({ sessionIndex: i + 1, group1Mean: mean(g1), group1N: g1.length, group2Mean: mean(g2), group2N: g2.length })
  }
  return points
}
