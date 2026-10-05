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

function latestByTest(entries: LabEntry[], testName: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === testName && e.value != null)
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

function previousByTest(entries: LabEntry[], testName: string, beforeDate: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === testName && e.value != null && e.date < beforeDate)
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

export interface HusActivityStatus {
  ldh: LabEntry | null
  platelets: LabEntry | null
  previousPlatelets: LabEntry | null
  active: boolean | null
}

// HUS is followed longitudinally by trending platelets and LDH: as long as
// LDH stays above the upper limit of normal, the disease is still in its
// active (ongoing-hemolysis) phase. Platelet count is carried alongside for
// context — recovering platelets together with a normalizing LDH signal
// resolution — but LDH alone decides active vs. inactive, per the user's
// own follow-up protocol.
export function assessHusActivity(patient: Patient, entries: LabEntry[], ldhUpperLimit: number): HusActivityStatus | null {
  if (!patientHasHus(patient)) return null
  const ldh = latestByTest(entries, 'LDH')
  const platelets = latestByTest(entries, 'Platelets')
  if (ldh == null && platelets == null) return null
  const previousPlatelets = platelets ? previousByTest(entries, 'Platelets', platelets.date) : null
  const active = ldh?.value != null ? ldh.value > ldhUpperLimit : null
  return { ldh, platelets, previousPlatelets, active }
}
