// Assistant phase 3 — voice, using only the browser's built-in engines
// (Web Speech API): nothing extra is sent to any server we control, and it
// costs nothing. On iOS/iPadOS, Safari's recognition is Apple's dictation
// service; Persian read-aloud needs a Persian voice installed on the device.
import { useCallback, useEffect, useRef, useState } from 'react'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rec = any
function recognitionCtor(): (new () => Rec) | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const dictationSupported = () => recognitionCtor() !== null
export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export type DictationError = 'not-allowed' | 'no-speech' | 'network' | 'unsupported' | 'other'

/**
 * Tap-to-talk dictation in Persian (fa-IR; English medical terms come through
 * as spoken). `onText(finalSoFar, interim)` fires as words arrive.
 */
export function useDictation(onText: (finalText: string, interim: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<DictationError | null>(null)
  const recRef = useRef<Rec | null>(null)
  const cb = useRef(onText)
  cb.current = onText

  const stop = useCallback(() => {
    try {
      recRef.current?.stop()
    } catch {
      /* already stopped */
    }
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor) {
      setError('unsupported')
      return
    }
    setError(null)
    const rec: Rec = new Ctor()
    rec.lang = 'fa-IR'
    rec.interimResults = true
    rec.continuous = true
    rec.maxAlternatives = 1
    let finalText = ''
    rec.onresult = (e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript + ' '
        else interim += r[0].transcript
      }
      cb.current(finalText.trim(), interim.trim())
    }
    rec.onerror = (e: { error: string }) => {
      const map: Record<string, DictationError> = {
        'not-allowed': 'not-allowed',
        'service-not-allowed': 'not-allowed',
        'no-speech': 'no-speech',
        network: 'network',
      }
      setError(map[e.error] ?? 'other')
    }
    rec.onend = () => {
      setListening(false)
      recRef.current = null
    }
    try {
      rec.start()
      recRef.current = rec
      setListening(true)
    } catch {
      setError('other')
    }
  }, [])

  useEffect(() => () => stop(), [stop])
  return { listening, error, start, stop, supported: dictationSupported() }
}

// ---------------------------------------------------------------- read aloud
function persianVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang?.toLowerCase().startsWith('fa')) ?? null
}

/** True once voices are loaded and one of them is Persian. */
export function hasPersianVoice(): boolean {
  return speechSupported() && persianVoice() !== null
}

/** Voices load asynchronously (Chrome/Safari): resolve when they're there. */
export function voicesReady(): Promise<void> {
  if (!speechSupported()) return Promise.resolve()
  if (window.speechSynthesis.getVoices().length) return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => resolve()
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true })
    window.setTimeout(done, 1500)
  })
}

/** Must run inside a tap on iOS so later (async) speech is allowed. */
export function unlockSpeech() {
  if (!speechSupported()) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  window.speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
}

/**
 * Speak plain text. Long answers are split into sentence-sized pieces —
 * iOS/Chrome silently stop long single utterances.
 */
export function speak(text: string) {
  if (!speechSupported() || !text.trim()) return
  stopSpeaking()
  const voice = persianVoice()
  const pieces = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?؟。\n؛:])\s+/)
    .flatMap((s) => (s.length > 220 ? s.match(/.{1,220}(\s|$)/g) ?? [s] : [s]))
    .map((s) => s.trim())
    .filter(Boolean)
  for (const p of pieces) {
    const u = new SpeechSynthesisUtterance(p)
    u.lang = voice?.lang ?? 'fa-IR'
    if (voice) u.voice = voice
    u.rate = 1
    window.speechSynthesis.speak(u)
  }
}

const SPEAK_KEY = 'nephron.assistant.speak'
export function getSpeakPref(): boolean {
  try {
    return localStorage.getItem(SPEAK_KEY) === '1'
  } catch {
    return false
  }
}
export function setSpeakPref(on: boolean) {
  try {
    localStorage.setItem(SPEAK_KEY, on ? '1' : '0')
  } catch {
    /* private mode */
  }
}
