import type { LabEntry } from '../types/domain'

export const CKD_BICARB_TARGET_MEQ_L = 22
// Lab dates in this app are day-granularity (no time of day), so "48 hours"
// is approximated as at least 2 calendar days apart.
export const CKD_BICARB_RECHECK_DAYS = 2
export const CKD_BICARB_ESCALATED_DOSE =
  '2 tablets morning, 2 tablets noon, 2 tablets evening (each tablet ≈ 8 mEq Na bicarbonate)'

function hco3Entries(entries: LabEntry[]): LabEntry[] {
  return entries
    .filter((e) => (e.test === 'VBG - HCO3' || e.test === 'Bicarbonate') && e.value != null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + 'T00:00:00Z').getTime()
  const to = new Date(toDateStr + 'T00:00:00Z').getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

export type CkdBicarbStatus = 'no-data' | 'at-goal' | 'below-goal-recent' | 'below-goal-recheck-due' | 'below-goal-after-recheck'

export interface CkdBicarbProtocol {
  status: CkdBicarbStatus
  latest: LabEntry | null
  daysSinceLatest: number | null
}

// Local CKD bicarbonate-replacement protocol: target HCO3 >= 22 mEq/L,
// recheck a VBG 48h after any below-goal result, and if a later VBG at
// least 48h after an earlier below-goal one is still below goal, escalate
// Na bicarbonate per CKD_BICARB_ESCALATED_DOSE.
export function assessCkdBicarbProtocol(
  entries: LabEntry[],
  today: string = new Date().toISOString().slice(0, 10)
): CkdBicarbProtocol {
  const hco3s = hco3Entries(entries)
  if (hco3s.length === 0) return { status: 'no-data', latest: null, daysSinceLatest: null }

  const latest = hco3s[hco3s.length - 1]
  const daysSinceLatest = daysBetween(latest.date, today)

  if ((latest.value as number) >= CKD_BICARB_TARGET_MEQ_L) {
    return { status: 'at-goal', latest, daysSinceLatest }
  }

  const priorBelowGoal = hco3s
    .slice(0, -1)
    .reverse()
    .find((e) => (e.value as number) < CKD_BICARB_TARGET_MEQ_L && daysBetween(e.date, latest.date) >= CKD_BICARB_RECHECK_DAYS)
  if (priorBelowGoal) {
    return { status: 'below-goal-after-recheck', latest, daysSinceLatest }
  }

  if (daysSinceLatest >= CKD_BICARB_RECHECK_DAYS) {
    return { status: 'below-goal-recheck-due', latest, daysSinceLatest }
  }

  return { status: 'below-goal-recent', latest, daysSinceLatest }
}
