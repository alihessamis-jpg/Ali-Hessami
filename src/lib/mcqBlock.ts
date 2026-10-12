// Parses one NEPHRON_CHAPTER_FORMAT.md v1.2 MCQ block's markdown body (the
// text between a `### سؤال N {#id .mcq}` heading and the next `##`/`###`):
//   <stem paragraph(s)>
//
//   - الف) ...
//   - ب) ...
//   - ج) ...
//   - د) ...
//
//   > [!answer]
//   > **<letter>** — <explanation>
// Shared by chapterImport.ts (building suggested cards) and ChapterProse.tsx
// (rendering the question card), so the two never drift apart.

export interface ParsedMcqChoice {
  label: string
  text: string
  correct: boolean
}

export interface ParsedMcq {
  stem: string
  choices: ParsedMcqChoice[]
  explanation: string | null
}

const OPTION_RE = /^-\s*(الف|ب|ج|د)\)\s*(.*)$/
const ANSWER_MARKER_RE = /^\[!answer\]\s*$/i
const BOLD_RE = /\*\*(.+?)\*\*/

export function parseMcqBlock(markdown: string): ParsedMcq | null {
  const lines = markdown.split('\n')
  let i = 0

  const stemLines: string[] = []
  while (i < lines.length && !OPTION_RE.test(lines[i].trim())) {
    stemLines.push(lines[i])
    i++
  }

  const choices: ParsedMcqChoice[] = []
  while (i < lines.length) {
    const m = lines[i].trim().match(OPTION_RE)
    if (!m) break
    choices.push({ label: m[1], text: m[2].trim(), correct: false })
    i++
  }
  if (choices.length !== 4) return null

  while (i < lines.length && lines[i].trim() === '') i++
  if (i >= lines.length || !/^>/.test(lines[i])) return null

  const quoteLines: string[] = []
  while (i < lines.length && /^>/.test(lines[i])) {
    quoteLines.push(lines[i].replace(/^>\s?/, ''))
    i++
  }
  const quoteText = quoteLines
    .filter((l) => !ANSWER_MARKER_RE.test(l.trim()))
    .join(' ')
    .trim()

  const boldMatch = quoteText.match(BOLD_RE)
  const correctLabel = boldMatch ? boldMatch[1].trim() : null
  if (!correctLabel || !choices.some((c) => c.label === correctLabel)) return null

  for (const c of choices) c.correct = c.label === correctLabel
  const explanation = quoteText.replace(BOLD_RE, '').replace(/^\s*[—-]\s*/, '').trim() || null

  return { stem: stemLines.join('\n').trim(), choices, explanation }
}
