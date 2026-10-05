import type { AcademicActivity, CaseLogEntry } from '../types/domain'

export interface CountEntry {
  label: string
  count: number
}

export interface CaseLogSummary {
  totalCases: number
  byRole: CountEntry[]
  byCategory: CountEntry[]
  procedures: CountEntry[]
  distinctDiagnoses: number
}

function toSortedCounts(m: Map<string, number>): CountEntry[] {
  return Array.from(m.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
}

export function summarizeCaseLog(entries: CaseLogEntry[]): CaseLogSummary {
  const byRole = new Map<string, number>()
  const byCategory = new Map<string, number>()
  const procedures = new Map<string, number>()
  const diagnoses = new Set<string>()

  for (const e of entries) {
    byRole.set(e.role, (byRole.get(e.role) ?? 0) + 1)
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1)
    const procedure = e.procedure?.trim()
    if (procedure) procedures.set(procedure, (procedures.get(procedure) ?? 0) + 1)
    const diagnosis = e.diagnosis?.trim().toLowerCase()
    if (diagnosis) diagnoses.add(diagnosis)
  }

  return {
    totalCases: entries.length,
    byRole: toSortedCounts(byRole),
    byCategory: toSortedCounts(byCategory),
    procedures: toSortedCounts(procedures),
    distinctDiagnoses: diagnoses.size,
  }
}

export interface AcademicActivityGroup {
  category: string
  items: AcademicActivity[]
}

export function groupAcademicActivities(activities: AcademicActivity[]): AcademicActivityGroup[] {
  const byCategory = new Map<string, AcademicActivity[]>()
  for (const a of activities) {
    const list = byCategory.get(a.category) ?? []
    list.push(a)
    byCategory.set(a.category, list)
  }
  return Array.from(byCategory.entries())
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => a.category.localeCompare(b.category))
}
