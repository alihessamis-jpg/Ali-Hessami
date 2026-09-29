// Reused as-is from the prototype (NEPHRON_HANDOFF.md).

export function schwartzEGFR(heightCm: number, crMgDl: number): number {
  return (0.413 * heightCm) / crMgDl // mL/min/1.73m^2
}

export function bsaMosteller(heightCm: number, weightKg: number): number {
  return Math.sqrt((heightCm * weightKg) / 3600)
}

export function bmiCalc(heightCm: number, weightKg: number): number {
  return weightKg / (heightCm / 100) ** 2
}

// Holliday-Segar maintenance fluid rate, mL/day.
export function maintenanceFluidPerDay(weightKg: number): number {
  if (weightKg <= 10) return weightKg * 100
  if (weightKg <= 20) return 1000 + (weightKg - 10) * 50
  return 1500 + (weightKg - 20) * 20
}

export function totalDose(weightKg: number, mgPerKg: number): number {
  return weightKg * mgPerKg
}

// Payne correction — accounts for calcium bound to albumin, using a normal
// albumin reference of 4.0 g/dL.
export function correctedCalcium(measuredCaMgDl: number, albuminGDl: number): number {
  return measuredCaMgDl + 0.8 * (4.0 - albuminGDl)
}

// Transferrin saturation (TSAT) — in CKD, <20% indicates iron deficiency
// and typically prompts iron repletion.
export function transferrinSaturation(serumIronUgDl: number, tibcUgDl: number): number {
  return (serumIronUgDl / tibcUgDl) * 100
}

export type KdigoStage = 1 | 2 | 3

// KDIGO AKI staging from serum creatinine only (ratio-to-baseline and
// absolute-rise criteria). Urine-output criteria aren't included since the
// app doesn't track hourly urine output.
export function kdigoStage(baselineCrMgDl: number, currentCrMgDl: number, onRRT = false): KdigoStage | null {
  if (onRRT) return 3
  const ratio = currentCrMgDl / baselineCrMgDl
  const rise = currentCrMgDl - baselineCrMgDl
  if (ratio >= 3 || currentCrMgDl >= 4.0) return 3
  if (ratio >= 2) return 2
  if (ratio >= 1.5 || rise >= 0.3) return 1
  return null
}

// Fractional excretion of sodium (%) — helps distinguish prerenal from
// intrinsic AKI. <1% suggests prerenal, >2% suggests intrinsic (ATN).
export function feNa(urineNaMEqL: number, plasmaCrMgDl: number, plasmaNaMEqL: number, urineCrMgDl: number): number {
  return ((urineNaMEqL * plasmaCrMgDl) / (plasmaNaMEqL * urineCrMgDl)) * 100
}

// Fractional excretion of urea (%) — more reliable than FeNa when the
// patient is on diuretics. <35% suggests prerenal, >50% suggests intrinsic.
export function feUrea(urineUreaMgDl: number, plasmaCrMgDl: number, plasmaUreaMgDl: number, urineCrMgDl: number): number {
  return ((urineUreaMgDl * plasmaCrMgDl) / (plasmaUreaMgDl * urineCrMgDl)) * 100
}

// Fractional excretion of bicarbonate (%) — used when suspecting proximal
// (type 2) RTA. <5% is normal or seen in distal (type 1) RTA; >15% (during
// bicarbonate loading) suggests proximal (type 2) RTA.
export function feHCO3(urineHCO3MEqL: number, plasmaCrMgDl: number, plasmaHCO3MEqL: number, urineCrMgDl: number): number {
  return ((urineHCO3MEqL * plasmaCrMgDl) / (plasmaHCO3MEqL * urineCrMgDl)) * 100
}

// Urine anion gap (mEq/L) — an indirect estimate of urinary ammonium (NH4+)
// excretion, used to distinguish the cause of a normal-anion-gap metabolic
// acidosis. Positive (roughly >20) suggests impaired distal acidification
// (e.g. distal/type 1 RTA); negative (roughly <-20) suggests an
// extrarenal cause (e.g. diarrhea) with an appropriately high urinary NH4+.
export function urineAnionGap(urineNaMEqL: number, urineKMEqL: number, urineClMEqL: number): number {
  return urineNaMEqL + urineKMEqL - urineClMEqL
}

// Tubular reabsorption of a filtered solute (%), most commonly applied to
// phosphate (TRP) when screening for renal phosphate wasting (e.g. Fanconi
// syndrome, XLH). A low TRP with inappropriate phosphaturia suggests a
// tubular phosphate leak rather than a purely dietary/GI cause.
export function tubularReabsorption(urineXMgDl: number, plasmaXMgDl: number, urineCrMgDl: number, plasmaCrMgDl: number): number {
  return (1 - (urineXMgDl / plasmaXMgDl) / (urineCrMgDl / plasmaCrMgDl)) * 100
}

// Age-adjusted 95th-percentile upper limit for a spot urine calcium/
// creatinine ratio (mg/mg), used to screen for hypercalciuria — the ratio
// is highest in infancy and falls with age.
export function calciumCreatinineRatioUpperLimit(ageMonths: number): number {
  if (ageMonths < 7) return 0.86
  if (ageMonths < 19) return 0.6
  if (ageMonths < 72) return 0.42
  return 0.22
}

export function isHypercalciuric(ratioMgMg: number, ageMonths: number): boolean {
  return ratioMgMg > calciumCreatinineRatioUpperLimit(ageMonths)
}

// Typical normal GFR by age (mL/min/1.73m²) — GFR is low at birth and rises
// to near-adult values by ~2 years as renal blood flow and tubular
// maturation catch up.
export function normalGfrRangeMlMin173m2(ageYears: number): { low: number; high: number } {
  if (ageYears < 1 / 12) return { low: 10, high: 25 } // 1 week
  if (ageYears < 0.5) return { low: 40, high: 70 } // 2-8 weeks -> 6 months
  if (ageYears < 2) return { low: 65, high: 105 }
  return { low: 90, high: 150 }
}

export type SchwartzPopulation = 'low-birth-weight-infant' | 'term-infant' | 'child-or-adolescent-girl' | 'adolescent-boy'

// Classic (non-bedside) Schwartz formula k-constants by population
// (mL/min/1.73m² per unit of height(cm)/creatinine(mg/dL)) — distinct from
// the single constant (0.413) used by the newer bedside/CKiD equation above.
export function schwartzKConstant(population: SchwartzPopulation): number {
  switch (population) {
    case 'low-birth-weight-infant':
      return 0.33
    case 'term-infant':
      return 0.45
    case 'child-or-adolescent-girl':
      return 0.55
    case 'adolescent-boy':
      return 0.7
  }
}

export function classicSchwartzEGFR(heightCm: number, crMgDl: number, population: SchwartzPopulation): number {
  return (schwartzKConstant(population) * heightCm) / crMgDl
}

export type CkdStage = 1 | 2 | 3 | '3a' | '3b' | 4 | 5

// KDIGO CKD staging by GFR (mL/min/1.73m²). Stage 3 is commonly split into
// 3a/3b; both the combined and split stage are returned so callers can show
// whichever their UI expects.
export function ckdStage(gfrMlMin173m2: number): { stage: CkdStage; split: '3a' | '3b' | null } {
  if (gfrMlMin173m2 >= 90) return { stage: 1, split: null }
  if (gfrMlMin173m2 >= 60) return { stage: 2, split: null }
  if (gfrMlMin173m2 >= 45) return { stage: '3a', split: '3a' }
  if (gfrMlMin173m2 >= 30) return { stage: '3b', split: '3b' }
  if (gfrMlMin173m2 >= 15) return { stage: 4, split: null }
  return { stage: 5, split: null }
}

export const CKD_STAGE_LABEL: Record<string, string> = {
  '1': 'Stage 1 (GFR ≥90, kidney damage with normal/high GFR)',
  '2': 'Stage 2 (GFR 60–89, mild decrease)',
  '3a': 'Stage 3a (GFR 45–59, mild-moderate decrease)',
  '3b': 'Stage 3b (GFR 30–44, moderate-severe decrease)',
  '4': 'Stage 4 (GFR 15–29, severe decrease)',
  '5': 'Stage 5 (GFR <15, kidney failure)',
}

export const OLIGURIA_THRESHOLD_ML_KG_HR = 0.5

// Threshold commonly used to flag clinically significant post-obstructive
// diuresis (e.g. after relieving PUV) that may need IV fluid replacement.
export const POLYURIA_THRESHOLD_ML_KG_HR = 4

export function urineOutputRate(volumeMl: number, durationHours: number, weightKg: number): number {
  return volumeMl / durationHours / weightKg
}
