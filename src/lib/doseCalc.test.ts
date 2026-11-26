import { describe, expect, it } from 'vitest'
import { computeDoses, egfrRowMatches, findDoses, parseEgfrCell } from './doseCalc'

describe('findDoses', () => {
  it('reads per-kg ranges with the period', () => {
    const m = findDoses('Mild/moderate infections: 50–75 mg/kg/24 hr ÷ Q12–24 hr IM/IV; max. dose: 2 g/24 hr')
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ lo: 50, hi: 75, unit: 'mg', per: '24 hr', basis: 'kg' })
  })
  it('reads per-m² doses', () => {
    const m = findDoses('Injectable: 200 mg/m 2/24 hr IV ÷ Q6–12 hr; max. dose: 600 mg/24 hr')
    expect(m[0]).toMatchObject({ lo: 200, basis: 'm2', per: '24 hr' })
  })
  it('ignores lines without a weight-based dose', () => {
    expect(findDoses('Adult: 1–2 g/dose Q12–24 hr IV/IM')).toHaveLength(0)
  })
})

describe('computeDoses', () => {
  it('multiplies by weight, splits by interval and caps at the stated max', () => {
    // ceftriaxone meningitis line, 25 kg
    const [r] = computeDoses(
      'Severe infections/meningitis: 100 mg/kg/24 hr IM/IV ÷ Q12 hr; max. dose: 2 g/dose and 4 g/24 hr',
      { weightKg: 25 }
    )
    expect(r.totalLo).toBe(2500)
    expect(r.dosesPerDay).toEqual([2, 2])
    expect(r.perDoseLo).toBe(1250)
    expect(r.max?.value).toBe(2000)
    expect(r.capped).toBe(false)
  })
  it('flags when the weight-based amount exceeds the max', () => {
    const [r] = computeDoses('Child: 10 mg/kg/24 hr PO ÷ BID–QID; max. dose: 800 mg/24 hr', { weightKg: 100 })
    expect(r.totalHi).toBe(1000)
    expect(r.capped).toBe(true)
  })
  it('handles Q6–8 hr ranges', () => {
    const [r] = computeDoses('150–200 mg/kg/24 hr ÷ Q6–8 hr IV/IM', { weightKg: 10 })
    expect(r.dosesPerDay).toEqual([3, 4])
    expect(r.perDoseLo).toBe(375)
    expect(Math.round(r.perDoseHi!)).toBe(667)
  })
  it('needs height for m² doses', () => {
    expect(computeDoses('200 mg/m2/24 hr IV ÷ Q6–12 hr', { weightKg: 20 })).toHaveLength(0)
    const [r] = computeDoses('200 mg/m2/24 hr IV ÷ Q6–12 hr', { weightKg: 20, heightCm: 110 })
    expect(r.bsa).toBeCloseTo(0.782, 2)
  })
})

describe('eGFR rows', () => {
  it('parses book cells', () => {
    expect(parseEgfrCell('30–50')).toMatchObject({ min: 30, max: 50 })
    expect(parseEgfrCell('<10/IHDᵃ/PD')).toMatchObject({ ihd: true, pd: true })
    expect(parseEgfrCell('SCr ≤2 mg/dL')).toBeNull()
  })
  it('matches eGFR and dialysis', () => {
    expect(egfrRowMatches('10–29', 29.5, 'none')).toBe(true)
    expect(egfrRowMatches('30–50', 29.5, 'none')).toBe(false)
    expect(egfrRowMatches('<10/IHDᵃ/PD', 8, 'none')).toBe(true)
    expect(egfrRowMatches('<10/IHDᵃ/PD', 40, 'ihd')).toBe(true)
    expect(egfrRowMatches('≤10', 10, 'none')).toBe(true)
    expect(egfrRowMatches('11–34', 10, 'none')).toBe(false)
  })
})
