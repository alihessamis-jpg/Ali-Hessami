// Proteinuria can be reported three different ways in practice — a dipstick
// grade, a 24-hour collection, or a spot urine protein/creatinine (UPC)
// ratio — and each has its own normal/nephrotic-range cutoffs. This module
// gives one place to translate between them and classify a result.

import type { LabEntry } from '../types/domain'

export type ProteinuriaClass = 'normal' | 'abnormal' | 'nephrotic-range'

export const PROTEINURIA_CLASS_LABEL: Record<ProteinuriaClass, string> = {
  normal: 'Normal',
  abnormal: 'Abnormal (non-nephrotic-range)',
  'nephrotic-range': 'Nephrotic-range',
}

// Rough dipstick-to-quantitative equivalence (dipstick is a concentration-
// dependent estimate, not a substitute for a quantitative test).
export const DIPSTICK_PROTEIN_EQUIVALENTS: Record<string, string> = {
  Negative: '0 mg/dL',
  Trace: '~15–30 mg/dL',
  '+1': '~30 mg/dL',
  '+2': '~100 mg/dL',
  '+3': '~300 mg/dL',
  '+4': '≥2000 mg/dL',
}

export function classifyDipstickProtein(grade: string): ProteinuriaClass {
  if (grade === '+3' || grade === '+4') return 'nephrotic-range'
  if (grade === '+2') return 'abnormal'
  return 'normal'
}

// Spot urine protein/creatinine ratio (mg/mg). Standard pediatric cutoffs:
// normal <0.2, nephrotic-range >2.0 (>0.5 and >2.0 respectively are also
// used for children under 2 years — apply clinical judgement).
export function classifyUpcRatio(ratioMgMg: number): ProteinuriaClass {
  if (ratioMgMg >= 2.0) return 'nephrotic-range'
  if (ratioMgMg >= 0.2) return 'abnormal'
  return 'normal'
}

// 24-hour urine protein, expressed as a rate against body surface area.
// Normal <4 mg/m²/hr, nephrotic-range >40 mg/m²/hr.
export function urineProteinRateMgM2Hr(totalProteinMg24h: number, bsaM2: number): number {
  return totalProteinMg24h / bsaM2 / 24
}

export function classifyProteinRate(mgM2Hr: number): ProteinuriaClass {
  if (mgM2Hr >= 40) return 'nephrotic-range'
  if (mgM2Hr >= 4) return 'abnormal'
  return 'normal'
}

export interface ProteinuriaStatus {
  label: string
  cls: ProteinuriaClass
}

// Latest spot UPC ratio, escalated to "persistent" when two-plus non-normal
// readings span at least a week -- matches the KDOQI definition used to
// decide whether isolated proteinuria needs a nephrology workup.
export function assessProteinuriaStatus(entries: LabEntry[]): ProteinuriaStatus | null {
  const upcEntries = entries.filter((e) => e.test === 'Urine Protein/Creatinine Ratio' && e.value != null)
  if (upcEntries.length === 0) return null
  const sorted = [...upcEntries].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const latestClass = classifyUpcRatio(latest.value!)
  if (latestClass === 'nephrotic-range') {
    return { label: 'Nephrotic-range proteinuria', cls: latestClass }
  }
  const nonNormalDates = sorted.filter((e) => classifyUpcRatio(e.value!) !== 'normal').map((e) => e.date)
  if (nonNormalDates.length >= 2) {
    const spanDays =
      (new Date(nonNormalDates[nonNormalDates.length - 1]).getTime() - new Date(nonNormalDates[0]).getTime()) /
      (1000 * 60 * 60 * 24)
    if (spanDays >= 7) return { label: 'Persistent proteinuria', cls: 'abnormal' }
  }
  if (latestClass === 'abnormal') {
    return { label: 'Isolated abnormal proteinuria — recheck to confirm persistence', cls: latestClass }
  }
  return { label: 'Proteinuria: normal', cls: 'normal' }
}
