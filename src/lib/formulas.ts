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
