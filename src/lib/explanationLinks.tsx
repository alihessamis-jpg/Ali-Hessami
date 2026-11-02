// v1.6 (NEPHRON_CHAPTER_FORMAT.md section 10.1): renders `board_questions.explanation`
// with the same inline vocabulary the Reader uses -- **bold**, line breaks, and
// `[[#id|text]]` / `[[#id]]` source links -- outside the Reader's own prose
// pipeline (ChapterProse), which only ever sees markdown from a chapter note.
// Explanations are plain strings, so this is a small, self-contained tokenizer
// rather than a reuse of ChapterProse's react-markdown component tree.

import type { ReactNode } from 'react'
import { splitSourceLinks } from './sourceLinks'

export interface RenderExplanationOptions {
  /** Called with the anchor id when a source link/chip is tapped. */
  onLinkClick: (id: string) => void
  keyBase: string
}

const BOLD_RE = /\*\*(.+?)\*\*/g

function renderInline(text: string, opts: RenderExplanationOptions, keyPrefix: string): ReactNode[] {
  return splitSourceLinks(text).map((seg, i) => {
    const key = `${keyPrefix}-${i}`
    if (seg.kind === 'text') return <span key={key}>{seg.text}</span>
    return (
      <button
        key={key}
        type="button"
        className={seg.chip ? 'xlink' : 'srclink'}
        onClick={() => opts.onLinkClick(seg.id as string)}
      >
        {seg.text}
      </button>
    )
  })
}

/** Renders explanation text as React nodes: bold spans, line breaks, and tappable source links/chips. */
export function renderExplanation(text: string, opts: RenderExplanationOptions): ReactNode[] {
  return text.split('\n').flatMap((line, lineIdx) => {
    const lineKey = `${opts.keyBase}-l${lineIdx}`
    const parts: ReactNode[] = []
    let cursor = 0
    let boldIdx = 0
    for (const m of line.matchAll(BOLD_RE)) {
      const idx = m.index ?? 0
      if (idx > cursor) parts.push(...renderInline(line.slice(cursor, idx), opts, `${lineKey}-t${boldIdx}`))
      parts.push(<strong key={`${lineKey}-b${boldIdx}`}>{renderInline(m[1], opts, `${lineKey}-b${boldIdx}-in`)}</strong>)
      cursor = idx + m[0].length
      boldIdx++
    }
    if (cursor < line.length) parts.push(...renderInline(line.slice(cursor), opts, `${lineKey}-tail`))
    return lineIdx > 0 ? [<br key={`${lineKey}-br`} />, ...parts] : parts
  })
}
