// Daily Case Challenge — mirrors supabase/functions/generate-daily-case/caseSchema.ts.

export const STAGE_KEYS = ['presentation', 'exam', 'labs', 'imaging', 'workup', 'diagnosis', 'management'] as const
export type StageKey = (typeof STAGE_KEYS)[number]
export type CaseDifficulty = 'moderate' | 'hard' | 'board-killer'

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

export interface CaseSource {
  id: string
  kind: 'lib' | 'guideline' | 'drug' | 'figure'
  label: string
  book: string
  heading: string
  chapterId: string | null
  anchor: string | null
  pages: string
  excerpt: string
  storagePath?: string
  caption?: string
}

export interface SelfCheckReport {
  consistent: boolean
  issues: { severity: 'major' | 'minor'; location: string; problem: string; fix: string }[]
  repaired?: boolean
  skipped?: string
}

export interface DailyCase {
  id: string
  caseDate: string
  kind: 'daily' | 'manual'
  topicId: string | null
  topicName: string | null
  topicCategory: string | null
  difficulty: CaseDifficulty
  status: 'generating' | 'ready' | 'failed'
  error: string | null
  title: string
  caseJson: CaseJson | null
  sources: Record<string, CaseSource>
  selfCheck: SelfCheckReport | null
  createdAt: string
}

export interface StageFeedback {
  score: number // 0–10
  correct: string[]
  missed: string[]
  comment: string
  gradedBy: 'ai' | 'fallback' | 'key'
}

export interface StageResponse {
  stage: StageKey
  answer: string
  choice: number | null
  skipped: boolean
  hints: number
  feedback: StageFeedback | null
  answeredAt: string
}

export interface CaseAttempt {
  id: string
  caseId: string
  stageIndex: number
  stageResponses: StageResponse[]
  hintsUsed: number
  score: number | null
  startedAt: string
  completedAt: string | null
  timeSpent: number
  reviewItemId: string | null
}

export interface CaseTopic {
  id: string
  slug: string
  name: string
  category: string
  lastUsedAt: string | null
}
