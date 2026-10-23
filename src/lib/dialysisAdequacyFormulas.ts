// Ported from the user's chapter-note calculator for Pediatric Nephrology
// (Emma et al., 2022) Ch. 78 "Adequacy of Dialysis" — formulas kept
// numerically identical to that worked reference, just typed and split
// into named pure functions for the app's Calculators page.

// ---- 1) URR & simple (single-pool, no UF/generation correction) Kt/V ----

export function urr(preBun: number, postBun: number): number {
  return (1 - postBun / preBun) * 100
}

export function simpleSpKtV(preBun: number, postBun: number): number {
  return -Math.log(postBun / preBun)
}

// ---- 2) spKt/V — Daugirdas II (also reused by Goldstein pediatric eKt/V) ----

export function defaultVolumeL(postWeightKg: number): number {
  return 0.55 * postWeightKg
}

export function daugirdasSpKtV(preBun: number, postBun: number, tHours: number, ufL: number, vL: number): number {
  const r = postBun / preBun
  return -Math.log(r - 0.008 * tHours) + ((4 - 3.5 * r) * (0.55 * ufL)) / vL
}

// ---- 3) eKt/V from spKt/V (three rest/equilibration estimates) ----

export function ektvDaugirdasRate(spKtV: number, tHours: number): number {
  return spKtV - (0.6 * spKtV) / tHours + 0.03
}

export function ektvTattersall(spKtV: number, tHours: number): number {
  const tMin = tHours * 60
  return (spKtV * tMin) / (tMin + 35)
}

export function ektvLeypoldt(spKtV: number, tHours: number): number {
  return 0.924 * spKtV - (0.395 * spKtV) / tHours + 0.056
}

// ---- 4) Pediatric eKt/V — Goldstein (estimated-BUN) + Daugirdas II ----

export function goldsteinEstBun(bun30sec: number, bun15min: number): number {
  return (bun15min - bun30sec) / 0.69 + bun30sec
}

export interface GoldsteinEktvResult {
  estBun: number
  reboundPct: number
  spKtV: number
  ektv: number
  spMinusE: number
}

export function goldsteinEktv(
  preBun: number,
  bun30sec: number,
  bun15min: number,
  tHours: number,
  ufL: number,
  vL: number
): GoldsteinEktvResult {
  const estBun = goldsteinEstBun(bun30sec, bun15min)
  const ektv = daugirdasSpKtV(preBun, estBun, tHours, ufL, vL)
  const spKtV = daugirdasSpKtV(preBun, bun30sec, tHours, ufL, vL)
  return { estBun, reboundPct: ((estBun - bun30sec) / bun30sec) * 100, spKtV, ektv, spMinusE: spKtV - ektv }
}

// ---- 5) stdKt/V (Gotch/Leypoldt) + weekly Kru contribution ----

export function stdKtV(ektv: number, tHours: number, nPerWeek: number): number {
  const a = 1 - Math.exp(-ektv)
  return (168 * a) / tHours / (a / ektv + 168 / (nPerWeek * tHours) - 1)
}

export function kruWeeklyStdKtV(kruMlMin: number, vL: number): number {
  return (kruMlMin * 10080) / (vL * 1000)
}

// ---- 6) nPCR — modified Borah (+ optional urinary urea-nitrogen term) ----

export function estimatedUreaGeneration(
  postBun: number,
  postTbwL: number,
  nextPreBun: number,
  nextPreTbwL: number,
  interdialyticHours: number
): number {
  return (nextPreBun * nextPreTbwL * 10 - postBun * postTbwL * 10) / (interdialyticHours * 60)
}

export function npcrBorah(ureaGenerationMgMin: number, postTbwL: number): number {
  return (5.43 * ureaGenerationMgMin) / postTbwL + 0.17
}

export function npcrUrinaryAddOn(urineUreaNitrogenG: number, interdialyticHours: number, weightKg: number): number {
  return (urineUreaNitrogenG * 150) / (interdialyticHours * weightKg)
}

// ---- 7) Residual urea clearance (Kru) ----

export function kruMlMin(urineUreaNitrogenMgDl: number, plasmaBunMgDl: number, urineVolMl: number, collectionMin: number): number {
  const urineFlowMlMin = urineVolMl / collectionMin
  return (urineUreaNitrogenMgDl / plasmaBunMgDl) * urineFlowMlMin
}

export function kruNormalized173(kruMlMin: number, bsaM2: number): number {
  return (kruMlMin * 1.73) / bsaM2
}

// ---- 8) Total body water (Morgenstern) & BSA (Gehan-George) ----

export type Sex = 'm' | 'f'

export function tbwMorgenstern(sex: Sex, heightCm: number, weightKg: number): number {
  const hw = heightCm * weightKg
  return sex === 'm' ? 0.1 * hw ** 0.68 - 0.37 * weightKg : 0.14 * hw ** 0.65 - 0.35 * weightKg
}

// Original-paper girls' exponent (0.64, vs. the 0.65 commonly cited) —
// shown alongside the main result for girls only, as in the source chapter.
export function tbwMorgensternGirlsOriginalExponent(heightCm: number, weightKg: number): number {
  const hw = heightCm * weightKg
  return 0.14 * hw ** 0.64 - 0.35 * weightKg
}

export function bsaGehanGeorge(heightCm: number, weightKg: number): number {
  return 0.0235 * heightCm ** 0.42246 * weightKg ** 0.51456
}

// ---- 9) PD weekly Kt/Vurea ----

export interface PdWeeklyKtVResult {
  peritoneal: number
  renal: number
  total: number
}

export function pdWeeklyKtV(
  dialysateVolLPerDay: number,
  dialysateUrea: number,
  plasmaUrea: number,
  urineVolLPerDay: number,
  urineUrea: number,
  tbwL: number
): PdWeeklyKtVResult {
  const peritoneal = ((dialysateVolLPerDay * dialysateUrea) / plasmaUrea / tbwL) * 7
  const renal = ((urineVolLPerDay * urineUrea) / plasmaUrea / tbwL) * 7
  return { peritoneal, renal, total: peritoneal + renal }
}

// ---- 10) PD weekly creatinine clearance ----

export type PdModality = 'CAPD' | 'CCPD' | 'NIPD'

export const PD_CRCL_TARGET_L_WK_173M2: Record<PdModality, number> = {
  CAPD: 60,
  CCPD: 63,
  NIPD: 66,
}

export interface PdWeeklyCrClResult {
  peritoneal: number
  renal: number
  total: number
}

export function pdWeeklyCrCl(
  dialysateCr: number,
  plasmaCr: number,
  dialysateVolLPerDay: number,
  urineVolLPerDay: number,
  urineCr: number,
  urineUrea: number,
  plasmaUrea: number,
  bsaM2: number
): PdWeeklyCrClResult {
  const peritoneal = ((dialysateCr / plasmaCr) * dialysateVolLPerDay * 7 * 1.73) / bsaM2
  const ccr = (urineVolLPerDay * urineCr) / plasmaCr
  const cur = (urineVolLPerDay * urineUrea) / plasmaUrea
  const renal = (0.5 * (ccr + cur) * 7 * 1.73) / bsaM2
  return { peritoneal, renal, total: peritoneal + renal }
}

// ---- 11) Protein nitrogen appearance (PNA) in PD — modified Borah ----

export interface PnaPdResult {
  unaG: number
  pna: number
}

export function pnaPD(
  urineUreaNitrogenG: number,
  dialysateUreaNitrogenG: number,
  tbwL: number,
  dialysateProteinLossG: number,
  weightKg: number
): PnaPdResult {
  const unaG = urineUreaNitrogenG + dialysateUreaNitrogenG
  const pna = (6.49 * unaG + 0.294 * tbwL + dialysateProteinLossG) / weightKg
  return { unaG, pna }
}
