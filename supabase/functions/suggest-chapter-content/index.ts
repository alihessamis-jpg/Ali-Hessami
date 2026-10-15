// Step 4 of the Board Questions / Academy chapter-linking feature:
// AI-suggested board questions, flashcards and high-yield points for one
// Academy v2 chapter.
//
// Called from the browser (ReaderPage "Suggest with AI") with the user's
// own session -- runs as that user (not service role), so every insert
// goes through the normal owner_id = auth.uid() RLS policies already on
// board_questions and library_cards. Nothing here ever touches patient
// tables, and nothing generated is treated as ready to use:
//   - board_questions rows are inserted with review_status = 'pending'
//     and source = 'پیشنهاد هوش مصنوعی' (its own value, kept apart from
//     "آزمون درون‌بخشی" department-exam imports); they stay invisible to
//     listBoardQuestions()/practice/Board Readiness until a human approves
//     them (see approveBoardQuestionSuggestion/rejectBoardQuestionSuggestion).
//   - library_cards rows (flashcards: kind 'basic'; high-yield points:
//     kind 'basic' + high_yield = true) are inserted with status =
//     'suggested' (the DB default) and source = 'ai_suggested', reusing
//     the exact same approve/reject review flow ReaderPage already has
//     for textbook-import-suggested cards.
// No images or files are generated or stored -- text only.
//
// Env vars (Supabase secrets), set via the dashboard -- set ONE of these:
//   GEMINI_API_KEY    - free, no billing required: aistudio.google.com/apikey
//   ANTHROPIC_API_KEY - from console.anthropic.com (needs billing set up)
// If both are set, Gemini is tried first.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash'
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-5-20250929'

const AI_QUESTION_SOURCE = 'پیشنهاد هوش مصنوعی'
const AI_CARD_SOURCE = 'ai_suggested'

interface RequestBody {
  chapterId: string
  questionCount?: number
  flashcardCount?: number
  highYieldCount?: number
}

interface GeneratedQuestion {
  stem: string
  options: { key: string; text: string }[]
  correct: string
  explanation?: string
}

interface GeneratedCard {
  front: string
  back: string
}

interface GeneratedPayload {
  questions: GeneratedQuestion[]
  flashcards: GeneratedCard[]
  high_yield: GeneratedCard[]
}

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } })
}

// Pulls the first {...} block out of the model's reply -- models reliably
// wrap JSON in prose or a ```json fence despite being asked not to.
function extractJson(text: string): GeneratedPayload {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in model output')
  return JSON.parse(match[0]) as GeneratedPayload
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })

  if (!GEMINI_API_KEY && !ANTHROPIC_API_KEY) {
    return jsonResponse(
      {
        error:
          'No AI provider configured. Add a GEMINI_API_KEY (free, aistudio.google.com/apikey) or ANTHROPIC_API_KEY secret under Supabase project settings -> Edge Functions -> Secrets.',
      },
      500
    )
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }
  if (!body.chapterId) return jsonResponse({ error: 'chapterId is required' }, 400)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401)

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return jsonResponse({ error: 'Not authenticated' }, 401)

  const { data: chapter, error: chapterError } = await supabase
    .from('library_chapters')
    .select('id, title, note')
    .eq('id', body.chapterId)
    .maybeSingle()
  if (chapterError) return jsonResponse({ error: chapterError.message }, 500)
  if (!chapter) return jsonResponse({ error: 'Chapter not found' }, 404)

  const [existingQuestionsRes, exampleQuestionsRes, existingCardsRes] = await Promise.all([
    supabase.from('board_questions').select('question').eq('chapter_id', body.chapterId).neq('review_status', 'rejected'),
    supabase
      .from('board_questions')
      .select('question, options, correct_index, explanation')
      .eq('chapter_id', body.chapterId)
      .eq('question_type', 'mcq')
      .neq('source', AI_QUESTION_SOURCE)
      .not('source', 'is', null)
      .limit(4),
    supabase.from('library_cards').select('front').eq('chapter_id', body.chapterId),
  ])
  if (existingQuestionsRes.error) return jsonResponse({ error: existingQuestionsRes.error.message }, 500)
  if (exampleQuestionsRes.error) return jsonResponse({ error: exampleQuestionsRes.error.message }, 500)
  if (existingCardsRes.error) return jsonResponse({ error: existingCardsRes.error.message }, 500)

  const existingStems = [
    ...existingQuestionsRes.data.map((q: { question: string }) => q.question),
    ...existingCardsRes.data.map((c: { front: string }) => c.front),
  ]

  const questionCount = Math.min(Math.max(body.questionCount ?? 5, 0), 10)
  const flashcardCount = Math.min(Math.max(body.flashcardCount ?? 5, 0), 10)
  const highYieldCount = Math.min(Math.max(body.highYieldCount ?? 5, 0), 10)

  const fewShot = exampleQuestionsRes.data
    .map((q: { question: string; options: string[]; correct_index: number | null; explanation: string | null }) => {
      const optionsText = (q.options ?? []).join('\n')
      const correct = q.correct_index != null ? q.options?.[q.correct_index] : ''
      return `Q: ${q.question}\nOptions:\n${optionsText}\nCorrect: ${correct}\nExplanation: ${q.explanation ?? ''}`
    })
    .join('\n\n')

  const chapterNote = (chapter.note ?? '').slice(0, 8000)

  const prompt = `You are writing study material for a pediatric nephrology fellowship exam bank (Nelson Textbook of Pediatrics style). Chapter: "${chapter.title}".

Chapter content (may be partial):
"""
${chapterNote || '(no stored chapter note -- write from general pediatric nephrology fellowship-level knowledge of this topic)'}
"""
${fewShot ? `\nExisting department-exam questions for this chapter, as a style/difficulty example -- match their style and clinical-vignette format, do NOT repeat their content:\n\n${fewShot}\n` : ''}
${existingStems.length > 0 ? `\nDo not duplicate the substance of these existing items (board questions and flashcards already in the bank for this chapter):\n- ${existingStems.slice(0, 30).join('\n- ')}\n` : ''}

Generate NEW, original content for this chapter:
- ${questionCount} multiple-choice board-exam-style questions, each a clinical vignette or fact-recall stem in Persian (Farsi) with English medical/lab terms kept in English (e.g. drug names, lab values, "ADPKD"), 4 options labeled الف/ب/ج/د, one correct answer, and a short explanation citing the relevant physiology/clinical reasoning.
- ${flashcardCount} flashcards (front = a question or term in Persian, back = a concise answer in Persian with English terms kept in English).
- ${highYieldCount} high-yield one-line facts (front = empty string "", back = the fact itself, concise, in Persian with English terms kept in English).

Respond with ONLY a single JSON object, no prose before or after, no markdown fence, in exactly this shape:
{
  "questions": [{"stem": "...", "options": [{"key": "الف", "text": "..."}, {"key": "ب", "text": "..."}, {"key": "ج", "text": "..."}, {"key": "د", "text": "..."}], "correct": "ب", "explanation": "..."}],
  "flashcards": [{"front": "...", "back": "..."}],
  "high_yield": [{"front": "", "back": "..."}]
}`

  let text: string
  if (GEMINI_API_KEY) {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    )
    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini API error', geminiRes.status, errText)
      return jsonResponse({ error: `Gemini API error: ${errText}` }, 502)
    }
    const geminiJson = await geminiRes.json()
    text = (geminiJson.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  } else {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text()
      console.error('Anthropic API error', anthropicRes.status, errText)
      return jsonResponse({ error: `Anthropic API error: ${errText}` }, 502)
    }
    const anthropicJson = await anthropicRes.json()
    text = (anthropicJson.content ?? []).map((b: { text?: string }) => b.text ?? '').join('')
  }

  let payload: GeneratedPayload
  try {
    payload = extractJson(text)
  } catch (err) {
    return jsonResponse({ error: `Could not parse model output as JSON: ${err instanceof Error ? err.message : err}` }, 502)
  }

  const questionRows = (payload.questions ?? []).map((q) => {
    const options = (q.options ?? []).map((o) => `${o.key}) ${o.text}`)
    const correctIndex = (q.options ?? []).findIndex((o) => o.key === q.correct)
    return {
      owner_id: user.id,
      topic: chapter.title,
      chapter_id: body.chapterId,
      question: q.stem,
      question_type: 'mcq',
      options,
      correct_index: correctIndex >= 0 ? correctIndex : null,
      explanation: q.explanation ?? null,
      source: AI_QUESTION_SOURCE,
      answer_verified: false,
      review_status: 'pending',
    }
  })

  const cardRows = [
    ...(payload.flashcards ?? []).map((c) => ({
      owner_id: user.id,
      chapter_id: body.chapterId,
      kind: 'basic',
      front: c.front,
      back: c.back,
      high_yield: false,
      source: AI_CARD_SOURCE,
    })),
    ...(payload.high_yield ?? []).map((c) => ({
      owner_id: user.id,
      chapter_id: body.chapterId,
      kind: 'basic',
      front: c.front || chapter.title,
      back: c.back,
      high_yield: true,
      source: AI_CARD_SOURCE,
    })),
  ]

  if (questionRows.length > 0) {
    const { error } = await supabase.from('board_questions').insert(questionRows)
    if (error) return jsonResponse({ error: `Failed to save suggested questions: ${error.message}` }, 500)
  }
  if (cardRows.length > 0) {
    const { error } = await supabase.from('library_cards').insert(cardRows)
    if (error) return jsonResponse({ error: `Failed to save suggested cards: ${error.message}` }, 500)
  }

  return jsonResponse({
    questions: questionRows.length,
    flashcards: (payload.flashcards ?? []).length,
    highYield: (payload.high_yield ?? []).length,
  })
})
