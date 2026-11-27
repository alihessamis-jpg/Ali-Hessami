// PostgREST caps every response at the project's max-rows (1000 by default), so
// a plain select silently truncates big tables (board_questions has 1375+).
// fetchAll pages through with .range() until a short page comes back.

const PAGE = 1000

interface RangeQuery {
  range: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
}

/**
 * `make()` must return a fresh, fully-ordered query each call (order keeps
 * pages stable). Rows are cast to T, as the rest of the API layer does.
 */
export async function fetchAll<T>(make: () => RangeQuery): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}
