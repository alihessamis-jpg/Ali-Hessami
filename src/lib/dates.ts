export function daysSince(dateStr: string): number {
  const ms = new Date().setHours(0, 0, 0, 0) - new Date(dateStr).setHours(0, 0, 0, 0)
  return Math.round(ms / (1000 * 60 * 60 * 24))
}
