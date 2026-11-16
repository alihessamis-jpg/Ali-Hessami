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
  // A malformed summary must never take the whole Reader page down with it
  // (an uncaught render error leaves a blank white screen) -- skip the box.
  const html = useMemo(() => {
    try {
      return renderClinicalSummaryHtml(summary)
    } catch (err) {
      console.error('Clinical summary failed to render', err)
      return null
    }
  }, [summary])

  function handle(e: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) {
    if ('key' in e && e.key !== 'Enter') return
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-jump]')
    if (!el) return
    e.preventDefault()
    const id = el.dataset.jump
    if (id) onJump(id)
  }

  if (!html) return null
  return <div onClick={handle} onKeyDown={handle} dangerouslySetInnerHTML={{ __html: html }} />
}
