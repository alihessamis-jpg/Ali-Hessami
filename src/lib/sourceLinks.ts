// v1.5 (NEPHRON_CHAPTER_FORMAT.md section 9): `[[#id|text]]` source links
// and `[[#id]]` source chips inside an answer/summary. Shared by
// ChapterProse's McqCard (whose explanation text bypasses the prose
// special-match system) and ReviewPage (card back/explanation, shown
// outside the Reader entirely, where a link is a cross-page deep link).

export interface SourceLinkSegment {
  kind: 'text' | 'link'
  text: string
  id?: string
  /** true for `[[#id]]` (no pipe text) -- render as the small chip, not a highlighted word. */
  chip?: boolean
}

const SOURCE_LINK_RE = /\[\[#([\w-]+)(?:\|([^\]]+))?\]\]/g

export function splitSourceLinks(text: string): SourceLinkSegment[] {
  const segments: SourceLinkSegment[] = []
  let cursor = 0
  for (const m of text.matchAll(SOURCE_LINK_RE)) {
    const idx = m.index ?? 0
    if (idx > cursor) segments.push({ kind: 'text', text: text.slice(cursor, idx) })
    const id = m[1]
    const label = m[2]
    segments.push({ kind: 'link', text: label ?? 'منبع', id, chip: !label })
    cursor = idx + m[0].length
  }
  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) })
  return segments
}

// Every `{#id}` / `{#id .mcq}` / `{#id .figure}` declared anywhere in a raw
// chapter note -- section/sub-section headings, MCQ questions, figures, and
// (v1.5) paragraph/list/callout-line anchors. A source link whose id isn't
// in this set renders as plain text instead of a tappable link.
const ANCHOR_DECL_RE = /\{#([\w-]+)(?:\s+\.[\w-]+)?\}/g

export function collectAnchorIds(rawNote: string): Set<string> {
  const ids = new Set<string>()
  for (const m of rawNote.matchAll(ANCHOR_DECL_RE)) ids.add(m[1])
  return ids
}

// Strips a trailing `{#id}` (optionally preceded by whitespace) from the end
// of a paragraph's, list item's or callout line's raw text, e.g.
// "... {#ch75-s2-p3}" -> { text: "...", id: "ch75-s2-p3" }.
const TRAILING_ANCHOR_RE = /\s*\{#([\w-]+)\}\s*$/

export function stripTrailingAnchorText(text: string): { text: string; id: string | null } {
  const m = text.match(TRAILING_ANCHOR_RE)
  if (!m || m.index == null) return { text, id: null }
  return { text: text.slice(0, m.index), id: m[1] }
}
