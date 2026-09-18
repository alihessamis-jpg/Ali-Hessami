// Persian text mixed with a numeric range (e.g. "۵-۱۵ mEq/kg/day") gets its
// two numbers visually swapped by the browser's bidi algorithm when the
// range sits as its own space-separated token inside RTL text — a distinct
// issue from paragraph-direction detection (see index.css's unicode-bidi
// rule), specific to how EN/AN number runs joined by a separator resolve
// inside an RTL paragraph. Wrapping the range in invisible LRM (U+200E)
// marks fixes it without changing anything visible.
const LRM = '‎'
const NUMBER_RANGE_RE = /([0-9۰-۹]+\s*[-–]\s*[0-9۰-۹]+)/g

export function protectNumberRanges(text: string): string {
  return text.replace(NUMBER_RANGE_RE, `${LRM}$1${LRM}`)
}
