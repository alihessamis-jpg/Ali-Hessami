// App-wide dictation: when any text field is focused, a small mic button
// appears next to it. Tap to record, tap again to stop; the speech is
// transcribed on the server (same engine as the assistant's mic, which works
// on iPhone home-screen apps where the browser's SpeechRecognition is
// blocked) and inserted at the cursor.
//
// Fields that have their own mic opt out with `data-no-dictation`.
import { useCallback, useEffect, useRef, useState } from 'react'
import { transcribeAudio } from '../lib/api/assistant'
import { useVoiceInput } from '../lib/speech'
import { toPersianDigits } from '../lib/shamsi'

type Field = HTMLInputElement | HTMLTextAreaElement

const TEXT_TYPES = new Set(['text', 'search', ''])

function isDictatable(el: EventTarget | null): el is Field {
  if (!(el instanceof HTMLTextAreaElement) && !(el instanceof HTMLInputElement)) return false
  if (el instanceof HTMLInputElement && !TEXT_TYPES.has(el.type)) return false
  if (el.readOnly || el.disabled) return false
  if (el.closest('[data-no-dictation]')) return false
  return true
}

/** Inserts text at the cursor in a React-controlled field and fires its onChange. */
export function insertIntoField(el: Field, text: string) {
  const value = el.value
  const start = el.selectionStart ?? value.length
  const end = el.selectionEnd ?? value.length
  const before = value.slice(0, start)
  const after = value.slice(end)
  const pad = before && !/\s$/.test(before) ? ' ' : ''
  const next = before + pad + text + (after && !/^\s/.test(after) ? ' ' : '') + after
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  const caret = (before + pad + text).length
  try {
    el.setSelectionRange(caret, caret)
  } catch {
    /* some input types don't support selection */
  }
}

export function GlobalDictation() {
  const [target, setTarget] = useState<Field | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const targetRef = useRef<Field | null>(null)
  targetRef.current = target

  const voice = useVoiceInput(transcribeAudio, (text) => {
    const el = targetRef.current
    if (el && el.isConnected) insertIntoField(el, text)
  })
  const busy = voice.state !== 'idle'
  const busyRef = useRef(busy)
  busyRef.current = busy

  const place = useCallback(() => {
    const el = targetRef.current
    if (!el || !el.isConnected) {
      setPos(null)
      return
    }
    const r = el.getBoundingClientRect()
    const rtl = getComputedStyle(el).direction === 'rtl'
    const size = 40
    let top = r.top - size - 6
    if (top < 8) top = r.bottom + 6
    const left = rtl ? r.left + 4 : r.right - size - 4
    setPos({ top: Math.max(8, top), left: Math.min(Math.max(8, left), window.innerWidth - size - 8) })
  }, [])

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      if (busyRef.current) return
      if (isDictatable(e.target)) {
        setTarget(e.target)
        setNote(null)
      }
    }
    function onFocusOut() {
      // wait: focus may be moving to another field, or to our own button
      window.setTimeout(() => {
        if (busyRef.current) return
        if (!isDictatable(document.activeElement)) setTarget(null)
      }, 150)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  useEffect(() => {
    if (!target) return
    place()
    const vv = window.visualViewport
    window.addEventListener('scroll', place, { passive: true, capture: true })
    window.addEventListener('resize', place)
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    const ro = new ResizeObserver(place)
    ro.observe(target)
    return () => {
      window.removeEventListener('scroll', place, { capture: true })
      window.removeEventListener('resize', place)
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
      ro.disconnect()
    }
  }, [target, place])

  useEffect(() => {
    if (!voice.error) return
    const msg: Record<string, string> = {
      'not-allowed': 'اجازه میکروفون داده نشده. در تنظیمات گوشی (Settings › Safari › Microphone یا تنظیمات خود برنامه) اجازه بدهید.',
      unsupported: 'این مرورگر ضبط صدا را پشتیبانی نمی‌کند.',
      'too-short': 'صدایی ضبط نشد؛ کمی طولانی‌تر صحبت کنید.',
      failed: voice.errorDetail ?? 'تبدیل صدا به متن انجام نشد؛ دوباره امتحان کنید.',
    }
    setNote(msg[voice.error] ?? null)
  }, [voice.error, voice.errorDetail])

  if (!target || !pos || !voice.supported) return null

  return (
    <div className="gd" style={{ top: pos.top, left: pos.left }}>
      <button
        type="button"
        className={`gd-mic ${voice.state}`}
        // keep the field focused (and the keyboard up) while tapping
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setNote(null)
          if (voice.state === 'recording') void voice.stop()
          else if (voice.state === 'idle') void voice.start()
        }}
        disabled={voice.state === 'transcribing'}
        aria-label={voice.state === 'recording' ? 'پایان ضبط' : 'دیکته صوتی'}
      >
        {voice.state === 'transcribing' ? (
          <span className="gd-spin" aria-hidden="true" />
        ) : voice.state === 'recording' ? (
          <span className="gd-sec">{toPersianDigits(voice.seconds)}</span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {note && (
        <span className="gd-note" dir="rtl">
          {note}
        </span>
      )}
    </div>
  )
}
