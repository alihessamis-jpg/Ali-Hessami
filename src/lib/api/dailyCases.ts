// Daily Case Challenge — daily_cases / case_attempts / case_images tables and
// the `generate-daily-case` edge function (generation, stage feedback, case chat).
import { supabase } from '../supabaseClient'
import { getAuthUser } from './authUser'
import { IMAGING_BUCKET } from '../storage'
import type {
  CaseAttempt,
  CaseDifficulty,
  CaseJson,
  CaseSource,
  CaseTopic,
  DailyCase,
  SelfCheckReport,
  StageFeedback,
  StageResponse,
} from '../../types/dailyCase'

const FN = 'generate-daily-case'

interface CaseRow {
  id: string
  case_date: string
  kind: 'daily' | 'manual'
  topic_id: string | null
  difficulty: CaseDifficulty
  status: DailyCase['status']
  error: string | null
  title: string
  case_json: CaseJson | Record<string, never> | null
  sources: Record<string, CaseSource> | null
  self_check: SelfCheckReport | null
  created_at: string
  case_topics?: { name: string; category: string } | null
}

function caseToDomain(r: CaseRow): DailyCase {
  const cj = r.case_json && 'stages' in r.case_json ? (r.case_json as CaseJson) : null
  return {
    id: r.id,
    caseDate: r.case_date,
    kind: r.kind,
    topicId: r.topic_id,
    topicName: r.case_topics?.name ?? null,
    topicCategory: r.case_topics?.category ?? null,
    difficulty: r.difficulty,
    status: r.status,
    error: r.error,
    title: r.title,
    caseJson: cj,
    sources: r.sources ?? {},
    selfCheck: r.self_check,
    createdAt: r.created_at,
  }
}

interface AttemptRow {
  id: string
  case_id: string
  stage_index: number
  stage_responses: StageResponse[]
  hints_used: number
  score: number | null
  started_at: string
  completed_at: string | null
  time_spent: number
  review_item_id: string | null
}

function attemptToDomain(r: AttemptRow): CaseAttempt {
  return {
    id: r.id,
    caseId: r.case_id,
    stageIndex: r.stage_index,
    stageResponses: r.stage_responses ?? [],
    hintsUsed: r.hints_used,
    score: r.score,
    startedAt: r.started_at,
    completedAt: r.completed_at,
    timeSpent: r.time_spent,
    reviewItemId: r.review_item_id,
  }
}

const LIST_COLS = 'id, case_date, kind, topic_id, difficulty, status, error, title, created_at, case_topics(name, category)'

/** Archive list — without the (large) case_json / sources columns. */
export async function listDailyCases(): Promise<DailyCase[]> {
  const { data, error } = await supabase
    .from('daily_cases')
    .select(`${LIST_COLS}, final_diagnosis:case_json->>final_diagnosis`)
    .order('case_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as (CaseRow & { final_diagnosis: string | null })[]).map((r) => {
    const d = caseToDomain({ ...r, case_json: null, sources: null, self_check: null })
    return { ...d, finalDiagnosis: r.final_diagnosis } as DailyCase & { finalDiagnosis: string | null }
  })
}

export async function getDailyCase(id: string): Promise<DailyCase | null> {
  const { data, error } = await supabase.from('daily_cases').select(`*, case_topics(name, category)`).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? caseToDomain(data as CaseRow) : null
}

export async function getCaseForDate(date: string): Promise<DailyCase | null> {
  const { data, error } = await supabase
    .from('daily_cases')
    .select(LIST_COLS)
    .eq('kind', 'daily')
    .eq('case_date', date)
    .maybeSingle()
  if (error) throw error
  return data ? caseToDomain({ ...(data as unknown as CaseRow), case_json: null, sources: null, self_check: null }) : null
}

export async function listCaseTopics(): Promise<CaseTopic[]> {
  const { data, error } = await supabase.from('case_topics').select('id, slug, name, category, last_used_at').order('category').order('name')
  if (error) throw error
  return (data ?? []).map((t) => ({ id: t.id, slug: t.slug, name: t.name, category: t.category, lastUsedAt: t.last_used_at }))
}

// ---------------------------------------------------------------- edge function
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body })
  if (error) {
    // surface the function's own JSON error message when there is one
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json().catch(() => null)
      if (j?.error) throw new Error(j.error)
    }
    throw error
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

/** Starts generation (runs in the background on the server). kind 'daily' is idempotent per Tehran day. */
export function requestCase(kind: 'daily' | 'manual', topicSlug?: string) {
  return invoke<{ caseId: string; status: DailyCase['status'] }>({ action: 'generate', kind, topicSlug })
}

export function gradeStage(caseId: string, stageIndex: number, answer: string, choice: number | null) {
  return invoke<StageFeedback>({ action: 'feedback', caseId, stageIndex, answer, choice })
}

export function askCase(caseId: string, revealedThrough: number, answeredThrough: number, question: string, history: { role: 'user' | 'assistant'; text: string }[]) {
  return invoke<{ answer: string }>({ action: 'chat', caseId, revealedThrough, answeredThrough, question, history })
}

/** Polls a generating case until it is ready/failed (or the timeout passes). */
export async function waitForCase(id: string, onTick?: (c: DailyCase) => void, timeoutMs = 6 * 60_000): Promise<DailyCase> {
  const until = Date.now() + timeoutMs
  for (;;) {
    const c = await getDailyCase(id)
    if (!c) throw new Error('case disappeared')
    onTick?.(c)
    if (c.status !== 'generating') return c
    if (Date.now() > until) throw new Error('ساخت کیس بیش از حد طول کشید؛ کمی بعد صفحه را تازه کنید.')
    await new Promise((r) => setTimeout(r, 5000))
  }
}

// ---------------------------------------------------------------- attempts
export async function listCaseAttempts(caseId?: string): Promise<CaseAttempt[]> {
  let q = supabase.from('case_attempts').select('*').order('started_at', { ascending: true })
  if (caseId) q = q.eq('case_id', caseId)
  const { data, error } = await q
  if (error) throw error
  return (data as AttemptRow[]).map(attemptToDomain)
}

export async function startAttempt(caseId: string): Promise<CaseAttempt> {
  const {
    data: { user },
  } = await getAuthUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('case_attempts').insert({ case_id: caseId, user_id: user.id }).select().single()
  if (error) throw error
  return attemptToDomain(data as AttemptRow)
}

export async function saveAttempt(
  id: string,
  patch: Partial<Pick<CaseAttempt, 'stageIndex' | 'stageResponses' | 'hintsUsed' | 'score' | 'completedAt' | 'timeSpent' | 'reviewItemId'>>,
): Promise<CaseAttempt> {
  const row: Record<string, unknown> = {}
  if (patch.stageIndex !== undefined) row.stage_index = patch.stageIndex
  if (patch.stageResponses !== undefined) row.stage_responses = patch.stageResponses
  if (patch.hintsUsed !== undefined) row.hints_used = patch.hintsUsed
  if (patch.score !== undefined) row.score = patch.score
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt
  if (patch.timeSpent !== undefined) row.time_spent = patch.timeSpent
  if (patch.reviewItemId !== undefined) row.review_item_id = patch.reviewItemId
  const { data, error } = await supabase.from('case_attempts').update(row).eq('id', id).select().single()
  if (error) throw error
  return attemptToDomain(data as AttemptRow)
}

// ---------------------------------------------------------------- user images
export interface CaseImage {
  id: string
  stageKey: string | null
  storagePath: string
  caption: string | null
}

export async function listCaseImages(caseId: string): Promise<CaseImage[]> {
  const { data, error } = await supabase.from('case_images').select('*').eq('case_id', caseId).order('created_at')
  if (error) throw error
  return (data ?? []).map((r) => ({ id: r.id, stageKey: r.stage_key, storagePath: r.storage_path, caption: r.caption }))
}

/** Uploads a real (de-identified) image into the private imaging bucket under {userId}/daily-cases/. */
export async function uploadCaseImage(caseId: string, stageKey: string | null, file: File, caption: string): Promise<CaseImage> {
  const {
    data: { user },
  } = await getAuthUser()
  if (!user) throw new Error('Not authenticated')
  const ext = file.name.split('.').pop()
  const path = `${user.id}/daily-cases/${caseId}/${Date.now()}${ext ? `.${ext}` : ''}`
  const { error: upErr } = await supabase.storage.from(IMAGING_BUCKET).upload(path, file)
  if (upErr) throw upErr
  const { data, error } = await supabase
    .from('case_images')
    .insert({ owner_id: user.id, case_id: caseId, stage_key: stageKey, storage_path: path, caption: caption || null })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, stageKey: data.stage_key, storagePath: data.storage_path, caption: data.caption }
}

export async function deleteCaseImage(img: CaseImage): Promise<void> {
  await supabase.storage.from(IMAGING_BUCKET).remove([img.storagePath])
  const { error } = await supabase.from('case_images').delete().eq('id', img.id)
  if (error) throw error
}
