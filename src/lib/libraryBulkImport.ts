// Parses a JSON or CSV file of hand-written/AI-generated cards, questions,
// and clinical scenarios into BulkCardImportItem rows, pending chapter
// resolution and insertion in lib/api/library.ts (importBulkCards). Kept
// separate from that file since this is pure parsing with no network calls.
import type { LibraryCardKind, McqChoice, PatientCaseVignetteStat, ClinicalScenarioStep } from '../types/domain'

export interface BulkCardImportItem {
  kind: LibraryCardKind
  chapterNumber: number
  bookId: string | null
  front: string
  back: string
  topic: string | null
  tags: string[]
  highYield: boolean
  sectionNumber: string | null
  page: number | null
  choices: McqChoice[] | null
  explanation: string | null
  stats: PatientCaseVignetteStat[] | null
  steps: ClinicalScenarioStep[] | null
}

export interface BulkImportError {
  index: number
  message: string
}

const CARD_KINDS: LibraryCardKind[] = ['basic', 'cloze', 'table_cell', 'mcq', 'patient_case', 'clinical_scenario']

function toItem(raw: unknown, index: number): BulkCardImportItem {
  if (!raw || typeof raw !== 'object') throw new Error(`Item ${index + 1}: not an object`)
  const o = raw as Record<string, unknown>
  const kind = (o.kind as LibraryCardKind) ?? 'basic'
  if (!CARD_KINDS.includes(kind)) throw new Error(`Item ${index + 1}: unknown kind "${String(o.kind)}"`)
  const chapterNumber = Number(o.chapter_number ?? o.chapterNumber)
  if (!Number.isFinite(chapterNumber)) throw new Error(`Item ${index + 1}: chapter_number is required`)
  return {
    kind,
    chapterNumber,
    bookId: (o.book_id as string) ?? (o.bookId as string) ?? null,
    front: String(o.front ?? ''),
    back: String(o.back ?? ''),
    topic: (o.topic as string) ?? null,
    tags: Array.isArray(o.tags) ? (o.tags as string[]) : [],
    highYield: Boolean(o.high_yield ?? o.highYield ?? false),
    sectionNumber: (o.section_number as string) ?? (o.sectionNumber as string) ?? null,
    page: o.page != null ? Number(o.page) : null,
    choices: Array.isArray(o.choices) ? (o.choices as McqChoice[]) : null,
    explanation: (o.explanation as string) ?? null,
    stats: Array.isArray(o.stats) ? (o.stats as PatientCaseVignetteStat[]) : null,
    steps: Array.isArray(o.steps) ? (o.steps as ClinicalScenarioStep[]) : null,
  }
}

// Accepts either a bare array or { cards: [...] } / { items: [...] }.
export function parseBulkImportJson(raw: string): BulkCardImportItem[] {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Not valid JSON')
  }
  const list = Array.isArray(data) ? data : Array.isArray((data as Record<string, unknown>)?.cards) ? (data as { cards: unknown[] }).cards : Array.isArray((data as Record<string, unknown>)?.items) ? (data as { items: unknown[] }).items : null
  if (!list) throw new Error('Expected a JSON array, or { "cards": [...] }')
  return list.map((row, i) => toItem(row, i))
}

// Minimal RFC4180-ish line parser (quoted fields, "" escapes a literal
// quote) -- CSV only covers the flat kinds (basic/cloze/table_cell);
// mcq/patient_case/clinical_scenario need JSON for their nested fields.
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

export function parseBulkImportCsv(raw: string): BulkCardImportItem[] {
  const lines = raw.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('CSV needs a header row and at least one data row')
  const header = parseCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line, i) => {
    const cells = parseCsvLine(line)
    const row: Record<string, unknown> = {}
    header.forEach((h, c) => (row[h] = cells[c] ?? ''))
    if (row.kind && !['basic', 'cloze', 'table_cell'].includes(String(row.kind))) {
      throw new Error(`Row ${i + 2}: CSV only supports basic/cloze/table_cell -- use JSON for mcq/patient_case/clinical_scenario`)
    }
    if (typeof row.tags === 'string') row.tags = row.tags.split(';').map((t) => t.trim()).filter(Boolean)
    if (typeof row.high_yield === 'string') row.high_yield = /^(true|1|yes)$/i.test(row.high_yield)
    return toItem(row, i)
  })
}

export function validateBulkImportItems(items: BulkCardImportItem[]): BulkImportError[] {
  const errors: BulkImportError[] = []
  items.forEach((item, i) => {
    if (!item.front.trim()) errors.push({ index: i, message: 'front is required' })
    if (item.kind === 'mcq') {
      if (!item.choices || item.choices.length < 2) errors.push({ index: i, message: 'mcq needs at least 2 choices' })
      else if (item.choices.filter((c) => c.correct).length !== 1)
        errors.push({ index: i, message: 'mcq needs exactly one correct choice' })
    } else if (item.kind === 'clinical_scenario') {
      if (!item.steps || item.steps.length === 0) errors.push({ index: i, message: 'clinical_scenario needs at least 1 step' })
      else if (item.steps.some((s) => !s.question?.trim() || !s.answer?.trim()))
        errors.push({ index: i, message: 'every scenario step needs a question and an answer' })
    } else if (item.kind === 'patient_case') {
      if (!item.stats || item.stats.length === 0) errors.push({ index: i, message: 'patient_case needs at least 1 stat' })
    } else if (!item.back.trim()) {
      errors.push({ index: i, message: 'back is required for this card kind' })
    }
  })
  return errors
}
