interface Range {
  low?: number
  high?: number
}

// Parses common reference-range formats: "0.5-1.2", "<1.2", ">=3", "≤ 1.2".
// Returns null for anything else so unrecognized formats never falsely flag.
export function parseRefRange(ref: string | null | undefined): Range | null {
  if (!ref) return null
  const trimmed = ref.trim()

  let m = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)$/)
  if (m) return { low: Number(m[1]), high: Number(m[2]) }

  m = trimmed.match(/^[<≤]=?\s*(-?\d+(?:\.\d+)?)$/)
  if (m) return { high: Number(m[1]) }

  m = trimmed.match(/^[>≥]=?\s*(-?\d+(?:\.\d+)?)$/)
  if (m) return { low: Number(m[1]) }

  return null
}

export function isAbnormal(value: number | null | undefined, ref: string | null | undefined): boolean {
  if (value == null) return false
  const range = parseRefRange(ref)
  if (!range) return false
  if (range.low != null && value < range.low) return true
  if (range.high != null && value > range.high) return true
  return false
}
