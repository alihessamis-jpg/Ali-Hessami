import type { LabEntry } from '../types/domain'

const ANEMIA_WORKUP_TESTS = ['Ferritin', 'Iron', 'TIBC']
const CKD_MBD_WORKUP_TESTS = ['PTH', 'Alkaline Phosphatase', '25-OH Vitamin D', 'Calcium', 'Phosphorus', 'Albumin']

export interface CkdScreeningStatus {
  anemiaMissing: string[]
  mbdMissing: string[]
}

function everChecked(entries: LabEntry[], test: string): boolean {
  return entries.some((e) => e.test === test && (e.value != null || e.valueText != null))
}

// CKD screening reminder: anemia-of-CKD workup (ferritin, serum iron, TIBC)
// and CKD-MBD workup (PTH, alkaline phosphatase, vitamin D, calcium,
// phosphorus, albumin) are required labs, independent of whether any
// abnormality has actually shown up yet.
export function assessCkdScreening(entries: LabEntry[]): CkdScreeningStatus {
  return {
    anemiaMissing: ANEMIA_WORKUP_TESTS.filter((t) => !everChecked(entries, t)),
    mbdMissing: CKD_MBD_WORKUP_TESTS.filter((t) => !everChecked(entries, t)),
  }
}
