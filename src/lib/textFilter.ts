// Shared case-insensitive substring search used by every list/library page's
// search box, so "does this item match the query" is defined once.
export function matchesSearch(fields: Array<string | number | null | undefined>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((f) => f != null && String(f).toLowerCase().includes(q))
}
