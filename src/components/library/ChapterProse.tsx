import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Element as HastElement, RootContent } from 'hast'
import { tokenizeBidi } from '../../lib/bidiText'
import { extractCalloutVariants, type CalloutVariant } from '../../lib/libraryNote'
import { splitNoteBlocks, type NoteBlock } from '../../lib/chapterNoteBlocks'
import { parseMcqBlock, type ParsedMcqChoice } from '../../lib/mcqBlock'
import { toPersianDigits } from '../../lib/shamsi'
import { renderNephronChart, type NephronChartSpec } from './nephronChart'
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
  /** Chapter-number -> id, so `[[chNN]]` links (v1.1) can navigate there. */
  chapterNumberToId?: Record<number, string>
  /** v1.3: figureKey -> signed image URL, for `.figure` blocks. */
  figures?: Record<string, string>
  /** v1.3: upload an image for a figure the import had no file for. */
  onUploadFigure?: (figureKey: string, file: File) => Promise<void>
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
  kind: 'pageref' | 'carded' | 'mark' | 'reference' | 'chlink'
  page?: number
  id?: string
  text: string
  /** chlink only: the raw id inside [[...]], e.g. "ch75" or "ch74-s8". */
  linkId?: string
  /** chlink only: true for `[[#id]]` (same-chapter section), false for `[[chNN]]`. */
  isSection?: boolean
}

// `{p.N}` (older hand-authored notes) and `[p. N]` (NEPHRON_CHAPTER_FORMAT
// imports) are both rendered as the same small "p. N" chip.
const PAGE_REF_RES = [/\{p\.(\d+)\}/g, /\[p\.\s?(\d+)\]/g]
// `[۱۵]`, `[۳، ۴]`, `[۲۳ تا ۲۵]` -- a bracketed Persian-digit reference
// number (or range/list of them), rendered small and muted.
const REFERENCE_RE = /\[([۰-۹][۰-۹،,\sتا]*)\]/g
// v1.1: `[[ch75]]` (another chapter) or `[[#ch74-s8]]` (a section of this one).
const CHAPTER_LINK_RE = /\[\[(#?)([\w-]+)\]\]/g

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
  for (const m of text.matchAll(CHAPTER_LINK_RE)) {
    matches.push({
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      kind: 'chlink',
      text: m[0],
      linkId: m[2],
      isSection: m[1] === '#',
    })
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

function renderTextWithSpecials(
  text: string,
  cards: LibraryCard[],
  highlights: LibraryHighlight[],
  keyBase: string,
  chapterNumberToId?: Record<number, string>
): ReactNode[] {
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
    } else if (m.kind === 'chlink') {
      if (m.isSection) {
        const sectionNum = (m.linkId ?? '').replace(/^.*-s/, '')
        nodes.push(
          <a className="xlink" key={`${keyBase}-l${i}`} href={`#${m.linkId}`}>
            بخش {sectionNum} ›
          </a>
        )
      } else {
        const chNumMatch = (m.linkId ?? '').match(/^ch(\d+)$/)
        const chNum = chNumMatch ? Number(chNumMatch[1]) : null
        const targetId = chNum != null ? chapterNumberToId?.[chNum] : undefined
        nodes.push(
          targetId ? (
            <Link className="xlink" key={`${keyBase}-l${i}`} to={`/academy/reader/${targetId}`}>
              Ch {chNum} ›
            </Link>
          ) : (
            <span className="xlink" key={`${keyBase}-l${i}`}>
              Ch {chNum ?? m.linkId} ›
            </span>
          )
        )
      }
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

function transformChildren(
  children: ReactNode,
  cards: LibraryCard[],
  highlights: LibraryHighlight[],
  keyBase: string,
  chapterNumberToId?: Record<number, string>
): ReactNode {
  let i = 0
  function walk(node: ReactNode): ReactNode {
    if (typeof node === 'string') return renderTextWithSpecials(node, cards, highlights, `${keyBase}-${i++}`, chapterNumberToId)
    return node
  }
  if (Array.isArray(children)) return children.map(walk)
  return walk(children)
}

// A paragraph written fully in English (e.g. an original figure caption,
// v1.1): true when it has no Persian/Arabic characters but does have a
// Latin letter, so it renders LTR instead of inheriting the RTL paragraph
// direction.
const PERSIAN_CHAR_RE = /[؀-ۿ]/
const LATIN_LETTER_RE = /[A-Za-z]/
function isFullyEnglish(text: string): boolean {
  return !PERSIAN_CHAR_RE.test(text) && LATIN_LETTER_RE.test(text)
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
  explain: 'توضیح ساده',
}
const CALLOUT_ICON: Record<CalloutVariant, string> = {
  pearl: '💡',
  flag: '⚠',
  outside: '📘',
  discrepancy: '⚠',
  explain: '📝',
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

// v1.2: one `### سؤال N {#id .mcq}` block -- a tappable question card with a
// "Show answer" toggle (native <details>, no extra state needed).
function McqCard({
  id,
  label,
  stem,
  choices,
  explanation,
}: {
  id: string
  label: string
  stem: string
  choices: ParsedMcqChoice[]
  explanation: string | null
}) {
  return (
    <section className="mcqc" id={id}>
      <div className="mq">{label}</div>
      <p className="mq-stem">{renderBdi(stem, `${id}-stem`)}</p>
      <ul>
        {choices.map((c) => (
          <li key={c.label}>
            {c.label}) {renderBdi(c.text, `${id}-${c.label}`)}
          </li>
        ))}
      </ul>
      <details className="ans">
        <summary>
          <bdi dir="ltr">Show answer</bdi>
        </summary>
        <div>
          <strong>{choices.find((c) => c.correct)?.label}</strong>
          {explanation && <> — {renderBdi(explanation, `${id}-expl`)}</>}
        </div>
      </details>
    </section>
  )
}

// v1.3: one `![caption](figures/x.jpg){#id .figure}` book figure -- full
// column width, caption below, tap opens the full-screen zoom/pan viewer.
// Renders a "Missing figure" row instead of an <img> when the note
// references a figure the import wasn't given an image file for.
function FigureCard({
  id,
  src,
  caption,
  file,
  onOpen,
  onUploadFigure,
}: {
  id: string
  src: string | null
  caption: string
  file: string
  onOpen: () => void
  onUploadFigure?: (figureKey: string, file: File) => Promise<void>
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(picked: File) {
    if (!onUploadFigure) return
    setUploading(true)
    setUploadError(null)
    try {
      await onUploadFigure(id, picked)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <figure className="bookfig" id={id}>
      {src ? (
        <button type="button" className="bookfig-btn" onClick={onOpen} aria-label="Open figure full screen">
          <img src={src} alt={caption} loading="lazy" />
        </button>
      ) : (
        <div className="bookfig-missing">
          <span>Missing figure: {file.split('/').pop() ?? file}</span>
          {onUploadFigure && (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const picked = e.target.files?.[0]
                  e.target.value = ''
                  if (picked) void handleFile(picked)
                }}
              />
              <button type="button" className="np-btn ghost sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? 'Uploading…' : 'Add image'}
              </button>
              {uploadError && <span className="bookfig-err">{uploadError}</span>}
            </>
          )}
        </div>
      )}
      {caption && <figcaption>{renderBdi(caption, `${id}-cap`)}</figcaption>}
    </figure>
  )
}

// Full-screen figure viewer with pinch-zoom (two-finger touch or trackpad/
// wheel) and drag-to-pan once zoomed in; double-tap/click toggles between
// 1x and 2.5x centered. No library -- just Pointer Events, since a figure
// zoom is the only place in the app that needs this.
function FigureViewer({ src, caption, onClose }: { src: string; caption: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null)
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function clampScale(s: number) {
    return Math.min(4, Math.max(1, s))
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchStart.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale }
      dragStart.current = null
    } else if (pointers.current.size === 1) {
      dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y }
    }
  }
  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      setScale(clampScale(pinchStart.current.scale * (dist / pinchStart.current.dist)))
    } else if (pointers.current.size === 1 && dragStart.current && scale > 1) {
      setPos({ x: dragStart.current.posX + (e.clientX - dragStart.current.x), y: dragStart.current.posY + (e.clientY - dragStart.current.y) })
    }
  }
  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) dragStart.current = null
  }
  function onDoubleClick() {
    if (scale > 1) {
      setScale(1)
      setPos({ x: 0, y: 0 })
    } else {
      setScale(2.5)
    }
  }
  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault()
    setScale((s) => clampScale(s - e.deltaY * 0.01))
  }

  return (
    <div className="figview" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <button type="button" className="figview-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div
        className="figview-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
      >
        <img src={src} alt={caption} draggable={false} style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }} />
      </div>
      {caption && <p className="figview-cap">{caption}</p>}
    </div>
  )
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
  chapterNumberToId,
  figures,
  onUploadFigure,
}: Props) {
  const chartIndexRef = useRef(0)
  chartIndexRef.current = 0
  const { text: cleanedNote, variants } = extractCalloutVariants(note)
  const calloutIndexRef = useRef(0)
  calloutIndexRef.current = 0
  const sectionRef = useRef<string | null>(null)
  sectionRef.current = null

  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<{ top: number; left: number } | null>(null)
  const selectedTextRef = useRef('')
  const [viewerFigure, setViewerFigure] = useState<{ src: string; caption: string } | null>(null)

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
    // The note's own "# Title" duplicates the Reader's own header -- never render it.
    h1: () => null,
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
    // v1.1: a "#### label" inside a نکات امتحانی panel is a group label, not
    // a card (see chapterImport.ts's parseExamBullets, which reads the same
    // bullets to build the topic/high_yield fields this just displays).
    h4: ({ node }: { node?: HastElement }) => {
      const raw = node ? hastText(node) : ''
      const starred = /⭐\s*$/.test(raw)
      const display = raw.replace(/\s*⭐\s*$/, '').trim()
      return (
        <h4 className="grp">
          {renderBdi(display, `h4-${raw}`)}
          {starred && (
            <span className="hy">
              ⭐ <bdi dir="ltr">High-yield</bdi>
            </span>
          )}
        </h4>
      )
    },
    p: ({ node, children }: { node?: HastElement; children?: ReactNode }) => {
      const raw = node ? hastText(node) : ''
      if (isFullyEnglish(raw)) {
        return (
          <p dir="ltr" className="enp">
            {transformChildren(children, cards, highlights, `p-${sectionRef.current}`, chapterNumberToId)}
          </p>
        )
      }
      return <p>{transformChildren(children, cards, highlights, `p-${sectionRef.current}`, chapterNumberToId)}</p>
    },
    li: (props: { children?: ReactNode }) => (
      <li>{transformChildren(props.children, cards, highlights, `li-${sectionRef.current}`, chapterNumberToId)}</li>
    ),
    pre: ({ node, children }: { node?: HastElement; children?: ReactNode }) => {
      const codeNode = node?.children.find((c): c is HastElement => c.type === 'element' && c.tagName === 'code')
      const classes = (codeNode?.properties?.className as string[] | undefined) ?? []
      if (codeNode && classes.includes('language-nephron-chart')) {
        try {
          const spec = JSON.parse(hastText(codeNode)) as NephronChartSpec
          chartIndexRef.current += 1
          const chart = renderNephronChart(spec, chartIndexRef.current)
          if (chart) return chart
        } catch {
          // fall through to plain code block below
        }
      }
      return <pre>{children}</pre>
    },
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
  const cardByImportKey = new Map(cards.filter((c) => c.importKey).map((c) => [c.importKey as string, c] as const))
  const renderedBlocks: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block.kind === 'prose') {
      renderedBlocks.push(
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} key={`b-${i}`}>
          {block.markdown}
        </ReactMarkdown>
      )
      continue
    }
    if (block.kind === 'explain') {
      renderedBlocks.push(
        <div key={`b-${i}`}>
          <h3 className="explain-h">توضیح ساده</h3>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {block.markdown}
          </ReactMarkdown>
        </div>
      )
      continue
    }
    if (block.kind === 'mcq') {
      const runStart = i
      const run: Array<Extract<NoteBlock, { kind: 'mcq' }>> = []
      while (i < blocks.length && blocks[i].kind === 'mcq') {
        run.push(blocks[i] as Extract<NoteBlock, { kind: 'mcq' }>)
        i++
      }
      i--
      const suggestedIds = run
        .map((b) => cardByImportKey.get(b.id))
        .filter((c): c is LibraryCard => !!c && c.status === 'suggested')
        .map((c) => c.id)
      renderedBlocks.push(
        <div key={`b-${runStart}`}>
          {run.map((mcqBlock) => {
            const parsed = parseMcqBlock(mcqBlock.markdown)
            if (!parsed) return null
            return (
              <McqCard
                key={mcqBlock.id}
                id={mcqBlock.id}
                label={mcqBlock.label}
                stem={parsed.stem}
                choices={parsed.choices}
                explanation={parsed.explanation}
              />
            )
          })}
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
        </div>
      )
      continue
    }
    if (block.kind === 'figure') {
      const url = figures?.[block.id]
      renderedBlocks.push(
        <FigureCard
          key={`b-${i}`}
          id={block.id}
          src={url ?? null}
          caption={block.caption}
          file={block.file}
          onOpen={() => url && setViewerFigure({ src: url, caption: block.caption })}
          onUploadFigure={onUploadFigure}
        />
      )
      continue
    }
    // exam block
    const sectionNumber = block.sectionId ? block.sectionId.replace(/^.*-s/, '') : null
    const suggested = cards.filter((c) => c.status === 'suggested' && (c.sectionNumber ?? null) === sectionNumber)
    const suggestedIds = suggested.map((c) => c.id)
    renderedBlocks.push(
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
  }

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
      {renderedBlocks}
      {viewerFigure && <FigureViewer src={viewerFigure.src} caption={viewerFigure.caption} onClose={() => setViewerFigure(null)} />}
    </div>
  )
}
