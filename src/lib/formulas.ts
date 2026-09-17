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
