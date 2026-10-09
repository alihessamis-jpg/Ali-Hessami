// Temporary diagnostic helper -- Supabase/PostgREST errors are plain
// objects, not `instanceof Error`, so `err instanceof Error ? err.message :
// 'generic fallback'` silently swallows the real reason (missing table,
// missing column, RLS denial). describeError() surfaces it regardless of
// shape; tagPromise() labels which query failed so a Promise.all rejection
// says which table broke instead of just "Failed to load X".

export function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [e.message, e.details, e.hint, e.code ? `code ${e.code}` : null].filter(Boolean)
    if (parts.length > 0) return parts.join(' — ')
  }
  if (err instanceof Error) return err.message
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

export function tagPromise<T>(label: string, promise: Promise<T>): Promise<T> {
  return promise.catch((err) => {
    throw new Error(`[${label}] ${describeError(err)}`)
  })
}
