// Splits an (already callout-marker-stripped) chapter note into render
// blocks, per NEPHRON_CHAPTER_FORMAT.md's headings that aren't rendered as
// plain headings:
//   ### ترجمه / #### ترجمه       -> dropped; its body merges into the
//                                     surrounding prose stream
//   ### توضیح ساده {.explain}     -> an "explain" block (soft panel)
//   ### نکات امتحانی              -> an "exam" block (suggested-cards panel)
// A note with none of these headings (every hand-authored pre-import
// chapter) comes back as a single 'prose' block holding the whole note
// unchanged, so this is a no-op for the existing authoring convention.

export type NoteBlock =
  | { kind: 'prose'; markdown: string }
  | { kind: 'exam'; sectionId: string | null; markdown: string }
  | { kind: 'explain'; markdown: string }

const HEADING_RE = /^(#{2,4})\s+(.*)$/

function bareHeadingText(text: string): string {
  // Drop a trailing {#id} or {.class} attribute block before comparing.
  return text.replace(/\s*\{[^}]*\}\s*$/, '').trim()
}

export function splitNoteBlocks(note: string): NoteBlock[] {
  const lines = note.split('\n')
  const blocks: NoteBlock[] = []
  let proseLines: string[] = []
  let currentSectionId: string | null = null
  let i = 0

  function flushProse() {
    if (proseLines.length > 0) {
      const text = proseLines.join('\n').trim()
      if (text) blocks.push({ kind: 'prose', markdown: text })
      proseLines = []
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const m = line.match(HEADING_RE)
    if (m) {
      const rawText = m[2].trim()
      if (m[1] === '##') {
        const idMatch = rawText.match(/\{#([\w-]+)\}/)
        if (idMatch) currentSectionId = idMatch[1]
      }
      const bare = bareHeadingText(rawText)

      if (bare === 'ترجمه') {
        i++
        continue
      }

      if (bare === 'توضیح ساده') {
        flushProse()
        i++
        const body: string[] = []
        while (i < lines.length && !HEADING_RE.test(lines[i])) {
          body.push(lines[i])
          i++
        }
        blocks.push({ kind: 'explain', markdown: body.join('\n').trim() })
        continue
      }

      if (bare === 'نکات امتحانی') {
        flushProse()
        i++
        const body: string[] = []
        while (i < lines.length && !HEADING_RE.test(lines[i])) {
          body.push(lines[i])
          i++
        }
        blocks.push({ kind: 'exam', sectionId: currentSectionId, markdown: body.join('\n').trim() })
        continue
      }
    }
    proseLines.push(line)
    i++
  }
  flushProse()
  return blocks
}
