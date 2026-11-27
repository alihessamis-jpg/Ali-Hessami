// JSON schema + validator for one Daily Case. Mirrors src/types/dailyCase.ts
// (keep the two in sync).

export const STAGE_KEYS = ['presentation', 'exam', 'labs', 'imaging', 'workup', 'diagnosis', 'management'] as const
export type StageKey = (typeof STAGE_KEYS)[number]

export interface CaseLab {
  panel: string
  test: string
  value: string
  unit: string
  ref_range: string
  flag: 'H' | 'L' | 'N' | 'C'
}

export interface CaseQuestion {
  type: 'free' | 'mcq'
  prompt: string
  options: string[]
  correct_option: number
  model_answer: string
  rubric: string[]
  hints: string[]
}

export interface CaseStage {
  key: StageKey
  title: string
  content: string
  labs: CaseLab[]
  figure_ids: string[]
  question: CaseQuestion
  pearl: string
}

export interface CaseDose {
  drug: string
  indication: string
  source_dose: string
  calculation: string
  max_dose: string
  renal_adjustment: string
  source_ids: string[]
}

export interface CaseJson {
  title: string
  patient: { age: string; sex: 'male' | 'female'; weight_kg: number; height_cm: number }
  stages: CaseStage[]
  final_diagnosis: string
  summary: string
  learning_points: string[]
  mnemonic: { text: string; explanation: string }
  doses: CaseDose[]
  not_found: string[]
}

const str = { type: 'string' }
const strArr = { type: 'array', items: str }

export const CASE_SCHEMA = {
  type: 'object',
  required: ['title', 'patient', 'stages', 'final_diagnosis', 'summary', 'learning_points', 'mnemonic', 'doses', 'not_found'],
  properties: {
    title: str,
    patient: {
      type: 'object',
      required: ['age', 'sex', 'weight_kg', 'height_cm'],
      properties: { age: str, sex: { type: 'string', enum: ['male', 'female'] }, weight_kg: { type: 'number' }, height_cm: { type: 'number' } },
    },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'title', 'content', 'labs', 'figure_ids', 'question', 'pearl'],
        properties: {
          key: { type: 'string', enum: [...STAGE_KEYS] },
          title: str,
          content: str,
          labs: {
            type: 'array',
            items: {
              type: 'object',
              required: ['panel', 'test', 'value', 'unit', 'ref_range', 'flag'],
              properties: { panel: str, test: str, value: str, unit: str, ref_range: str, flag: { type: 'string', enum: ['H', 'L', 'N', 'C'] } },
            },
          },
          figure_ids: strArr,
          question: {
            type: 'object',
            required: ['type', 'prompt', 'options', 'correct_option', 'model_answer', 'rubric', 'hints'],
            properties: {
              type: { type: 'string', enum: ['free', 'mcq'] },
              prompt: str,
              options: strArr,
              correct_option: { type: 'integer' },
              model_answer: str,
              rubric: strArr,
              hints: strArr,
            },
          },
          pearl: str,
        },
      },
    },
    final_diagnosis: str,
    summary: str,
    learning_points: strArr,
    mnemonic: { type: 'object', required: ['text', 'explanation'], properties: { text: str, explanation: str } },
    doses: {
      type: 'array',
      items: {
        type: 'object',
        required: ['drug', 'indication', 'source_dose', 'calculation', 'max_dose', 'renal_adjustment', 'source_ids'],
        properties: { drug: str, indication: str, source_dose: str, calculation: str, max_dose: str, renal_adjustment: str, source_ids: strArr },
      },
    },
    not_found: strArr,
  },
} as const

export const SELF_CHECK_SCHEMA = {
  type: 'object',
  required: ['consistent', 'issues'],
  properties: {
    consistent: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'location', 'problem', 'fix'],
        properties: { severity: { type: 'string', enum: ['major', 'minor'] }, location: str, problem: str, fix: str },
      },
    },
  },
} as const

export interface SelfCheck {
  consistent: boolean
  issues: { severity: 'major' | 'minor'; location: string; problem: string; fix: string }[]
}

export const FEEDBACK_SCHEMA = {
  type: 'object',
  required: ['score', 'correct', 'missed', 'comment'],
  properties: { score: { type: 'integer' }, correct: strArr, missed: strArr, comment: str },
} as const

export const NOT_FOUND_FA = 'در منابع Nephron یافت نشد'
const CITE_RE = /\[(S\d+(?:\s*[,،]\s*S\d+)*)\]/g

export function citedIds(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(CITE_RE)) out.push(...m[1].split(/[,،]/).map((x) => x.trim()))
  return out
}

const hasCiteOrNotFound = (s: string) => citedIds(s).length > 0 || s.includes('یافت نشد')

/** Returns a list of problems (empty = valid). Also normalises small things in place. */
export function validateCase(c: CaseJson, sourceIds: Set<string>, figureIds: Set<string>): string[] {
  const errs: string[] = []
  if (!c || typeof c !== 'object') return ['output is not an object']
  if (!c.title?.trim()) errs.push('title is empty')
  if (!c.final_diagnosis?.trim()) errs.push('final_diagnosis is empty')
  else if (c.title && c.title.toLowerCase().includes(c.final_diagnosis.toLowerCase().trim())) errs.push('title reveals the final diagnosis; rewrite the title')
  if (!c.patient || !(c.patient.weight_kg > 0) || !(c.patient.height_cm > 0)) errs.push('patient.weight_kg and patient.height_cm must be positive numbers')
  if (!Array.isArray(c.stages) || c.stages.length !== STAGE_KEYS.length) {
    errs.push(`stages must have exactly ${STAGE_KEYS.length} items in this order: ${STAGE_KEYS.join(', ')}`)
  } else {
    c.stages.forEach((s, i) => {
      const where = `stages[${i}] (${s?.key})`
      if (s.key !== STAGE_KEYS[i]) errs.push(`${where}: key must be "${STAGE_KEYS[i]}"`)
      if (!s.content?.trim()) errs.push(`${where}: content is empty`)
      if (!Array.isArray(s.labs)) s.labs = []
      if (!Array.isArray(s.figure_ids)) s.figure_ids = []
      s.figure_ids = s.figure_ids.filter((f) => {
        if (figureIds.has(f)) return true
        errs.push(`${where}: unknown figure id ${f} (use only ids from FIGURES)`)
        return false
      })
      if (s.key === 'labs' && s.labs.length < 6) errs.push(`${where}: give the initial labs as a labs[] table (at least 6 rows)`)
      const q = s.question
      if (!q?.prompt?.trim()) errs.push(`${where}: question.prompt is empty`)
      else {
        if (!q.model_answer?.trim()) errs.push(`${where}: question.model_answer is empty`)
        else if (!hasCiteOrNotFound(q.model_answer)) errs.push(`${where}: question.model_answer has no [S#] citation`)
        if (!Array.isArray(q.rubric) || q.rubric.length < 2) errs.push(`${where}: question.rubric needs at least 2 key points`)
        if (!Array.isArray(q.hints) || q.hints.length < 1) errs.push(`${where}: question.hints needs at least 1 hint`)
        if (q.type === 'mcq') {
          if (!Array.isArray(q.options) || q.options.length < 4) errs.push(`${where}: mcq needs at least 4 options`)
          else if (!(q.correct_option >= 0 && q.correct_option < q.options.length)) errs.push(`${where}: correct_option out of range`)
        } else {
          q.options = []
          q.correct_option = -1
        }
      }
      if (!s.pearl?.trim() || !hasCiteOrNotFound(s.pearl)) errs.push(`${where}: pearl must exist and carry an [S#] citation`)
    })
    const mgmt = c.stages[6]
    if (mgmt && !/\d/.test(mgmt.question?.model_answer ?? '')) errs.push('management model_answer must give concrete doses (numbers) or state that a dose was not found in the sources')
  }
  if (!Array.isArray(c.learning_points) || c.learning_points.length < 3) errs.push('learning_points needs at least 3 items')
  else c.learning_points.forEach((p, i) => !hasCiteOrNotFound(p) && errs.push(`learning_points[${i}] has no [S#] citation`))
  if (!c.mnemonic) c.mnemonic = { text: '', explanation: '' }
  if (!Array.isArray(c.doses)) c.doses = []
  if (!Array.isArray(c.not_found)) c.not_found = []

  // every citation must point at a real source
  const all = JSON.stringify(c)
  const bad = [...new Set(citedIds(all).filter((id) => !sourceIds.has(id)))]
  if (bad.length) errs.push(`unknown source ids cited: ${bad.join(', ')} — cite only ids listed under SOURCES`)
  for (const d of c.doses) {
    if (!d.source_ids?.length && !d.source_dose.includes('یافت نشد')) errs.push(`doses: ${d.drug} has no source_ids (or say «${NOT_FOUND_FA}»)`)
    for (const id of d.source_ids ?? []) if (!sourceIds.has(id)) errs.push(`doses: ${d.drug} cites unknown ${id}`)
  }
  return errs
}
