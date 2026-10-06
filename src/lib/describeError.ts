// `err instanceof Error` misses errors thrown as plain objects (e.g. some
// network/parsing failures surface a {message, ...} object rather than a
// real Error), silently falling back to a generic message and hiding the
// actual cause. This checks for a usable `.message` either way.
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}
