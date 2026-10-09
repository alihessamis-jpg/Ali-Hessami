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
// Parens are deliberately NOT in the plain run's char class any more: a lone
// "(" or ")" must never be isolated on its own (that's what let a mixed
// Persian+Latin parenthetical's closing paren drift during the bidi
// reorder). Parens are only ever isolated as part of a whole
// parenthetical group that is purely Latin/number content end to end --
// see PAREN_GROUP_RE / tokenizeBidi below.
const RUN_CHARS = `A-Za-z0-9۰-۹./%+\\-:,${ARROWS}`
// Exported so other renderers (e.g. the Academy v2 Reader, which wraps runs
// in real <bdi> elements instead of invisible isolate marks) can match the
// exact same "what counts as a Latin/number run" definition.
export const LATIN_RUN_RE = new RegExp(`[${RUN_CHARS}]+`, 'g')
export const LATIN_RUN_HAS_CONTENT_RE = new RegExp(`[A-Za-z0-9۰-۹${ARROWS}]`)
const RUN_RE = LATIN_RUN_RE
const HAS_CONTENT_RE = LATIN_RUN_HAS_CONTENT_RE

// One level of non-nested parens, e.g. "(CKD)" or "(HIF-1α)". Content is
// checked below for "no Persian/Arabic characters inside" before the whole
// group (including both parens) is treated as one isolate unit.
const PAREN_GROUP_RE = /\(([^()]*)\)/g
const PERSIAN_CHAR_RE = /[؀-ۿ]/

export interface BidiToken {
  text: string
  /** true = this run should be isolated as LTR (wrapped in bdi / LRI..PDI) */
  isolate: boolean
}

// Splits `text` into alternating isolate/plain segments:
//  - a "(...)" group whose inner content has no Persian characters and at
//    least one Latin/number character is isolated as ONE unit, parens
//    included (e.g. "(CKD)", "(HIF-1α)");
//  - inside everything else, a plain Latin/number run (no parens) is
//    isolated on its own, exactly as before;
//  - a mixed Persian+Latin parenthetical, e.g. "(کِی‌دوکی، KDOQI)", is left
//    alone as a group -- only the inner "KDOQI" run gets isolated via the
//    plain-run pass, so the parens themselves stay ordinary RTL punctuation.
export function tokenizeBidi(text: string): BidiToken[] {
  const parenRanges: Array<{ start: number; end: number }> = []
  for (const m of text.matchAll(PAREN_GROUP_RE)) {
    const inner = m[1]
    if (inner.length > 0 && !PERSIAN_CHAR_RE.test(inner) && HAS_CONTENT_RE.test(inner)) {
      parenRanges.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length })
    }
  }

  const tokens: BidiToken[] = []
  function pushPlainRuns(segment: string) {
    let last = 0
    for (const m of segment.matchAll(RUN_RE)) {
      const idx = m.index ?? 0
      if (!HAS_CONTENT_RE.test(m[0])) continue
      if (idx > last) tokens.push({ text: segment.slice(last, idx), isolate: false })
      tokens.push({ text: m[0], isolate: true })
      last = idx + m[0].length
    }
    if (last < segment.length) tokens.push({ text: segment.slice(last), isolate: false })
  }

  let cursor = 0
  for (const range of parenRanges) {
    if (range.start > cursor) pushPlainRuns(text.slice(cursor, range.start))
    tokens.push({ text: text.slice(range.start, range.end), isolate: true })
    cursor = range.end
  }
  if (cursor < text.length) pushPlainRuns(text.slice(cursor))
  return tokens
}

export function isolateLatinRuns(text: string): string {
  return tokenizeBidi(text)
    .map((t) => (t.isolate ? `${LRI}${t.text}${PDI}` : t.text))
    .join('')
}
