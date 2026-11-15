import { useMemo, type KeyboardEvent, type MouseEvent } from 'react'
import { renderClinicalSummaryHtml, type ClinicalSummary } from '../../lib/clinicalSummary'

interface Props {
  summary: ClinicalSummary
  /** Jump to an anchor in the chapter text (may live in another part). */
  onJump: (anchorId: string) => void
}

// The box's markup is a plain HTML string built from the stored JSON (see
// lib/clinicalSummary.ts, which escapes every text field). Links carry a
// data-jump anchor id and are handled here by delegation.
export function ClinicalSummaryBox({ summary, onJump }: Props) {
  const html = useMemo(() => renderClinicalSummaryHtml(summary), [summary])

  function handle(e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) {
    if ('key' in e && e.key !== 'Enter') return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-jump]')
    if (!el) return
    e.preventDefault()
    const id = el.dataset.jump
    if (id) onJump(id)
  }

  return <div onClick={handle} onKeyDown={handle} dangerouslySetInnerHTML={{ __html: html }} />
}
