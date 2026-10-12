// Splits an (already callout-marker-stripped) chapter note into render
// blocks, per NEPHRON_CHAPTER_FORMAT.md's headings that aren't rendered as
// plain headings:
//   ### ترجمه / #### ترجمه       -> dropped; its body merges into the
//                                     surrounding prose stream
//   ### توضیح ساده {.explain}     -> an "explain" block (soft panel)
//   ### نکات امتحانی              -> an "exam" block (suggested-cards panel)
//   ### سؤال N {#id .mcq}         -> an "mcq" block (v1.2 question card)
//   ![caption](figures/x.jpg){#id .figure} -> a "figure" block (v1.3 book figure)
// A note with none of these headings (every hand-authored pre-import
// chapter) comes back as a single 'prose' block holding the whole note
// unchanged, so this is a no-op for the existing authoring convention.

export type NoteBlock =
  | { kind: 'prose'; markdown: string }
  | { kind: 'exam'; sectionId: string | null; markdown: string }
  | { kind: 'explain'; markdown: string }
  | { kind: 'mcq'; id: string; label: string; sectionId: string | null; markdown: string }
  | { kind: 'figure'; id: string; file: string; caption: string; sectionId: string | null }

const HEADING_RE = /^(#{2,4})\s+(.*)$/
// v1.1: a "#### label" line INSIDE a نکات امتحانی/توضیح ساده block is a
// group label (handled downstream by the exam-block parser/renderer), not
// a heading that ends the block -- only ##/### do that. Outside such a
// block, #### still means "ترجمه" (dropped) same as v1.
const BLOCK_END_RE = /^(##|###)\s+/
// v1.2: "### سؤال N {#ch49-q7 .mcq}" -- captures the id, ignores the label text.
const MCQ_HEADING_RE = /\{#([\w-]+)\s+\.mcq\}\s*$/
// v1.3: "![caption](figures/ch49-fig1.jpg){#ch49-fig1 .figure}" on its own line.
const FIGURE_LINE_RE = /^!\[([^\]]*)\]\(figures\/([^)]+)\)\{#([\w-]+)\s+\.figure\}\s*$/

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
        while (i < lines.length && !BLOCK_END_RE.test(lines[i])) {
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
        while (i < lines.length && !BLOCK_END_RE.test(lines[i])) {
          body.push(lines[i])
          i++
        }
        blocks.push({ kind: 'exam', sectionId: currentSectionId, markdown: body.join('\n').trim() })
        continue
      }

      if (m[1] === '###') {
        const mcqMatch = rawText.match(MCQ_HEADING_RE)
        if (mcqMatch) {
          flushProse()
          const id = mcqMatch[1]
          i++
          const body: string[] = []
          while (i < lines.length && !BLOCK_END_RE.test(lines[i])) {
            body.push(lines[i])
            i++
          }
          blocks.push({ kind: 'mcq', id, label: bare, sectionId: currentSectionId, markdown: body.join('\n').trim() })
          continue
        }
      }
    }

    const figMatch = line.trim().match(FIGURE_LINE_RE)
    if (figMatch) {
      flushProse()
      blocks.push({ kind: 'figure', id: figMatch[3], file: figMatch[2], caption: figMatch[1], sectionId: currentSectionId })
      i++
      continue
    }

    proseLines.push(line)
    i++
  }
  flushProse()
  return blocks
}
