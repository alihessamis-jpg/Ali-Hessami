import { useEffect, useState, type RefObject } from 'react'
import { useAssistant } from './AssistantProvider'

/**
 * Select text inside `containerRef` -> a «بپرس» pill appears (pinned to the
 * bottom so it never fights the iOS selection menu). Tapping it opens the
 * assistant on this chapter with the passage quoted in the composer.
 */
export function SelectionAsk({ containerRef, chapterId }: { containerRef: RefObject<HTMLElement>; chapterId: string }) {
  const { open } = useAssistant()
  const [text, setText] = useState('')

  useEffect(() => {
    let t = 0
    const onChange = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => {
        const sel = window.getSelection()
        const el = containerRef.current
        if (!sel || sel.isCollapsed || !el || !sel.anchorNode || !el.contains(sel.anchorNode)) {
          setText('')
          return
        }
        const s = sel.toString().trim()
        setText(s.length >= 3 ? s.slice(0, 1200) : '')
      }, 180)
    }
    document.addEventListener('selectionchange', onChange)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('selectionchange', onChange)
    }
  }, [containerRef])

  if (!text) return null
  // Latin-script selections (English textbook/guideline text) also get a
  // one-tap Persian translation that keeps medical terms in English.
  const latin = /[A-Za-z]/.test(text) && !/[\u0600-\u06FF]/.test(text)
  return (
    <div className="as-ask-sel-row">
      <button
        type="button"
        className="as-ask-sel"
        // keep the selection alive on mousedown/touch
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          open({ mode: 'study', chapterId, prompt: `«${text}»\n\nاین قسمت را توضیح بده.` })
          window.getSelection()?.removeAllRanges()
          setText('')
        }}
      >
        ✨ بپرس
      </button>
      {latin && (
        <button
          type="button"
          className="as-ask-sel"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            open({
              mode: 'study',
              chapterId,
              prompt: `«${text}»\n\nاین متن را دقیق و روان به فارسی ترجمه کن. اصطلاحات پزشکی، نام داروها، اعداد و واحدها را به انگلیسی نگه دار. فقط ترجمه، بدون توضیح اضافه.`,
              autoSend: true,
            })
            window.getSelection()?.removeAllRanges()
            setText('')
          }}
        >
          🔤 ترجمه
        </button>
      )}
    </div>
  )
}
