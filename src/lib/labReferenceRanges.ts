// Age-banded pediatric normal ranges for common labs, so a value can be
// auto-flagged as abnormal without the user typing a reference range in
// every time. These are general pediatric reference values (as commonly
// published in standard references such as the Harriet Lane Handbook and
// Nelson Textbook of Pediatrics) -- NOT a substitute for the performing
// lab's own reference range, which varies by assay/platform. They only
// apply when the entry has no manually-entered "ref" (that always wins)
// and, where a unit is recorded, only when it matches the unit assumed
// here (so an unrecognized/mismatched unit is silently skipped rather
// than risk a wrong comparison).
//
// Deliberately excluded: tests that already have dedicated, more clinically
// nuanced handling elsewhere (Creatinine -> KDIGO staging vs baseline,
// Hemoglobin -> anemia threshold, Calcium/Phosphorus/PTH/Vitamin D/Alkaline
// Phosphatase/Bicarbonate -> CKD-MBD and acid-base assessment). Adding a
// second, conflicting flag for those would be confusing, not helpful.

interface AgeBand {
  maxAgeYears: number // exclusive upper bound; Infinity for "and up"
  low?: number
  high?: number
}

interface TestReference {
  unit: string
  bands: AgeBand[] // ascending by maxAgeYears
  note?: string
}

const LAB_REFERENCE_DATA: Record<string, TestReference> = {
  Sodium: { unit: 'mEq/L', bands: [{ maxAgeYears: Infinity, low: 135, high: 145 }] },
  Potassium: {
    unit: 'mEq/L',
    bands: [
      { maxAgeYears: 1 / 12, low: 3.7, high: 5.9 },
      { maxAgeYears: 2, low: 4.1, high: 5.3 },
      { maxAgeYears: Infinity, low: 3.5, high: 5.0 },
    ],
  },
  Chloride: { unit: 'mEq/L', bands: [{ maxAgeYears: Infinity, low: 98, high: 107 }] },
  Magnesium: { unit: 'mg/dL', bands: [{ maxAgeYears: Infinity, low: 1.5, high: 2.5 }] },
  BUN: {
    unit: 'mg/dL',
    bands: [
      { maxAgeYears: 1, low: 4, high: 17 },
      { maxAgeYears: Infinity, low: 7, high: 20 },
    ],
  },
  Albumin: {
    unit: 'g/dL',
    bands: [
      { maxAgeYears: 1, low: 2.5, high: 5.0 },
      { maxAgeYears: Infinity, low: 3.8, high: 5.4 },
    ],
  },
  'Total Protein': {
    unit: 'g/dL',
    bands: [
      { maxAgeYears: 1, low: 4.6, high: 7.4 },
      { maxAgeYears: Infinity, low: 6.0, high: 8.3 },
    ],
  },
  Hematocrit: {
    unit: '%',
    bands: [
      { maxAgeYears: 1 / 12, low: 31, high: 55 },
      { maxAgeYears: 0.5, low: 29, high: 41 },
      { maxAgeYears: 2, low: 33, high: 39 },
      { maxAgeYears: 6, low: 34, high: 40 },
      { maxAgeYears: 12, low: 35, high: 45 },
      { maxAgeYears: Infinity, low: 36, high: 49 },
    ],
  },
  WBC: {
    unit: 'x10^3/uL',
    bands: [
      { maxAgeYears: 1 / 12, low: 9.0, high: 30.0 },
      { maxAgeYears: 1, low: 6.0, high: 17.5 },
      { maxAgeYears: 6, low: 5.0, high: 15.5 },
      { maxAgeYears: 18, low: 4.5, high: 13.5 },
      { maxAgeYears: Infinity, low: 4.5, high: 11.0 },
    ],
  },
  Platelets: { unit: 'x10^3/uL', bands: [{ maxAgeYears: Infinity, low: 150, high: 450 }] },
  ESR: { unit: 'mm/hr', bands: [{ maxAgeYears: Infinity, high: 10 }], note: 'Wide normal variation by age/sex' },
  CRP: { unit: 'mg/dL', bands: [{ maxAgeYears: Infinity, high: 1.0 }] },
  PT: {
    unit: 'sec',
    bands: [
      { maxAgeYears: 1 / 12, low: 10.6, high: 16.2 },
      { maxAgeYears: Infinity, low: 11.0, high: 14.0 },
    ],
  },
  PTT: {
    unit: 'sec',
    bands: [
      { maxAgeYears: 1 / 12, low: 27, high: 79 },
      { maxAgeYears: Infinity, low: 25, high: 35 },
    ],
  },
  INR: {
    unit: '',
    bands: [
      { maxAgeYears: 1 / 12, low: 0.9, high: 1.7 },
      { maxAgeYears: Infinity, low: 0.8, high: 1.2 },
    ],
  },
  Fibrinogen: {
    unit: 'mg/dL',
    bands: [
      { maxAgeYears: 1 / 12, low: 125, high: 300 },
      { maxAgeYears: Infinity, low: 150, high: 400 },
    ],
  },
  'Total Cholesterol': {
    unit: 'mg/dL',
    bands: [{ maxAgeYears: Infinity, high: 170 }],
    note: 'NHLBI pediatric "acceptable" upper limit, not a lower-bound range',
  },
  Triglycerides: {
    unit: 'mg/dL',
    bands: [
      { maxAgeYears: 10, high: 75 },
      { maxAgeYears: Infinity, high: 90 },
    ],
    note: 'NHLBI pediatric "acceptable" upper limit, not a lower-bound range',
  },
  ALT: {
    unit: 'U/L',
    bands: [
      { maxAgeYears: 1, high: 60 },
      { maxAgeYears: Infinity, high: 35 },
    ],
  },
  AST: {
    unit: 'U/L',
    bands: [
      { maxAgeYears: 1, high: 90 },
      { maxAgeYears: Infinity, high: 45 },
    ],
  },
  Ferritin: {
    unit: 'ng/mL',
    bands: [
      { maxAgeYears: 1 / 12, low: 25, high: 200 },
      { maxAgeYears: 1, low: 6, high: 410 },
      { maxAgeYears: Infinity, low: 7, high: 140 },
    ],
    note: 'Physiologically wide range in infancy; also an acute-phase reactant',
  },
  Iron: { unit: 'ug/dL', bands: [{ maxAgeYears: Infinity, low: 40, high: 145 }] },
  TIBC: { unit: 'ug/dL', bands: [{ maxAgeYears: Infinity, low: 250, high: 450 }] },
}

export interface LabReferenceRange {
  low?: number
  high?: number
  unit: string
  note?: string
}

export function getLabReferenceRange(test: string, ageYears: number | null): LabReferenceRange | null {
  const ref = LAB_REFERENCE_DATA[test]
  if (!ref || ageYears == null) return null
  const band = ref.bands.find((b) => ageYears < b.maxAgeYears)
  if (!band) return null
  return { low: band.low, high: band.high, unit: ref.unit, note: ref.note }
}

function unitMatches(test: string, unit: string | null | undefined): boolean {
  const ref = LAB_REFERENCE_DATA[test]
  if (!ref) return false
  if (!unit || !unit.trim()) return true
  return unit.trim().toLowerCase() === ref.unit.toLowerCase()
}

export function isOutsideLabReferenceRange(
  test: string,
  value: number | null | undefined,
  ageYears: number | null,
  unit: string | null | undefined
): boolean {
  if (value == null || !unitMatches(test, unit)) return false
  const range = getLabReferenceRange(test, ageYears)
  if (!range) return false
  if (range.low != null && value < range.low) return true
  if (range.high != null && value > range.high) return true
  return false
}

export function formatLabReferenceRange(range: LabReferenceRange): string {
  const parts =
    range.low != null && range.high != null
      ? `${range.low}–${range.high}`
      : range.high != null
        ? `< ${range.high}`
        : range.low != null
          ? `> ${range.low}`
          : ''
  return `${parts} ${range.unit}`.trim()
}
