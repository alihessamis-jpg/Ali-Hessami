import type { LabEntry } from '../types/domain'

function latestByTest(entries: LabEntry[], testName: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === testName && (e.value != null || e.valueText != null))
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

function displayValue(entry: LabEntry | null): string {
  if (!entry) return '—'
  return entry.valueText ?? String(entry.value ?? '—')
}

const HEMATURIA_DIPSTICK_POSITIVE = new Set(['Trace', '+1', '+2', '+3', '+4'])
// Rough screening cutoffs — always shown alongside the raw value so the
// clinician judges against their own lab's reference range.
const SIGNIFICANT_HEMATURIA_RBC_PER_HPF = 5
const C3_LOW_MG_DL = 90
const C4_LOW_MG_DL = 10
const ASO_HIGH_IU_ML = 200

export interface NephriticWorkup {
  hematuriaPresent: boolean
  hematuriaSource: string
  hematuriaDisplay: string
  dysmorphicRbc: LabEntry | null
  aso: LabEntry | null
  c3: LabEntry | null
  psgnLikely: boolean
  ana: LabEntry | null
  antiDsDna: LabEntry | null
  c4: LabEntry | null
  lupusLikely: boolean
  pAnca: LabEntry | null
  cAnca: LabEntry | null
}

// Nephritic syndrome is defined by hematuria + hypertension; hypertension
// isn't a lab value the app tracks longitudinally (it needs age/height/sex
// percentile tables), so this only auto-detects the hematuria side and
// prompts the clinician to confirm BP themselves.
export function assessNephriticWorkup(entries: LabEntry[]): NephriticWorkup | null {
  const urineRbc = latestByTest(entries, 'Urine RBC')
  const urineBlood = latestByTest(entries, 'Urinalysis - Blood')

  const hematuriaFromRbc = urineRbc?.value != null && urineRbc.value > SIGNIFICANT_HEMATURIA_RBC_PER_HPF
  const hematuriaFromDipstick = !!urineBlood?.valueText && HEMATURIA_DIPSTICK_POSITIVE.has(urineBlood.valueText)
  if (!hematuriaFromRbc && !hematuriaFromDipstick) return null

  const hematuriaSource = hematuriaFromRbc ? 'Urine RBC' : 'Urinalysis - Blood'
  const hematuriaEntry = hematuriaFromRbc ? urineRbc : urineBlood

  const aso = latestByTest(entries, 'ASO')
  const c3 = latestByTest(entries, 'C3')
  const psgnLikely = !!c3?.value && c3.value < C3_LOW_MG_DL && !!aso?.value && aso.value > ASO_HIGH_IU_ML

  const ana = latestByTest(entries, 'ANA')
  const antiDsDna = latestByTest(entries, 'Anti-dsDNA')
  const c4 = latestByTest(entries, 'C4')
  const anaPositive = ana?.valueText === 'Positive'
  const dsDnaPositive = antiDsDna?.valueText === 'Positive'
  const complementLow = (!!c3?.value && c3.value < C3_LOW_MG_DL) || (!!c4?.value && c4.value < C4_LOW_MG_DL)
  const lupusLikely = (anaPositive || dsDnaPositive) && complementLow

  return {
    hematuriaPresent: true,
    hematuriaSource,
    hematuriaDisplay: displayValue(hematuriaEntry),
    dysmorphicRbc: latestByTest(entries, 'Urine Dysmorphic RBC'),
    aso,
    c3,
    psgnLikely,
    ana,
    antiDsDna,
    c4,
    lupusLikely,
    pAnca: latestByTest(entries, 'P-ANCA (MPO)'),
    cAnca: latestByTest(entries, 'C-ANCA (PR3)'),
  }
}
