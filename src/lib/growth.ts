// Growth (height/weight/head circumference) and blood pressure percentile
// calculations for pediatric patients.
//
// Growth references: WHO Child Growth Standards (2006) for birth-24 months
// (head circumference to 36 months), CDC 2000 Growth Charts for 2-20 years —
// this WHO-then-CDC handoff at 24 months is the combination recommended by
// CDC itself for US/international pediatric use.
// BP reference: 2017 AAP Clinical Practice Guideline (Flynn et al., Pediatrics
// 2017;140(3):e20171904), Tables 3 & 4 (ages 1-<13, by height percentile) and
// the simplified fixed thresholds the same guideline gives for ages >=13.
import { WHO_WEIGHT_FOR_AGE, WHO_LENGTH_FOR_AGE, WHO_HEAD_CIRCUMFERENCE_FOR_AGE, type LmsPoint } from './growthData/who'
import { CDC_STATURE_FOR_AGE, CDC_WEIGHT_FOR_AGE } from './growthData/cdc'
import { BP_TABLE_2017, HEIGHT_PERCENTILE_COLUMNS, type BpTableRow } from './growthData/bpFlynn2017'

export type Sex = 'M' | 'F'

export function normalizeSex(sex: string | null | undefined): Sex | null {
  if (!sex) return null
  const s = sex.trim().toLowerCase()
  if (/^(m|male|boy|پسر|مرد)/.test(s)) return 'M'
  if (/^(f|female|girl|دختر|زن)/.test(s)) return 'F'
  return null
}

const DAYS_PER_MONTH = 30.4375

export function ageInMonths(dob: string, onDate: string): number | null {
  const birth = new Date(dob)
  const on = new Date(onDate)
  if (Number.isNaN(birth.getTime()) || Number.isNaN(on.getTime())) return null
  const days = (on.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24)
  if (days < 0) return null
  return days / DAYS_PER_MONTH
}

export function ageInYears(dob: string, onDate: string): number | null {
  const m = ageInMonths(dob, onDate)
  return m == null ? null : m / 12
}

// --- LMS math (used for WHO/CDC growth percentiles) ---

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911
  const t = 1 / (1 + p * ax)
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-ax * ax)
  return sign * y
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

function lmsZ(value: number, L: number, M: number, S: number): number {
  if (Math.abs(L) < 1e-9) return Math.log(value / M) / S
  return (Math.pow(value / M, L) - 1) / (L * S)
}

function interpolateLms(table: LmsPoint[], ageMonths: number): LmsPoint {
  if (ageMonths <= table[0].m) return table[0]
  const last = table[table.length - 1]
  if (ageMonths >= last.m) return last
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i]
    const b = table[i + 1]
    if (ageMonths >= a.m && ageMonths <= b.m) {
      const f = b.m === a.m ? 0 : (ageMonths - a.m) / (b.m - a.m)
      return { m: ageMonths, L: a.L + (b.L - a.L) * f, M: a.M + (b.M - a.M) * f, S: a.S + (b.S - a.S) * f }
    }
  }
  return last
}

function percentileFor(value: number, table: LmsPoint[], ageMonths: number): number {
  const { L, M, S } = interpolateLms(table, ageMonths)
  const z = lmsZ(value, L, M, S)
  return normalCdf(z) * 100
}

const WHO_CDC_HANDOFF_MONTHS = 24

export function weightForAgePercentile(weightKg: number, ageMonths: number, sex: Sex): number {
  const table = ageMonths < WHO_CDC_HANDOFF_MONTHS ? WHO_WEIGHT_FOR_AGE[sex] : CDC_WEIGHT_FOR_AGE[sex]
  return percentileFor(weightKg, table, ageMonths)
}

export function heightForAgePercentile(heightCm: number, ageMonths: number, sex: Sex): number {
  const table = ageMonths < WHO_CDC_HANDOFF_MONTHS ? WHO_LENGTH_FOR_AGE[sex] : CDC_STATURE_FOR_AGE[sex]
  return percentileFor(heightCm, table, ageMonths)
}

const HEAD_CIRC_MAX_MONTHS = 36

// WHO head-circumference-for-age reference only covers birth-36 months;
// beyond that head circumference is not routinely tracked, so this returns
// null rather than extrapolating.
export function headCircumferenceForAgePercentile(hcCm: number, ageMonths: number, sex: Sex): number | null {
  if (ageMonths > HEAD_CIRC_MAX_MONTHS) return null
  return percentileFor(hcCm, WHO_HEAD_CIRCUMFERENCE_FOR_AGE[sex], ageMonths)
}

export function percentileLabel(pct: number): string {
  if (pct < 0.1) return '<0.1st percentile'
  if (pct < 1) return '<1st percentile'
  if (pct < 3) return '<3rd percentile'
  if (pct > 99.9) return '>99.9th percentile'
  if (pct > 99) return '>99th percentile'
  if (pct > 97) return '>97th percentile'
  const rounded = Math.round(pct)
  const suffix = rounded % 10 === 1 && rounded !== 11 ? 'st' : rounded % 10 === 2 && rounded !== 12 ? 'nd' : rounded % 10 === 3 && rounded !== 13 ? 'rd' : 'th'
  return `${rounded}${suffix} percentile`
}

export function isLowPercentile(pct: number): boolean {
  return pct < 3
}

export function isHighPercentile(pct: number): boolean {
  return pct > 97
}

// --- Growth faltering / failure-to-thrive screening ---
// Based on commonly used pediatric FTT screening criteria: weight-for-age
// persistently below the 5th percentile, or a downward crossing of roughly
// two major percentile channels (~1 SD) between visits.
export interface GrowthFalteringFlag {
  reason: 'low_weight_for_age' | 'downward_crossing'
  message: string
}

export function detectGrowthFaltering(
  points: Array<{ date: string; weightKg: number; ageMonths: number }>,
  sex: Sex
): GrowthFalteringFlag[] {
  if (points.length === 0) return []
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const zScored = sorted.map((p) => {
    const table = p.ageMonths < WHO_CDC_HANDOFF_MONTHS ? WHO_WEIGHT_FOR_AGE[sex] : CDC_WEIGHT_FOR_AGE[sex]
    const { L, M, S } = interpolateLms(table, p.ageMonths)
    return { ...p, z: lmsZ(p.weightKg, L, M, S) }
  })

  const flags: GrowthFalteringFlag[] = []
  const latest = zScored[zScored.length - 1]
  if (normalCdf(latest.z) * 100 < 5) {
    flags.push({
      reason: 'low_weight_for_age',
      message: 'Weight-for-age below the 5th percentile — consider failure-to-thrive evaluation.',
    })
  }

  for (let i = 1; i < zScored.length; i++) {
    const drop = zScored[i - 1].z - zScored[i].z
    if (drop >= 1.0) {
      flags.push({
        reason: 'downward_crossing',
        message: `Significant downward percentile crossing in weight (${percentileLabel(normalCdf(zScored[i - 1].z) * 100)} → ${percentileLabel(normalCdf(zScored[i].z) * 100)}) — possible growth faltering.`,
      })
      break
    }
  }

  return flags
}

// --- Blood pressure percentile (2017 AAP guideline) ---

export type BpCategory = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'indeterminate'

export interface BpAssessment {
  category: BpCategory
  label: string
  note: string
  p90?: { sbp: number; dbp: number }
  p95?: { sbp: number; dbp: number }
}

function interpolateHeightColumn(values: number[], heightPercentile: number): number {
  const cols = HEIGHT_PERCENTILE_COLUMNS
  const hp = Math.min(95, Math.max(5, heightPercentile))
  for (let i = 0; i < cols.length - 1; i++) {
    if (hp >= cols[i] && hp <= cols[i + 1]) {
      const f = (hp - cols[i]) / (cols[i + 1] - cols[i])
      return values[i] + (values[i + 1] - values[i]) * f
    }
  }
  return values[values.length - 1]
}

function findBpRow(table: BpTableRow[], age: number, p: 50 | 90 | 95): BpTableRow | undefined {
  return table.find((r) => r.age === age && r.p === p)
}

function bpThresholds(ageYears: number, sex: Sex, heightPercentile: number) {
  const ageRow = Math.min(12, Math.max(1, Math.floor(ageYears)))
  const table = BP_TABLE_2017[sex]
  const row90 = findBpRow(table, ageRow, 90)
  const row95 = findBpRow(table, ageRow, 95)
  if (!row90 || !row95) return null
  return {
    sbp90: interpolateHeightColumn(row90.sbp, heightPercentile),
    dbp90: interpolateHeightColumn(row90.dbp, heightPercentile),
    sbp95: interpolateHeightColumn(row95.sbp, heightPercentile),
    dbp95: interpolateHeightColumn(row95.dbp, heightPercentile),
  }
}

export function assessBloodPressure(
  sbp: number,
  dbp: number,
  ageYears: number,
  sex: Sex,
  heightPercentile: number | null
): BpAssessment {
  if (ageYears < 1) {
    return {
      category: 'indeterminate',
      label: 'Not applicable',
      note: 'AAP percentile tables start at age 1 year.',
    }
  }

  if (ageYears >= 13) {
    // AAP 2017 gives fixed adult-style thresholds for adolescents >=13,
    // no height percentile needed.
    if (sbp >= 140 || dbp >= 90) return { category: 'stage2', label: 'Stage 2 hypertension', note: '≥140/90 mmHg (age ≥13)' }
    if (sbp >= 130 || dbp >= 80) return { category: 'stage1', label: 'Stage 1 hypertension', note: '130-139/80-89 mmHg (age ≥13)' }
    if (sbp >= 120) return { category: 'elevated', label: 'Elevated BP', note: '120-129/<80 mmHg (age ≥13)' }
    return { category: 'normal', label: 'Normal BP', note: '<120/80 mmHg (age ≥13)' }
  }

  const hp = heightPercentile ?? 50
  const th = bpThresholds(ageYears, sex, hp)
  if (!th) return { category: 'indeterminate', label: 'Unavailable', note: 'No reference row for this age.' }

  // AAP 2017: Stage 1/2 cutoffs use whichever is lower — the height-based
  // percentile threshold or the fixed adult-style number — as a safety cap
  // for tall children.
  const stage2Cut = { sbp: Math.min(th.sbp95 + 12, 140), dbp: Math.min(th.dbp95 + 12, 90) }
  const stage1Cut = { sbp: Math.min(th.sbp95, 130), dbp: Math.min(th.dbp95, 80) }

  const p90 = { sbp: Math.round(th.sbp90), dbp: Math.round(th.dbp90) }
  const p95 = { sbp: Math.round(th.sbp95), dbp: Math.round(th.dbp95) }

  if (sbp >= stage2Cut.sbp || dbp >= stage2Cut.dbp) {
    return { category: 'stage2', label: 'Stage 2 hypertension', note: `≥95th percentile + 12 mmHg (${p95.sbp + 12}/${p95.dbp + 12})`, p90, p95 }
  }
  if (sbp >= stage1Cut.sbp || dbp >= stage1Cut.dbp) {
    return { category: 'stage1', label: 'Stage 1 hypertension', note: `≥95th percentile (${p95.sbp}/${p95.dbp})`, p90, p95 }
  }
  if (sbp >= th.sbp90 || dbp >= th.dbp90) {
    return { category: 'elevated', label: 'Elevated BP', note: `≥90th percentile (${p90.sbp}/${p90.dbp})`, p90, p95 }
  }
  return { category: 'normal', label: 'Normal BP', note: `Below 90th percentile (${p90.sbp}/${p90.dbp})`, p90, p95 }
}
