// Tubular function tests beyond FeNa/FeUrea (already surfaced inline in
// LabsTab): FeHCO3, urine anion gap (UAG), tubular reabsorption of phosphate
// (TRP), and the age-adjusted calcium/creatinine ratio. Also gives an
// advisory (never definitive) hint at RTA type when the pattern is
// characteristic — always shown alongside the raw values so the clinician
// judges the actual case, per Harriet Lane Handbook Ch.19 (Table 19.16).
import { calciumCreatinineRatioUpperLimit, feHCO3, tubularReabsorption, urineAnionGap } from './formulas'
import type { LabEntry } from '../types/domain'

function latestByTest(entries: LabEntry[], testName: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === testName && e.value != null)
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

function sameDate(entries: (LabEntry | null)[]): string | null {
  const dates = entries.map((e) => e?.date)
  if (dates.some((d) => d == null)) return null
  return dates.every((d) => d === dates[0]) ? dates[0]! : null
}

export interface FeHCO3Result {
  value: number
  date: string
  interpretation: 'normal-or-distal-RTA' | 'proximal-RTA-pattern' | 'indeterminate'
}

export interface UagResult {
  value: number
  date: string
  interpretation: 'positive-impaired-acidification' | 'negative-extrarenal-cause' | 'indeterminate'
}

export interface TrpResult {
  value: number
  date: string
}

export interface CaCrRatioResult {
  value: number
  date: string
  upperLimit: number
  hypercalciuric: boolean
}

export interface RtaHint {
  key: string
  message: string
}

export interface TubularFunctionAssessment {
  feHco3: FeHCO3Result | null
  uag: UagResult | null
  trp: TrpResult | null
  caCrRatio: CaCrRatioResult | null
  rtaHints: RtaHint[]
}

export function assessTubularFunction(entries: LabEntry[], ageMonths: number | null): TubularFunctionAssessment | null {
  const plasmaCr = latestByTest(entries, 'Creatinine')
  const plasmaHco3 = latestByTest(entries, 'Bicarbonate') ?? latestByTest(entries, 'VBG - HCO3')
  const urineHco3 = latestByTest(entries, 'Urine Bicarbonate')
  const urineCr = latestByTest(entries, 'Urine Creatinine')
  const urineNa = latestByTest(entries, 'Urine Sodium')
  const urineK = latestByTest(entries, 'Urine Potassium')
  const urineCl = latestByTest(entries, 'Urine Chloride')
  const plasmaPhos = latestByTest(entries, 'Phosphorus')
  const urinePhos = latestByTest(entries, 'Urine Phosphorus')
  const urineCa = latestByTest(entries, 'Urine Calcium')
  const plasmaK = latestByTest(entries, 'Potassium')

  let feHco3Result: FeHCO3Result | null = null
  const feHco3Date = sameDate([urineHco3, plasmaCr, plasmaHco3, urineCr])
  if (feHco3Date) {
    const value = feHCO3(urineHco3!.value!, plasmaCr!.value!, plasmaHco3!.value!, urineCr!.value!)
    feHco3Result = {
      value,
      date: feHco3Date,
      interpretation: value < 5 ? 'normal-or-distal-RTA' : value > 15 ? 'proximal-RTA-pattern' : 'indeterminate',
    }
  }

  let uagResult: UagResult | null = null
  const uagDate = sameDate([urineNa, urineK, urineCl])
  if (uagDate) {
    const value = urineAnionGap(urineNa!.value!, urineK!.value!, urineCl!.value!)
    uagResult = {
      value,
      date: uagDate,
      interpretation: value > 20 ? 'positive-impaired-acidification' : value < -20 ? 'negative-extrarenal-cause' : 'indeterminate',
    }
  }

  let trpResult: TrpResult | null = null
  const trpDate = sameDate([urinePhos, plasmaPhos, urineCr, plasmaCr])
  if (trpDate) {
    trpResult = { value: tubularReabsorption(urinePhos!.value!, plasmaPhos!.value!, urineCr!.value!, plasmaCr!.value!), date: trpDate }
  }

  let caCrRatioResult: CaCrRatioResult | null = null
  const caCrDate = sameDate([urineCa, urineCr])
  if (caCrDate && ageMonths != null) {
    const value = urineCa!.value! / urineCr!.value!
    const upperLimit = calciumCreatinineRatioUpperLimit(ageMonths)
    caCrRatioResult = { value, date: caCrDate, upperLimit, hypercalciuric: value > upperLimit }
  }

  if (!feHco3Result && !uagResult && !trpResult && !caCrRatioResult) return null

  const rtaHints: RtaHint[] = []
  const acidoticLowBicarb = plasmaHco3?.value != null && plasmaHco3.value < 18
  if (acidoticLowBicarb) {
    if (feHco3Result?.interpretation === 'proximal-RTA-pattern') {
      rtaHints.push({
        key: 'proximal-rta',
        message:
          'Metabolic acidosis with FeHCO3 >15% — pattern suggests proximal (type 2) RTA (bicarbonate wasting); consider Fanconi syndrome workup (glucosuria, aminoaciduria, phosphaturia) and expect a larger alkali dose to keep up with the loss.',
      })
    }
    if (uagResult?.interpretation === 'positive-impaired-acidification' && plasmaK?.value != null && plasmaK.value < 3.5) {
      rtaHints.push({
        key: 'distal-rta',
        message:
          'Metabolic acidosis with a positive urine anion gap and low plasma K — pattern suggests distal (type 1) RTA (impaired distal acidification); screen for nephrocalcinosis and hypercalciuria.',
      })
    }
    if (uagResult?.interpretation === 'positive-impaired-acidification' && plasmaK?.value != null && plasmaK.value > 5.5) {
      rtaHints.push({
        key: 'type4-rta',
        message:
          'Metabolic acidosis with a positive urine anion gap and elevated plasma K — pattern suggests type 4 (hyperkalemic) RTA; consider hypoaldosteronism or obstructive uropathy and check an aldosterone level.',
      })
    }
    if (uagResult?.interpretation === 'negative-extrarenal-cause') {
      rtaHints.push({
        key: 'extrarenal-loss',
        message:
          'Metabolic acidosis with a negative urine anion gap — kidneys are appropriately excreting ammonium, so this points to an extrarenal bicarbonate loss (e.g. diarrhea) rather than RTA.',
      })
    }
  }

  return { feHco3: feHco3Result, uag: uagResult, trp: trpResult, caCrRatio: caCrRatioResult, rtaHints }
}
