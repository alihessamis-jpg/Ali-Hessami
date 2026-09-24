import type { LabEntry } from '../types/domain'

export const NORMAL_HCO3_MEQ_L = 22

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
// HCO3 below the (configurable) severe threshold, start sodium bicarbonate
// (IV or oral) toward the normal of 22 mEq/L.
export function assessAcidBase(entries: LabEntry[], phThreshold: number, hco3Threshold: number): AcidBaseAssessment {
  const ph = latestByTest(entries, 'VBG - pH')
  const hco3 = latestByTest(entries, 'VBG - HCO3') ?? latestByTest(entries, 'Bicarbonate')
  const needsBicarbTherapy = !!(
    ph?.value != null &&
    ph.value < phThreshold &&
    hco3?.value != null &&
    hco3.value < hco3Threshold
  )
  return { ph, hco3, needsBicarbTherapy }
}
