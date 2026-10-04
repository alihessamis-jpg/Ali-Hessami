import type { LabEntry, Patient } from '../types/domain'

const HUS_PATTERN = /HUS|hemolytic uremic/i

export function patientHasHus(patient: Patient): boolean {
  return HUS_PATTERN.test(patient.diagnosis ?? '') || HUS_PATTERN.test(patient.underlyingDisease ?? '')
}

function hasTestSince(entries: LabEntry[], testName: string, sinceDate: string | null): boolean {
  return entries.some((e) => e.test === testName && (sinceDate == null || e.date >= sinceDate))
}

export interface HusWorkupGap {
  missingLdh: boolean
  missingUricAcid: boolean
}

// HUS is a thrombotic microangiopathy, and LDH/uric acid track ongoing
// hemolysis and cell turnover — easy to forget once a patient's course
// shifts to managing AKI and fluid status. Flag whichever one hasn't been
// checked since admission (or ever, if there's no admission date on record)
// for any patient whose diagnosis/underlying disease names HUS.
export function assessHusWorkup(patient: Patient, entries: LabEntry[]): HusWorkupGap | null {
  if (!patientHasHus(patient)) return null
  const since = patient.doa ?? null
  const missingLdh = !hasTestSince(entries, 'LDH', since)
  const missingUricAcid = !hasTestSince(entries, 'Uric Acid', since)
  if (!missingLdh && !missingUricAcid) return null
  return { missingLdh, missingUricAcid }
}
