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
// Exported so other renderers (e.g. the Academy v2 Reader, which wraps runs
// in real <bdi> elements instead of invisible isolate marks) can match the
// exact same "what counts as a Latin/number run" definition.
export const LATIN_RUN_RE = new RegExp(`[${RUN_CHARS}]+`, 'g')
export const LATIN_RUN_HAS_CONTENT_RE = new RegExp(`[A-Za-z0-9۰-۹${ARROWS}]`)
const RUN_RE = LATIN_RUN_RE
const HAS_CONTENT_RE = LATIN_RUN_HAS_CONTENT_RE

export function isolateLatinRuns(text: string): string {
  return text.replace(RUN_RE, (match) => (HAS_CONTENT_RE.test(match) ? `${LRI}${match}${PDI}` : match))
}
