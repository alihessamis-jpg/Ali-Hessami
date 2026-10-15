// Parses/validates/converts a department-exam question-import JSON file
// (see docs/question-import-schema.md) into BoardQuestionDraft rows linked
// to one Academy v2 chapter. Kept separate from lib/api/boardQuestions.ts
// since this is pure parsing/mapping logic with no network calls.
import type { BoardQuestionDraft, BoardQuestionType } from '../types/domain'

export interface QuestionImportFileOption {
  key: string
  text: string
}

export interface QuestionImportFileQuestion {
  number: number
  type: 'mcq' | 'true_false' | 'essay'
  stem: string
  options?: QuestionImportFileOption[]
  correct?: string | boolean
  explanation?: string | null
  model_answer?: string | null
  answer_verified?: boolean
  note?: string | null
}

export interface QuestionImportFile {
  chapter_number: number
  chapter_title: string
  chapter_title_fa?: string | null
  book?: string | null
  source?: string | null
  source_file?: string | null
  language?: string | null
  questions: QuestionImportFileQuestion[]
}

export interface QuestionImportError {
  number: number | null
  message: string
}

export function parseQuestionImportFile(raw: unknown): QuestionImportFile {
  if (!raw || typeof raw !== 'object') throw new Error('فایل JSON معتبر نیست')
  const obj = raw as Record<string, unknown>
  if (typeof obj.chapter_number !== 'number') throw new Error('فیلد chapter_number وجود ندارد')
  if (!Array.isArray(obj.questions)) throw new Error('فیلد questions (آرایه) وجود ندارد')
  return obj as unknown as QuestionImportFile
}

export function validateQuestionImportFile(file: QuestionImportFile): QuestionImportError[] {
  const errors: QuestionImportError[] = []
  const seenNumbers = new Set<number>()
  for (const q of file.questions) {
    if (seenNumbers.has(q.number)) errors.push({ number: q.number, message: 'شماره سؤال تکراری است' })
    seenNumbers.add(q.number)
    if (!q.stem || !q.stem.trim()) errors.push({ number: q.number, message: 'متن سؤال خالی است' })
    if (q.type === 'mcq') {
      if (!q.options || q.options.length === 0) errors.push({ number: q.number, message: 'سؤال چندگزینه‌ای بدون گزینه' })
      else if (q.correct == null || !q.options.some((o) => o.key === q.correct))
        errors.push({ number: q.number, message: 'کلید پاسخ صحیح با هیچ گزینه‌ای مطابقت ندارد' })
    } else if (q.type === 'true_false') {
      if (typeof q.correct !== 'boolean') errors.push({ number: q.number, message: 'پاسخ درست/نادرست مشخص نشده' })
    } else if (q.type === 'essay') {
      if (!q.model_answer) errors.push({ number: q.number, message: 'پاسخ نمونه (model_answer) برای سؤال تشریحی وجود ندارد' })
    } else {
      errors.push({ number: q.number, message: `نوع سؤال ناشناخته: "${(q as { type?: unknown }).type}"` })
    }
  }
  return errors
}

export function buildImportDrafts(file: QuestionImportFile, chapterId: string): BoardQuestionDraft[] {
  const topic = file.chapter_title_fa || file.chapter_title || `Ch ${file.chapter_number}`
  const sourceFile = file.source_file ?? null
  return file.questions.map((q) => {
    const importKey = `${chapterId}:${sourceFile ?? 'file'}:${q.number}`
    const base = {
      topic,
      chapterId,
      source: file.source ?? null,
      sourceFile,
      sourceDate: null as string | null,
      answerVerified: q.answer_verified ?? true,
      importKey,
      question: q.stem,
      explanation: q.explanation ?? null,
      tags: null as string[] | null,
      difficulty: null as string | null,
      taxonomy: null as number | null,
      allowReuse: null as boolean | null,
      fillAnswers: null as string[] | null,
      matchLeft: null,
      matchRight: null,
      matchAnswer: null,
    }
    if (q.type === 'mcq') {
      const options = (q.options ?? []).map((o) => `${o.key}) ${o.text}`)
      const correctIndex = (q.options ?? []).findIndex((o) => o.key === q.correct)
      return {
        ...base,
        type: 'mcq' as BoardQuestionType,
        options,
        correctIndex: correctIndex >= 0 ? correctIndex : null,
        correctBool: null,
        modelAnswer: null,
      }
    }
    if (q.type === 'true_false') {
      return {
        ...base,
        type: 'true_false' as BoardQuestionType,
        options: [],
        correctIndex: null,
        correctBool: typeof q.correct === 'boolean' ? q.correct : null,
        modelAnswer: null,
      }
    }
    return {
      ...base,
      type: 'essay' as BoardQuestionType,
      options: [],
      correctIndex: null,
      correctBool: null,
      modelAnswer: q.model_answer ?? null,
    }
  })
}
