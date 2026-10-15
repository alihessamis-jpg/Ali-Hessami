import { supabase } from '../supabaseClient'

export interface ChapterSuggestionCounts {
  questionCount?: number
  flashcardCount?: number
  highYieldCount?: number
}

export interface ChapterSuggestionResult {
  questions: number
  flashcards: number
  highYield: number
}

// Calls the suggest-chapter-content Edge Function (Step 4: AI-suggested
// board questions/flashcards/high-yield points for one chapter). Runs as
// the signed-in user -- everything it writes goes through the normal
// owner_id RLS policies, lands with review_status/status = 'pending' or
// 'suggested', and needs a human approve/reject before it's visible
// anywhere else in the app (see boardQuestions.ts and library.ts).
export async function requestChapterSuggestions(chapterId: string, counts: ChapterSuggestionCounts = {}): Promise<ChapterSuggestionResult> {
  const { data, error } = await supabase.functions.invoke('suggest-chapter-content', {
    body: {
      chapterId,
      questionCount: counts.questionCount,
      flashcardCount: counts.flashcardCount,
      highYieldCount: counts.highYieldCount,
    },
  })
  if (error) {
    // On a non-2xx response, supabase-js's FunctionsHttpError carries the
    // raw Response in `context` (not parsed) -- the function's own JSON
    // error body ({ error: "..." }) has to be read out of it explicitly,
    // or every failure just shows the generic "non-2xx status code".
    const context = (error as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json()
        if (body?.error) throw new Error(body.error as string)
      } catch {
        // fall through to the generic message below
      }
    }
    throw new Error(error.message ?? 'Failed to generate AI suggestions')
  }
  if (data?.error) throw new Error(data.error as string)
  return data as ChapterSuggestionResult
}
