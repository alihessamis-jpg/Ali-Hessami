// Persian text mixed with Latin/numeric runs (e.g. "25-OH vitamin D سطح PTH",
// "۵-۱۵ mEq/kg/day", "Cr → eGFR") gets those runs visually reordered or its
// internal characters swapped by the browser's bidi algorithm when they sit
// inside RTL text — a distinct issue from paragraph-direction detection (see
// index.css's unicode-bidi rule). Wrapping each run in Unicode directional
// isolate marks (U+2066 LRI / U+2069 PDI) fixes it without changing anything
// visible — the same effect as wrapping the run in <bdi> or <span dir="ltr">,
// but as invisible characters so it works inside markdown/plain strings too.
const LRI = '⁦'
const PDI = '⁩'
const ARROWS = '←-↙⇄⇅'
const RUN_CHARS = `A-Za-z0-9۰-۹()./%+\\-:,${ARROWS}`
const RUN_RE = new RegExp(`[${RUN_CHARS}]+`, 'g')
const HAS_CONTENT_RE = new RegExp(`[A-Za-z0-9۰-۹${ARROWS}]`)

export function isolateLatinRuns(text: string): string {
  return text.replace(RUN_RE, (match) => (HAS_CONTENT_RE.test(match) ? `${LRI}${match}${PDI}` : match))
}
