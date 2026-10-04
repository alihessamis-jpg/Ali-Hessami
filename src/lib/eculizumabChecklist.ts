import type { LabEntry, Vaccination } from '../types/domain'

const ECULIZUMAB_PATTERN = /eculizumab|soliris/i
const MENINGOCOCCAL_PATTERN = /meningococcal|men[-\s]?acwy|menactra|menveo|menquadfi|nimenrix|bexsero|trumenba|penbraya/i
const PNEUMOCOCCAL_PATTERN = /pneumococcal|pcv\b|prevnar|ppsv/i
const PENICILLIN_PATTERN = /penicillin/i
const PPD_TEST_NAME = 'PPD'

export function isOnEculizumab(activeMedNames: string[]): boolean {
  return activeMedNames.some((n) => ECULIZUMAB_PATTERN.test(n))
}

export interface EculizumabChecklist {
  meningococcalGiven: Vaccination | null
  pneumococcalGiven: Vaccination | null
  penicillinActive: boolean
  ppdDone: boolean
  anyMissing: boolean
}

// Pre-eculizumab checklist (local protocol): meningococcal + pneumococcal
// vaccination and a PPD test, with penicillin prophylaxis covering the
// ~2-week window before vaccine immunity develops. This only flags what's
// missing from this patient's record here — dosing/spacing/booster
// schedules stay documented in the HUS Academy topic, since they depend on
// which product (valency) the health center supplies.
export function assessEculizumabChecklist(
  activeMedNames: string[],
  vaccinations: Vaccination[],
  labEntries: LabEntry[]
): EculizumabChecklist | null {
  if (!isOnEculizumab(activeMedNames)) return null

  const meningococcalGiven = vaccinations.find((v) => MENINGOCOCCAL_PATTERN.test(v.vaccineName)) ?? null
  const pneumococcalGiven = vaccinations.find((v) => PNEUMOCOCCAL_PATTERN.test(v.vaccineName)) ?? null
  const penicillinActive = activeMedNames.some((n) => PENICILLIN_PATTERN.test(n))
  const ppdDone = labEntries.some((e) => e.test === PPD_TEST_NAME && (e.value != null || e.valueText != null))

  return {
    meningococcalGiven,
    pneumococcalGiven,
    penicillinActive,
    ppdDone,
    anyMissing: !meningococcalGiven || !pneumococcalGiven || !penicillinActive || !ppdDone,
  }
}
