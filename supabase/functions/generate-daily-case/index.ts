// generate-daily-case — Daily Case Challenge (Today → «کیس روز»).
//
// Builds one board-level pediatric nephrology case per day from the user's
// OWN library (library_chunks of Pediatric Nephrology 8e, Fogo atlas, Rose,
// Nelson, Handbook of Kidney Transplantation, KDIGO / AAP guidelines) plus
// Harriet Lane drug monographs (drug_reference), with [S#] citations that
// map to real passages and pages. Atlas/chapter figures are linked, never
// generated.
//
// POST JSON
//   { action: 'cron' }                                   x-case-secret only: today's case for every user with a library
//   { action: 'generate', kind?: 'daily'|'manual', topicSlug? }  -> { caseId, status }   (runs in the background)
//   { action: 'feedback', caseId, stageIndex, answer, choice? } -> { score 0–10, correct[], missed[], comment, gradedBy }
//   { action: 'chat', caseId, revealedThrough, question, history? } -> { answer }
//   { action: 'step', caseId, ownerId }                    x-case-secret only: run the next pipeline phase (internal)
//
// Auth: a user JWT (Authorization: Bearer …), or the shared secret header
// x-case-secret == Vault secret 'daily_case_secret', checked by
// check_daily_case_secret() (cron; body.ownerId selects the user for
// non-cron actions). Deployed with verify_jwt = false because the cron call
// carries no JWT; the JWT is verified here instead. All queries run with the
// service role and an explicit owner filter.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'
import { callJson, callText, LlmError, PROVIDER } from './llm.ts'
import {
  CASE_SCHEMA,
  FEEDBACK_SCHEMA,
  NOT_FOUND_FA,
  SELF_CHECK_SCHEMA,
  STAGE_KEYS,
  type CaseJson,
  type SelfCheck,
  validateCase,
  citedIds,
} from './caseSchema.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// Per-invocation model budget: the edge wall-clock limit is 150 s on the free
// plan (400 s on paid; raise DAILY_CASE_PHASE_MS there).
const PHASE_BUDGET_MS = Number(Deno.env.get('DAILY_CASE_PHASE_MS') ?? 138_000)
// A 'generating' row whose phase has not moved for this long was killed.
const STALE_MS = 6 * 60_000

// deno-lint-ignore no-explicit-any
type Any = any

// ------------------------------------------------------------------ http helpers
function cors(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-case-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(), 'Content-Type': 'application/json' } })
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s)

export function tehranDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

// ------------------------------------------------------------------ sources
interface SourceEntry {
  id: string
  kind: 'lib' | 'guideline' | 'drug' | 'figure'
  label: string
  book: string
  heading: string
  chapterId: string | null
  anchor: string | null
  pages: string
  text: string
  storagePath?: string
  caption?: string
}

const stripHeading = (h: string | null | undefined) =>
  String(h ?? '').replace(/\{#[^}]*\}/g, '').replace(/^#+\s*/, '').trim()

function pagesOf(from: number | null, to: number | null, text: string): string {
  const marks = [...text.matchAll(/\{p\.(\d+)\}/g)].map((m) => Number(m[1]))
  const lo = marks.length ? Math.min(...marks) : from
  const hi = marks.length ? Math.max(...marks) : to
  if (lo == null && hi == null) return ''
  return lo != null && hi != null && hi !== lo ? `pp. ${lo}–${hi}` : `p. ${lo ?? hi}`
}

interface Topic {
  id: string
  slug: string
  name: string
  category: string
  search_terms: string[]
  drugs: string[]
  last_used_at: string | null
}

async function retrieve(db: SupabaseClient, owner: string, topic: Topic) {
  const sources: SourceEntry[] = []
  const seen = new Set<string>()
  let n = 0
  const nextId = () => `S${++n}`

  const { data: guidelineBooks } = await db.from('library_books').select('slug').eq('owner_id', owner).eq('kind', 'guideline')
  const guidelineSlugs = (guidelineBooks ?? []).map((b: Any) => b.slug).filter(Boolean)

  // Short queries work far better than long AND-queries on library_chunks.
  const queries: { q: string; books: string[] | null; k: number }[] = []
  for (const t of topic.search_terms) queries.push({ q: t, books: null, k: 5 })
  for (const t of topic.search_terms.slice(0, 2)) if (guidelineSlugs.length) queries.push({ q: t, books: guidelineSlugs, k: 3 })
  queries.push({ q: topic.search_terms[0], books: ['renal-pathology-atlas'], k: 2 })

  const results = await Promise.all(
    queries.map(async (qq) => {
      const { data, error } = await db.rpc('case_search_library', { q: qq.q, p_owner: owner, p_books: qq.books, k: qq.k })
      if (error) console.error('[daily-case] search', qq.q, error.message)
      let rows = (data ?? []) as Any[]
      // fall back to the first two words when a multi-word term finds nothing
      if (!rows.length && qq.q.split(/\s+/).length > 2) {
        const { data: d2 } = await db.rpc('case_search_library', { q: qq.q.split(/\s+/).slice(0, 2).join(' '), p_owner: owner, p_books: qq.books, k: qq.k })
        rows = (d2 ?? []) as Any[]
      }
      return rows
    }),
  )
  // round-robin over queries so every term contributes
  const MAX_CHUNKS = 18
  const chapterIds = new Set<string>()
  for (let r = 0; sources.length < MAX_CHUNKS && results.some((rs) => rs.length > r); r++) {
    for (const rs of results) {
      const row = rs[r]
      if (!row || sources.length >= MAX_CHUNKS) continue
      const key = `${row.chapter_id}|${row.part_number ?? 0}|${row.section_idx}`
      if (seen.has(row.chunk_id) || seen.has(key)) continue
      seen.add(row.chunk_id)
      seen.add(key)
      chapterIds.add(row.chapter_id)
      const content = String(row.content)
      const pages = pagesOf(row.page_from, row.page_to, content)
      const heading = stripHeading(row.heading)
      const isGuideline = row.book_kind === 'guideline'
      sources.push({
        id: nextId(),
        kind: isGuideline ? 'guideline' : 'lib',
        book: row.book_title,
        label: `${row.book_title} · ${isGuideline ? '' : `Ch. ${row.chapter_number} — `}${row.chapter_title}${pages ? ` · ${pages}` : ''}`,
        heading,
        chapterId: row.chapter_id,
        anchor: row.anchor,
        pages,
        text: content.replace(/\{p\.(\d+)\}/g, '[p.$1]').slice(0, 1800),
      })
    }
  }

  // Harriet Lane monographs for the management stage
  const missingDrugs: string[] = []
  for (const drug of topic.drugs) {
    const { data } = await db
      .from('drug_reference')
      .select('id, medication, source, source_chapter, source_pages, monograph, pediatric_dose, max_dose, adjusted_dose, renal_notes')
      .eq('owner_id', owner)
      .or(`medication.ilike.%${drug.replace(/[,()]/g, ' ')}%,trade_names.ilike.%${drug.replace(/[,()]/g, ' ')}%`)
      .limit(1)
    const r = (data ?? [])[0] as Any
    if (!r) {
      missingDrugs.push(drug)
      continue
    }
    const mono = String(r.monograph ?? r.pediatric_dose ?? '').replace(/\{p\.(\d+)\}/g, '[p.$1]')
    const text = [
      mono.slice(0, 2600),
      r.max_dose ? `Max dose: ${r.max_dose}` : '',
      r.adjusted_dose ? `KIDNEY FAILURE (Ch. 31): ${String(r.adjusted_dose).slice(0, 900)}` : '',
      r.renal_notes ? `Renal remarks: ${String(r.renal_notes).slice(0, 500)}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    sources.push({
      id: nextId(),
      kind: 'drug',
      book: r.source ?? 'Harriet Lane Handbook 23e',
      label: `Harriet Lane Handbook 23e · ${r.medication} · ${r.source_chapter ?? 'Ch. 30'}${r.source_pages ? ` · ${r.source_pages}` : ''}`,
      heading: r.medication,
      chapterId: null,
      anchor: null,
      pages: r.source_pages ?? '',
      text,
    })
  }

  // Figures: atlas (Fogo & Kashgarian) + figures of the retrieved chapters
  const { data: atlasChapters } = await db
    .from('library_chapters')
    .select('id, library_books!inner(slug)')
    .eq('owner_id', owner)
    .eq('library_books.slug', 'renal-pathology-atlas')
  const figChapterIds = [...new Set([...((atlasChapters ?? []) as Any[]).map((c) => c.id as string), ...chapterIds])]
  const { data: figRows } = figChapterIds.length
    ? await db
        .from('library_chapter_figures')
        .select('figure_key, storage_path, caption, chapter_id, library_chapters(chapter_number, title, library_books(title))')
        .eq('owner_id', owner)
        .in('chapter_id', figChapterIds)
        .limit(150)
    : { data: [] }
  const figures: SourceEntry[] = ((figRows ?? []) as Any[])
    .filter((f) => /شکل|fig/i.test(String(f.caption ?? f.figure_key)))
    .slice(0, 60)
    .map((f, i) => ({
      id: `F${i + 1}`,
      kind: 'figure' as const,
      book: f.library_chapters?.library_books?.title ?? '',
      label: `${f.library_chapters?.library_books?.title ?? ''} · Ch. ${f.library_chapters?.chapter_number} — ${f.library_chapters?.title} · ${f.caption ?? f.figure_key}`,
      heading: f.caption ?? f.figure_key,
      chapterId: f.chapter_id,
      anchor: f.figure_key,
      pages: '',
      text: '',
      storagePath: f.storage_path,
      caption: f.caption ?? f.figure_key,
    }))

  return { sources, figures, missingDrugs }
}

// ------------------------------------------------------------------ prompts
const DIFFICULTY_TEXT: Record<string, string> = {
  moderate: 'MODERATE: a classic presentation with one or two subtle features; a well-prepared fellow should get it.',
  hard: 'HARD: an atypical presentation or an important mimic in the differential; requires integrating labs, imaging and pathology.',
  'board-killer':
    'BOARD-KILLER: a rare variant, a superimposed second problem, or a misleading early finding; the key clue is easy to overlook. Still 100% supported by the sources.',
}

const GEN_SYSTEM = `You write board-exam (pediatric nephrology subspecialty board) clinical cases for a pediatric nephrology fellow in Iran.

GROUNDING — the most important rule
- Every medical fact, criterion, threshold, interpretation and drug dose in model answers, pearls, learning points and summary must come from the numbered SOURCES given to you, and must carry their ids in square brackets, e.g. [S3] or [S2, S7]. A citation may only follow a statement that the cited passage itself supports.
- If something a fellow should know is not in the SOURCES, write «${NOT_FOUND_FA}» for that point instead of filling it in from memory, and list it in not_found.
- DOSES: only from the Harriet Lane sources (or a textbook/guideline source that states the dose). Compute the dose for THIS patient's weight (and BSA if dosed per m²: Mosteller √(height×weight/3600)) and eGFR (bedside Schwartz 0.413 × height(cm) / SCr(mg/dL)), show the arithmetic, respect the max dose and the Chapter 31 renal adjustment when it applies. Put each dose also in doses[]. A drug listed under MISSING DRUGS has no monograph: say «دوز ${NOT_FOUND_FA}» for it unless a textbook source states it.
- IMAGES: never describe an image as if it were shown. Imaging is written as a radiology report in text. For pathology you may attach figures ONLY by their F# ids from FIGURES (figure_ids), and only when the figure shows THIS disease or the exact finding described (a figure of a different disease is worse than none; leave figure_ids empty if nothing matches).

CASE DESIGN
- A realistic, internally consistent child (or neonate/adolescent) case. Labs must fit the final diagnosis and each other (anion gap, osmolality, FENa/TTKG etc. must compute correctly from the given numbers). Use SI or conventional units as Iranian hospitals do (Cr mg/dL, BUN mg/dL, Na/K mEq/L).
- Exactly 7 stages in this order: presentation, exam, labs, imaging, workup, diagnosis, management.
  presentation: age, sex, chief complaint, HPI, past/family/drug history.
  exam: vital signs with the BP and its percentile for age/sex/height, growth (weight/height with percentile), full focused exam.
  labs: content = 1–2 sentences; labs[] = the full initial table: U/A with microscopy, CBC, BUN/Cr, electrolytes, VBG/ABG, and urine indices (FENa, TTKG, UACR/UPCR, urine Ca/Cr, urine anion gap …) when relevant. ref_range must be age-appropriate; flag H/L/N, C = critical.
  imaging: text reports (US / VCUG / DMSA / MAG3 / CT / MRI as relevant), with measurements.
  workup: serology, complement, genetics, and kidney biopsy with LM / IF / EM findings when relevant (attach matching F# figures).
  diagnosis: content = a short synthesis of the decisive data WITHOUT naming the diagnosis; the question asks for the diagnosis (and its subtype/mechanism).
  management: content = the current weight, height, SCr and eGFR the plan must be based on; the question asks for acute and long-term management with exact doses and follow-up.
- Each stage's question is answered BEFORE the next stage opens, so a stage's content must never give away the answer to its own question, and earlier stages must never reveal later findings or the diagnosis. Before the diagnosis stage, questions ask for a ranked differential, the next test or an interpretation — never "what is the diagnosis", and no mcq option before the diagnosis stage may name the final diagnosis or its specific subtype. Good questions: ranked differential diagnosis, the single most useful next test, interpretation of a finding (e.g. compute the anion gap and say what it means), mechanism.
- Use mcq (4–5 options, one best answer, plausible distractors) for 2–3 of the 7 stages; the rest free text. model_answer explains WHY (for mcq: why the right one is right and the main distractor is wrong), with citations. rubric = 2–6 short key points a full answer must contain (used for grading). hints = 1–2 graded hints that narrow the thinking without giving the answer.
- pearl = one high-yield board pearl tied to the stage, with citation.
- title: a short Persian title that does NOT reveal the diagnosis (e.g. «شیرخوار ۴ ماهه با polyuria و عدم وزن‌گیری»).
- summary: 4–6 sentences; learning_points: 4–7 bullets, each cited; mnemonic: a short memorable mnemonic only if it fits naturally (else empty strings).

LANGUAGE: Persian (Farsi) prose; keep medical terms, drug names, lab names, units and numbers in English/Latin script. Markdown allowed in content/model_answer (bold, bullet lists, short tables). No LaTeX.`

function genPrompt(args: {
  topic: Topic
  difficulty: string
  patientSeed: string
  avoid: string[]
  sources: SourceEntry[]
  figures: SourceEntry[]
  missingDrugs: string[]
}): string {
  const src = args.sources.map((s) => `[${s.id}] ${s.label}${s.heading ? ` — ${s.heading}` : ''}\n${s.text}`).join('\n\n-----\n\n')
  const figs = args.figures.length ? args.figures.map((f) => `[${f.id}] ${f.label}`).join('\n') : '(none)'
  return `TOPIC: ${args.topic.name} (category: ${args.topic.category})
DIFFICULTY: ${DIFFICULTY_TEXT[args.difficulty] ?? args.difficulty}
PATIENT SEED (vary age/sex/setting accordingly): ${args.patientSeed}
${args.avoid.length ? `DO NOT REPEAT these earlier cases of this topic (choose a different presentation, age, variant or twist):\n- ${args.avoid.join('\n- ')}\n` : ''}
MISSING DRUGS (no Harriet Lane monograph in the user's library): ${args.missingDrugs.length ? args.missingDrugs.join(', ') : 'none'}

FIGURES (attach by id only when they match):
${figs}

SOURCES:
${src}`
}

const CHECK_SYSTEM = `You are a meticulous pediatric nephrology board examiner reviewing a generated teaching case for internal consistency and source fidelity before it is published. Be strict but only flag real problems.`

function checkPrompt(c: CaseJson, sources: SourceEntry[], figures: SourceEntry[]): string {
  const src = sources.map((s) => `[${s.id}] ${s.label}\n${s.text}`).join('\n\n-----\n\n')
  const attached = new Set(c.stages.flatMap((s) => s.figure_ids))
  const figs = figures.filter((f) => attached.has(f.id)).map((f) => `[${f.id}] ${f.label}`)
  return `Check this case. Report issues as major (would mislead a learner: wrong lab arithmetic, labs that contradict the diagnosis, a dose or calculation not matching the cited Harriet Lane passage or exceeding its max, eGFR computed wrong, a citation whose passage does not support the statement, a stage that gives away its own answer or a later stage, a question or mcq option before the diagnosis stage that names the final diagnosis, an mcq whose keyed answer is wrong, an attached figure (figure_ids) that does not show this patient's disease/finding — fix: remove it) or minor (wording, small omissions). For each: location (e.g. "stages[2].labs", "doses[1]"), the problem, and the exact fix. consistent = true only if there are no major issues.

CASE JSON:
${JSON.stringify(c)}

ATTACHED FIGURES (library figures, shown to the learner beside the stage):
${figs.length ? figs.join('\n') : '(none)'}

SOURCES:
${src}`
}

// ------------------------------------------------------------------ topic + difficulty
const LEVELS = ['moderate', 'hard', 'board-killer'] as const
const SEEDS = [
  'neonate in the NICU',
  'infant under 1 year',
  'toddler 1–3 years',
  'preschool child 3–6 years',
  'school-age child 6–11 years',
  'adolescent 12–17 years',
]

async function pickTopic(db: SupabaseClient, owner: string, slug?: string): Promise<Topic> {
  const { count } = await db.from('case_topics').select('id', { count: 'exact', head: true }).eq('owner_id', owner)
  if (!count) {
    const { error } = await db.rpc('seed_case_topics', { p_owner: owner })
    if (error) throw new Error(`seed_case_topics: ${error.message}`)
  }
  const { data: topics, error } = await db.from('case_topics').select('*').eq('owner_id', owner).eq('active', true)
  if (error) throw error
  if (!topics?.length) throw new Error('no case topics')
  if (slug) {
    const t = topics.find((x: Any) => x.slug === slug)
    if (t) return t as Topic
  }
  // performance per topic (completed attempts)
  const { data: perf } = await db
    .from('case_attempts')
    .select('score, daily_cases!inner(topic_id, owner_id)')
    .eq('user_id', owner)
    .not('score', 'is', null)
  const byTopic = new Map<string, number[]>()
  for (const p of (perf ?? []) as Any[]) {
    const tid = p.daily_cases?.topic_id
    if (!tid) continue
    if (!byTopic.has(tid)) byTopic.set(tid, [])
    byTopic.get(tid)!.push(p.score)
  }
  const now = Date.now()
  const scored = (topics as Topic[]).map((t) => {
    const days = t.last_used_at ? (now - new Date(t.last_used_at).getTime()) / 86_400_000 : 120
    const s = byTopic.get(t.id)
    const avg = s?.length ? s.reduce((a, b) => a + b, 0) / s.length : null
    // staleness (capped) + weakness; a topic used in the last 10 days is held back
    const priority = Math.min(days, 120) + (avg == null ? 20 : (100 - avg) * 0.6) - (days < 10 ? 200 : 0) + Math.random() * 8
    return { t, priority }
  })
  scored.sort((a, b) => b.priority - a.priority)
  return scored[0].t
}

async function pickDifficulty(db: SupabaseClient, owner: string): Promise<(typeof LEVELS)[number]> {
  const { data: last } = await db
    .from('daily_cases')
    .select('difficulty')
    .eq('owner_id', owner)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
  const current = (last?.[0]?.difficulty as (typeof LEVELS)[number]) ?? 'hard'
  const { data: att } = await db
    .from('case_attempts')
    .select('score')
    .eq('user_id', owner)
    .not('score', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5)
  const scores = (att ?? []).map((a: Any) => a.score as number)
  if (scores.length < 3) return current
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  const i = LEVELS.indexOf(current)
  if (avg >= 85) return LEVELS[Math.min(i + 1, 2)]
  if (avg < 55) return LEVELS[Math.max(i - 1, 0)]
  return current
}

// ------------------------------------------------------------------ generation pipeline
// The edge wall-clock limit (150 s on the free plan) is too short for
// generate + self-check + repair in one invocation, so each phase is its own
// invocation with ONE model call, chained by the function calling itself
// (x-case-secret). Progress lives on the row: phase, phase_at, work (the
// retrieved sources and validator errors; cleared when the case is ready).
//
//   retrieve → generate (≤2 attempts, validated) → check → [repair] → ready
type Phase = 'generate' | 'check' | 'repair'

interface Work {
  topic: Topic
  difficulty: string
  seed: string
  avoid: string[]
  sources: SourceEntry[]
  figures: SourceEntry[]
  missingDrugs: string[]
  attempt: number
  errs: string[]
  draft?: CaseJson
  model?: string
  check?: SelfCheck & { repaired?: boolean; skipped?: string }
}

/** Retrieval (no model call) — then hands over to the 'generate' phase. */
async function prepareCase(db: SupabaseClient, owner: string, caseId: string, topic: Topic, difficulty: string) {
  const { sources, figures, missingDrugs } = await retrieve(db, owner, topic)
  if (sources.filter((s) => s.kind !== 'drug').length < 3) throw new Error(`too few library passages found for ${topic.name}`)
  const { data: prev } = await db
    .from('daily_cases')
    .select('title, case_json->>final_diagnosis')
    .eq('owner_id', owner)
    .eq('topic_id', topic.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(8)
  const work: Work = {
    topic,
    difficulty,
    seed: SEEDS[Math.floor(Math.random() * SEEDS.length)],
    avoid: ((prev ?? []) as Any[]).map((p) => `${p.title} → ${p.final_diagnosis ?? ''}`),
    sources,
    figures,
    missingDrugs,
    attempt: 0,
    errs: [],
  }
  await setPhase(db, caseId, 'generate', work)
  await chain(caseId, owner)
}

async function setPhase(db: SupabaseClient, caseId: string, phase: Phase, work: Work) {
  const { error } = await db.from('daily_cases').update({ phase, phase_at: new Date().toISOString(), work }).eq('id', caseId)
  if (error) throw error
}

/** Starts the next phase in a fresh invocation (returns once it is accepted). */
async function chain(caseId: string, owner: string) {
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: secret } = await db.rpc('get_daily_case_secret')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-daily-case`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-case-secret': String(secret ?? ''), Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    body: JSON.stringify({ action: 'step', caseId, ownerId: owner }),
  })
  if (!res.ok) throw new Error(`could not start next phase (${res.status}): ${(await res.text()).slice(0, 200)}`)
}

/** Runs the row's current phase (one model call) and chains the next one. */
async function runPhase(db: SupabaseClient, owner: string, caseId: string) {
  const started = Date.now()
  const deadline = started + PHASE_BUDGET_MS
  const { data: row } = await db.from('daily_cases').select('status, phase, work').eq('id', caseId).eq('owner_id', owner).maybeSingle()
  if (!row || row.status !== 'generating' || !row.work) return
  const w = row.work as Work
  const phase = row.phase as Phase
  const prompt = genPrompt({ topic: w.topic, difficulty: w.difficulty, patientSeed: w.seed, avoid: w.avoid, sources: w.sources, figures: w.figures, missingDrugs: w.missingDrugs })
  const srcIds = new Set(w.sources.map((s) => s.id))
  const figIds = new Set(w.figures.map((f) => f.id))

  if (phase === 'generate') {
    const p = w.attempt === 0 ? prompt : `${prompt}\n\nYOUR PREVIOUS OUTPUT WAS REJECTED. Fix ALL of these problems and return the complete case again:\n- ${w.errs.join('\n- ')}`
    w.attempt++
    let errs: string[]
    let value: CaseJson | null = null
    try {
      const r = await callJson<CaseJson>(GEN_SYSTEM, p, CASE_SCHEMA, { maxTokens: 20000, deadline, effort: 'medium' })
      w.model = r.model
      value = r.value
      errs = validateCase(r.value, srcIds, figIds)
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e
      errs = ['output was not valid JSON (it was probably cut off — be more concise)']
    }
    console.log('[daily-case] generate attempt', w.attempt, `${Math.round((Date.now() - started) / 1000)}s`, errs.length ? JSON.stringify(errs.slice(0, 10)) : 'valid')
    if (!errs.length && value) {
      w.draft = value
      w.errs = []
      await setPhase(db, caseId, 'check', w)
      return chain(caseId, owner)
    }
    if (w.attempt >= 2) throw new Error(`case failed validation twice: ${errs.slice(0, 6).join(' | ')}`)
    w.errs = errs
    await setPhase(db, caseId, 'generate', w)
    return chain(caseId, owner)
  }

  const c = w.draft!
  if (phase === 'check') {
    try {
      const cited = new Set(citedIds(JSON.stringify(c)))
      for (const d of c.doses) for (const id of d.source_ids ?? []) cited.add(id)
      const r = await callJson<SelfCheck>(CHECK_SYSTEM, checkPrompt(c, w.sources.filter((s) => cited.has(s.id)), w.figures), SELF_CHECK_SCHEMA, {
        maxTokens: 6000,
        deadline,
        effort: 'high',
      })
      w.check = r.value
    } catch (e) {
      console.error('[daily-case] self-check failed', e)
      w.check = { consistent: false, issues: [], skipped: `self-check failed: ${(e as Error).message}` }
    }
    const major = w.check.issues.filter((i) => i.severity === 'major')
    console.log('[daily-case] check', `${Math.round((Date.now() - started) / 1000)}s`, `${major.length} major / ${w.check.issues.length} issues`)
    if (major.length) {
      await setPhase(db, caseId, 'repair', w)
      return chain(caseId, owner)
    }
    return finalize(db, owner, caseId, w, c)
  }

  if (phase === 'repair') {
    const major = (w.check?.issues ?? []).filter((i) => i.severity === 'major')
    const fixPrompt = `${prompt}\n\nHere is a draft case and the examiner's major issues. Return the complete corrected case (same schema), fixing every issue and changing nothing else unnecessarily.\n\nDRAFT:\n${JSON.stringify(c)}\n\nISSUES:\n${major.map((i) => `- ${i.location}: ${i.problem} → ${i.fix}`).join('\n')}`
    let final = c
    try {
      const fixed = await callJson<CaseJson>(GEN_SYSTEM, fixPrompt, CASE_SCHEMA, { maxTokens: 20000, deadline, effort: 'medium' })
      const errs = validateCase(fixed.value, srcIds, figIds)
      if (!errs.length) {
        final = fixed.value
        w.check!.repaired = true
      } else w.check!.skipped = `repair output rejected: ${errs.slice(0, 3).join(' | ')}`
    } catch (e) {
      w.check!.skipped = `repair failed: ${(e as Error).message}`
    }
    return finalize(db, owner, caseId, w, final)
  }
}

async function finalize(db: SupabaseClient, owner: string, caseId: string, w: Work, c: CaseJson) {
  // keep only the sources the case actually cites (+ attached figures)
  const used = new Set(citedIds(JSON.stringify(c)))
  for (const d of c.doses) for (const id of d.source_ids ?? []) used.add(id)
  for (const s of c.stages) for (const f of s.figure_ids) used.add(f)
  const srcMap: Record<string, Omit<SourceEntry, 'text'> & { excerpt: string }> = {}
  for (const s of [...w.sources, ...w.figures]) {
    if (!used.has(s.id)) continue
    const { text, ...rest } = s
    srcMap[s.id] = { ...rest, excerpt: text.slice(0, 600) }
  }
  const { error } = await db
    .from('daily_cases')
    .update({ status: 'ready', error: null, title: c.title, case_json: c, sources: srcMap, self_check: w.check ?? null, model: w.model ?? null, work: null, phase: null })
    .eq('id', caseId)
    .eq('owner_id', owner)
  if (error) throw error
  await db.from('case_topics').update({ last_used_at: new Date().toISOString() }).eq('id', w.topic.id)
  console.log('[daily-case] ready', caseId, w.topic.slug, w.difficulty)
}

async function failCase(db: SupabaseClient, caseId: string, e: unknown) {
  const msg = e instanceof LlmError ? `AI (${e.status}): ${e.message}` : String((e as Error)?.message ?? e)
  console.error('[daily-case] failed', caseId, msg)
  await db.from('daily_cases').update({ status: 'failed', error: msg.slice(0, 1000), work: null }).eq('id', caseId)
}

function background(job: Promise<unknown>) {
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime
  if (rt?.waitUntil) rt.waitUntil(job)
}

/** Creates the placeholder row and starts the pipeline in the background. Returns the row id. */
async function startGeneration(db: SupabaseClient, owner: string, kind: 'daily' | 'manual', slug?: string): Promise<{ caseId: string; status: string }> {
  const date = tehranDate()
  if (kind === 'daily') {
    const { data: existing } = await db.from('daily_cases').select('id, status, phase_at, created_at').eq('owner_id', owner).eq('kind', 'daily').eq('case_date', date).maybeSingle()
    if (existing) {
      const last = new Date(existing.phase_at ?? existing.created_at).getTime()
      const stale = existing.status === 'generating' && Date.now() - last > STALE_MS
      if (existing.status !== 'failed' && !stale) return { caseId: existing.id, status: existing.status }
      await db.from('daily_cases').delete().eq('id', existing.id)
    }
  }
  const topic = await pickTopic(db, owner, slug)
  const difficulty = await pickDifficulty(db, owner)
  const { data: row, error } = await db
    .from('daily_cases')
    .insert({ owner_id: owner, case_date: date, kind, topic_id: topic.id, difficulty, status: 'generating', title: topic.name, phase_at: new Date().toISOString() })
    .select('id')
    .single()
  if (error) {
    // two requests raced for today's daily case — return the winner
    if (kind === 'daily' && error.code === '23505') {
      const { data: w } = await db.from('daily_cases').select('id, status').eq('owner_id', owner).eq('kind', 'daily').eq('case_date', date).single()
      return { caseId: w!.id, status: w!.status }
    }
    throw error
  }
  background(prepareCase(db, owner, row.id, topic, difficulty).catch((e) => failCase(db, row.id, e)))
  return { caseId: row.id, status: 'generating' }
}

// ------------------------------------------------------------------ feedback
const FEEDBACK_SYSTEM = `You grade a pediatric nephrology fellow's answer to one stage of a board-style case. Grade ONLY against the rubric and the model answer given (they are already source-checked); do not add facts of your own. Score 0–10 (10 = every rubric point, clearly reasoned; partial credit for partial points; 0 = blank/wrong). correct = rubric points the answer covered (short, Persian with English terms); missed = rubric points it missed or got wrong; comment = 1–2 encouraging, specific sentences in Persian. Accept synonyms, abbreviations and Persian/English mixtures.`

function rubricFallback(answer: string, rubric: string[]) {
  const a = answer.toLowerCase()
  const correct: string[] = []
  const missed: string[] = []
  for (const r of rubric) {
    const words = (r.toLowerCase().match(/[a-z0-9][a-z0-9\-/+]{2,}/g) ?? []).filter((w) => !['and', 'the', 'with', 'for'].includes(w))
    const hit = words.length ? words.filter((w) => a.includes(w)).length / words.length >= 0.5 : false
    ;(hit ? correct : missed).push(r)
  }
  return { score: rubric.length ? Math.round((10 * correct.length) / rubric.length) : 0, correct, missed }
}

async function handleFeedback(db: SupabaseClient, owner: string, body: Any) {
  if (!isUuid(body.caseId)) return json({ error: 'caseId required' }, 400)
  const i = Number(body.stageIndex)
  const { data: row } = await db.from('daily_cases').select('case_json').eq('id', body.caseId).eq('owner_id', owner).maybeSingle()
  if (!row) return json({ error: 'case not found' }, 404)
  const c = row.case_json as CaseJson
  const stage = c.stages?.[i]
  if (!stage) return json({ error: 'bad stageIndex' }, 400)
  const q = stage.question
  if (q.type === 'mcq') {
    const choice = Number(body.choice)
    const ok = choice === q.correct_option
    return json({
      score: ok ? 10 : 0,
      correct: ok ? [q.options[q.correct_option]] : [],
      missed: ok ? [] : [q.options[q.correct_option]],
      comment: ok ? 'پاسخ درست.' : `پاسخ درست: ${q.options[q.correct_option]}`,
      gradedBy: 'key',
    })
  }
  const answer = String(body.answer ?? '').trim().slice(0, 4000)
  if (!answer) return json({ score: 0, correct: [], missed: q.rubric, comment: 'پاسخی ثبت نشد.', gradedBy: 'key' })
  const context = c.stages
    .slice(0, i + 1)
    .map((s) => `## ${s.title}\n${s.content}${s.labs.length ? '\n' + s.labs.map((l) => `${l.test}: ${l.value} ${l.unit}`).join('; ') : ''}`)
    .join('\n\n')
  try {
    const r = await callJson<{ score: number; correct: string[]; missed: string[]; comment: string }>(
      FEEDBACK_SYSTEM,
      `CASE SO FAR:\n${context}\n\nQUESTION: ${q.prompt}\n\nRUBRIC:\n- ${q.rubric.join('\n- ')}\n\nMODEL ANSWER:\n${q.model_answer}\n\nFELLOW'S ANSWER:\n${answer}`,
      FEEDBACK_SCHEMA,
      { maxTokens: 2000, deadline: Date.now() + 60_000, effort: 'low' },
    )
    const v = r.value
    return json({ score: Math.max(0, Math.min(10, Math.round(v.score))), correct: v.correct ?? [], missed: v.missed ?? [], comment: v.comment ?? '', gradedBy: 'ai' })
  } catch (e) {
    console.error('[daily-case] feedback fallback', e)
    const fb = rubricFallback(answer, q.rubric)
    return json({ ...fb, comment: 'تصحیح خودکار با کلیدواژه‌ها انجام شد (هوش مصنوعی در دسترس نبود).', gradedBy: 'fallback' })
  }
}

// ------------------------------------------------------------------ chat with the case
const CHAT_SYSTEM = `You are the attending presenting a teaching case. The fellow asks about the patient. Answer ONLY from the CASE DATA REVEALED SO FAR below — never invent findings, never use outside knowledge about this patient, never name or hint at the diagnosis, and never give away answers to questions not yet answered. If the requested information is not in the revealed data, say exactly: «در داده‌های فعلی کیس ذکر نشده — شاید در مراحل بعد بیاید.» Keep answers to 1–3 sentences, Persian with English medical terms.`

async function handleChat(db: SupabaseClient, owner: string, body: Any) {
  if (!isUuid(body.caseId)) return json({ error: 'caseId required' }, 400)
  const question = String(body.question ?? '').trim().slice(0, 1000)
  if (!question) return json({ error: 'question required' }, 400)
  const upto = Math.max(0, Math.min(STAGE_KEYS.length - 1, Number(body.revealedThrough) || 0))
  const answeredThrough = Math.min(upto, Number(body.answeredThrough ?? upto - 1))
  const { data: row } = await db.from('daily_cases').select('case_json').eq('id', body.caseId).eq('owner_id', owner).maybeSingle()
  if (!row) return json({ error: 'case not found' }, 404)
  const c = row.case_json as CaseJson
  const revealed = c.stages
    .slice(0, upto + 1)
    .map(
      (s, i) =>
        `## ${s.title}\n${s.content}${s.labs.length ? '\n' + s.labs.map((l) => `${l.panel} · ${l.test}: ${l.value} ${l.unit} (ref ${l.ref_range})`).join('\n') : ''}${
          i <= answeredThrough ? `\n(discussed answer: ${s.question.model_answer})` : ''
        }`,
    )
    .join('\n\n')
  const pending = c.stages.slice(upto + 1).map((s) => s.title)
  const history = Array.isArray(body.history)
    ? (body.history as Any[]).slice(-6).map((h) => `${h.role === 'user' ? 'FELLOW' : 'ATTENDING'}: ${String(h.text).slice(0, 600)}`).join('\n')
    : ''
  try {
    const answer = await callText(
      CHAT_SYSTEM,
      `PATIENT: ${c.patient.age}, ${c.patient.sex}, ${c.patient.weight_kg} kg, ${c.patient.height_cm} cm\n\nCASE DATA REVEALED SO FAR:\n${revealed}\n\nSTAGES NOT YET OPENED: ${pending.join(', ') || 'none'}\n\n${history ? `CONVERSATION:\n${history}\n\n` : ''}FELLOW: ${question}`,
      { maxTokens: 800, deadline: Date.now() + 45_000 },
    )
    return json({ answer })
  } catch (e) {
    const quota = e instanceof LlmError && e.status === 429
    return json({ error: quota ? 'سهمیهٔ هوش مصنوعی (Gemini رایگان) فعلاً پر است؛ کمی بعد دوباره بپرس.' : e instanceof LlmError ? `AI (${e.status}): ${e.message.slice(0, 200)}` : String((e as Error).message) }, 502)
  }
}

// ------------------------------------------------------------------ entry
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!PROVIDER) return json({ error: 'هیچ کلید هوش مصنوعی تنظیم نشده (GEMINI_API_KEY یا ANTHROPIC_API_KEY).' }, 500)

  let body: Any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  // ---- who is asking
  let owner: string | null = null
  const secret = req.headers.get('x-case-secret')
  let viaSecret = false
  if (secret) {
    const { data: ok } = await db.rpc('check_daily_case_secret', { s: secret })
    viaSecret = ok === true
    if (!viaSecret) return json({ error: 'bad secret' }, 403)
  }
  if (viaSecret) {
    owner = isUuid(body.ownerId) ? body.ownerId : null
  } else {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Missing Authorization header' }, 401)
    const { data } = await db.auth.getUser(token)
    if (!data.user) return json({ error: 'Not authenticated' }, 401)
    owner = data.user.id
  }

  try {
    if (body.action === 'cron') {
      if (!viaSecret) return json({ error: 'forbidden' }, 403)
      const { data: owners } = await db.from('library_books').select('owner_id')
      const ids = [...new Set(((owners ?? []) as Any[]).map((o) => o.owner_id))]
      const out = []
      for (const id of ids) {
        try {
          out.push({ owner: id, ...(await startGeneration(db, id, 'daily')) })
        } catch (e) {
          out.push({ owner: id, error: String((e as Error).message) })
        }
      }
      return json({ date: tehranDate(), results: out })
    }
    if (!owner) return json({ error: 'ownerId required with the secret header' }, 400)
    if (body.action === 'step') {
      if (!viaSecret || !isUuid(body.caseId)) return json({ error: 'forbidden' }, 403)
      const caseId = body.caseId as string
      background(runPhase(db, owner, caseId).catch((e) => failCase(db, caseId, e)))
      return json({ accepted: true }, 202)
    }
    if (body.action === 'generate') {
      const kind = body.kind === 'manual' ? 'manual' : 'daily'
      return json(await startGeneration(db, owner, kind, typeof body.topicSlug === 'string' ? body.topicSlug : undefined))
    }
    if (body.action === 'feedback') return await handleFeedback(db, owner, body)
    if (body.action === 'chat') return await handleChat(db, owner, body)
    return json({ error: 'unknown action' }, 400)
  } catch (e) {
    console.error('[daily-case] error', e)
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
