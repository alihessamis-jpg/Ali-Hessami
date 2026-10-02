import type { AcademyTopic } from '../types/domain'

const PERSIAN_DIGITS: Record<string, string> = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' }

// Sub-topic names are often numbered (e.g. "۱۰. مطالعات بالینی") so they can
// be read in the book's original order — a plain string sort would put
// "۱۰." before "۲." since "1" < "2" lexicographically. Pull the leading
// number out (converting Persian digits) so sibling lessons sort 1, 2, 3…
// instead of 1, 10, 11, 2, 3…
export function leadingNumber(name: string): number | null {
  const normalized = name.replace(/[۰-۹]/g, (d) => PERSIAN_DIGITS[d])
  const match = normalized.match(/^\s*(\d+)[.\-–)]/)
  return match ? Number(match[1]) : null
}

export function sortSubTopics(items: AcademyTopic[]): AcademyTopic[] {
  return [...items].sort((a, b) => {
    const na = leadingNumber(a.name)
    const nb = leadingNumber(b.name)
    if (na != null && nb != null) return na - nb
    if (na != null) return -1
    if (nb != null) return 1
    return a.name.localeCompare(b.name)
  })
}
