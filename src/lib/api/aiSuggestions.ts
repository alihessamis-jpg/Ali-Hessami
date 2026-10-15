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
    // supabase-js swallows the function's own JSON error body on a non-2xx
    // response -- fall back to its generic message when context isn't set.
    const context = (error as { context?: { error?: string } }).context
    throw new Error(context?.error ?? error.message ?? 'Failed to generate AI suggestions')
  }
  if (data?.error) throw new Error(data.error as string)
  return data as ChapterSuggestionResult
}
