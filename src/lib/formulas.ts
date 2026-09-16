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
