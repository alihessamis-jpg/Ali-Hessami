// Weight/BSA-based dose arithmetic for Harriet Lane monograph lines, and
// eGFR matching for Chapter 31 kidney-failure rows.
//
// These helpers only do arithmetic on the numbers printed in the line itself
// (dose per kg or per m², the ÷ Qn hr / BID… split, and a "max. dose" stated
// on the SAME line). They never invent a dose: a line without a per-kg/per-m²
// dose yields nothing, and the UI always shows the original line next to the
// result so it can be checked against the book.

export interface DoseInputs {
  weightKg?: number | null
  heightCm?: number | null
}

export interface DoseMatch {
  /** the matched dose expression, e.g. "50–75 mg/kg/24 hr" */
  expr: string
  lo: number
  hi: number
  unit: string
  /** 'dose' | '24 hr' | 'hr' | 'min' | 'day' | '' */
  per: string
  basis: 'kg' | 'm2'
}

export interface DoseResult {
  match: DoseMatch
  /** total for the patient (per the same period as `per`) */
  totalLo: number
  totalHi: number
  /** when a /24 hr dose is divided (÷ Q8 hr, BID …): per-dose range */
  perDoseLo?: number
  perDoseHi?: number
  dosesPerDay?: [number, number]
  divisionLabel?: string
  /** max stated on the same line, converted to the dose's unit */
  max?: { value: number; unit: string; per: string; raw: string }
  /** true when the computed amount exceeds that max (display the cap) */
  capped: boolean
  bsa?: number
}

const NUM = String.raw`\d+(?:\.\d+)?`
const DOSE_RE = new RegExp(
  String.raw`(${NUM})(?:\s*(?:–|-|to)\s*(${NUM}))?\s*(mg|mCg|mcg|g|units|Units|unit|mEq|mmol|mL|million units)\s*\/\s*(kg|m\s?2|m²)(?:\s*\/\s*(dose|24\s?hr|day|hr|min))?`,
  'g'
)
const DIV_RE = /^[^;]{0,40}?(?:÷\s*)?(?:Q\s?(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:hr|h)\b|\b(BID|TID|QID|once daily|daily)\b)/i
const MAX_RE = new RegExp(
  String.raw`max(?:\.|imum)?\s*(?:single\s+)?(?:daily\s+)?dose[^:\d]{0,12}:?\s*(${NUM})\s*(mg|mCg|mcg|g|units|Units|mEq|mmol|mL)\s*(?:\/\s*(dose|24\s?hr|day))?`,
  'i'
)

function toMg(value: number, unit: string): number | null {
  const u = unit.toLowerCase()
  if (u === 'mg') return value
  if (u === 'g') return value * 1000
  if (u === 'mcg') return value / 1000
  return null
}

function sameUnit(value: number, from: string, to: string): number | null {
  if (from.toLowerCase() === to.toLowerCase()) return value
  const a = toMg(value, from)
  if (a == null) return null
  const t = to.toLowerCase()
  if (t === 'mg') return a
  if (t === 'g') return a / 1000
  if (t === 'mcg') return a * 1000
  return null
}

export function bsaMosteller(heightCm: number, weightKg: number): number {
  return Math.sqrt((heightCm * weightKg) / 3600)
}

export function round(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3
  return String(Number(n.toFixed(d)))
}

export function findDoses(line: string): DoseMatch[] {
  const out: DoseMatch[] = []
  for (const m of line.matchAll(DOSE_RE)) {
    const lo = Number(m[1])
    const hi = m[2] ? Number(m[2]) : lo
    const per = (m[5] ?? '').replace(/\s/g, ' ').replace('24hr', '24 hr')
    out.push({
      expr: m[0],
      lo,
      hi,
      unit: m[3] === 'mCg' ? 'mcg' : m[3],
      per,
      basis: m[4].startsWith('kg') ? 'kg' : 'm2',
    })
  }
  return out
}

export function computeDoses(line: string, inp: DoseInputs): DoseResult[] {
  const w = inp.weightKg && inp.weightKg > 0 ? inp.weightKg : null
  const bsa = w && inp.heightCm && inp.heightCm > 0 ? bsaMosteller(inp.heightCm, w) : null
  const results: DoseResult[] = []
  const matches = findDoses(line)
  for (const match of matches) {
    const factor = match.basis === 'kg' ? w : bsa
    if (!factor) continue
    const totalLo = match.lo * factor
    const totalHi = match.hi * factor
    const r: DoseResult = { match, totalLo, totalHi, capped: false, bsa: bsa ?? undefined }

    const after = line.slice(line.indexOf(match.expr) + match.expr.length)
    if (match.per === '24 hr' || match.per === 'day') {
      const dm = after.match(DIV_RE)
      if (dm) {
        let n: [number, number] | null = null
        let label = ''
        if (dm[1]) {
          const q1 = Number(dm[1])
          const q2 = dm[2] ? Number(dm[2]) : q1
          if (q1 > 0 && q2 > 0 && q1 <= 24 && q2 <= 24) {
            n = [24 / q2, 24 / q1] // fewest … most doses per day
            label = dm[2] ? `Q${q1}–${q2} hr` : `Q${q1} hr`
          }
        } else if (dm[3]) {
          const k = dm[3].toUpperCase()
          const map: Record<string, number> = { BID: 2, TID: 3, QID: 4, 'ONCE DAILY': 1, DAILY: 1 }
          if (map[k]) {
            n = [map[k], map[k]]
            label = dm[3]
          }
        }
        if (n) {
          r.dosesPerDay = n
          r.divisionLabel = label
          r.perDoseLo = totalLo / n[1]
          r.perDoseHi = totalHi / n[0]
        }
      }
    }

    const mm = after.match(MAX_RE) ?? line.match(MAX_RE)
    if (mm) {
      const maxPer = (mm[3] ?? '').replace(/\s/g, ' ').replace('24hr', '24 hr')
      const v = sameUnit(Number(mm[1]), mm[2] === 'mCg' ? 'mcg' : mm[2], match.unit)
      if (v != null) {
        r.max = { value: v, unit: match.unit, per: maxPer, raw: mm[0] }
        const perMatches =
          (maxPer === 'dose' && match.per === 'dose') ||
          ((maxPer === '24 hr' || maxPer === 'day') && (match.per === '24 hr' || match.per === 'day')) ||
          (maxPer === '' && (match.per === 'dose' || match.per === ''))
        if (perMatches && totalHi > v) r.capped = true
        if (maxPer === 'dose' && r.perDoseHi != null && r.perDoseHi > v) r.capped = true
      }
    }
    results.push(r)
  }
  return results
}

// ------------------------------------------------------------------ eGFR rows

export interface EgfrBand {
  min: number | null // inclusive lower bound (null = open)
  max: number | null // inclusive upper bound (null = open)
  ihd: boolean
  pd: boolean
  hd: boolean
}

/** Parses a Chapter 31 eGFR cell ("30–50", "<10/IHDᵃ/PD", "≤10", ">120", "10–29/IHD", "60-89"). */
export function parseEgfrCell(text: string): EgfrBand | null {
  const t = text.replace(/[ᵃᵇᶜᵈᵉᶠ]/g, '')
  const ihd = /\bIHD\b/.test(t)
  const pd = /\bPD\b/.test(t)
  const hd = /(^|\/)HD\b/.test(t)
  let min: number | null = null
  let max: number | null = null
  let m: RegExpMatchArray | null
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/))) {
    min = Number(m[1])
    max = Number(m[2])
  } else if ((m = t.match(/[<≤]\s*(\d+(?:\.\d+)?)/))) {
    max = t.includes('≤') ? Number(m[1]) : Number(m[1]) - 0.0001
    min = 0
  } else if ((m = t.match(/[>≥]\s*(\d+(?:\.\d+)?)/))) {
    min = t.includes('≥') ? Number(m[1]) : Number(m[1]) + 0.0001
    max = null
  } else if ((m = t.match(/^\s*(\d+(?:\.\d+)?)\s*$/))) {
    min = max = Number(m[1])
  }
  if (min == null && max == null && !ihd && !pd && !hd) return null
  if (/SCr|mg\/dL/i.test(t)) return null
  return { min, max, ihd, pd, hd }
}

export type Dialysis = 'none' | 'ihd' | 'pd'

export function egfrRowMatches(text: string, egfr: number | null, dialysis: Dialysis): boolean {
  const b = parseEgfrCell(text)
  if (!b) return false
  if (dialysis === 'ihd' && (b.ihd || b.hd)) return true
  if (dialysis === 'pd' && b.pd) return true
  if (dialysis !== 'none') return false
  if (egfr == null || (b.min == null && b.max == null)) return false
  // integer bands in the book ("10–29" then "30–50") — treat as [10, 30) so 29.5 still lands somewhere
  const hiEdge = b.max != null && Number.isInteger(b.max) ? b.max + 0.9999 : b.max
  return (b.min == null || egfr >= b.min) && (hiEdge == null || egfr <= hiEdge)
}

export function schwartzBedside(heightCm: number, scrMgDl: number): number {
  return (0.413 * heightCm) / scrMgDl
}
