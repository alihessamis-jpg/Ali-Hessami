// Parses a NEPHRON_CHAPTER_FORMAT.md v1 chapter-note file: the YAML-lite
// front matter that picks the target chapter, and the "نکات امتحانی" exam
// blocks' bullets into suggested (unscheduled) cards. Rendering the rest of
// the note's markdown is ChapterProse's job (via splitNoteBlocks); this
// module only extracts what the importer itself needs to decide.
import { splitNoteBlocks, type NoteBlock } from './chapterNoteBlocks'
import { parseMcqBlock } from './mcqBlock'

export interface ChapterNoteFrontMatter {
  format: string | null
  book: string | null
  part: string | null
  chapter: number
  chapterTitleEn: string | null
  title: string | null
  subtitle: string | null
  pages: string | null
  language: string | null
  direction: string | null
  sections: number | null
}

export interface ImportedSuggestedCard {
  importKey: string
  sectionNumber: string | null
  front: string
  back: string
  tags: string[]
  /** v1.1: the "#### label" group this bullet sat under, if any. */
  topic: string | null
  /** v1.1: from a trailing ⭐ on the bullet or its group label. */
  highYield: boolean
  /** v1.3: the figure to show on the card back, if its group label names one. */
  figureKey: string | null
}

/** v1.3: one `![caption](figures/x.jpg){#id .figure}` book figure. */
export interface ImportedFigure {
  figureKey: string
  file: string
  caption: string
}

/** v1.2: a `### سؤال N {#id .mcq}` block, suggested like exam-bullet cards. */
export interface ImportedMcqCard {
  importKey: string
  sectionNumber: string | null
  front: string
  back: string
  options: { choices: Array<{ label: string; text: string; correct: boolean }>; explanation: string | null }
}

export interface ParsedChapterNote {
  meta: ChapterNoteFrontMatter
  body: string
  suggestedCards: ImportedSuggestedCard[]
  suggestedMcqCards: ImportedMcqCard[]
  figures: ImportedFigure[]
}

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export function parseChapterNoteFile(raw: string): { meta: ChapterNoteFrontMatter; body: string } {
  const fmMatch = raw.match(FRONT_MATTER_RE)
  if (!fmMatch) {
    throw new Error('Missing front matter block (file must start with a --- ... --- section)')
  }
  const fields: Record<string, string> = {}
  for (const line of fmMatch[1].split('\n')) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/)
    if (m) fields[m[1]] = m[2].trim()
  }
  const chapterNumber = Number(fields.chapter)
  if (!fields.chapter || Number.isNaN(chapterNumber) || chapterNumber <= 0) {
    throw new Error('Front matter is missing a valid "chapter:" number')
  }
  const body = raw.slice(fmMatch[0].length)
  return {
    meta: {
      format: fields.format ?? null,
      book: fields.book ?? null,
      part: fields.part ?? null,
      chapter: chapterNumber,
      chapterTitleEn: fields.chapter_title_en ?? null,
      title: fields.title ?? null,
      subtitle: fields.subtitle ?? null,
      pages: fields.pages ?? null,
      language: fields.language ?? null,
      direction: fields.direction ?? null,
      sections: fields.sections ? Number(fields.sections) : null,
    },
    body,
  }
}

const BOLD_RE = /\*\*(.+?)\*\*/g

function extractCloze(bulletText: string): { front: string; back: string } {
  const bold = [...bulletText.matchAll(BOLD_RE)]
  if (bold.length === 0) return { front: bulletText.trim(), back: bulletText.trim() }
  const back = bold.map((m) => m[1].trim()).join('، ')
  const front = bulletText.replace(BOLD_RE, '_____').trim()
  return { front, back }
}

interface ExamBullet {
  front: string
  back: string
  tag: 'book' | 'not-book'
  topic: string | null
  highYield: boolean
}

// Trailing ⭐ (v1.1): strips it from the text that becomes the card, and
// reports whether it was there so the caller can set high_yield.
const STAR_RE = /\s*⭐\s*$/

function stripStar(text: string): { text: string; starred: boolean } {
  return { text: text.replace(STAR_RE, '').trimEnd(), starred: STAR_RE.test(text) }
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

function toEnglishDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
}

function figureNumberFromKey(key: string): number | null {
  const m = key.match(/fig(\d+)$/)
  return m ? Number(m[1]) : null
}

// v1.3: "#### خواندن شکل ۱ ⭐" -- a group label naming a figure. Matches it to
// the parsed figure with the same number (from its id, e.g. "ch49-fig1"),
// falling back to the chapter's only figure when there's just one.
function findFigureForGroupLabel(label: string, figures: ImportedFigure[]): string | null {
  if (figures.length === 0 || !label.includes('شکل')) return null
  const numMatch = label.match(/شکل\s*([۰-۹0-9]+)/)
  if (numMatch) {
    const num = Number(toEnglishDigits(numMatch[1]))
    const match = figures.find((f) => figureNumberFromKey(f.figureKey) === num)
    if (match) return match.figureKey
  }
  return figures.length === 1 ? figures[0].figureKey : null
}

// Walks one exam block's raw markdown.
//  - "#### label" (v1.1): not a card -- sets the topic/tag for every bullet
//    that follows, until the next "#### label" or the end of the block. A
//    trailing ⭐ on the label makes every bullet in that group high-yield.
//  - a top-level "- " line is a card tagged 'book'; inside a `[!outside]`
//    blockquote it's tagged 'not-book' instead.
//  - a bold-only line with no leading "- " (a sub-group label, e.g.
//    "**اریتروپویتین (EPO)**") is not a bullet and is skipped.
//  - (v1.1) a bullet ending in ":" followed by indented "  - " bullets is
//    not itself a card -- each nested bullet is its own card, with the
//    parent's text kept as context in its front.
//  - a trailing ⭐ on any bullet (parent group's star aside) makes just
//    that card high-yield.
function parseExamBullets(markdown: string): ExamBullet[] {
  const lines = markdown.split('\n')
  const bullets: ExamBullet[] = []
  let topic: string | null = null
  let groupHighYield = false
  let i = 0

  function pushBullet(rawText: string, tag: 'book' | 'not-book') {
    const { text, starred } = stripStar(rawText)
    const { front, back } = extractCloze(text)
    bullets.push({ front, back, tag, topic, highYield: groupHighYield || starred })
  }

  while (i < lines.length) {
    const line = lines[i]

    const groupMatch = line.match(/^####\s+(.*)$/)
    if (groupMatch) {
      const { text, starred } = stripStar(groupMatch[1].trim())
      topic = text
      groupHighYield = starred
      i++
      continue
    }

    if (/^>/.test(line)) {
      const block: string[] = []
      while (i < lines.length && /^>/.test(lines[i])) {
        block.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      const isOutside = /\[!outside\]/i.test(block.join(' '))
      for (const inner of block) {
        const m = inner.match(/^-\s+(.*)$/)
        if (m) pushBullet(m[1], isOutside ? 'not-book' : 'book')
      }
      continue
    }

    const topMatch = line.match(/^-\s+(.*)$/)
    if (topMatch) {
      const bulletText = topMatch[1]
      const nested: string[] = []
      let j = i + 1
      while (j < lines.length && /^\s{2,}-\s+/.test(lines[j])) {
        nested.push(lines[j].replace(/^\s+-\s+/, ''))
        j++
      }
      const endsWithColon = /[:：]\s*$/.test(bulletText.trim())
      if (nested.length > 0 && endsWithColon) {
        const stem = stripStar(bulletText).text.replace(/[:：]\s*$/, '').trim()
        for (const nestedText of nested) {
          const { text, starred } = stripStar(nestedText)
          const { front, back } = extractCloze(text)
          bullets.push({ front: `${stem}: ${front}`, back, tag: 'book', topic, highYield: groupHighYield || starred })
        }
        i = j
        continue
      }
      // No colon+nested pattern: the line is a normal bullet in its own
      // right, and any indented lines under it (not expected here) are
      // still given their own cards rather than silently dropped.
      pushBullet(bulletText, 'book')
      for (const nestedText of nested) pushBullet(nestedText, 'book')
      i = j
      continue
    }

    i++
  }
  return bullets
}

export function parseChapterNoteForImport(raw: string): ParsedChapterNote {
  const { meta, body } = parseChapterNoteFile(raw)
  const blocks = splitNoteBlocks(body)
  const suggestedCards: ImportedSuggestedCard[] = []
  const suggestedMcqCards: ImportedMcqCard[] = []
  const figures: ImportedFigure[] = blocks
    .filter((b): b is Extract<NoteBlock, { kind: 'figure' }> => b.kind === 'figure')
    .map((b) => ({ figureKey: b.id, file: b.file, caption: b.caption }))
  let currentSectionId: string | null | undefined
  let indexInSection = 0

  for (const block of blocks) {
    if (block.kind === 'exam') {
      if (block.sectionId !== currentSectionId) {
        currentSectionId = block.sectionId
        indexInSection = 0
      }
      for (const bullet of parseExamBullets(block.markdown)) {
        suggestedCards.push({
          importKey: `${block.sectionId ?? 'root'}::exam::${indexInSection}`,
          sectionNumber: block.sectionId ? block.sectionId.replace(/^.*-s/, '') : null,
          front: bullet.front,
          back: bullet.back,
          tags: bullet.tag === 'not-book' ? ['not-book'] : [],
          topic: bullet.topic,
          highYield: bullet.highYield,
          figureKey: bullet.topic ? findFigureForGroupLabel(bullet.topic, figures) : null,
        })
        indexInSection++
      }
      continue
    }

    if (block.kind === 'mcq') {
      const parsed = parseMcqBlock(block.markdown)
      if (!parsed) continue
      const correct = parsed.choices.find((c) => c.correct)
      suggestedMcqCards.push({
        importKey: block.id,
        sectionNumber: block.sectionId ? block.sectionId.replace(/^.*-s/, '') : null,
        front: parsed.stem,
        back: correct?.text ?? '',
        options: { choices: parsed.choices, explanation: parsed.explanation },
      })
    }
  }

  return { meta, body, suggestedCards, suggestedMcqCards, figures }
}
