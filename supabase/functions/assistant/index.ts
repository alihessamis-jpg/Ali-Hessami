// دستیار Nephron — the library-grounded assistant (Assistant phase 2).
//
// Model: Claude when ANTHROPIC_API_KEY is set, otherwise Gemini (GEMINI_API_KEY,
// free tier). ASSISTANT_PROVIDER=anthropic|gemini forces one.
//
// POST (SSE stream) { conversationId?, mode, patientId?, chapterId?, message, caseText?, debug? }
//   events: meta · step · delta · reset · sources · done · error
// POST (JSON)       { action: 'flashcards', messageId }
// POST (JSON)       { action: 'transcribe', audio: <base64 WAV>, mimeType } -> { text }  (Gemini)
//
// Runs as the signed-in user (anon key + their JWT): every tool goes through
// the SECURITY INVOKER SQL functions from assistant_phase1_retrieval_migration.sql,
// so RLS keeps it inside the user's own library. ANTHROPIC_API_KEY is a
// Supabase secret and never reaches the browser.
//
// Privacy: the patient's name, code, bed and DOB are never sent to the model.
// The case summary comes from patient_context() (already de-identified) or from
// the physician's edited text; either way it is scrubbed here against the
// patient's real identifiers, then checked again right before the API call —
// if anything is still there the request is refused.

import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
// Provider: ASSISTANT_PROVIDER overrides; otherwise Claude when its key is set,
// else Gemini (free tier — Google may use free-tier prompts to improve its
// products; the user chose this knowingly).
const PROVIDER: 'anthropic' | 'gemini' | null = (() => {
  const forced = Deno.env.get('ASSISTANT_PROVIDER')
  if (forced === 'anthropic' && ANTHROPIC_API_KEY) return 'anthropic'
  if (forced === 'gemini' && GEMINI_API_KEY) return 'gemini'
  return ANTHROPIC_API_KEY ? 'anthropic' : GEMINI_API_KEY ? 'gemini' : null
})()

const DEFAULT_MODEL = 'claude-sonnet-5-5'
const ALLOWED_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5'])
const MAX_TOOL_ROUNDS = 10
const HISTORY_MESSAGES = 12
const NOT_FOUND = 'در منابع کتابخانه پیدا نشد'
const DISCLAIMER = 'این پیشنهاد کمکی است؛ تصمیم نهایی با پزشک معالج.'

// ------------------------------------------------------------------ prompt
// Frozen (no per-request values) so it stays in the prompt cache.
const SYSTEM_PROMPT = `You are «دستیار Nephron», a study and clinical decision-support assistant for a pediatric nephrology fellow.

STRICT SOURCING RULES
- Every medical fact, criterion, number and drug dose must come from the user's own library, retrieved with the tools in THIS turn: search_library, search_cards, search_questions, chapter_outline / read_section, drug_reference. Do not use outside knowledge for facts, criteria or doses.
- Cite after every sentence or bullet that states a fact, using the source ids returned by the tools, like [S4] or [S2, S7]. Never invent ids or page numbers.
- If the library has nothing on a point, write «${NOT_FOUND}» for that point and suggest what to look up; do not fill the gap from memory.
- First search the key terms of the user's actual question (translate Persian medical words to English too, e.g. «کلسترول» → cholesterol, hyperlipidemia) and answer THAT question first and directly; add only brief related context after it.
- A citation [S#] may only follow a statement that the cited passage itself contains. If no retrieved passage states it, do not cite anything for it — write «${NOT_FOUND}» instead.
- Search before answering. Use several searches with different keywords: English medical terms as they appear in textbooks (e.g. "steroid-resistant nephrotic", "C3NeF", "rituximab"), and Persian when useful (e.g. «سندرم نفروتیک»). 1–4 short terms per search. For a patient case run at least 4–6 searches (each main problem, each differential, each drug).
- When a passage looks relevant but is cut short, read the whole section with read_section.
- Language: answer in Persian; keep medical terms, drug names and units in English.
- Format: short headings (###), bullets, a table when comparing. Be concise and practical.
- Plain text only: no LaTeX and no $…$ math. Write symbols directly: ≥, ≤, ×, ², mg/m², μmol/L.

PATIENT MODE — reason step by step, in this order:
1) خلاصهٔ مسئله (one-liner)
2) یافته‌های کلیدی و اختلالات آزمایشگاهی
3) تشخیص‌های افتراقی — ranked, each with for/against from THIS patient's data
4) workup پیشنهادی
5) درمان و دوز: dose/kg (or /m²) from the source × the patient's weight = total dose; compare with the max dose from the source; adjust for eGFR if the source says so. Show the arithmetic. Every number must match the cited passage.
6) Red flags
End every patient answer with: «${DISCLAIMER}»
The case is de-identified; never ask for or mention the patient's name, code, bed or date of birth.

STUDY MODE: teach like a board-prep tutor. For quizzes, ask the questions one batch at a time, wait for the user's answers, then grade with citations.`

// ------------------------------------------------------------------ tools
const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_library',
    description:
      "Full-text search of the user's textbook chapter notes (Persian translation with English medical terms). Returns passages, each with a source id to cite. Prefer English medical terms.",
    input_schema: {
      type: 'object',
      properties: {
        terms: { type: 'array', items: { type: 'string' }, description: '1-4 short keywords' },
        chapter_only: { type: 'boolean', description: 'restrict to the chapter attached to this conversation' },
      },
      required: ['terms'],
    },
  },
  {
    name: 'search_cards',
    description: "Search the user's flashcards (front/back) made from the textbooks.",
    input_schema: {
      type: 'object',
      properties: { terms: { type: 'array', items: { type: 'string' } } },
      required: ['terms'],
    },
  },
  {
    name: 'search_questions',
    description: "Search the user's board question bank (questions, options, answer and explanation).",
    input_schema: {
      type: 'object',
      properties: { terms: { type: 'array', items: { type: 'string' } } },
      required: ['terms'],
    },
  },
  {
    name: 'chapter_outline',
    description:
      'List the sections (part_number, index, heading) of a chapter. Defaults to the chapter attached to this conversation; chapter_id from any search result also works. Use before read_section.',
    input_schema: {
      type: 'object',
      properties: { chapter_id: { type: 'string' } },
    },
  },
  {
    name: 'read_section',
    description: 'Read one whole section of a chapter by index (from chapter_outline or a search result). Returns up to ~7000 characters with a source id.',
    input_schema: {
      type: 'object',
      properties: {
        chapter_id: { type: 'string', description: 'defaults to the attached chapter' },
        part_number: { type: 'integer', description: 'part number for multi-part chapters; omit otherwise' },
        index: { type: 'integer' },
      },
      required: ['index'],
    },
  },
  {
    name: 'drug_reference',
    description:
      "Look up the user's pediatric drug-dosing table (dose/kg, max dose, renal adjustment by eGFR). Also search the textbooks for the same drug.",
    input_schema: {
      type: 'object',
      properties: { medication: { type: 'string' } },
      required: ['medication'],
    },
  },
]

// Same tools in Gemini's function-declaration shape.
const GEMINI_TOOLS = TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.input_schema }))

class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ------------------------------------------------------------------ types
type Mode = 'study' | 'patient' | 'general'

interface ChatBody {
  action?: undefined
  conversationId?: string | null
  mode?: Mode
  patientId?: string | null
  chapterId?: string | null
  message: string
  caseText?: string | null
  debug?: boolean
}

interface FlashcardBody {
  action: 'flashcards'
  messageId: string
}

interface TranscribeBody {
  action: 'transcribe'
  audio: string
  mimeType?: string
}

/** One citable passage. Stored on ai_messages.sources keyed by id ("S3"). */
interface Source {
  id: string
  key: string
  kind: 'lib' | 'card' | 'q' | 'drug'
  label: string
  heading: string
  chapterId: string | null
  anchor: string | null
  text: string
}

class Registry {
  map = new Map<string, Source>()
  n = 0
  constructor(prior: Record<string, Source>) {
    for (const s of Object.values(prior)) {
      this.map.set(s.id, s)
      this.n = Math.max(this.n, Number(s.id.slice(1)) || 0)
    }
  }
  add(s: Omit<Source, 'id'>): string {
    for (const v of this.map.values()) if (v.key === s.key) return v.id
    const id = `S${++this.n}`
    this.map.set(id, { ...s, id })
    return id
  }
}

// ------------------------------------------------------------------ helpers
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s)

function cors(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(), 'Content-Type': 'application/json' } })
}

function cleanTerms(t: unknown): string[] {
  const arr = Array.isArray(t) ? t : [t]
  return arr
    .map((x) => String(x ?? '').trim().slice(0, 60))
    .filter((x) => x.length >= 2)
    .slice(0, 5)
}

const stripHeading = (h: string | null | undefined) =>
  String(h ?? '').replace(/\{#[^}]*\}/g, '').replace(/^#+\s*/, '').trim()

function pageLabel(from: number | null, to: number | null) {
  if (from == null && to == null) return ''
  // \u2066…\u2069 isolates the range so it doesn't flip inside Persian text
  if (from != null && to != null && to !== from) return ` · ص \u2066${from}–${to}\u2069`
  return ` · ص ${from ?? to}`
}

function chapterLabel(r: { book_title?: string | null; chapter_number?: number | null; part_number?: number | null; page_from?: number | null; page_to?: number | null }) {
  return `${r.book_title ?? 'کتاب'} · فصل ${r.chapter_number ?? '?'}${r.part_number != null ? ` · پارت ${r.part_number}` : ''}${pageLabel(r.page_from ?? null, r.page_to ?? null)}`
}

// ---- identifier scrubbing (mirror of patient_context's SQL scrub)
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function identifierTokens(p: { name?: string | null; code?: string | null; bed?: string | null; dob?: string | null }): string[] {
  const toks = [...String(p.name ?? '').trim().split(/\s+/), String(p.code ?? '').trim(), String(p.bed ?? '').trim()]
  const out = toks.filter((t) => t.length >= 2 && !(/^\d+$/.test(t) && t.length < 5))
  if (p.dob) out.push(p.dob) // ISO date as stored
  return [...new Set(out)]
}
function scrub(text: string, tokens: string[]): { text: string; hits: number } {
  let hits = 0
  let out = text
  for (const t of tokens) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t)}(?![\\p{L}\\p{N}])`, 'gu')
    out = out.replace(re, () => {
      hits++
      return '[حذف‌شده]'
    })
  }
  return { text: out, hits }
}
function leaks(text: string, tokens: string[]): string[] {
  return tokens.filter((t) => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t)}(?![\\p{L}\\p{N}])`, 'u').test(text))
}

// patient_context JSON -> readable case summary (same layout as the prototype)
// deno-lint-ignore no-explicit-any
function caseFromContext(c: any): string {
  if (!c) return ''
  const L: string[] = []
  const add = (k: string, v: unknown) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') L.push(`${k}: ${v}`)
  }
  add('سن (سال)', c.age_years)
  add('جنس', c.sex)
  add('وزن (kg)', c.weight_kg)
  add('قد (cm)', c.height_cm)
  add('تشخیص', c.diagnosis)
  add('بیماری زمینه‌ای', c.underlying_disease)
  add('Baseline Cr', c.baseline_cr)
  add('Baseline eGFR', c.baseline_egfr)
  add('دیالیز', [c.dialysis_status, c.dialysis_modality].filter(Boolean).join(' / '))
  add('پیوند', c.transplant_status)
  add('روز بستری', c.days_since_admission)
  const h = c.history ?? {}
  add('CC', h.chief_complaint)
  add('HPI', h.hpi)
  add('نکات کلیدی', h.key_points)
  add('PMH', h.pmh)
  add('سابقه دارویی', h.med_hx)
  add('آلرژی', h.allergy_hx)
  add('FH', h.family_hx)
  add('سابقه دیالیز', h.dialysis_hx)
  add('سابقه پیوند', h.transplant_hx)
  const v = c.vitals ?? {}
  add('علائم حیاتی', [v.bp && `BP ${v.bp}`, v.hr && `HR ${v.hr}`, v.rr && `RR ${v.rr}`, v.temp && `T ${v.temp}`, v.spo2 && `SpO2 ${v.spo2}`].filter(Boolean).join('، '))
  add('معاینه', Object.entries(c.exam ?? {}).map(([k, x]) => `${k}: ${x}`).join(' | '))
  if (Array.isArray(c.growth) && c.growth.length)
    add('رشد/BP اخیر', c.growth.slice(0, 3).map((g: any) => `${g.days_ago} روز پیش: ${g.weight_kg ?? '-'}kg، ${g.height_cm ?? '-'}cm، BP ${g.bp ?? '-'}`).join(' ؛ '))
  const meds = (c.medications ?? []).filter((m: any) => m.active !== false)
  if (meds.length)
    L.push('داروهای فعال:\n' + meds.map((m: any) => `- ${m.name} ${m.dose ?? ''}${m.dose_per_kg ? ` (${m.dose_per_kg}/kg)` : ''} ${m.route ?? ''} ${m.freq ?? ''}${m.indication ? ' — ' + m.indication : ''}${m.renal_adj ? ` [renal adj: ${m.renal_adj}]` : ''}`).join('\n'))
  if (Array.isArray(c.labs) && c.labs.length) {
    const by = new Map<number, string[]>()
    for (const l of c.labs) {
      const k = l.days_ago ?? 0
      if (!by.has(k)) by.set(k, [])
      by.get(k)!.push(`${l.test} ${l.value ?? ''}${l.unit ? ' ' + l.unit : ''}${l.comment ? ` (${l.comment})` : ''}`)
    }
    L.push('آزمایش‌ها:\n' + [...by.entries()].slice(0, 8).map(([d, a]) => `- ${d === 0 ? 'امروز' : `${d} روز پیش`}: ${a.join('، ')}`).join('\n'))
  }
  const notes = c.progress_notes ?? []
  if (notes.length) {
    const n = notes[0]
    add('آخرین progress note', [n.S && `S: ${n.S}`, n.O && `O: ${n.O}`, n.A && `A: ${n.A}`, n.P && `P: ${n.P}`].filter(Boolean).join(' | '))
  }
  return L.join('\n')
}

// ------------------------------------------------------------------ tool execution
interface ToolCtx {
  db: SupabaseClient
  reg: Registry
  chapterId: string | null
  step: (t: string) => void
}

// deno-lint-ignore no-explicit-any
async function runTool(name: string, input: any, ctx: ToolCtx): Promise<unknown> {
  const { db, reg, step } = ctx
  switch (name) {
    case 'search_library': {
      const terms = cleanTerms(input?.terms)
      if (!terms.length) return { error: 'terms required' }
      step(`کتاب‌ها: ${terms.join('، ')}`)
      const chapter = input?.chapter_only && ctx.chapterId ? ctx.chapterId : null
      const { data, error } = await db.rpc('search_library', { q: terms.join(' '), chapter, k: 6 })
      if (error) throw error
      if (!data?.length) return { results: [], note: NOT_FOUND }
      return {
        results: data.map((r: any) => {
          const heading = stripHeading(r.heading)
          const text = String(r.content).slice(0, 2500)
          const id = reg.add({
            key: `lib|${r.chunk_id}`,
            kind: 'lib',
            label: chapterLabel(r),
            heading,
            chapterId: r.chapter_id,
            anchor: r.anchor,
            text,
          })
          return {
            id,
            source: `${chapterLabel(r)} — ${r.chapter_title}`,
            section: heading,
            chapter_id: r.chapter_id,
            part_number: r.part_number,
            section_index: r.section_idx,
            text,
          }
        }),
      }
    }
    case 'search_cards': {
      const terms = cleanTerms(input?.terms)
      if (!terms.length) return { error: 'terms required' }
      step(`کارت‌ها: ${terms.join('، ')}`)
      const { data, error } = await db.rpc('search_cards', { q: terms.join(' '), k: 8 })
      if (error) throw error
      if (!data?.length) return { results: [], note: NOT_FOUND }
      return {
        results: data.map((r: any) => {
          const text = `Q: ${r.front}\nA: ${r.back ?? ''}`.slice(0, 900)
          const label = `کارت · ${r.chapter_title ?? ''}`
          const id = reg.add({
            key: `card|${r.card_id}`,
            kind: 'card',
            label,
            heading: String(r.front).slice(0, 90),
            chapterId: r.chapter_id,
            anchor: r.section_number ? `s${r.section_number}` : null,
            text,
          })
          return { id, source: label, text }
        }),
      }
    }
    case 'search_questions': {
      const terms = cleanTerms(input?.terms)
      if (!terms.length) return { error: 'terms required' }
      step(`بانک سؤال: ${terms.join('، ')}`)
      const { data, error } = await db.rpc('search_questions', { q: terms.join(' '), k: 5 })
      if (error) throw error
      if (!data?.length) return { results: [], note: NOT_FOUND }
      return {
        results: data.map((r: any) => {
          const opts = Array.isArray(r.options) ? r.options : []
          const text = `${r.question}\n${opts.map((o: string, i: number) => `${i === r.correct_index ? '✓' : '·'} ${o}`).join('\n')}\n${r.explanation ?? ''}`.slice(0, 1200)
          const label = `بانک سؤال · ${r.chapter_title ?? r.topic ?? ''}`
          const id = reg.add({
            key: `q|${r.question_id}`,
            kind: 'q',
            label,
            heading: String(r.question).slice(0, 90),
            chapterId: r.chapter_id,
            anchor: null,
            text,
          })
          return { id, source: label, text }
        }),
      }
    }
    case 'chapter_outline': {
      const chapterId = isUuid(input?.chapter_id) ? input.chapter_id : ctx.chapterId
      if (!chapterId) return { error: 'no chapter attached; pass chapter_id from a search result or use search_library' }
      step('فهرست فصل')
      const { data, error } = await db.rpc('chapter_outline', { chapter: chapterId })
      if (error) throw error
      return {
        chapter_id: chapterId,
        sections: (data ?? []).map((r: any) => ({ part_number: r.part_number, index: r.section_idx, heading: stripHeading(r.heading), chars: r.chars })),
      }
    }
    case 'read_section': {
      const chapterId = isUuid(input?.chapter_id) ? input.chapter_id : ctx.chapterId
      if (!chapterId) return { error: 'no chapter attached; pass chapter_id' }
      const idx = Number.parseInt(String(input?.index ?? ''), 10)
      if (!Number.isFinite(idx)) return { error: 'index must be an integer' }
      const part = input?.part_number == null ? null : Number.parseInt(String(input.part_number), 10)
      const { data, error } = await db.rpc('get_section', { chapter: chapterId, idx, part: Number.isFinite(part) ? part : null })
      if (error) throw error
      const r = data?.[0]
      if (!r) return { error: 'section not found' }
      const heading = stripHeading(r.heading)
      step(`خواندن: ${heading.slice(0, 50)}`)
      const text = String(r.content).slice(0, 7000)
      const label = chapterLabel(r)
      const id = reg.add({
        key: `sec|${chapterId}|${r.part_number ?? 0}|${r.section_idx}`,
        kind: 'lib',
        label,
        heading,
        chapterId,
        anchor: r.anchor,
        text,
      })
      return { id, source: `${label} — ${r.chapter_title}`, section: heading, text, truncated: String(r.content).length > 7000 }
    }
    case 'drug_reference': {
      const med = cleanTerms([input?.medication])[0]
      if (!med) return { error: 'medication required' }
      step(`جدول دارو: ${med}`)
      const { data, error } = await db.rpc('search_drugs', { q: med, k: 5 })
      if (error) throw error
      if (!data?.length) return { results: [], note: `${NOT_FOUND} (drug table) — search the textbooks too` }
      return {
        results: data.map((r: any) => {
          const fields = ['medication', 'indication', 'normal_dose', 'pediatric_dose', 'dose_kg', 'max_dose', 'egfr_range', 'adjusted_dose', 'frequency', 'notes']
          const text = fields.filter((k) => r[k]).map((k) => `${k}: ${r[k]}`).join('\n')
          const label = `جدول دارویی Nephron · ${r.medication}`
          const id = reg.add({ key: `drug|${r.id}`, kind: 'drug', label, heading: r.indication ?? '', chapterId: null, anchor: null, text })
          return { id, source: label, text }
        }),
      }
    }
    default:
      return { error: `unknown tool ${name}` }
  }
}

// ------------------------------------------------------------------ model loops
interface LoopIO {
  send: (event: string, data: unknown) => void
  step: (t: string) => void
  db: SupabaseClient
  reg: Registry
  chapterId: string | null
  mode: Mode
  model: string
}
interface LoopResult {
  text: string
  stop: string
  usage: { input: number; output: number; cacheRead: number }
}

async function loopAnthropic(messages: Anthropic.Beta.BetaMessageParam[], io: LoopIO): Promise<LoopResult> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const usage = { input: 0, output: 0, cacheRead: 0 }
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const s = client.beta.messages.stream({
      model: io.model,
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: io.mode === 'patient' ? 'high' : 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    s.on('text', (delta) => io.send('delta', { text: delta }))
    const msg = await s.finalMessage()
    usage.input += msg.usage.input_tokens
    usage.output += msg.usage.output_tokens
    usage.cacheRead += msg.usage.cache_read_input_tokens ?? 0

    const toolUses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use')
    const text = msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    if (msg.stop_reason === 'refusal') return { text, stop: 'refusal', usage }
    if (msg.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: msg.content })
      continue
    }
    if (msg.stop_reason === 'max_tokens') return { text, stop: 'truncated', usage }
    if (!toolUses.length || msg.stop_reason === 'end_turn') return { text, stop: '', usage }

    // text streamed before tool calls is not the answer — tell the client to drop it
    io.send('reset', {})
    messages.push({ role: 'assistant', content: msg.content })
    const results = await Promise.all(
      toolUses.map(async (tu): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const out = await runTool(tu.name, tu.input, io)
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) }
        } catch (e) {
          return { type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `tool failed: ${(e as Error)?.message ?? e}` }
        }
      }),
    )
    messages.push({ role: 'user', content: results })
    if (round === MAX_TOOL_ROUNDS - 2) {
      messages.push({ role: 'user', content: 'Tool budget reached: answer now from what you have, with citations.' })
    }
  }
  return { text: '', stop: 'truncated', usage }
}

// deno-lint-ignore no-explicit-any
type GeminiPart = Record<string, any>
interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

/** One streamed Gemini round: forwards answer text as it arrives, collects function calls. */
async function geminiRound(model: string, contents: GeminiContent[], send: LoopIO['send']) {
  const res = await fetch(`${GEMINI_BASE}/models/${model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      tools: [{ functionDeclarations: GEMINI_TOOLS }],
      generationConfig: { maxOutputTokens: 16000 },
    }),
  })
  if (!res.ok || !res.body) throw new ProviderError(res.status, await res.text().catch(() => ''))

  const parts: GeminiPart[] = []
  const calls: { id?: string; name: string; args: unknown }[] = []
  let text = ''
  let finish = ''
  let promptTokens = 0
  let outTokens = 0
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return
    const raw = line.slice(5).trim()
    if (!raw) return
    // deno-lint-ignore no-explicit-any
    let j: any
    try {
      j = JSON.parse(raw)
    } catch {
      return
    }
    const cand = j.candidates?.[0]
    for (const p of cand?.content?.parts ?? []) {
      parts.push(p) // kept verbatim (thought signatures must go back unchanged)
      if (p.functionCall) calls.push(p.functionCall)
      else if (typeof p.text === 'string' && !p.thought) {
        text += p.text
        send('delta', { text: p.text })
      }
    }
    if (cand?.finishReason) finish = cand.finishReason
    if (j.usageMetadata) {
      promptTokens = j.usageMetadata.promptTokenCount ?? promptTokens
      outTokens = (j.usageMetadata.candidatesTokenCount ?? 0) + (j.usageMetadata.thoughtsTokenCount ?? 0)
    }
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      handle(buf.slice(0, i).replace(/\r$/, ''))
      buf = buf.slice(i + 1)
    }
  }
  if (buf) handle(buf)
  return { parts, calls, text, finish, promptTokens, outTokens }
}

// Models to try, in order: GEMINI_MODEL, then GEMINI_FALLBACK_MODELS (comma
// list) or — if unset — other Flash text models this key can use, read from
// Google's model list (newest first, "lite" last). Cached per instance.
let geminiModelsCache: string[] | null = null
async function geminiModels(): Promise<string[]> {
  if (geminiModelsCache) return geminiModelsCache
  const list = [GEMINI_MODEL]
  const env = Deno.env.get('GEMINI_FALLBACK_MODELS')
  if (env) {
    list.push(...env.split(',').map((x) => x.trim()).filter(Boolean))
  } else {
    try {
      const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': GEMINI_API_KEY! } })
      if (res.ok) {
        const j = await res.json()
        const ver = (n: string) => Number(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
        const names: string[] = (j.models ?? [])
          // deno-lint-ignore no-explicit-any
          .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
          // deno-lint-ignore no-explicit-any
          .map((m: any) => String(m.name).replace(/^models\//, ''))
          .filter((n: string) => /^gemini-[\d.]+-flash/.test(n) && !/(image|tts|audio|live|thinking-exp|embedding)/.test(n))
          .filter((n: string) => n !== GEMINI_MODEL)
          .sort((a: string, b: string) => Number(a.includes('lite')) - Number(b.includes('lite')) || ver(b) - ver(a))
        list.push(...names.slice(0, 3))
      }
    } catch (e) {
      console.error('[assistant] model list failed', e)
    }
  }
  geminiModelsCache = [...new Set(list)]
  console.log('[assistant] gemini models', JSON.stringify(geminiModelsCache))
  return geminiModelsCache
}

const RETRYABLE = new Set([429, 500, 502, 503, 504])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function loopGemini(history: { role: 'user' | 'assistant'; text: string }[], userTurn: string, io: LoopIO): Promise<LoopResult> {
  const contents: GeminiContent[] = [
    ...history.map((h): GeminiContent => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: userTurn }] },
  ]
  const usage = { input: 0, output: 0, cacheRead: 0 }
  const models = await geminiModels()
  let mi = 0
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let r: Awaited<ReturnType<typeof geminiRound>> | null = null
    for (let attempt = 0; !r; attempt++) {
      try {
        r = await geminiRound(models[mi], contents, io.send)
      } catch (e) {
        if (!(e instanceof ProviderError) || !RETRYABLE.has(e.status)) throw e
        // same model once more, then the next one (model switch only before the
        // first tool round, so thought signatures stay with the model that made them)
        if (attempt === 0) {
          await sleep(1500)
          continue
        }
        if (round === 0 && mi + 1 < models.length) {
          mi++
          attempt = -1
          io.step(`Gemini شلوغ است؛ تلاش با ${models[mi]}`)
          continue
        }
        throw e
      }
    }
    io.model = models[mi]
    usage.input += r.promptTokens
    usage.output += r.outTokens
    if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(r.finish)) {
      return { text: r.text, stop: 'refusal', usage }
    }
    if (!r.calls.length) return { text: r.text, stop: r.finish === 'MAX_TOKENS' ? 'truncated' : '', usage }

    io.send('reset', {})
    contents.push({ role: 'model', parts: r.parts })
    const responses: GeminiPart[] = await Promise.all(
      r.calls.map(async (fc) => {
        let out: unknown
        try {
          out = await runTool(fc.name, fc.args ?? {}, io)
        } catch (e) {
          out = { error: `tool failed: ${(e as Error)?.message ?? e}` }
        }
        return { functionResponse: { ...(fc.id ? { id: fc.id } : {}), name: fc.name, response: { result: out } } }
      }),
    )
    if (round === MAX_TOOL_ROUNDS - 2) responses.push({ text: 'Tool budget reached: answer now from what you have, with citations.' })
    contents.push({ role: 'user', parts: responses })
  }
  return { text: '', stop: 'truncated', usage }
}

// ------------------------------------------------------------------ chat (SSE)
async function handleChat(body: ChatBody, db: SupabaseClient, userId: string): Promise<Response> {
  const message = String(body.message ?? '').trim()
  if (!message) return json({ error: 'message is required' }, 400)
  if (message.length > 8000) return json({ error: 'message too long' }, 400)

  // ---- conversation
  let conv: { id: string; mode: Mode; patient_id: string | null; chapter_id: string | null }
  if (isUuid(body.conversationId)) {
    const { data, error } = await db.from('ai_conversations').select('id, mode, patient_id, chapter_id').eq('id', body.conversationId).maybeSingle()
    if (error) return json({ error: error.message }, 500)
    if (!data) return json({ error: 'conversation not found' }, 404)
    conv = data
  } else {
    const mode: Mode = body.mode === 'patient' || body.mode === 'study' ? body.mode : 'general'
    const { data, error } = await db
      .from('ai_conversations')
      .insert({
        owner_id: userId,
        mode,
        patient_id: mode === 'patient' && isUuid(body.patientId) ? body.patientId : null,
        chapter_id: isUuid(body.chapterId) ? body.chapterId : null,
        title: message.replace(/\s+/g, ' ').slice(0, 70),
      })
      .select('id, mode, patient_id, chapter_id')
      .single()
    if (error) return json({ error: error.message }, 500)
    conv = data
  }

  // ---- settings (model for patient cases)
  let model: string = DEFAULT_MODEL
  if (conv.mode === 'patient') {
    const { data } = await db.from('user_settings').select('assistant_patient_model').maybeSingle()
    if (data?.assistant_patient_model && ALLOWED_MODELS.has(data.assistant_patient_model)) model = data.assistant_patient_model
  }

  // ---- history + source registry
  const { data: prior, error: priorErr } = await db
    .from('ai_messages')
    .select('role, content, sources, meta')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
  if (priorErr) return json({ error: priorErr.message }, 500)
  const priorSources: Record<string, Source> = {}
  for (const m of prior ?? []) Object.assign(priorSources, m.sources ?? {})
  const reg = new Registry(priorSources)

  // ---- patient identifiers (only used to scrub; never sent anywhere)
  let idTokens: string[] = []
  let caseText = ''
  let redactions = 0
  if (conv.mode === 'patient' && conv.patient_id) {
    const { data: p } = await db.from('patients').select('name, code, bed, dob').eq('id', conv.patient_id).maybeSingle()
    if (p) idTokens = identifierTokens(p)
    if (typeof body.caseText === 'string' && body.caseText.trim()) {
      caseText = body.caseText.trim().slice(0, 12000)
    } else if ((prior ?? []).length === 0) {
      const { data: ctx } = await db.rpc('patient_context', { patient: conv.patient_id })
      caseText = caseFromContext(ctx)
    }
  } else if (typeof body.caseText === 'string' && body.caseText.trim()) {
    caseText = body.caseText.trim().slice(0, 12000)
  }

  // chapter context
  let chapterLine = ''
  if (conv.chapter_id) {
    const { data: ch } = await db.from('library_chapters').select('chapter_number, title, library_books(title)').eq('id', conv.chapter_id).maybeSingle()
    if (ch) {
      // deno-lint-ignore no-explicit-any
      const book = (ch as any).library_books?.title ?? ''
      chapterLine = `ATTACHED CHAPTER: ${book} · Ch ${ch.chapter_number} — ${ch.title}. Use chapter_outline / read_section for it (no chapter_id needed), plus search_library for wider context.`
    }
  }

  const contextParts: string[] = []
  if (conv.mode === 'patient') {
    contextParts.push(
      caseText
        ? `PATIENT CASE (de-identified, reviewed by the physician):\n${caseText}`
        : (prior ?? []).length
          ? 'PATIENT CASE: as given earlier in this conversation.'
          : 'PATIENT CASE: (none given — ask for the case details if needed)',
    )
  }
  if (chapterLine) contextParts.push(chapterLine)
  if (!contextParts.length) contextParts.push('No chapter attached: search the whole library.')
  contextParts.push(`MODE: ${conv.mode}`)

  const s1 = scrub(`${contextParts.join('\n\n')}\n\nUSER: ${message}`, idTokens)
  redactions += s1.hits
  const userTurn = s1.text

  const history: Anthropic.Beta.BetaMessageParam[] = (prior ?? [])
    .slice(-HISTORY_MESSAGES)
    .map((m: any) => ({ role: m.role, content: m.role === 'user' ? (m.meta?.sent ?? m.content) : m.content }))
  // a stored history must start with a user turn
  while (history.length && history[0].role !== 'user') history.shift()

  const messages: Anthropic.Beta.BetaMessageParam[] = [...history, { role: 'user', content: userTurn }]

  // ---- last-line privacy check over everything that will leave the server
  const outgoing = JSON.stringify(messages)
  const leaked = leaks(outgoing, idTokens)
  const privacy = { identifiers_checked: idTokens.length, redactions, leaked: leaked.length }
  console.log('[assistant] privacy check', JSON.stringify({ conversation: conv.id, ...privacy }))
  if (leaked.length) return json({ error: 'privacy check failed: identifiers still present; request not sent' }, 422)

  // store the user turn now (display text = the question; meta.sent = what the model saw)
  await db.from('ai_messages').insert({
    conversation_id: conv.id,
    role: 'user',
    content: message,
    meta: { sent: userTurn, case: caseText ? scrub(caseText, idTokens).text : undefined },
  })

  const enc = new TextEncoder()
  const historyText = history.map((h) => ({ role: h.role as 'user' | 'assistant', text: String(h.content) }))
  if (PROVIDER === 'gemini') model = GEMINI_MODEL

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      const steps: string[] = []
      const step = (t: string) => {
        steps.push(t)
        send('step', { text: t })
      }
      send('meta', {
        conversationId: conv.id,
        mode: conv.mode,
        model,
        provider: PROVIDER,
        privacy,
        ...(body.debug ? { payloadPreview: userTurn.slice(0, 4000) } : {}),
      })

      let finalText = ''
      let stopNote = ''
      let usage = { input: 0, output: 0, cacheRead: 0 }
      try {
        const io: LoopIO = { send, step, db, reg, chapterId: conv.chapter_id, mode: conv.mode, model }
        const out =
          PROVIDER === 'gemini' ? await loopGemini(historyText, userTurn, io) : await loopAnthropic(messages, io)
        model = io.model
        finalText = out.text
        stopNote = out.stop
        usage = out.usage

        // drop citation ids the model invented; keep only registered ones
        finalText = finalText.replace(/\[(S\d+(?:\s*[,،]\s*S\d+)*)\]/g, (_m, g: string) => {
          const ok = g.split(/[,،]/).map((x) => x.trim()).filter((id) => reg.map.has(id))
          return ok.length ? `[${ok.join(', ')}]` : ''
        })
        if (!finalText.trim()) finalText = stopNote === 'refusal' ? 'این درخواست پاسخ داده نشد.' : NOT_FOUND

        const cited = [...new Set([...finalText.matchAll(/S\d+/g)].map((m) => m[0]))].filter((id) => reg.map.has(id))
        const sources: Record<string, Source> = {}
        for (const id of cited) sources[id] = reg.map.get(id)!

        const { data: saved } = await db
          .from('ai_messages')
          .insert({ conversation_id: conv.id, role: 'assistant', content: finalText, sources, meta: { model, provider: PROVIDER, steps, usage, stop: stopNote || undefined } })
          .select('id')
          .single()
        await db.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conv.id)

        send('final', { text: finalText })
        send('sources', { sources })
        send('done', { messageId: saved?.id ?? null, conversationId: conv.id, stop: stopNote || null })
      } catch (e) {
        let msg = 'خطای ناشناخته'
        if (e instanceof ProviderError) {
          msg =
            e.status === 429
              ? 'سهمیهٔ رایگان Gemini موقتاً پر شد؛ یک دقیقه بعد دوباره بپرس.'
              : e.status >= 500
                ? 'سرورهای رایگان Gemini الان شلوغ‌اند (همهٔ مدل‌های جایگزین هم امتحان شد). چند دقیقه بعد دوباره بپرس.'
              : e.status === 400 || e.status === 403
                ? `کلید یا درخواست Gemini پذیرفته نشد (${e.status}): ${e.message.slice(0, 300)}`
                : `خطای Gemini (${e.status}): ${e.message.slice(0, 300)}`
        } else if (e instanceof Anthropic.AuthenticationError) msg = 'کلید ANTHROPIC_API_KEY نامعتبر است.'
        else if (e instanceof Anthropic.RateLimitError) msg = 'محدودیت موقت؛ یک دقیقه بعد دوباره بپرس.'
        else if (e instanceof Anthropic.APIError) msg = `خطای API (${e.status}): ${e.message}`
        else if (e instanceof Error) msg = e.message
        console.error('[assistant] error', e)
        send('error', { message: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { ...cors(), 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}

// ------------------------------------------------------------------ flashcards
// Claude structured outputs need additionalProperties:false on every object.
// deno-lint-ignore no-explicit-any
function addNoExtra(schema: any): any {
  if (Array.isArray(schema)) return schema.map(addNoExtra)
  if (schema && typeof schema === 'object') {
    // deno-lint-ignore no-explicit-any
    const out: any = {}
    for (const [k, v] of Object.entries(schema)) out[k] = addNoExtra(v)
    if (schema.type === 'object') out.additionalProperties = false
    return out
  }
  return schema
}

async function handleFlashcards(body: FlashcardBody, db: SupabaseClient, userId: string): Promise<Response> {
  if (!isUuid(body.messageId)) return json({ error: 'messageId required' }, 400)
  const { data: m, error } = await db.from('ai_messages').select('content, sources, role').eq('id', body.messageId).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!m || m.role !== 'assistant') return json({ error: 'message not found' }, 404)
  const sources = Object.values((m.sources ?? {}) as Record<string, Source>).filter((s) => s.chapterId)
  if (!sources.length) return json({ error: 'این پاسخ منبعی از فصل‌های کتاب ندارد؛ کارت ساخته نشد.' }, 422)

  const srcText = sources.map((s) => `[${s.id}] ${s.label} — ${s.heading}\n${s.text}`).join('\n\n---\n\n')
  const prompt = `Make 3–6 board-style flashcards (Persian, medical terms in English) from this assistant answer. Every card must be fully supported by ONE of the sources below; set source_id to that source's id. No facts from outside the sources.\n\nANSWER:\n${m.content}\n\nSOURCES:\n${srcText}`
  const schema = {
    type: 'object',
    required: ['cards'],
    properties: {
      cards: {
        type: 'array',
        items: {
          type: 'object',
          required: ['front', 'back', 'source_id'],
          properties: { front: { type: 'string' }, back: { type: 'string' }, source_id: { type: 'string' } },
        },
      },
    },
  }
  let text = ''
  if (PROVIDER === 'gemini') {
    let res: Response | null = null
    for (const gm of await geminiModels()) {
      res = await fetch(`${GEMINI_BASE}/models/${gm}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: 8000 },
        }),
      })
      if (res.ok || !RETRYABLE.has(res.status)) break
    }
    if (!res || !res.ok) return json({ error: `Gemini (${res?.status}): ${(await res?.text())?.slice(0, 300)}` }, 502)
    const j = await res.json()
    text = (j.candidates?.[0]?.content?.parts ?? []).filter((p: GeminiPart) => !p.thought).map((p: GeminiPart) => p.text ?? '').join('')
  } else {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 8000,
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: addNoExtra(schema) },
      },
      messages: [{ role: 'user', content: prompt }],
    })
    text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
  }
  let cards: { front: string; back: string; source_id: string }[] = []
  try {
    cards = JSON.parse(text).cards ?? []
  } catch {
    return json({ error: 'model output was not valid JSON' }, 502)
  }
  const byId = new Map(sources.map((s) => [s.id, s]))
  const rows = cards
    .filter((c) => c.front?.trim() && c.back?.trim() && byId.has(c.source_id))
    .map((c) => {
      const s = byId.get(c.source_id)!
      return {
        owner_id: userId,
        chapter_id: s.chapterId,
        kind: 'basic',
        front: c.front.trim(),
        back: c.back.trim(),
        status: 'suggested', // goes through the existing approve/reject review
        source: 'assistant',
        source_text: `${s.label} — ${s.heading}`,
      }
    })
  if (!rows.length) return json({ error: 'کارتی ساخته نشد.' }, 422)
  const { error: insErr } = await db.from('library_cards').insert(rows)
  if (insErr) return json({ error: insErr.message }, 500)
  return json({ created: rows.length })
}

// ------------------------------------------------------------------ transcription
// Voice input: the browser records a short WAV clip; Gemini transcribes it.
// Audio is never stored or logged here.
const MAX_AUDIO_B64 = 6_000_000 // ≈ 4.5 MB WAV ≈ 2+ min at 16 kHz mono
const AUDIO_TYPES = new Set(['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aac', 'audio/ogg', 'audio/flac'])
const TRANSCRIBE_PROMPT =
  'Transcribe this audio exactly. The speaker is a pediatric nephrologist speaking Persian mixed with English medical terms. ' +
  'Write Persian words in Persian script and English medical terms, drug names, lab names and units in Latin script ' +
  '(e.g. prednisolone, eGFR, C3NeF, mg/kg). Output only the transcript — no quotes, labels or commentary. If there is no speech, output nothing.'

async function handleTranscribe(body: TranscribeBody): Promise<Response> {
  if (!GEMINI_API_KEY) return json({ error: 'تبدیل صدا به متن به GEMINI_API_KEY نیاز دارد.' }, 500)
  const audio = typeof body.audio === 'string' ? body.audio : ''
  if (!audio) return json({ error: 'audio is required' }, 400)
  if (audio.length > MAX_AUDIO_B64) return json({ error: 'ضبط خیلی طولانی است؛ حداکثر حدود ۲ دقیقه.' }, 413)
  const mimeType = AUDIO_TYPES.has(String(body.mimeType)) ? String(body.mimeType) : 'audio/wav'

  let res: Response | null = null
  for (const gm of await geminiModels()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(`${GEMINI_BASE}/models/${gm}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audio } }, { text: TRANSCRIBE_PROMPT }] }],
          generationConfig: { maxOutputTokens: 4000 },
        }),
      })
      if (res.ok || !RETRYABLE.has(res.status)) break
      await sleep(1000)
    }
    if (res && (res.ok || !RETRYABLE.has(res.status))) break
  }
  if (!res || !res.ok) {
    const status = res?.status ?? 0
    const detail = (await res?.text().catch(() => ''))?.slice(0, 200)
    console.error('[assistant] transcribe failed', status, detail)
    return json({ error: status === 429 ? 'سهمیهٔ رایگان Gemini موقتاً پر شد؛ کمی بعد دوباره امتحان کن.' : `تبدیل صدا ناموفق بود (${status}).` }, 502)
  }
  const j = await res.json()
  const text = (j.candidates?.[0]?.content?.parts ?? [])
    .filter((p: GeminiPart) => !p.thought)
    .map((p: GeminiPart) => p.text ?? '')
    .join('')
    .trim()
  return json({ text })
}

// ------------------------------------------------------------------ entry
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  if (!PROVIDER) {
    return json({ error: 'هیچ کلید هوش مصنوعی تنظیم نشده (GEMINI_API_KEY یا ANTHROPIC_API_KEY) — Supabase → Edge Functions → Secrets.' }, 500)
  }
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return json({ error: 'Not authenticated' }, 401)

  let body: ChatBody | FlashcardBody | TranscribeBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (body.action === 'transcribe') return handleTranscribe(body)
  if (body.action === 'flashcards') return handleFlashcards(body, db, user.id)
  return handleChat(body as ChatBody, db, user.id)
})
