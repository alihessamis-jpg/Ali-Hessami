// Keyword match against a patient's diagnosis/underlying disease text —
// used to surface a post-obstructive diuresis watch after surgery for
// conditions like PUV where relieving the obstruction can trigger polyuria.
const OBSTRUCTIVE_UROPATHY_PATTERN =
  /\bpuv\b|posterior urethral valve|obstructive uropathy|upj obstruction|ureteropelvic junction|uvj obstruction|ureterovesical junction/i

export function hasObstructiveUropathy(patient: { diagnosis?: string | null; underlyingDisease?: string | null }): boolean {
  const text = `${patient.diagnosis ?? ''} ${patient.underlyingDisease ?? ''}`
  return OBSTRUCTIVE_UROPATHY_PATTERN.test(text)
}
