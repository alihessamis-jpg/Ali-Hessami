import { isPositiveCulture } from './labPresets'
import { toShamsi } from './shamsi'
import type { FollowUpCategory, LabEntry, UserSettings } from '../types/domain'

export type PrerequisiteCheck =
  | { kind: 'culture'; test: string }
  | { kind: 'min'; test: string; unit: string; threshold: (s: UserSettings) => number }
  | { kind: 'max'; test: string; unit: string; threshold: (s: UserSettings) => number }

export interface ProcedureFollowUp {
  category: FollowUpCategory
  description: (reminderTitle: string) => string
  daysAfter: number
}

export interface ProcedureRule {
  match: RegExp
  label: string
  checks: PrerequisiteCheck[]
  // When set, saving a reminder matching this rule also creates a
  // Follow-up item due `daysAfter` days from the reminder's own date (e.g.
  // the biopsy itself), instead of making the clinician add it separately.
  followUp?: ProcedureFollowUp
}

// Procedures that have lab prerequisites worth flagging inline wherever a
// reminder's own title mentions them (Reminders tab, Overview alerts), so
// the check surfaces right where the clinician is scheduling the thing
// rather than only in the Labs tab.
export const PROCEDURE_RULES: ProcedureRule[] = [
  { match: /vcug/i, label: 'VCUG', checks: [{ kind: 'culture', test: 'Urine Culture' }] },
  {
    match: /biopsy/i,
    label: 'biopsy',
    checks: [
      { kind: 'min', test: 'Platelets', unit: 'x10³/µL', threshold: (s) => s.biopsyPlateletMin },
      { kind: 'max', test: 'INR', unit: '', threshold: (s) => s.biopsyInrMax },
    ],
    followUp: {
      category: 'pathology',
      description: (title) => `Pathology result — ${title}`,
      daysAfter: 2,
    },
  },
]

// Categories that get an automatic "overdue" flag (Follow-up tab, Overview
// alerts) once this many days have passed since they were ordered.
// Categories left out just show elapsed time and rely on clinical judgement.
export const FOLLOW_UP_WINDOW_DAYS: Partial<Record<FollowUpCategory, number>> = {
  culture: 2,
  pathology: PROCEDURE_RULES.find((r) => r.followUp?.category === 'pathology')?.followUp?.daysAfter ?? 2,
}

export type CheckStatus = { text: string; cls: 'value-abnormal' | undefined }

function latestWithMicro(entries: LabEntry[], test: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === test && e.microDetails)
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

function latestNumeric(entries: LabEntry[], test: string): LabEntry | null {
  const matches = entries.filter((e) => e.test === test && e.value != null)
  if (matches.length === 0) return null
  return matches.reduce((latest, e) => (e.date > latest.date ? e : latest))
}

export function evaluateCheck(check: PrerequisiteCheck, entries: LabEntry[], settings: UserSettings, procedureLabel: string): CheckStatus {
  if (check.kind === 'culture') {
    const culture = latestWithMicro(entries, check.test)
    if (!culture) return { text: `⚠ No ${check.test} on file — must be negative before ${procedureLabel}`, cls: 'value-abnormal' }
    if (isPositiveCulture(culture.microDetails!.organism)) {
      return {
        text: `⚠ Latest ${check.test} (${toShamsi(culture.date)}) is POSITIVE — hold ${procedureLabel} until it's negative`,
        cls: 'value-abnormal',
      }
    }
    return { text: `✓ Latest ${check.test} (${toShamsi(culture.date)}) is negative — OK for ${procedureLabel}`, cls: undefined }
  }

  const entry = latestNumeric(entries, check.test)
  const threshold = check.threshold(settings)
  if (!entry || entry.value == null) {
    return { text: `⚠ No ${check.test} recorded — check before ${procedureLabel}`, cls: 'value-abnormal' }
  }
  const ok = check.kind === 'min' ? entry.value >= threshold : entry.value <= threshold
  const comparator = check.kind === 'min' ? '≥' : '≤'
  const unitSuffix = check.unit ? ` ${check.unit}` : ''
  return {
    text: `${ok ? '✓' : '⚠'} ${check.test}: ${entry.value}${unitSuffix} (${toShamsi(entry.date)}) — needs ${comparator} ${threshold}${unitSuffix}${
      ok ? '' : ` — hold ${procedureLabel}`
    }`,
    cls: ok ? undefined : 'value-abnormal',
  }
}

export function matchingProcedureRule(title: string): ProcedureRule | undefined {
  return PROCEDURE_RULES.find((r) => r.match.test(title))
}

export function procedureStatusesFor(title: string, entries: LabEntry[], settings: UserSettings): CheckStatus[] {
  const rule = matchingProcedureRule(title)
  if (!rule) return []
  return rule.checks.map((check) => evaluateCheck(check, entries, settings, rule.label))
}
