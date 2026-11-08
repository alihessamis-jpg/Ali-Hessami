import { PERSIAN_VERSES, type PersianVerse } from '../data/persianVerses'
import { formatShamsiWeekdayLong } from './shamsi'

// Local calendar date (the user's own day, e.g. Tehran), not UTC — so the
// verse changes at local midnight rather than at 03:30 Tehran time.
export function localIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return localIsoDate(new Date(y, m - 1, d + days))
}

// "شنبه ۱۷ آبان ۱۴۰۵" for an ISO date string.
export function shamsiWeekdayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return formatShamsiWeekdayLong(new Date(y, m - 1, d))
}

// Next verse to show: the first one (in poet-rotating order) that hasn't
// been shown yet; once all have been shown, cycle through again.
export function pickNextVerse(usedKeys: Iterable<string>, totalShown: number): PersianVerse {
  const used = new Set(usedKeys)
  const fresh = PERSIAN_VERSES.find((v) => !used.has(v.key))
  return fresh ?? PERSIAN_VERSES[totalShown % PERSIAN_VERSES.length]
}

// Deterministic fallback when the verse can't be saved (offline / table
// missing): same verse all day, rotating by day number.
export function verseForDate(iso: string): PersianVerse {
  const [y, m, d] = iso.split('-').map(Number)
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
  return PERSIAN_VERSES[dayNumber % PERSIAN_VERSES.length]
}
