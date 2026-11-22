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

// ---------------------------------------------------------------- recorder
// Voice input that works on iOS: record raw audio with Web Audio, encode a
// 16 kHz mono WAV in the browser, and let the server transcribe it (Gemini).
// Safari's own SpeechRecognition doesn't handle Persian reliably on iOS.

export type VoiceState = 'idle' | 'recording' | 'transcribing'
export type VoiceError = 'not-allowed' | 'unsupported' | 'too-short' | 'failed'

const TARGET_RATE = 16000
const MAX_SECONDS = 120

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    // average the source samples that fall into this output sample
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = sum / Math.max(1, end - start)
  }
  return out
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  let o = 44
  for (const x of samples) {
    const s = Math.max(-1, Math.min(1, x))
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    o += 2
  }
  return new Blob([buf], { type: 'audio/wav' })
}

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]+,/, ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(b)
  })
}

export const recordingSupported = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  !!(window.AudioContext || (window as any).webkitAudioContext)

/**
 * Tap to record, tap again to stop; `transcribe(base64Wav)` turns the clip
 * into text, which is handed to `onText`.
 */
export function useVoiceInput(transcribe: (wavBase64: string) => Promise<string>, onText: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<VoiceError | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const rec = useRef<{ ctx: AudioContext; stream: MediaStream | null; proc: ScriptProcessorNode | null; chunks: Float32Array[]; timer: number } | null>(null)
  const cbs = useRef({ transcribe, onText })
  cbs.current = { transcribe, onText }

  const teardown = useCallback(() => {
    const r = rec.current
    if (!r) return null
    window.clearInterval(r.timer)
    r.proc?.disconnect()
    r.stream?.getTracks().forEach((t) => t.stop())
    const rate = r.ctx.sampleRate
    void r.ctx.close().catch(() => {})
    rec.current = null
    return { chunks: r.chunks, rate }
  }, [])

  const stop = useCallback(async () => {
    const got = teardown()
    if (!got) return
    const total = got.chunks.reduce((n, c) => n + c.length, 0)
    if (total / got.rate < 0.6) {
      setState('idle')
      setError('too-short')
      return
    }
    const merged = new Float32Array(total)
    let o = 0
    for (const c of got.chunks) {
      merged.set(c, o)
      o += c.length
    }
    setState('transcribing')
    try {
      const b64 = await blobToBase64(encodeWav(downsample(merged, got.rate, TARGET_RATE), TARGET_RATE))
      const text = (await cbs.current.transcribe(b64)).trim()
      if (text) cbs.current.onText(text)
      else setError('too-short')
    } catch (e) {
      setErrorDetail((e as Error)?.message ?? null)
      setError('failed')
    } finally {
      setState('idle')
    }
  }, [teardown])

  const start = useCallback(async () => {
    if (!recordingSupported()) {
      setError('unsupported')
      return
    }
    setError(null)
    setErrorDetail(null)
    // Create/resume the AudioContext synchronously inside the tap (iOS rule).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new Ctx()
    void ctx.resume()
    const r = { ctx, stream: null as MediaStream | null, proc: null as ScriptProcessorNode | null, chunks: [] as Float32Array[], timer: 0 }
    rec.current = r
    setSeconds(0)
    setState('recording')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      if (rec.current !== r) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      r.stream = stream
      const src = ctx.createMediaStreamSource(stream)
      const proc = ctx.createScriptProcessor(4096, 1, 1)
      proc.onaudioprocess = (e) => r.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      src.connect(proc)
      proc.connect(ctx.destination) // output stays silent; needed for processing to run
      r.proc = proc
      const t0 = Date.now()
      r.timer = window.setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000)
        setSeconds(s)
        if (s >= MAX_SECONDS) void stop()
      }, 250)
    } catch (e) {
      teardown()
      setState('idle')
      setError((e as DOMException)?.name === 'NotAllowedError' ? 'not-allowed' : 'failed')
    }
  }, [stop, teardown])

  const cancel = useCallback(() => {
    teardown()
    setState('idle')
  }, [teardown])

  useEffect(() => () => void teardown(), [teardown])
  return { state, seconds, error, errorDetail, start, stop, cancel, supported: recordingSupported() }
}
