// Academy · Topic Hub — pure helpers (no I/O): categories, summary status
// line, personal-note blocks, «(Ch.N §M)» links and question statistics.

import type { AcademyTopic } from '../types/domain'
import { sortSubTopics } from './sortSubTopics'

// ------------------------------------------------------------------ categories
export interface HubCategory {
  key: string // academy_topics.category, exactly as stored
  fa: string
}

export const HUB_CATEGORIES: HubCategory[] = [
  { key: 'AKI', fa: 'آسیب حاد کلیه' },
  { key: 'CKD & Dialysis', fa: 'CKD و دیالیز' },
  { key: 'Glomerular Diseases', fa: 'بیماری‌های گلومرولی' },
  { key: 'Tubular Disorders', fa: 'اختلالات توبولی' },
  { key: 'Electrolytes', fa: 'الکترولیت‌ها و اسید-باز' },
  { key: 'Hypertension', fa: 'فشار خون' },
  { key: 'CAKUT', fa: 'ناهنجاری‌های مادرزادی (CAKUT)' },
  { key: 'UTI & VUR', fa: 'عفونت ادراری و ریفلاکس' },
  { key: 'Stones', fa: 'سنگ و نفروکلسینوز' },
  { key: 'HUS/TMA', fa: 'HUS و میکروآنژیوپاتی ترومبوتیک' },
  { key: 'Genetics', fa: 'ژنتیک' },
  { key: 'Neonatal', fa: 'نفرولوژی نوزادی' },
  { key: 'Renal Transplant', fa: 'پیوند کلیه' },
  { key: 'Renal Tumors', fa: 'تومورهای کلیه' },
  { key: 'Clinical Approaches', fa: 'رویکردهای بالینی' },
]

export function categoryFa(key: string | null | undefined): string {
  return HUB_CATEGORIES.find((c) => c.key === key)?.fa ?? key ?? 'بدون دسته'
}

/** Daily Case topic category (case_topics.category) → Topic Hub categories. */
export const CASE_CATEGORY_TO_HUB: Record<string, string[]> = {
  aki: ['AKI'],
  ckd: ['CKD & Dialysis'],
  glomerular: ['Glomerular Diseases'],
  tubular: ['Tubular Disorders'],
  electrolyte: ['Electrolytes'],
  hypertension: ['Hypertension'],
  cakut: ['CAKUT', 'UTI & VUR'],
  stones: ['Stones'],
  cystic: ['CAKUT'],
  genetic: ['Genetics', 'Renal Tumors'],
  neonatal: ['Neonatal'],
  transplant: ['Renal Transplant'],
}

/** Daily Case categories that belong to a Topic Hub category. */
export function caseCategoriesForHub(hubCategory: string | null | undefined): string[] {
  if (!hubCategory) return []
  return Object.entries(CASE_CATEGORY_TO_HUB)
    .filter(([, hubs]) => hubs.includes(hubCategory))
    .map(([k]) => k)
}

// ------------------------------------------------------------------ summary status
export type StatusKind = 'reviewed' | 'partial'

export interface ParsedSummary {
  body: string // summary without the status / 📚 lines
  status: StatusKind | null
  statusText: string | null // e.g. «بازبینی‌شده با فصل (۱۴۰۵/۰۹/۰۶)»
  refs: string | null // the 📚 … line, shown small and grey
  personal: boolean // the topic is (or contains) a personal clinical note
}

/**
 * The reviewed summaries end with a status paragraph like
 * «✅ بازبینی‌شده با فصل (۱۴۰۵/۰۹/۰۶) — 📚 Pediatric Nephrology — Ch. 65 …».
 * Split it off so the UI can show a badge + a small grey reference line.
 */
export function parseSummary(summary: string | null | undefined): ParsedSummary {
  const text = (summary ?? '').replace(/\r\n/g, '\n').trim()
  const out: ParsedSummary = { body: text, status: null, statusText: null, refs: null, personal: /(^|\n)\s*(\*\*)?📝[^\n]*شخصی/.test(text) }
  if (!text) return out
  const paras = text.split(/\n\s*\n/)
  const keep: string[] = []
  for (const p of paras) {
    const t = p.trim()
    const isStatus = /^(✅|⚠️|⚠)/.test(t)
    const isRefs = t.startsWith('📚')
    if (!isStatus && !isRefs) {
      keep.push(p)
      continue
    }
    if (isStatus) {
      out.status = t.startsWith('✅') ? 'reviewed' : 'partial'
      const [head, ...rest] = t.split('📚')
      out.statusText = head.replace(/^(✅|⚠️|⚠)\s*/, '').replace(/[\s—–-]+$/, '').trim() || null
      if (rest.length) out.refs = `📚${rest.join('📚')}`.trim()
    } else {
      out.refs = t
    }
  }
  out.body = keep.join('\n\n').trim()
  return out
}

// ------------------------------------------------------------------ personal notes
export interface TextSegment {
  text: string
  personal: boolean
}

const PERSONAL_SECTION_RE = /^#{1,6}\s.*\((UpToDate Expert AI|Local Protocol)\)\s*$/
const PERSONAL_NOTE_RE = /^\s*(#{1,6}\s*)?(\*\*|__)?\s*📝/
const LIST_ITEM_RE = /^\s*(\d+[.)]|[-*•+])\s/
const TOP_HEADING_RE = /^#{1,2}\s/

/**
 * Splits a field into book text and personal blocks (shown on a pale-blue
 * background). Personal blocks are:
 *  - a paragraph starting with 📝 (plus the list that follows it), and
 *  - a «## … (UpToDate Expert AI)» or «## … (Local Protocol)» section, up to
 *    the next `---` rule or the next top-level heading.
 * The text itself is never changed — only grouped.
 */
export function splitPersonalBlocks(input: string | null | undefined): TextSegment[] {
  const lines = (input ?? '').replace(/\r\n?/g, '\n').split('\n')
  const segs: TextSegment[] = []
  let buf: string[] = []
  let mode: 'book' | 'note' | 'section' = 'book'
  const flush = () => {
    const text = buf.join('\n').replace(/^\n+|\n+$/g, '')
    if (text.trim()) segs.push({ text, personal: mode !== 'book' })
    buf = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const startsSection = PERSONAL_SECTION_RE.test(line)
    const startsNote = PERSONAL_NOTE_RE.test(line)
    if (startsSection || startsNote) {
      flush()
      mode = startsSection ? 'section' : 'note'
      buf.push(line)
      continue
    }
    if (mode === 'section' && (/^\s*---\s*$/.test(line) || TOP_HEADING_RE.test(line))) {
      flush()
      mode = 'book'
    } else if (mode === 'note') {
      if (/^\s*---\s*$/.test(line)) {
        flush()
        mode = 'book'
      } else if (line.trim() === '') {
        // a blank line ends the note unless its list continues after it
        const next = lines.slice(i + 1).find((l) => l.trim() !== '')
        if (!next || !LIST_ITEM_RE.test(next)) {
          flush()
          mode = 'book'
        }
      }
    }
    buf.push(line)
  }
  flush()
  return segs
}

// ------------------------------------------------------------------ line structure
const BLOCK_LINE_RE = /^\s*([-*+]\s|\d+[.)]\s|#{1,6}\s|>|\||---\s*$|```)/

/**
 * The topic texts are written line by line («• …» bullets, «وزن: …» rows),
 * but markdown joins single newlines into one paragraph. Turn «•» bullets
 * into list items and other single line breaks into hard breaks, without
 * touching lists, tables, headings or blank-line paragraphs.
 */
export function preserveLineBreaks(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/^(\s*)•\s*/, '$1- '))
  return lines
    .map((line, i) => {
      const next = lines[i + 1]
      if (next === undefined || !line.trim() || !next.trim()) return line
      if (BLOCK_LINE_RE.test(next) || /^\s*\|/.test(line)) return line
      return /\s{2}$/.test(line) ? line : `${line}  `
    })
    .join('\n')
}

// ------------------------------------------------------------------ «(Ch.N §M)» links
export interface ChapterRefResolver {
  /** Pediatric Nephrology chapter number → library_chapters.id */
  chapterId: (num: number) => string | null
  /** whether `ch{num}-s{sec}` is a real anchor in that chapter's note */
  hasAnchor?: (num: number, sec: number) => boolean
}

const toLatinDigits = (s: string) => s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

/**
 * Turns «(Ch.44 §3)», «(Ch.44 §4، §6)», «(Ch.56 §15–16، Ch.55 §14)» into
 * markdown links to the Reader (and to the section anchor when it exists).
 * Unknown chapters are left as plain text.
 */
export function linkChapterRefs(text: string, r: ChapterRefResolver): string {
  return text.replace(/\(Ch\.\s?(\d+)([^)]*)\)/g, (whole, firstNum: string, rest: string) => {
    let current = Number(firstNum)
    const inner = `Ch.${firstNum}${rest}`
    const parts = inner.split(/\s*[،,]\s*/)
    let linkedAny = false
    const out = parts.map((part) => {
      const ch = part.match(/Ch\.\s?(\d+)/)
      if (ch) current = Number(ch[1])
      const id = r.chapterId(current)
      if (!id) return part
      const sec = part.match(/§\s*([\d۰-۹]+)/)
      const secNum = sec ? Number(toLatinDigits(sec[1])) : null
      const anchor = secNum != null && (!r.hasAnchor || r.hasAnchor(current, secNum)) ? `#ch${current}-s${secNum}` : ''
      linkedAny = true
      return `[${part}](/academy/reader/${id}${anchor})`
    })
    return linkedAny ? `(${out.join('، ')})` : whole
  })
}

// ------------------------------------------------------------------ statistics
export interface HubIndex {
  chaptersByTopic: Map<string, string[]>
  questionsByChapter: Map<string, string[]>
  attemptsByQuestion: Map<string, { correct: number; total: number; last: string | null }>
  patientsByTopic: Map<string, string[]>
}

export interface QuestionStats {
  questions: number
  attempted: number // distinct questions answered at least once
  unanswered: number
  attempts: number
  correct: number
  accuracy: number | null // % of attempts correct
  wrongQuestions: number // distinct questions ever answered wrong
  lastAttemptAt: string | null
  patients: number
  chapters: number
}

export function buildHubIndex(input: {
  chapterTopics: { chapter_id: string; topic_id: string }[]
  questions: { id: string; chapter_id: string | null }[]
  attempts: { question_id: string; is_correct: boolean; attempted_at: string }[]
  topicPatients: { topic_id: string; patient_id: string }[]
}): HubIndex {
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const a = m.get(k)
    if (a) a.push(v)
    else m.set(k, [v])
  }
  const chaptersByTopic = new Map<string, string[]>()
  for (const l of input.chapterTopics) push(chaptersByTopic, l.topic_id, l.chapter_id)
  const questionsByChapter = new Map<string, string[]>()
  for (const q of input.questions) if (q.chapter_id) push(questionsByChapter, q.chapter_id, q.id)
  const attemptsByQuestion = new Map<string, { correct: number; total: number; last: string | null }>()
  for (const a of input.attempts) {
    const s = attemptsByQuestion.get(a.question_id) ?? { correct: 0, total: 0, last: null }
    s.total++
    if (a.is_correct) s.correct++
    if (!s.last || a.attempted_at > s.last) s.last = a.attempted_at
    attemptsByQuestion.set(a.question_id, s)
  }
  const patientsByTopic = new Map<string, string[]>()
  for (const p of input.topicPatients) push(patientsByTopic, p.topic_id, p.patient_id)
  return { chaptersByTopic, questionsByChapter, attemptsByQuestion, patientsByTopic }
}

/** Question ids reachable from these topics (distinct, via their chapters). */
export function questionIdsForTopics(idx: HubIndex, topicIds: string[]): Set<string> {
  const qs = new Set<string>()
  for (const ch of chapterIdsForTopics(idx, topicIds)) for (const q of idx.questionsByChapter.get(ch) ?? []) qs.add(q)
  return qs
}

export function chapterIdsForTopics(idx: HubIndex, topicIds: string[]): Set<string> {
  const chs = new Set<string>()
  for (const t of topicIds) for (const ch of idx.chaptersByTopic.get(t) ?? []) chs.add(ch)
  return chs
}

/**
 * Stats over a set of topics, counting every question and patient once even
 * when several topics share a chapter (a category's root and its sub-topics
 * usually do), so category numbers are not inflated.
 */
export function statsForTopics(idx: HubIndex, topicIds: string[]): QuestionStats {
  const qs = questionIdsForTopics(idx, topicIds)
  let attempted = 0
  let attempts = 0
  let correct = 0
  let wrongQuestions = 0
  let last: string | null = null
  for (const q of qs) {
    const s = idx.attemptsByQuestion.get(q)
    if (!s) continue
    attempted++
    attempts += s.total
    correct += s.correct
    if (s.correct < s.total) wrongQuestions++
    if (s.last && (!last || s.last > last)) last = s.last
  }
  const patients = new Set<string>()
  for (const t of topicIds) for (const p of idx.patientsByTopic.get(t) ?? []) patients.add(p)
  return {
    questions: qs.size,
    attempted,
    unanswered: qs.size - attempted,
    attempts,
    correct,
    accuracy: attempts ? Math.round((1000 * correct) / attempts) / 10 : null,
    wrongQuestions,
    lastAttemptAt: last,
    patients: patients.size,
    chapters: chapterIdsForTopics(idx, topicIds).size,
  }
}

/** Minimum attempts before a category's accuracy is trusted for «weakest first». */
export const MIN_ATTEMPTS_FOR_RANK = 5

export type HubSort = 'weakest' | 'alpha' | 'questions'

export function sortCategories<T extends { cat: HubCategory; stats: QuestionStats }>(rows: T[], sort: HubSort): T[] {
  const copy = [...rows]
  if (sort === 'alpha') return copy.sort((a, b) => a.cat.fa.localeCompare(b.cat.fa, 'fa'))
  if (sort === 'questions') return copy.sort((a, b) => b.stats.questions - a.stats.questions)
  const ranked = (r: T) => r.stats.attempts >= MIN_ATTEMPTS_FOR_RANK && r.stats.accuracy != null
  return copy.sort((a, b) => {
    const ra = ranked(a)
    const rb = ranked(b)
    if (ra && rb) return (a.stats.accuracy as number) - (b.stats.accuracy as number)
    if (ra !== rb) return ra ? -1 : 1
    // not enough attempts yet: the ones with more questions waiting first
    return b.stats.unanswered - a.stats.unanswered
  })
}

// ------------------------------------------------------------------ tree
export interface TopicNode {
  topic: AcademyTopic
  children: TopicNode[]
}

/** Category tree: roots (no parent, or parent outside the category) with their descendants. */
export function topicTree(topics: AcademyTopic[]): TopicNode[] {
  const ids = new Set(topics.map((t) => t.id))
  const byParent = new Map<string, AcademyTopic[]>()
  for (const t of topics) {
    if (t.parentTopicId && ids.has(t.parentTopicId)) {
      const a = byParent.get(t.parentTopicId) ?? []
      a.push(t)
      byParent.set(t.parentTopicId, a)
    }
  }
  const build = (t: AcademyTopic, seen: Set<string>): TopicNode => ({
    topic: t,
    children: seen.has(t.id) ? [] : sortSubTopics(byParent.get(t.id) ?? []).map((c) => build(c, new Set([...seen, t.id]))),
  })
  return sortSubTopics(topics.filter((t) => !t.parentTopicId || !ids.has(t.parentTopicId))).map((t) => build(t, new Set()))
}

/** Topic + every descendant id (for a root row's stats). */
export function descendantIds(node: TopicNode): string[] {
  return [node.topic.id, ...node.children.flatMap(descendantIds)]
}

/** Text the search box matches: name + key points. */
export function topicMatches(t: AcademyTopic, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return [t.name, ...(t.keyPoints ?? [])].join(' ').toLowerCase().includes(needle)
}
