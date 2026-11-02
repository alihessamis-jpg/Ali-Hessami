// v1.6 (NEPHRON_CHAPTER_FORMAT.md section 10.4): every source link already
// written (Practice explanations, the note's own MCQ answers) is also read
// in reverse -- paragraph/table/figure anchor -> the questions that cite it.
// No new data: this just indexes links that already exist in
// board_questions.explanation and in imported mcq library_cards'
// options.explanation (the same field ChapterProse's McqCard renders).

import type { BoardQuestion, LibraryCard, McqOptions } from '../types/domain'

export type AnchoredQuestionRef = { kind: 'board'; question: BoardQuestion } | { kind: 'card'; card: LibraryCard }

const LINK_RE = /\[\[#([\w-]+)/g

function extractAnchorIds(text: string | null | undefined): string[] {
  if (!text) return []
  const ids = new Set<string>()
  for (const m of text.matchAll(LINK_RE)) ids.add(m[1])
  return [...ids]
}

function isMcqOptionsWithExplanation(o: LibraryCard['options']): o is McqOptions {
  return !!o && typeof o === 'object' && 'choices' in o
}

export function buildAnchorQuestionIndex(boardQuestions: BoardQuestion[], cards: LibraryCard[]): Map<string, AnchoredQuestionRef[]> {
  const index = new Map<string, AnchoredQuestionRef[]>()
  function add(id: string, ref: AnchoredQuestionRef) {
    const list = index.get(id)
    if (list) list.push(ref)
    else index.set(id, [ref])
  }
  for (const q of boardQuestions) {
    for (const id of extractAnchorIds(q.explanation)) add(id, { kind: 'board', question: q })
  }
  for (const c of cards) {
    if (c.kind !== 'mcq' || !isMcqOptionsWithExplanation(c.options)) continue
    for (const id of extractAnchorIds(c.options.explanation)) add(id, { kind: 'card', card: c })
  }
  return index
}

/** Every question ref belonging to a section's own anchor and every anchor nested under it (sub-sections, paragraphs, figures, tables) -- what the section heading's "🧩 n سؤال در این بخش" badge opens. */
export function sectionQuestionRefs(sectionAnchorId: string, index: Map<string, AnchoredQuestionRef[]>): AnchoredQuestionRef[] {
  const refs: AnchoredQuestionRef[] = []
  for (const [anchorId, list] of index) {
    if (anchorId === sectionAnchorId || anchorId.startsWith(`${sectionAnchorId}-`)) refs.push(...list)
  }
  return refs
}

/** Sum of question counts for a section's own anchor and every anchor nested under it. */
export function sectionQuestionCount(sectionAnchorId: string, index: Map<string, AnchoredQuestionRef[]>): number {
  return sectionQuestionRefs(sectionAnchorId, index).length
}
