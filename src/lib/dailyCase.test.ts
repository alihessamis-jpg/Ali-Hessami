import { describe, expect, it } from 'vitest'
import { caseScore, caseStreak, stagePoints, statsByCategory, tehranToday } from './dailyCase'
import type { CaseAttempt, DailyCase, StageResponse } from '../types/dailyCase'

const resp = (score: number, hints = 0, skipped = false): StageResponse => ({
  stage: 'presentation',
  answer: 'x',
  choice: null,
  skipped,
  hints,
  feedback: skipped ? null : { score, correct: [], missed: [], comment: '', gradedBy: 'ai' },
  answeredAt: '2026-11-27T00:00:00Z',
})

describe('scoring', () => {
  it('full marks on all 7 stages is 100', () => {
    expect(caseScore(Array.from({ length: 7 }, () => resp(10)))).toBe(100)
  })
  it('skipped stage scores 0 and hints cost 25 % each', () => {
    expect(stagePoints(resp(10, 0, true))).toBe(0)
    expect(stagePoints(resp(10, 1))).toBeCloseTo(0.75)
    expect(stagePoints(resp(8, 2))).toBeCloseTo(0.4)
    expect(stagePoints(resp(10, 5))).toBe(0)
  })
  it('mixes stages', () => {
    const r = [resp(10), resp(5), resp(0, 0, true), resp(10, 1), resp(10), resp(10), resp(10)]
    // (1 + .5 + 0 + .75 + 1 + 1 + 1) / 7 = 0.75
    expect(caseScore(r)).toBe(75)
  })
})

describe('streak', () => {
  it('counts back from today', () => {
    expect(caseStreak(['2026-11-27', '2026-11-26', '2026-11-25', '2026-11-23'], '2026-11-27')).toBe(3)
  })
  it('today not done yet keeps yesterday’s streak', () => {
    expect(caseStreak(['2026-11-26', '2026-11-25'], '2026-11-27')).toBe(2)
  })
  it('crosses month boundaries', () => {
    expect(caseStreak(['2026-12-01', '2026-11-30'], '2026-12-01')).toBe(2)
  })
  it('zero when broken', () => {
    expect(caseStreak(['2026-11-24'], '2026-11-27')).toBe(0)
  })
})

describe('tehranToday', () => {
  it('is UTC+3:30', () => {
    expect(tehranToday(new Date('2026-11-27T20:29:00Z'))).toBe('2026-11-27')
    expect(tehranToday(new Date('2026-11-27T20:31:00Z'))).toBe('2026-11-28')
  })
})

describe('statsByCategory', () => {
  it('uses the first completed attempt and sorts weakest first', () => {
    const mk = (id: string, cat: string) => ({ id, topicCategory: cat }) as DailyCase
    const at = (caseId: string, score: number, startedAt: string) =>
      ({ caseId, score, startedAt, completedAt: startedAt }) as CaseAttempt
    const s = statsByCategory(
      [mk('a', 'tubular'), mk('b', 'glomerular'), mk('c', 'glomerular')],
      [at('a', 90, '1'), at('b', 40, '1'), at('b', 100, '2'), at('c', 60, '1')],
    )
    expect(s.map((x) => [x.key, x.avg])).toEqual([
      ['glomerular', 50],
      ['tubular', 90],
    ])
  })
})
