import { describe, expect, it } from 'vitest'
import { isolateLatinRuns } from './bidiText'
import {
  preserveLineBreaks,
  buildHubIndex,
  caseCategoriesForHub,
  linkChapterRefs,
  parseSummary,
  sortCategories,
  splitPersonalBlocks,
  statsForTopics,
  topicTree,
  HUB_CATEGORIES,
} from './topicHub'
import type { AcademyTopic } from '../types/domain'

describe('parseSummary', () => {
  it('splits the reviewed status line and the 📚 references', () => {
    const p = parseSummary(
      'AKI افت ناگهانی عملکرد کلیه است.\n\n✅ بازبینی‌شده با فصل (۱۴۰۵/۰۹/۰۶) — 📚 Pediatric Nephrology — Ch. 65 Pathogenesis of AKI (pp. 1555–1592)',
    )
    expect(p.status).toBe('reviewed')
    expect(p.statusText).toBe('بازبینی‌شده با فصل (۱۴۰۵/۰۹/۰۶)')
    expect(p.refs).toBe('📚 Pediatric Nephrology — Ch. 65 Pathogenesis of AKI (pp. 1555–1592)')
    expect(p.body).toBe('AKI افت ناگهانی عملکرد کلیه است.')
    expect(p.personal).toBe(false)
  })
  it('flags partial review and personal-note topics', () => {
    expect(parseSummary('متن\n\n⚠️ بازبینی جزئی').status).toBe('partial')
    expect(parseSummary('📝 این مبحث نکته‌ی بالینی شخصی است (نه متن کتاب).').personal).toBe(true)
  })
  it('handles empty input', () => {
    expect(parseSummary(null)).toMatchObject({ body: '', status: null, refs: null })
  })
})

describe('splitPersonalBlocks', () => {
  it('marks a 📝 paragraph and its list as personal, then returns to book text', () => {
    const t = 'متن کتاب (§12).\n\n**📝 نکته‌ی بالینی شخصی — آنوری، قدم‌های اول:**\n1. مثانه\n2. Lasix\n\n3. ادامه\n\nمتن بعدی کتاب'
    const s = splitPersonalBlocks(t)
    expect(s.map((x) => x.personal)).toEqual([false, true, false])
    expect(s[1].text).toContain('3. ادامه')
    expect(s[2].text).toBe('متن بعدی کتاب')
  })
  it('marks UpToDate / Local Protocol sections until the next rule', () => {
    const t = 'کتاب\n\n---\n\n## Approach to HUS (UpToDate Expert AI)\r\n\r\n### Step 1\r\ntext\n\n---\n\n## Pre-Eculizumab Checklist (Local Protocol)\nlist'
    const s = splitPersonalBlocks(t)
    expect(s.map((x) => x.personal)).toEqual([false, true, false, true])
    expect(s[1].text).toContain('### Step 1')
  })
})

describe('linkChapterRefs', () => {
  const r = { chapterId: (n: number) => (n === 44 || n === 55 || n === 56 ? `id${n}` : null), hasAnchor: (n: number, s: number) => !(n === 56 && s === 15) }
  it('links single and multiple section refs', () => {
    expect(linkChapterRefs('x (Ch.44 §3)', r)).toBe('x ([Ch.44 §3](/academy/reader/id44#ch44-s3))')
    expect(linkChapterRefs('(Ch.44 §4، §6)', r)).toBe('([Ch.44 §4](/academy/reader/id44#ch44-s4)، [§6](/academy/reader/id44#ch44-s6))')
  })
  it('switches chapter mid-list and drops a missing anchor', () => {
    expect(linkChapterRefs('(Ch.56 §15–16، Ch.55 §14)', r)).toBe('([Ch.56 §15–16](/academy/reader/id56)، [Ch.55 §14](/academy/reader/id55#ch55-s14))')
  })
  it('leaves unknown chapters alone', () => {
    expect(linkChapterRefs('(Ch.99 §1)', r)).toBe('(Ch.99 §1)')
  })
})

describe('stats', () => {
  const idx = buildHubIndex({
    chapterTopics: [
      { chapter_id: 'c1', topic_id: 'root' },
      { chapter_id: 'c1', topic_id: 'sub' },
      { chapter_id: 'c2', topic_id: 'sub' },
    ],
    questions: [
      { id: 'q1', chapter_id: 'c1' },
      { id: 'q2', chapter_id: 'c1' },
      { id: 'q3', chapter_id: 'c2' },
    ],
    attempts: [
      { question_id: 'q1', is_correct: true, attempted_at: '2026-01-01' },
      { question_id: 'q1', is_correct: false, attempted_at: '2026-01-03' },
      { question_id: 'q3', is_correct: true, attempted_at: '2026-01-02' },
    ],
    topicPatients: [
      { topic_id: 'root', patient_id: 'p1' },
      { topic_id: 'sub', patient_id: 'p1' },
    ],
  })
  it('counts shared chapters, questions and patients once per category', () => {
    const s = statsForTopics(idx, ['root', 'sub'])
    expect(s).toMatchObject({ questions: 3, attempted: 2, unanswered: 1, attempts: 3, correct: 2, wrongQuestions: 1, patients: 1, chapters: 2 })
    expect(s.accuracy).toBeCloseTo(66.7)
    expect(s.lastAttemptAt).toBe('2026-01-03')
  })
  it('sorts weakest first, unranked (< 5 attempts) after', () => {
    const mk = (key: string, attempts: number, accuracy: number | null, unanswered = 0) => ({
      cat: HUB_CATEGORIES.find((c) => c.key === key)!,
      stats: { attempts, accuracy, unanswered, questions: 0 } as never,
    })
    const rows = [mk('AKI', 0, null, 100), mk('CKD & Dialysis', 116, 66.4), mk('HUS/TMA', 2, 100, 40), mk('Glomerular Diseases', 15, 60)]
    expect(sortCategories(rows, 'weakest').map((r) => r.cat.key)).toEqual(['Glomerular Diseases', 'CKD & Dialysis', 'AKI', 'HUS/TMA'])
  })
})

describe('topicTree + case mapping', () => {
  const t = (id: string, name: string, parent: string | null = null) => ({ id, name, parentTopicId: parent, keyPoints: [], studyLinks: [], caseQuestions: [] }) as AcademyTopic
  it('nests sub-topics under their root', () => {
    const tree = topicTree([t('b', '۲. دوم', 'r'), t('r', 'ریشه'), t('a', '۱. اول', 'r')])
    expect(tree).toHaveLength(1)
    expect(tree[0].children.map((c) => c.topic.id)).toEqual(['a', 'b'])
  })
  it('maps daily-case categories back to hub categories', () => {
    expect(caseCategoriesForHub('CAKUT').sort()).toEqual(['cakut', 'cystic'])
    expect(caseCategoriesForHub('Renal Tumors')).toEqual(['genetic'])
    expect(caseCategoriesForHub('HUS/TMA')).toEqual([])
  })
})

describe('line structure', () => {
  it('keeps numbered list markers outside bidi isolates', () => {
    const out = isolateLatinRuns('**📝 x:**\n1. اول\n2. دوم KDIGO')
    expect(out).toContain('\n1. اول')
    expect(out).toContain('\n2. دوم')
  })
  it('turns • bullets into list items and single newlines into hard breaks', () => {
    expect(preserveLineBreaks('• یک\n• دو')).toBe('- یک\n- دو')
    expect(preserveLineBreaks('وزن: 38\nقد: 148\n\nبند بعد')).toBe('وزن: 38  \nقد: 148\n\nبند بعد')
    expect(preserveLineBreaks('متن\n1. اول\n| a | b |\n|---|---|')).toBe('متن\n1. اول\n| a | b |\n|---|---|')
  })
})
