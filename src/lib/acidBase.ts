import type { LabEntry } from '../types/domain'

export const NORMAL_HCO3_MEQ_L = 22
const SEVERE_HCO3_MEQ_L = 15
const ACIDIC_PH = 7.35

function latestByTest(entries: LabEntry[], testName: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === testName && e.value != null)
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

export interface AcidBaseAssessment {
  ph: LabEntry | null
  hco3: LabEntry | null
  needsBicarbTherapy: boolean
}

// Renal failure (AKI or CKD) reminder: check a VBG, and if pH is acidic with
// HCO3 below 15 mEq/L, start sodium bicarbonate (IV or oral) toward the
// normal of 22 mEq/L.
export function assessAcidBase(entries: LabEntry[]): AcidBaseAssessment {
  const ph = latestByTest(entries, 'VBG - pH')
  const hco3 = latestByTest(entries, 'VBG - HCO3') ?? latestByTest(entries, 'Bicarbonate')
  const needsBicarbTherapy = !!(
    ph?.value != null &&
    ph.value < ACIDIC_PH &&
    hco3?.value != null &&
    hco3.value < SEVERE_HCO3_MEQ_L
  )
  return { ph, hco3, needsBicarbTherapy }
}
