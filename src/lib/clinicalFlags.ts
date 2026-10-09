// Keyword match against a patient's diagnosis/underlying disease text —
// used to surface a post-obstructive diuresis watch after surgery for
// conditions like PUV where relieving the obstruction can trigger polyuria.
const OBSTRUCTIVE_UROPATHY_PATTERN =
  /\bpuv\b|posterior urethral valve|obstructive uropathy|upj obstruction|ureteropelvic junction|uvj obstruction|ureterovesical junction/i

export function hasObstructiveUropathy(patient: { diagnosis?: string | null; underlyingDisease?: string | null }): boolean {
  const text = `${patient.diagnosis ?? ''} ${patient.underlyingDisease ?? ''}`
  return OBSTRUCTIVE_UROPATHY_PATTERN.test(text)
}

// True when the underlying-disease text is already said by the diagnosis
// text (exact match, or contained as a substring — e.g. diagnosis "CKD
// secondary to PUV-VUR" already says underlying disease "PUV-VUR"). Used to
// avoid showing the same condition twice across the chart.
export function isUnderlyingDiseaseDuplicate(diagnosis?: string | null, underlyingDisease?: string | null): boolean {
  const d = diagnosis?.trim().toLowerCase()
  const u = underlyingDisease?.trim().toLowerCase()
  if (!d || !u) return false
  return d === u || d.includes(u)
}

// Broader match including VUR -- used for the rising-creatinine/Foley flag
// below, which applies to reflux as well as true obstruction, unlike the
// post-obstructive-diuresis watch above (reflux surgery doesn't cause that).
const VUR_PUV_OBSTRUCTION_PATTERN =
  /\bvur\b|vesico-?ureteral reflux|\bpuv\b|posterior urethral valve|obstructive uropathy|obstructive nephropathy|upj obstruction|ureteropelvic junction|uvj obstruction|ureterovesical junction/i

export function hasVurPuvOrObstruction(patient: { diagnosis?: string | null; underlyingDisease?: string | null }): boolean {
  const text = `${patient.diagnosis ?? ''} ${patient.underlyingDisease ?? ''}`
  return VUR_PUV_OBSTRUCTION_PATTERN.test(text)
}

// A patient's baselineCr/baselineEGFR is also set for AKI (it's the
// pre-illness reference value KDIGO staging compares against), so it can't
// be used alone to decide "this is a CKD patient" — CKD-specific advisories
// (CKD-MBD, CKD screening, the bicarbonate-replacement protocol) need this
// separate, explicit check instead, or they fire for acute AKI patients too.
const CKD_PATTERN =
  /\bckd\b|chronic kidney disease|chronic renal (failure|insufficiency|disease)|\besrd\b|end-?stage (renal|kidney) disease/i

export function isCkdPatient(patient: {
  diagnosis?: string | null
  underlyingDisease?: string | null
  dialysisStatus?: string | null
  transplantStatus?: string | null
}): boolean {
  const text = `${patient.diagnosis ?? ''} ${patient.underlyingDisease ?? ''}`
  return CKD_PATTERN.test(text) || !!patient.dialysisStatus || !!patient.transplantStatus
}

export type CreatinineTrend = 'rising' | 'falling' | 'flat'

export interface ObstructiveCrTrendResult {
  latestValue: number
  latestDate: string
  previousValue: number
  previousLabel: 'baseline' | 'prior'
  previousDate: string | null
  trend: CreatinineTrend
}

// Compares the most recent Creatinine to the one before it (or to the
// patient's baseline Cr, if only one result is on file). Used to flag
// VUR/PUV/obstructive-uropathy patients whose Cr is rising -- they need a
// Foley catheter placed/fixed to relieve the obstruction -- versus improving
// or stuck afterward (stuck or still rising after that suggests permanent
// renal damage).
export function assessObstructiveCreatinineTrend(
  labEntries: Array<{ test: string; value?: number | null; date: string }>,
  baselineCr?: number | null
): ObstructiveCrTrendResult | null {
  const crEntries = labEntries
    .filter((e) => e.test === 'Creatinine' && e.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (crEntries.length === 0) return null

  const latest = crEntries[crEntries.length - 1]
  let previousValue: number | null = null
  let previousDate: string | null = null
  let previousLabel: 'baseline' | 'prior' = 'prior'

  if (crEntries.length >= 2) {
    const previous = crEntries[crEntries.length - 2]
    previousValue = previous.value ?? null
    previousDate = previous.date
  } else if (baselineCr != null) {
    previousValue = baselineCr
    previousLabel = 'baseline'
  }

  if (previousValue == null || latest.value == null) return null

  const trend: CreatinineTrend = latest.value > previousValue ? 'rising' : latest.value < previousValue ? 'falling' : 'flat'

  return {
    latestValue: latest.value,
    latestDate: latest.date,
    previousValue,
    previousLabel,
    previousDate,
    trend,
  }
}
