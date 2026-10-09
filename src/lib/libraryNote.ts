// Authoring conventions for a Library chapter's `note` (markdown):
//   ## 6.1 Section title       -> a Section (parsed at render time, not stored)
//   {p.1756}                   -> an inline "p. 1756" page-reference chip
//   > [!pearl] text…           -> a PEARL callout box
//   > [!flag] text…            -> a RED FLAG callout box
// Sections are never stored as rows — they're derived from the note's own
// `##` headings, so editing the note is the only way to change them.

export interface ParsedSection {
  number: string
  title: string
  anchor: string
}

const SECTION_HEADING_RE = /^##\s+([\d]+(?:\.[\d]+)*)\s+(.+)$/

export function parseSections(note: string | null | undefined): ParsedSection[] {
  if (!note) return []
  const sections: ParsedSection[] = []
  for (const line of note.split('\n')) {
    const m = line.match(SECTION_HEADING_RE)
    if (m) sections.push({ number: m[1], title: m[2].trim(), anchor: `s${m[1]}` })
  }
  return sections
}

const WORDS_PER_MINUTE = 200

// Consecutive days (counting back from today) with at least one page read.
export function computeReadingStreak(log: Array<{ logDate: string; pagesRead: number }>, today = new Date()): number {
  const readDates = new Set(log.filter((e) => e.pagesRead > 0).map((e) => e.logDate))
  let streak = 0
  const cursor = new Date(today)
  while (readDates.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function estimateMinutesLeft(note: string | null | undefined, readingPct: number): number {
  if (!note) return 0
  const wordCount = note.split(/\s+/).filter(Boolean).length
  const remainingWords = wordCount * (1 - Math.min(100, Math.max(0, readingPct)) / 100)
  return Math.max(1, Math.round(remainingWords / WORDS_PER_MINUTE))
}

// Strips the `[!pearl]`/`[!flag]` marker tokens from the raw markdown text
// (so they don't render as literal text) while recording, in document
// order, which blockquote block each one belonged to. The `blockquote`
// renderer component consumes this array positionally — ReactMarkdown
// renders blockquotes in the same top-to-bottom order they appear in the
// source, so a simple incrementing index lines them up correctly.
export function extractCalloutVariants(note: string): { text: string; variants: Array<'pearl' | 'flag' | null> } {
  const lines = note.split('\n')
  const variants: Array<'pearl' | 'flag' | null> = []
  let i = 0
  while (i < lines.length) {
    if (/^>/.test(lines[i])) {
      const block: string[] = []
      while (i < lines.length && /^>/.test(lines[i])) {
        block.push(lines[i])
        i++
      }
      const joined = block.join(' ')
      const m = joined.match(/\[!(pearl|flag)\]/i)
      variants.push(m ? (m[1].toLowerCase() as 'pearl' | 'flag') : null)
    } else {
      i++
    }
  }
  const text = note.replace(/\[!(pearl|flag)\]\s*/gi, '')
  return { text, variants }
}
