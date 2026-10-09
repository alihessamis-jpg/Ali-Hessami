import { useEffect, useRef, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Element as HastElement, RootContent } from 'hast'
import { tokenizeBidi } from '../../lib/bidiText'
import { extractCalloutVariants, type CalloutVariant } from '../../lib/libraryNote'
import { splitNoteBlocks } from '../../lib/chapterNoteBlocks'
import { toPersianDigits } from '../../lib/shamsi'
import type { LibraryCard, LibraryHighlight } from '../../types/domain'

export interface MakeCardPayload {
  sectionNumber: string | null
  sourceText: string
  front: string
  back: string
}

export interface MakeCardsFromTablePayload {
  sectionNumber: string | null
  cards: Array<{ front: string; back: string }>
}

interface Props {
  note: string
  cards: LibraryCard[]
  highlights: LibraryHighlight[]
  onMakeCard?: (payload: MakeCardPayload) => void
  onHighlight?: (payload: { sectionNumber: string | null; text: string }) => void
  onMakeCardsFromTable?: (payload: MakeCardsFromTablePayload) => void
  /** Approve every suggested card in the given section at once. */
  onApproveAllSuggested?: (cardIds: string[]) => void
  /** Open a one-by-one approve/skip flow for the given suggested cards. */
  onReviewSuggestedOneByOne?: (cardIds: string[]) => void
}

function renderBdi(text: string, keyBase: string): ReactNode[] {
  const tokens = tokenizeBidi(text)
  if (tokens.every((t) => !t.isolate)) return [text]
  let i = 0
  return tokens.map((t) =>
    t.isolate ? (
      <bdi dir="ltr" key={`${keyBase}-${i++}`}>
        {t.text}
      </bdi>
    ) : (
      t.text
    )
  )
}

interface SpecialMatch {
  start: number
  end: number
  kind: 'pageref' | 'carded' | 'mark' | 'reference'
  page?: number
  id?: string
  text: string
}

// `{p.N}` (older hand-authored notes) and `[p. N]` (NEPHRON_CHAPTER_FORMAT
// imports) are both rendered as the same small "p. N" chip.
const PAGE_REF_RES = [/\{p\.(\d+)\}/g, /\[p\.\s?(\d+)\]/g]
// `[۱۵]`, `[۳، ۴]`, `[۲۳ تا ۲۵]` -- a bracketed Persian-digit reference
// number (or range/list of them), rendered small and muted.
const REFERENCE_RE = /\[([۰-۹][۰-۹،,\sتا]*)\]/g

function findMatches(text: string, cards: LibraryCard[], highlights: LibraryHighlight[]): SpecialMatch[] {
  const matches: SpecialMatch[] = []
  for (const pageRe of PAGE_REF_RES) {
    for (const m of text.matchAll(pageRe)) {
      matches.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: 'pageref', page: Number(m[1]), text: m[0] })
    }
  }
  for (const m of text.matchAll(REFERENCE_RE)) {
    matches.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: 'reference', text: m[0] })
  }
  for (const c of cards) {
    if (!c.sourceText) continue
    const idx = text.indexOf(c.sourceText)
    if (idx >= 0) matches.push({ start: idx, end: idx + c.sourceText.length, kind: 'carded', id: c.id, text: c.sourceText })
  }
  for (const h of highlights) {
    if (h.kind !== 'highlight') continue
    const idx = text.indexOf(h.text)
    if (idx >= 0) matches.push({ start: idx, end: idx + h.text.length, kind: 'mark', id: h.id, text: h.text })
  }
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
  const result: SpecialMatch[] = []
  let lastEnd = -1
  for (const m of matches) {
    if (m.start >= lastEnd) {
      result.push(m)
      lastEnd = m.end
    }
  }
  return result
}

function renderTextWithSpecials(text: string, cards: LibraryCard[], highlights: LibraryHighlight[], keyBase: string): ReactNode[] {
  const matches = findMatches(text, cards, highlights)
  if (matches.length === 0) return renderBdi(text, keyBase)
  const nodes: ReactNode[] = []
  let cursor = 0
  matches.forEach((m, i) => {
    if (m.start > cursor) nodes.push(...renderBdi(text.slice(cursor, m.start), `${keyBase}-t${i}`))
    if (m.kind === 'pageref') {
      nodes.push(
        <span className="pg" key={`${keyBase}-p${i}`}>
          p. {m.page}
        </span>
      )
    } else if (m.kind === 'reference') {
      nodes.push(
        <sup className="ref" key={`${keyBase}-r${i}`}>
          {m.text}
        </sup>
      )
    } else if (m.kind === 'carded') {
      nodes.push(
        <span className="carded" key={`${keyBase}-c${i}`} title="Card">
          {renderBdi(m.text, `${keyBase}-c${i}-b`)}
        </span>
      )
    } else {
      nodes.push(
        <mark className="mark" key={`${keyBase}-m${i}`}>
          {renderBdi(m.text, `${keyBase}-m${i}-b`)}
        </mark>
      )
    }
    cursor = m.end
  })
  if (cursor < text.length) nodes.push(...renderBdi(text.slice(cursor), `${keyBase}-tail`))
  return nodes
}

function transformChildren(children: ReactNode, cards: LibraryCard[], highlights: LibraryHighlight[], keyBase: string): ReactNode {
  let i = 0
  function walk(node: ReactNode): ReactNode {
    if (typeof node === 'string') return renderTextWithSpecials(node, cards, highlights, `${keyBase}-${i++}`)
    return node
  }
  if (Array.isArray(children)) return children.map(walk)
  return walk(children)
}

function hastText(node: RootContent | HastElement): string {
  if (node.type === 'text') return node.value
  if ('children' in node && node.children) return node.children.map(hastText).join('')
  return ''
}

function extractTableRows(node: HastElement | undefined): string[][] {
  const rows: string[][] = []
  if (!node) return rows
  function walk(n: HastElement) {
    for (const child of n.children) {
      if (child.type !== 'element') continue
      if (child.tagName === 'tr') {
        rows.push(
          child.children
            .filter((c): c is HastElement => c.type === 'element' && (c.tagName === 'td' || c.tagName === 'th'))
            .map((c) => hastText(c).trim())
        )
      } else {
        walk(child)
      }
    }
  }
  walk(node)
  return rows
}

const CALLOUT_LABEL: Record<CalloutVariant, string> = {
  pearl: 'PEARL',
  flag: 'RED FLAG',
  outside: 'خارج از متن کتاب',
  discrepancy: 'اختلاف / خطای متن کتاب',
}
const CALLOUT_ICON: Record<CalloutVariant, string> = {
  pearl: '💡',
  flag: '⚠',
  outside: '📘',
  discrepancy: '⚠',
}

// Parses a `##`/`###` heading's text into its displayable parts. Two
// authoring conventions are supported:
//  - legacy hand-authored: "6.1 Section title" (leading "N.N ", no anchor)
//  - NEPHRON_CHAPTER_FORMAT import: "بخش ۱: مقدمه · Introduction {#ch73-s1}"
//    (an explicit {#id} anchor, an optional "بخش N: " prefix stripped, and
//    an optional " · English title" suffix split into its own span)
function parseHeadingText(raw: string): { display: string; en: string | null; sectionNumber: string | null; anchorId: string | null } {
  const legacy = raw.match(/^([\d]+(?:\.[\d]+)*)\s+(.+)$/)
  if (legacy) {
    return { display: legacy[2], en: null, sectionNumber: legacy[1], anchorId: `s${legacy[1]}` }
  }
  const idMatch = raw.match(/\{#([\w-]+)\}/)
  const anchorId = idMatch?.[1] ?? null
  let rest = raw.replace(/\s*\{#[\w-]+\}\s*$/, '').trim()
  rest = rest.replace(/^بخش\s+[۰-۹]+\s*:\s*/, '')
  const [faPart, ...enParts] = rest.split(' · ')
  const en = enParts.length > 0 ? enParts.join(' · ').trim() : null
  const sectionNumber = anchorId ? anchorId.replace(/^.*-s/, '') : null
  return { display: faPart.trim(), en, sectionNumber, anchorId }
}

export function ChapterProse({
  note,
  cards,
  highlights,
  onMakeCard,
  onHighlight,
  onMakeCardsFromTable,
  onApproveAllSuggested,
  onReviewSuggestedOneByOne,
}: Props) {
  const { text: cleanedNote, variants } = extractCalloutVariants(note)
  const calloutIndexRef = useRef(0)
  calloutIndexRef.current = 0
  const sectionRef = useRef<string | null>(null)
  sectionRef.current = null

  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<{ top: number; left: number } | null>(null)
  const selectedTextRef = useRef('')

  useEffect(() => {
    if (!onMakeCard && !onHighlight) return
    function handleSelectionChange() {
      const sel = window.getSelection()
      const container = containerRef.current
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !container) {
        setPopover(null)
        return
      }
      const range = sel.getRangeAt(0)
      if (!container.contains(range.commonAncestorContainer)) {
        setPopover(null)
        return
      }
      const selected = sel.toString().trim()
      if (!selected) {
        setPopover(null)
        return
      }
      selectedTextRef.current = selected
      const rect = range.getBoundingClientRect()
      setPopover({ top: rect.top - 46, left: rect.left + rect.width / 2 })
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [onMakeCard, onHighlight])

  // The section a selection belongs to: the nearest <h2 id="sN.N"> that
  // precedes it in document order.
  function currentBlockSection(range: Range): string | null {
    const headings = containerRef.current?.querySelectorAll('h2[id^="s"]')
    if (!headings) return null
    let found: string | null = null
    headings.forEach((h) => {
      if (range.startContainer.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_PRECEDING) {
        found = h.id.slice(1)
      }
    })
    return found
  }

  function handleMakeCard() {
    if (!onMakeCard) return
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const sourceText = selectedTextRef.current
    const sectionNumber = range ? currentBlockSection(range) : null
    const blockEl = range?.startContainer instanceof HTMLElement ? range.startContainer : range?.startContainer.parentElement
    const blockText = blockEl?.closest('p,li')?.textContent?.trim() ?? sourceText
    const idx = blockText.indexOf(sourceText)
    const front = idx >= 0 ? `${blockText.slice(0, idx)}_____${blockText.slice(idx + sourceText.length)}` : `_____ (${blockText})`
    onMakeCard({ sectionNumber, sourceText, front, back: sourceText })
    setPopover(null)
    window.getSelection()?.removeAllRanges()
  }

  function handleHighlight() {
    if (!onHighlight) return
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const sectionNumber = range ? currentBlockSection(range) : null
    onHighlight({ sectionNumber, text: selectedTextRef.current })
    setPopover(null)
    window.getSelection()?.removeAllRanges()
  }

  const components = {
    h2: ({ node }: { node?: HastElement }) => {
      const raw = node ? hastText(node) : ''
      const { display, en, sectionNumber, anchorId } = parseHeadingText(raw)
      sectionRef.current = sectionNumber
      return (
        <h2 id={anchorId ?? undefined}>
          {sectionNumber && <span className="sn">{toPersianDigits(sectionNumber)}</span>}
          {renderBdi(display, `h2-${anchorId ?? raw}`)}
          {en && <span className="en">{renderBdi(en, `h2-en-${anchorId ?? raw}`)}</span>}
        </h2>
      )
    },
    h3: ({ node }: { node?: HastElement }) => {
      const raw = node ? hastText(node) : ''
      const idMatch = raw.match(/\{#([\w-]+)\}/)
      const display = raw.replace(/\s*\{[^}]*\}\s*$/, '').trim()
      return (
        <h3 id={idMatch?.[1]}>{renderBdi(display, `h3-${idMatch?.[1] ?? raw}`)}</h3>
      )
    },
    p: (props: { children?: ReactNode }) => <p>{transformChildren(props.children, cards, highlights, `p-${sectionRef.current}`)}</p>,
    li: (props: { children?: ReactNode }) => <li>{transformChildren(props.children, cards, highlights, `li-${sectionRef.current}`)}</li>,
    blockquote: (props: { children?: ReactNode }) => {
      const variant = variants[calloutIndexRef.current] ?? null
      calloutIndexRef.current += 1
      if (!variant) return <blockquote>{props.children}</blockquote>
      return (
        <div className={`callout ${variant}`}>
          <span className="ci" aria-hidden="true">
            {CALLOUT_ICON[variant]}
          </span>
          <div>
            <b className="t">{CALLOUT_LABEL[variant]}</b>
            {props.children}
          </div>
        </div>
      )
    },
    table: ({ node, children, ...rest }: { node?: HastElement; children?: ReactNode }) => {
      const rows = extractTableRows(node)
      const header = rows[0] ?? []
      const dataRows = rows.slice(1)
      const cellCount = dataRows.reduce((sum, row) => sum + row.slice(1).filter((cell, j) => cell && header[j + 1]).length, 0)
      function handleMake() {
        if (!onMakeCardsFromTable || cellCount === 0) return
        const tableCards: Array<{ front: string; back: string }> = []
        for (const row of dataRows) {
          const rowLabel = row[0]
          if (!rowLabel) continue
          for (let j = 1; j < row.length; j++) {
            const col = header[j]
            const cell = row[j]
            if (!col || !cell) continue
            tableCards.push({ front: `${rowLabel} در ${col}؟`, back: cell })
          }
        }
        onMakeCardsFromTable({ sectionNumber: sectionRef.current, cards: tableCards })
      }
      return (
        <div className="tblw">
          {onMakeCardsFromTable && cellCount > 0 && (
            <div className="tbl-top">
              <b>Table</b>
              <button type="button" className="np-btn ghost sm tcards" onClick={handleMake}>
                Make {cellCount} cards
              </button>
            </div>
          )}
          <div className="tscroll">
            <table className="t2" {...rest}>
              {children}
            </table>
          </div>
        </div>
      )
    },
  }

  const blocks = splitNoteBlocks(cleanedNote)

  return (
    <div className="prose" dir="rtl" id="prose" ref={containerRef}>
      {popover && (onMakeCard || onHighlight) && (
        <div className="selpop on" style={{ position: 'fixed', top: popover.top, left: popover.left, transform: 'translate(-50%,0)' }}>
          {onMakeCard && (
            <button className="p" type="button" onMouseDown={(e) => (e.preventDefault(), handleMakeCard())}>
              Make card
            </button>
          )}
          {onHighlight && (
            <button type="button" onMouseDown={(e) => (e.preventDefault(), handleHighlight())}>
              Highlight
            </button>
          )}
        </div>
      )}
      {blocks.map((block, i) => {
        if (block.kind === 'prose') {
          return (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} key={`b-${i}`}>
              {block.markdown}
            </ReactMarkdown>
          )
        }
        if (block.kind === 'explain') {
          return (
            <div key={`b-${i}`}>
              <h3 className="explain-h">توضیح ساده</h3>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {block.markdown}
              </ReactMarkdown>
            </div>
          )
        }
        // exam block
        const sectionNumber = block.sectionId ? block.sectionId.replace(/^.*-s/, '') : null
        const suggested = cards.filter((c) => c.status === 'suggested' && (c.sectionNumber ?? null) === sectionNumber)
        const suggestedIds = suggested.map((c) => c.id)
        return (
          <section className="exam" key={`b-${i}`}>
            <div className="exam-h">
              <b>نکات امتحانی</b>
              {suggested.length > 0 && (
                <span className="sug">
                  <bdi dir="ltr">{suggested.length} suggested cards</bdi>
                </span>
              )}
            </div>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {block.markdown}
            </ReactMarkdown>
            {suggestedIds.length > 0 && (onApproveAllSuggested || onReviewSuggestedOneByOne) && (
              <div className="exam-f">
                {onApproveAllSuggested && (
                  <button type="button" className="np-btn sm" onClick={() => onApproveAllSuggested(suggestedIds)}>
                    Approve all
                  </button>
                )}
                {onReviewSuggestedOneByOne && (
                  <button type="button" className="np-btn ghost sm" onClick={() => onReviewSuggestedOneByOne(suggestedIds)}>
                    Review one by one
                  </button>
                )}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
