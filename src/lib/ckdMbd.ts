import { correctedCalcium } from './formulas'
import type { LabEntry } from '../types/domain'

function latestByTest(entries: LabEntry[], testName: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === testName && e.value != null)
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

// Pediatric phosphate reference ranges are strongly age-dependent (much
// higher in infancy than in adults) -- these bands are approximate and
// lab-dependent, same caveat as the other rough screening cutoffs in this
// app (see nephriticWorkup.ts).
function phosphateUpperLimit(ageYears: number | null): number {
  if (ageYears == null) return 4.5
  if (ageYears < 1) return 8.1
  if (ageYears < 3) return 6.5
  if (ageYears < 10) return 5.8
  if (ageYears < 17) return 5.4
  return 4.5
}

const CA_LOW_MG_DL = 8.5
const CA_HIGH_MG_DL = 10.5
const PTH_HIGH_PG_ML = 65
const PTH_LOW_PG_ML = 10
const VITD_DEFICIENT_NG_ML = 20
const VITD_INSUFFICIENT_NG_ML = 30
const BICARB_LOW_MEQ_L = 22

const CALCIUM_BINDER = /calcium carbonate|calcium acetate/i
const NONCALCIUM_BINDER = /sevelamer|lanthanum|renagel|renvela|fosrenol/i
const ANY_BINDER = /calcium carbonate|calcium acetate|sevelamer|lanthanum|renagel|renvela|fosrenol/i
const CALCITRIOL = /calcitriol|rocaltrol|paricalcitol|doxercalciferol|alfacalcidol/i
const ALKALI = /sodium bicarbonate|sodium citrate|potassium citrate|bicitra|polycitra/i

export interface CkdMbdFlag {
  key: string
  message: string
}

export interface CkdMbdAssessment {
  correctedCa: number | null
  phosphate: LabEntry | null
  pth: LabEntry | null
  vitD: LabEntry | null
  alkPhos: LabEntry | null
  bicarb: LabEntry | null
  flags: CkdMbdFlag[]
}

// Pure rule-based screen over KDIGO CKD-MBD principles: control phosphate
// before pushing active vitamin D, replete nutritional vitamin D before/
// alongside calcitriol, prefer a non-calcium binder once calcium is high,
// watch for oversuppressed PTH (adynamic bone disease), and treat chronic
// acidosis. `activeMedNames` (lowercased medication names) lets the
// messages say "increase the dose" instead of "start" when already treated.
export function assessCkdMbd(entries: LabEntry[], ageYears: number | null, activeMedNames: string[]): CkdMbdAssessment | null {
  const ca = latestByTest(entries, 'Calcium')
  const albumin = latestByTest(entries, 'Albumin')
  const phosphate = latestByTest(entries, 'Phosphorus')
  const pth = latestByTest(entries, 'PTH')
  const vitD = latestByTest(entries, '25-OH Vitamin D')
  const alkPhos = latestByTest(entries, 'Alkaline Phosphatase')
  const bicarb = latestByTest(entries, 'VBG - HCO3')

  if (!ca && !phosphate && !pth && !vitD && !bicarb) return null

  const correctedCa = ca?.value != null && albumin?.value != null ? correctedCalcium(ca.value, albumin.value) : ca?.value ?? null

  const onMed = (pattern: RegExp) => activeMedNames.some((n) => pattern.test(n))
  const flags: CkdMbdFlag[] = []

  const phosHigh = phosphate?.value != null && phosphate.value > phosphateUpperLimit(ageYears)
  const caLow = correctedCa != null && correctedCa < CA_LOW_MG_DL
  const caHigh = correctedCa != null && correctedCa > CA_HIGH_MG_DL

  if (phosHigh && caHigh) {
    flags.push({
      key: 'binder-noncalcium',
      message: onMed(NONCALCIUM_BINDER)
        ? 'Phosphate remains high with calcium also elevated, on a non-calcium binder — consider increasing the dose.'
        : onMed(CALCIUM_BINDER)
          ? 'Phosphate high with calcium elevated — switch from the calcium-based binder to a non-calcium binder (e.g. sevelamer).'
          : 'Phosphate high with calcium elevated — start a non-calcium phosphate binder (e.g. sevelamer) rather than calcium carbonate.',
    })
  } else if (phosHigh) {
    flags.push({
      key: 'binder-calcium',
      message: onMed(ANY_BINDER)
        ? 'Phosphate remains above the age-appropriate range on the current binder — consider increasing the dose.'
        : 'Phosphate above the age-appropriate range — consider starting a phosphate binder (calcium carbonate first-line while calcium is not elevated).',
    })
  }

  if (caLow && phosHigh) {
    flags.push({
      key: 'ca-phos-order',
      message:
        'Correct phosphate before calcium — treating hyperphosphatemia first avoids calcium-phosphate precipitation; hold oral calcium repletion unless calcium is symptomatically low.',
    })
  }

  if (caHigh) {
    flags.push({
      key: 'hypercalcemia',
      message:
        onMed(CALCITRIOL) || onMed(CALCIUM_BINDER)
          ? 'Calcium elevated — hold or reduce calcitriol and/or the calcium-based binder.'
          : 'Calcium elevated — avoid starting calcium-based therapy; recheck the cause.',
    })
  }

  const pthHigh = pth?.value != null && pth.value > PTH_HIGH_PG_ML
  const pthLow = pth?.value != null && pth.value < PTH_LOW_PG_ML
  const vitDDeficient = vitD?.value != null && vitD.value < VITD_DEFICIENT_NG_ML
  const vitDInsufficient = !vitDDeficient && vitD?.value != null && vitD.value < VITD_INSUFFICIENT_NG_ML

  if (pthHigh && (vitDDeficient || vitDInsufficient)) {
    flags.push({
      key: 'pth-vitd',
      message: `PTH elevated with ${vitDDeficient ? 'deficient' : 'insufficient'} 25-OH vitamin D (${vitD?.value} ng/mL) — replete nutritional vitamin D (ergocalciferol/cholecalciferol) before intensifying active vitamin D.`,
    })
  } else if (pthHigh && phosHigh) {
    flags.push({
      key: 'pth-phos',
      message: 'PTH elevated but phosphate is still high — control phosphate first; active vitamin D can worsen hyperphosphatemia and hypercalcemia.',
    })
  } else if (pthHigh) {
    flags.push({
      key: 'pth-calcitriol',
      message: onMed(CALCITRIOL)
        ? 'PTH remains elevated with phosphate and vitamin D controlled — consider increasing the calcitriol dose.'
        : 'PTH elevated with phosphate and vitamin D controlled — consider starting calcitriol (active vitamin D) to suppress PTH.',
    })
  } else if (pthLow && (onMed(CALCITRIOL) || onMed(CALCIUM_BINDER))) {
    flags.push({
      key: 'pth-oversuppressed',
      message: 'PTH below target — risk of adynamic bone disease; consider reducing or holding calcitriol and/or the calcium-based binder.',
    })
  }

  if (bicarb?.value != null && bicarb.value < BICARB_LOW_MEQ_L) {
    flags.push({
      key: 'acidosis',
      message: onMed(ALKALI)
        ? 'Bicarbonate remains below target on alkali therapy — consider increasing the dose.'
        : 'Metabolic acidosis (bicarbonate below 22 mEq/L) — consider starting alkali therapy (sodium bicarbonate/citrate); chronic acidosis worsens bone disease and growth in CKD.',
    })
  }

  return { correctedCa, phosphate, pth, vitD, alkPhos, bicarb, flags }
}
