import type { NephroticEvent } from '../types/domain'

export type NephroticClassification = 'resistant' | 'dependent' | 'frequent-relapsing' | 'sensitive' | 'insufficient-data'

export const NEPHROTIC_CLASSIFICATION_LABEL: Record<NephroticClassification, string> = {
  resistant: 'Steroid-resistant',
  dependent: 'Steroid-dependent',
  'frequent-relapsing': 'Frequently relapsing',
  sensitive: 'Steroid-sensitive',
  'insufficient-data': 'Insufficient data yet',
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ISKDC/KDIGO-style pediatric nephrotic syndrome response categories,
// derived from a chronological log of diagnosis/relapse/remission/
// no-response events rather than a single lab value:
// - Resistant: no remission after 4 weeks of daily steroids
// - Dependent: >=2 relapses during steroid therapy or within 2 weeks of stopping
// - Frequently relapsing: >=4 relapses in any rolling 12-month window, or
//   >=2 relapses within 6 months of the first remission
// - Sensitive: achieved remission with steroids and doesn't meet the above
export function classifyNephroticSyndrome(events: NephroticEvent[]): NephroticClassification {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.some((e) => e.eventType === 'no_response_4wk')) return 'resistant'

  const relapses = sorted.filter((e) => e.eventType === 'relapse')

  const duringTaperRelapses = relapses.filter((e) => e.duringTaper)
  if (duringTaperRelapses.length >= 2) return 'dependent'

  for (const relapse of relapses) {
    const windowEnd = addDaysToDateStr(relapse.date, 365)
    const count = relapses.filter((r) => r.date >= relapse.date && r.date <= windowEnd).length
    if (count >= 4) return 'frequent-relapsing'
  }

  const firstRemission = sorted.find((e) => e.eventType === 'remission')
  if (firstRemission) {
    const sixMonthsLater = addDaysToDateStr(firstRemission.date, 182)
    const earlyRelapses = relapses.filter((r) => r.date >= firstRemission.date && r.date <= sixMonthsLater)
    if (earlyRelapses.length >= 2) return 'frequent-relapsing'
  }

  if (sorted.some((e) => e.eventType === 'remission')) return 'sensitive'
  return 'insufficient-data'
}

// True when the only thing on record is the initial diagnosis and no
// remission/no-response has been logged yet -- i.e. before starting
// steroids -- so the app can prompt for pre-steroid TB screening (CXR + PPD).
export function isPreSteroidNewDiagnosis(events: NephroticEvent[]): boolean {
  if (events.length === 0) return false
  const hasDiagnosis = events.some((e) => e.eventType === 'diagnosis')
  const hasAnyResponse = events.some((e) => e.eventType === 'remission' || e.eventType === 'no_response_4wk')
  return hasDiagnosis && !hasAnyResponse
}
