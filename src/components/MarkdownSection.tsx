import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Element as HastElement, RootContent } from 'hast'
import { isolateLatinRuns } from '../lib/bidiText'

export interface MakeCardPayload {
  prompt: string
  answer: string
}

interface Props {
  text: string
  sectionKey?: string
  onMakeCard?: (card: MakeCardPayload) => void
  onMakeCardsFromTable?: (cards: MakeCardPayload[]) => void
}

const BLOCK_TAGS = new Set(['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'blockquote'])

function findBlockElement(node: Node | null): HTMLElement | null {
  let el: HTMLElement | null = node instanceof HTMLElement ? node : node?.parentElement ?? null
  while (el && !BLOCK_TAGS.has(el.tagName.toLowerCase())) {
    el = el.parentElement
  }
  return el
}

function hastText(node: RootContent | HastElement): string {
  if (node.type === 'text') return node.value
  if ('children' in node && node.children) return node.children.map(hastText).join('')
  return ''
}

// Pulls plain-text rows out of a GFM table's hast node (thead/tbody -> tr -> th/td)
// so "Make cards from table" can build one card per cell without re-parsing markdown.
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

function TableWithCardButton({
  node,
  children,
  onMakeCardsFromTable,
  ...rest
}: { node?: HastElement; children?: React.ReactNode; onMakeCardsFromTable?: (cards: MakeCardPayload[]) => void } & React.TableHTMLAttributes<HTMLTableElement>) {
  const rows = extractTableRows(node)
  const header = rows[0] ?? []
  const dataRows = rows.slice(1)
  const cardCount = dataRows.reduce(
    (sum, row) => sum + row.slice(1).filter((cell, j) => cell && header[j + 1] && row[0]).length,
    0
  )

  function handleClick() {
    if (!onMakeCardsFromTable) return
    const cards: MakeCardPayload[] = []
    for (const row of dataRows) {
      const rowLabel = row[0]
      if (!rowLabel) continue
      for (let j = 1; j < row.length; j++) {
        const col = header[j]
        const cell = row[j]
        if (!col || !cell) continue
        cards.push({ prompt: `${rowLabel} in ${col}?`, answer: cell })
      }
    }
    if (cards.length > 0) onMakeCardsFromTable(cards)
  }

  return (
    <div className="academy-table-wrap">
      <table {...rest}>{children}</table>
      {onMakeCardsFromTable && cardCount > 0 && (
        <button type="button" className="academy-table-cardbtn" onClick={handleClick}>
          Make cards from table ({cardCount})
        </button>
      )}
    </div>
  )
}

export function MarkdownSection({ text, sectionKey, onMakeCard, onMakeCardsFromTable }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [popover, setPopover] = useState<{ top: number; left: number } | null>(null)
  const selectedTextRef = useRef('')

  useEffect(() => {
    if (!onMakeCard) return
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
      const hostRect = container.getBoundingClientRect()
      setPopover({ top: rect.top - hostRect.top - 38, left: Math.max(0, rect.left - hostRect.left) })
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [onMakeCard])

  function handleMakeCard() {
    if (!onMakeCard) return
    const sel = window.getSelection()
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
    const blockEl = range ? findBlockElement(range.startContainer) : null
    const answer = selectedTextRef.current
    const blockText = blockEl?.textContent?.trim() ?? answer
    const idx = blockText.indexOf(answer)
    const prompt = idx >= 0 ? `${blockText.slice(0, idx)}_____${blockText.slice(idx + answer.length)}` : `_____ (${blockText})`
    onMakeCard({ prompt, answer })
    setPopover(null)
    window.getSelection()?.removeAllRanges()
  }

  return (
    <div className="academy-markdown" dir="rtl" ref={containerRef}>
      {popover && (
        <button
          type="button"
          className="academy-makecard-btn"
          style={{ top: popover.top, left: popover.left }}
          onClick={handleMakeCard}
        >
          Make card
        </button>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: (props) => <TableWithCardButton {...props} onMakeCardsFromTable={onMakeCardsFromTable} />,
        }}
      >
        {isolateLatinRuns(text)}
      </ReactMarkdown>
      <span data-academy-section-key={sectionKey} hidden />
    </div>
  )
}
