import { jalaaliMonthLength, jalaaliToDateObject, toJalaali } from 'jalaali-js'

export const SHAMSI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

// Jalaali week starts on Saturday.
export const SHAMSI_WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

// Full Persian weekday names, indexed by JS Date.getDay() (0 = Sunday … 6 = Saturday) —
// used for display strings like "پنجشنبه ۱۶ مهر ۱۴۰۵", separate from the
// Saturday-first SHAMSI_WEEKDAYS abbreviations used as calendar-grid headers.
const WEEKDAY_NAMES_BY_JS_DAY = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']

// e.g. "پنجشنبه ۱۶ مهر ۱۴۰۵" for the given date (defaults to now).
export function formatShamsiWeekdayLong(date: Date = new Date()): string {
  const { jy, jm, jd } = toJalaali(date)
  return `${WEEKDAY_NAMES_BY_JS_DAY[date.getDay()]} ${toPersianDigits(jd)} ${SHAMSI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`
}

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

export function toPersianDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)])
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

// Converts an ISO ("YYYY-MM-DD...") date string to a Shamsi display string.
// Non-ISO input (free text, empty) is returned unchanged so it never throws
// on data that isn't actually a date.
export function toShamsi(iso: string | null | undefined, style: 'numeric' | 'long' = 'numeric'): string {
  if (!iso) return ''
  const parsed = parseIsoDate(iso)
  if (!parsed) return iso
  const { jy, jm, jd } = toJalaali(parsed.y, parsed.m, parsed.d)
  if (style === 'long') {
    return `${toPersianDigits(jd)} ${SHAMSI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`
  }
  const mm = String(jm).padStart(2, '0')
  const dd = String(jd).padStart(2, '0')
  return toPersianDigits(`${jy}/${mm}/${dd}`)
}

export function todayJalaali() {
  return toJalaali(new Date())
}

export function jalaaliMonthGrid(jy: number, jm: number): Array<number | null> {
  const length = jalaaliMonthLength(jy, jm)
  const firstDayIndex = (jalaaliToDateObject(jy, jm, 1).getDay() + 1) % 7
  return [...Array(firstDayIndex).fill(null), ...Array.from({ length }, (_, i) => i + 1)]
}
