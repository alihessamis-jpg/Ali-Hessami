import type { CaseAttempt, CaseDifficulty, CaseSource, DailyCase, StageResponse } from '../types/dailyCase'

export const STAGE_COUNT = 7
/** Each hint costs this fraction of that stage's points. */
export const HINT_PENALTY = 0.25
/** Completed cases scoring below this go to the Leitner review queue. */
export const REVIEW_THRESHOLD = 70

export const DIFFICULTY_LABEL: Record<CaseDifficulty, string> = {
  moderate: 'Moderate',
  hard: 'Hard',
  'board-killer': 'Board-killer',
}

export const CATEGORY_LABEL: Record<string, string> = {
  glomerular: 'Glomerular',
  tubular: 'Tubular',
  electrolyte: 'Acid–base & electrolytes',
  cakut: 'CAKUT / VUR / UTI',
  aki: 'AKI',
  ckd: 'CKD / MBD / dialysis',
  hypertension: 'Hypertension',
  cystic: 'Cystic diseases',
  genetic: 'Genetic / syndromic',
  transplant: 'Transplantation',
  neonatal: 'Neonatal',
  stones: 'Stones',
}

/** Points one stage earns, 0..1 of its share: skipped = 0, each hint −25 % (floor 0). */
export function stagePoints(r: StageResponse): number {
  if (r.skipped || !r.feedback) return 0
  const raw = Math.max(0, Math.min(10, r.feedback.score)) / 10
  return Math.max(0, raw - HINT_PENALTY * r.hints * raw)
}

/** 0–100, all stages weighted equally. */
export function caseScore(responses: StageResponse[], stageCount = STAGE_COUNT): number {
  if (!stageCount) return 0
  const total = responses.slice(0, stageCount).reduce((sum, r) => sum + stagePoints(r), 0)
  return Math.round((100 * total) / stageCount)
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Today's date in Asia/Tehran (the case calendar). */
export function tehranToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/**
 * Consecutive days (ending today, or yesterday if today's case isn't done
 * yet) on which the daily case was completed.
 */
export function caseStreak(completedDates: Iterable<string>, today: string): number {
  const done = new Set(completedDates)
  let day = done.has(today) ? today : addDaysIso(today, -1)
  let n = 0
  while (done.has(day)) {
    n++
    day = addDaysIso(day, -1)
  }
  return n
}

/** Best completed score per case (re-solves don't lower it). */
export function bestScores(attempts: CaseAttempt[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const a of attempts) {
    if (a.score == null || !a.completedAt) continue
    out.set(a.caseId, Math.max(out.get(a.caseId) ?? 0, a.score))
  }
  return out
}

export interface TopicStat {
  key: string
  label: string
  cases: number
  avg: number
}

/** Average first-attempt score per topic category, weakest first. */
export function statsByCategory(cases: DailyCase[], attempts: CaseAttempt[]): TopicStat[] {
  const first = new Map<string, CaseAttempt>()
  for (const a of [...attempts].sort((x, y) => x.startedAt.localeCompare(y.startedAt))) {
    if (a.score != null && a.completedAt && !first.has(a.caseId)) first.set(a.caseId, a)
  }
  const acc = new Map<string, number[]>()
  for (const c of cases) {
    const a = first.get(c.id)
    if (!a || a.score == null) continue
    const k = c.topicCategory ?? 'other'
    if (!acc.has(k)) acc.set(k, [])
    acc.get(k)!.push(a.score)
  }
  return [...acc.entries()]
    .map(([key, s]) => ({ key, label: CATEGORY_LABEL[key] ?? key, cases: s.length, avg: Math.round(s.reduce((a, b) => a + b, 0) / s.length) }))
    .sort((a, b) => a.avg - b.avg)
}

export type CaseStatus = 'not-started' | 'in-progress' | 'done'

export function caseStatus(attempts: CaseAttempt[]): { status: CaseStatus; score: number | null } {
  const done = attempts.filter((a) => a.completedAt && a.score != null)
  if (done.length) return { status: 'done', score: Math.max(...done.map((a) => a.score as number)) }
  if (attempts.length) return { status: 'in-progress', score: null }
  return { status: 'not-started', score: null }
}

/** Link into the Library reader for a cited passage (null for drug sources). */
export function sourceHref(s: CaseSource): string | null {
  if (s.kind === 'drug') return '/reference'
  if (!s.chapterId) return null
  return `/academy/reader/${s.chapterId}${s.anchor && s.kind !== 'figure' ? `#${s.anchor}` : ''}`
}

