/* eslint-disable @typescript-eslint/no-explicit-any -- Deno edge function; untyped JSON from Supabase / model APIs (deno-lint-ignore marks the same spots) */
// Provider-neutral JSON / text calls for generate-daily-case.
// Same provider rule as the assistant function: CASE_PROVIDER (or
// ASSISTANT_PROVIDER) forces one; otherwise Claude when ANTHROPIC_API_KEY is
// set, else Gemini (GEMINI_API_KEY).

import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const CLAUDE_MODEL = Deno.env.get('CASE_MODEL') ?? 'claude-sonnet-5-5'

export const PROVIDER: 'anthropic' | 'gemini' | null = (() => {
  const forced = Deno.env.get('CASE_PROVIDER') ?? Deno.env.get('ASSISTANT_PROVIDER')
  if (forced === 'anthropic' && ANTHROPIC_API_KEY) return 'anthropic'
  if (forced === 'gemini' && GEMINI_API_KEY) return 'gemini'
  return ANTHROPIC_API_KEY ? 'anthropic' : GEMINI_API_KEY ? 'gemini' : null
})()

export class LlmError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

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

// ------------------------------------------------------------------ Gemini
let geminiModelsCache: string[] | null = null
async function geminiModels(): Promise<string[]> {
  if (geminiModelsCache) return geminiModelsCache
  const list = [GEMINI_MODEL]
  const env = Deno.env.get('GEMINI_FALLBACK_MODELS')
  if (env) list.push(...env.split(',').map((x) => x.trim()).filter(Boolean))
  else {
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
      console.error('[daily-case] gemini model list failed', e)
    }
  }
  geminiModelsCache = [...new Set(list)]
  return geminiModelsCache
}

const RETRYABLE = new Set([429, 500, 502, 503, 504])
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function geminiGenerate(body: unknown, deadline: number): Promise<{ text: string; model: string }> {
  let lastErr = ''
  let lastStatus = 0
  for (let pass = 0; pass < 3; pass++) {
    if (pass > 0) await sleep(pass * 5000)
    for (const model of await geminiModels()) {
      const left = deadline - Date.now()
      if (left < 8000) throw new LlmError(504, `time budget exhausted (${lastStatus} ${lastErr.slice(0, 200)})`)
      let res: Response
      try {
        res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.min(180_000, left)),
        })
      } catch (e) {
        lastStatus = 504
        lastErr = String((e as Error)?.message ?? e)
        continue
      }
      if (res.ok) {
        const j = await res.json()
        // deno-lint-ignore no-explicit-any
        const parts = (j.candidates?.[0]?.content?.parts ?? []) as any[]
        const text = parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('')
        const finish = j.candidates?.[0]?.finishReason
        if (!text && finish) throw new LlmError(502, `Gemini returned no text (${finish})`)
        return { text, model }
      }
      lastStatus = res.status
      lastErr = await res.text().catch(() => '')
      if (!RETRYABLE.has(res.status)) throw new LlmError(res.status, lastErr.slice(0, 400))
    }
  }
  throw new LlmError(lastStatus || 503, lastErr.slice(0, 400))
}

// ------------------------------------------------------------------ public
export interface LlmResult<T> {
  value: T
  model: string
  raw: string
}

/** One structured-output call. Throws LlmError on provider failure; JSON parse errors are thrown as SyntaxError. */
export async function callJson<T>(
  system: string,
  prompt: string,
  schema: Record<string, unknown>,
  opts: { maxTokens: number; deadline: number; effort?: 'low' | 'medium' | 'high' },
): Promise<LlmResult<T>> {
  if (PROVIDER === 'gemini') {
    const { text, model } = await geminiGenerate(
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, maxOutputTokens: opts.maxTokens },
      },
      opts.deadline,
    )
    return { value: JSON.parse(stripFence(text)) as T, model, raw: text }
  }
  if (PROVIDER === 'anthropic') {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: Math.max(10_000, opts.deadline - Date.now()) })
    const resp = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens,
      system,
      output_config: { effort: opts.effort ?? 'medium', format: { type: 'json_schema', schema: addNoExtra(schema) } },
      messages: [{ role: 'user', content: prompt }],
    })
    if (resp.stop_reason === 'refusal') throw new LlmError(422, 'model refused')
    if (resp.stop_reason === 'max_tokens') throw new LlmError(502, 'output truncated (max_tokens)')
    const text = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('')
    return { value: JSON.parse(text) as T, model: CLAUDE_MODEL, raw: text }
  }
  throw new LlmError(500, 'no AI key configured (GEMINI_API_KEY or ANTHROPIC_API_KEY)')
}

/** Plain-text call (case chat). */
export async function callText(system: string, prompt: string, opts: { maxTokens: number; deadline: number }): Promise<string> {
  if (PROVIDER === 'gemini') {
    const { text } = await geminiGenerate(
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: opts.maxTokens },
      },
      opts.deadline,
    )
    return text.trim()
  }
  if (PROVIDER === 'anthropic') {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
    const resp = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: opts.maxTokens,
      system,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: prompt }],
    })
    return resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('').trim()
  }
  throw new LlmError(500, 'no AI key configured')
}

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
}
