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
// see tokenizeBidi below.
//
// A space is deliberately IN this class (unlike parens): a multi-word
// English phrase like "Radiological features of ARPKD" must be ONE isolate
// unit, not one per word -- isolating each word separately left the plain
// RTL spaces between them to the browser's bidi algorithm, which reordered
// the words (e.g. rendering it as "ARPKD of features Radiological"). A run
// is still cut at the first Persian/Arabic character either side, so this
// never merges two unrelated Latin phrases separated by Persian text.
const RUN_CHARS = `A-Za-z0-9۰-۹ ./%+\\-:;,'’α-ω${ARROWS}`
// Exported so other renderers (e.g. the Academy v2 Reader, which wraps runs
// in real <bdi> elements instead of invisible isolate marks) can match the
// exact same "what counts as a Latin/number run" definition.
export const LATIN_RUN_RE = new RegExp(`[${RUN_CHARS}]+`, 'g')
export const LATIN_RUN_HAS_CONTENT_RE = new RegExp(`[A-Za-z0-9۰-۹α-ω${ARROWS}]`)

const PERSIAN_CHAR_RE = /[؀-ۿ]/

export interface BidiToken {
  text: string
  /** true = this run should be isolated as LTR (wrapped in bdi / LRI..PDI) */
  isolate: boolean
}

// Splits `text` into alternating isolate/plain segments. Every stretch of
// text with no Persian/Arabic letters is one candidate; within it, the span
// from the first to the last Latin/number character is isolated as ONE LTR
// unit, so an English phrase keeps its own order even across "=", "+", "/",
// "(…)" or arrows ("autoregulation = myogenic (Ca voltage-gated) + TGF").
//  - Spaces, sentence punctuation, connector symbols and arrows at the edges
//    stay OUTSIDE the isolate and follow the RTL paragraph: inside it they
//    were laid out on the wrong side ("RET با" shown as "RETبا", a "Term:"
//    colon flipped, "کارایی↓ ←" arrows swapped).
//  - A comparison sign glued to a number ("<5.3", "≥90") and a suffix glued
//    to a term ("CD4+", "22%") stay inside.
//  - Parens: a group closed inside the span is kept whole ("(CKD)",
//    "(HIF-1α)"); an unmatched paren -- one whose partner sits across
//    Persian text, e.g. "(کِی‌دوکی، KDOQI)" -- is never isolated, it stays an
//    ordinary RTL paren and the span is split around it.
// Persian/Arabic LETTERS and Persian punctuation end a span; Persian and
// Arabic-Indic digits and the Arabic percent/decimal/thousands signs (٪ ٫ ٬)
// do not, so "۵-۱۵ mEq/kg/day" or "۳۰–۴۰٪" stays one unit. An interpunct
// ("پرسش ۱۵ · RAS") or newline always ends a span, and so does a "←": in
// these notes it is a right-to-left "leads to" written between two terms
// ("Pelvic fracture ← membranous urethra"), and inside an LTR isolate it
// would point back at the wrong term. ("→" stays inside: there it reads
// correctly left-to-right.)
const NON_PERSIAN_SPAN_RE = /[^\u0600-\u065F\u066D-\u06EF\u06FA-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\n·•←⟵⇐]+/g
const CONTENT_RE = /[A-Za-z0-9۰-۹٠-٩α-ωΑ-Ωµ]/
const GLUED_PREFIX_RE = /[<>≤≥±~≈−-]/
const GLUED_SUFFIX_RE = /[+%٪°′″*]/

export function tokenizeBidi(text: string): BidiToken[] {
  const tokens: BidiToken[] = []
  const push = (t: string, isolate: boolean) => {
    if (!t) return
    const prev = tokens[tokens.length - 1]
    if (prev && prev.isolate === isolate && !isolate) prev.text += t
    else tokens.push({ text: t, isolate })
  }

  function core(seg: string) {
    let i = 0
    while (i < seg.length && !CONTENT_RE.test(seg[i])) i++
    if (i === seg.length) {
      push(seg, false)
      return
    }
    let j = seg.length - 1
    while (!CONTENT_RE.test(seg[j])) j--
    while (i > 0 && GLUED_PREFIX_RE.test(seg[i - 1])) i--
    while (j < seg.length - 1 && GLUED_SUFFIX_RE.test(seg[j + 1])) j++
    // Pull in closing/opening parens that pair with ones inside the span.
    const count = (s: string, c: string) => s.split(c).length - 1
    while (j < seg.length - 1 && seg[j + 1] === ')' && count(seg.slice(i, j + 1), '(') > count(seg.slice(i, j + 1), ')')) j++
    while (i > 0 && seg[i - 1] === '(' && count(seg.slice(i, j + 1), ')') > count(seg.slice(i, j + 1), '(')) i--
    const mid = seg.slice(i, j + 1)
    // A bare number followed by a separate "(…)" note ("۲۶٪ (P = 1.0)") is
    // two units, not one LTR phrase -- otherwise the note is read first.
    const numParen = mid.match(/^[^A-Za-zα-ωΑ-Ωµ]*?(\s+)\(/)
    if (numParen && numParen.index === 0) {
      const cut = numParen[0].length - 1 - numParen[1].length
      push(seg.slice(0, i), false)
      core(mid.slice(0, cut))
      core(mid.slice(cut))
      push(seg.slice(j + 1), false)
      return
    }
    // Unmatched paren inside: split around it (it stays plain RTL text).
    const stack: number[] = []
    let bad = -1
    for (let k = 0; k < mid.length && bad < 0; k++) {
      if (mid[k] === '(') stack.push(k)
      else if (mid[k] === ')') {
        if (stack.length) stack.pop()
        else bad = k
      }
    }
    if (bad < 0 && stack.length) bad = stack[0]
    push(seg.slice(0, i), false)
    if (bad < 0) {
      push(mid, true)
    } else {
      core(mid.slice(0, bad))
      push(mid[bad], false)
      core(mid.slice(bad + 1))
    }
    push(seg.slice(j + 1), false)
  }

  let last = 0
  for (const m of text.matchAll(NON_PERSIAN_SPAN_RE)) {
    const idx = m.index ?? 0
    push(text.slice(last, idx), false)
    core(m[0])
    last = idx + m[0].length
  }
  push(text.slice(last), false)
  return tokens
}

export function isolateLatinRuns(text: string): string {
  // Also used on raw markdown (MarkdownSection): never let an isolate span
  // markdown syntax such as table pipes, emphasis markers, link brackets,
  // a link's "](url)" target, or a line-leading ordered-list marker ("1. ") —
  // an isolate before the digit stops markdown from seeing the list at all.
  return text
    .split(/(\]\([^)]*\)|[|*_`[\]#>]+|(?:^|(?<=\n))[ \t]*\d+[.)](?=[ \t]))/)
    .map((piece, k) =>
      k % 2 === 1
        ? piece
        : tokenizeBidi(piece)
            .map((t) => (t.isolate ? `${LRI}${t.text}${PDI}` : t.text))
            .join('')
    )
    .join('')
}

// Block-level base direction for mixed Persian/English content. The global
// `* { unicode-bidi: plaintext }` rule guesses each paragraph's direction
// from its FIRST strong character, so a Persian sentence that happens to
// start with an English term ("PTH بالا ...", "**Nephrotic syndrome**: ...")
// was laid out left-to-right and its Persian clauses scrambled. Any block
// that contains Persian is RTL; only purely Latin blocks stay LTR.
export function blockDir(text: string): 'rtl' | 'ltr' {
  return PERSIAN_CHAR_RE.test(text) || !/[A-Za-z]/.test(text) ? 'rtl' : 'ltr'
}

// True when a block has Latin letters but no Persian at all. Such a block is
// still laid out RTL (right-aligned like the rest of the page), but its
// content is wrapped in ONE <bdi dir="ltr"> so the English sentence keeps its
// own word order and punctuation instead of being split into several
// isolates that an RTL paragraph would reorder.
export function isLatinOnly(text: string): boolean {
  return !PERSIAN_CHAR_RE.test(text) && /[A-Za-z]/.test(text)
}
