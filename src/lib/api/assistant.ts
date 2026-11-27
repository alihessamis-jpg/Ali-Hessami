// Client for the `assistant` Supabase Edge Function (Assistant phase 2) and
// the ai_conversations / ai_messages tables. The Anthropic key lives only in
// the function; the browser only ever sends the signed-in user's JWT.
import { supabase } from '../supabaseClient'

export type AssistantMode = 'study' | 'patient' | 'general'
export type AssistantModel = 'claude-sonnet-5-5' | 'claude-opus-5-5'

export interface AssistantSource {
  id: string
  kind: 'lib' | 'card' | 'q' | 'drug'
  label: string
  heading: string
  chapterId: string | null
  anchor: string | null
  text: string
}

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: Record<string, AssistantSource>
  steps?: string[]
  createdAt: string
}

export interface AssistantConversation {
  id: string
  mode: AssistantMode
  patientId: string | null
  chapterId: string | null
  title: string
  createdAt: string
  updatedAt: string
  patientName?: string | null
  chapterTitle?: string | null
}

export interface StreamHandlers {
  onMeta?: (m: { conversationId: string; model: string; privacy: { identifiers_checked: number; redactions: number; leaked: number }; payloadPreview?: string }) => void
  onStep?: (text: string) => void
  onDelta?: (text: string) => void
  onReset?: () => void
  onFinal?: (text: string) => void
  onSources?: (sources: Record<string, AssistantSource>) => void
  onDone?: (d: { messageId: string | null; conversationId: string; stop: string | null }) => void
  onError?: (message: string) => void
}

export interface AskParams {
  conversationId?: string | null
  mode: AssistantMode
  patientId?: string | null
  chapterId?: string | null
  message: string
  caseText?: string | null
  debug?: boolean
}

export const FN_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/assistant`

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('وارد حساب نشده‌اید')
  return {
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    'Content-Type': 'application/json',
  }
}

/** Streams one assistant turn. Resolves when the stream ends. */
export async function askAssistant(params: AskParams, h: StreamHandlers, signal?: AbortSignal): Promise<void> {
  const res = await fetch(FN_URL, { method: 'POST', headers: await authHeaders(), body: JSON.stringify(params), signal })
  if (!res.ok || !res.body) {
    let msg = `خطا (${res.status})`
    try {
      const j = await res.json()
      if (j?.error) msg = j.error
    } catch {
      /* not json */
    }
    h.onError?.(msg)
    return
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, i)
      buf = buf.slice(i + 2)
      let event = 'message'
      let data = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim()
        else if (line.startsWith('data: ')) data += line.slice(6)
      }
      if (!data) continue
      let d: any // eslint-disable-line @typescript-eslint/no-explicit-any
      try {
        d = JSON.parse(data)
      } catch {
        continue
      }
      switch (event) {
        case 'meta':
          h.onMeta?.(d)
          break
        case 'step':
          h.onStep?.(d.text)
          break
        case 'delta':
          h.onDelta?.(d.text)
          break
        case 'reset':
          h.onReset?.()
          break
        case 'final':
          h.onFinal?.(d.text)
          break
        case 'sources':
          h.onSources?.(d.sources ?? {})
          break
        case 'done':
          h.onDone?.(d)
          break
        case 'error':
          h.onError?.(d.message)
          break
      }
    }
  }
}

/** Voice input: base64 WAV -> text (server transcribes with Gemini; audio isn't stored). */
export async function transcribeAudio(wavBase64: string): Promise<string> {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ action: 'transcribe', audio: wavBase64, mimeType: 'audio/wav' }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ?? `خطا (${res.status})`)
  return String(j.text ?? '')
}

export async function makeFlashcards(messageId: string): Promise<number> {
  const res = await fetch(FN_URL, { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ action: 'flashcards', messageId }) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j?.error ?? `خطا (${res.status})`)
  return j.created as number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function listConversations(filter: { patientId?: string; chapterId?: string; mode?: AssistantMode } = {}): Promise<AssistantConversation[]> {
  let q = supabase
    .from('ai_conversations')
    .select('id, mode, patient_id, chapter_id, title, created_at, updated_at, patients(name), library_chapters(chapter_number, title)')
    .order('updated_at', { ascending: false })
    .limit(200)
  if (filter.patientId) q = q.eq('patient_id', filter.patientId)
  if (filter.chapterId) q = q.eq('chapter_id', filter.chapterId)
  if (filter.mode) q = q.eq('mode', filter.mode)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    mode: r.mode,
    patientId: r.patient_id,
    chapterId: r.chapter_id,
    title: r.title,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patientName: r.patients?.name ?? null,
    chapterTitle: r.library_chapters ? `${r.library_chapters.chapter_number}. ${r.library_chapters.title}` : null,
  }))
}

export async function getConversation(id: string): Promise<{ conversation: AssistantConversation; messages: AssistantMessage[] }> {
  const [c, m] = await Promise.all([
    supabase.from('ai_conversations').select('id, mode, patient_id, chapter_id, title, created_at, updated_at').eq('id', id).single(),
    supabase.from('ai_messages').select('id, role, content, sources, meta, created_at').eq('conversation_id', id).order('created_at'),
  ])
  if (c.error) throw c.error
  if (m.error) throw m.error
  const r: any = c.data
  return {
    conversation: {
      id: r.id,
      mode: r.mode,
      patientId: r.patient_id,
      chapterId: r.chapter_id,
      title: r.title,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    },
    messages: (m.data ?? []).map((x: any) => ({
      id: x.id,
      role: x.role,
      content: x.content,
      sources: x.sources ?? {},
      steps: x.meta?.steps ?? [],
      createdAt: x.created_at,
    })),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await supabase.from('ai_conversations').delete().eq('id', id)
  if (error) throw error
}

/** De-identified case summary (the same text the server would build), for review/editing before sending. */
export async function getPatientCaseText(patientId: string): Promise<string> {
  const { data, error } = await supabase.rpc('patient_context', { patient: patientId })
  if (error) throw error
  return caseFromContext(data)
}

export async function getAssistantPatientModel(): Promise<AssistantModel> {
  const { data } = await supabase.from('user_settings').select('assistant_patient_model').maybeSingle()
  return (data?.assistant_patient_model as AssistantModel) ?? 'claude-sonnet-5-5'
}

export async function setAssistantPatientModel(model: AssistantModel): Promise<void> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) throw new Error('not signed in')
  const { data: existing } = await supabase.from('user_settings').select('owner_id').maybeSingle()
  const q = existing
    ? supabase.from('user_settings').update({ assistant_patient_model: model }).eq('owner_id', u.user.id)
    : supabase.from('user_settings').insert({ owner_id: u.user.id, assistant_patient_model: model })
  const { error } = await q
  if (error) throw error
}

// ---------------------------------------------------------------- case text
// Mirror of caseFromContext() in supabase/functions/assistant/index.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function caseFromContext(c: any): string {
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
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Answer text for clipboard / progress note / speech: citations become plain labels or vanish. */
export function answerPlainText(text: string, sources: Record<string, AssistantSource>, withRefs = true): string {
  const body = text.replace(/\[(S\d+(?:\s*[,،]\s*S\d+)*)\]/g, (_m, g: string) =>
    withRefs ? `[${g.split(/[,،]/).map((x) => x.trim().slice(1)).join(',')}]` : '',
  )
  if (!withRefs) return body.replace(/[#*|`>]/g, ' ').replace(/\s+/g, ' ').trim()
  const refs = Object.values(sources)
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
    .map((s) => `[${s.id.slice(1)}] ${s.label}${s.heading ? ' — ' + s.heading : ''}`)
  return refs.length ? `${body.trim()}\n\nمنابع:\n${refs.join('\n')}` : body.trim()
}
