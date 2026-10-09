// Parses a NEPHRON_CHAPTER_FORMAT.md v1 chapter-note file: the YAML-lite
// front matter that picks the target chapter, and the "نکات امتحانی" exam
// blocks' bullets into suggested (unscheduled) cards. Rendering the rest of
// the note's markdown is ChapterProse's job (via splitNoteBlocks); this
// module only extracts what the importer itself needs to decide.
import { splitNoteBlocks } from './chapterNoteBlocks'

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
}

export interface ParsedChapterNote {
  meta: ChapterNoteFrontMatter
  body: string
  suggestedCards: ImportedSuggestedCard[]
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
}

// Walks one exam block's raw markdown. A top-level "- " line is a card
// tagged 'book'; a "- " line inside a `[!outside]` blockquote is a card
// tagged 'not-book'. A bold-only line with no leading "- " (a sub-group
// label, e.g. "**اریتروپویتین (EPO)**") is not a bullet and is skipped.
function parseExamBullets(markdown: string): ExamBullet[] {
  const lines = markdown.split('\n')
  const bullets: ExamBullet[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^>/.test(line)) {
      const block: string[] = []
      while (i < lines.length && /^>/.test(lines[i])) {
        block.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      const isOutside = /\[!outside\]/i.test(block.join(' '))
      for (const inner of block) {
        const m = inner.match(/^-\s+(.*)$/)
        if (m) bullets.push({ ...extractCloze(m[1]), tag: isOutside ? 'not-book' : 'book' })
      }
      continue
    }
    const m = line.match(/^-\s+(.*)$/)
    if (m) bullets.push({ ...extractCloze(m[1]), tag: 'book' })
    i++
  }
  return bullets
}

export function parseChapterNoteForImport(raw: string): ParsedChapterNote {
  const { meta, body } = parseChapterNoteFile(raw)
  const blocks = splitNoteBlocks(body)
  const suggestedCards: ImportedSuggestedCard[] = []
  let currentSectionId: string | null | undefined
  let indexInSection = 0

  for (const block of blocks) {
    if (block.kind !== 'exam') continue
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
      })
      indexInSection++
    }
  }

  return { meta, body, suggestedCards }
}
