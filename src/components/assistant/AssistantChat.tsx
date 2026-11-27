import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  answerPlainText,
  askAssistant,
  getConversation,
  getPatientCaseText,
  makeFlashcards,
  transcribeAudio,
  type AssistantMode,
  type AssistantSource,
} from '../../lib/api/assistant'
import { addProgressNote } from '../../lib/api/notes'
import { cleanPassage, delatex, renderAnswer } from '../../lib/assistantMarkdown'
import {
  getSpeakPref,
  hasPersianVoice,
  setSpeakPref,
  speak,
  speechSupported,
  stopSpeaking,
  unlockSpeech,
  useVoiceInput,
  voicesReady,
} from '../../lib/speech'

export const STUDY_CHIPS = [
  'این فصل رو خلاصه کن: نقشه ذهنی + نکات بورد',
  '۵ سؤال بورد از این فصل ازم بپرس و بعد از جوابم تصحیح کن',
  'تله‌های امتحانی و نکات high-yield',
  'یه سناریوی بالینی از این مبحث بساز',
]
export const PATIENT_CHIPS = [
  'تحلیل قدم‌به‌قدم این بیمار',
  'تشخیص‌های افتراقی با دلیل موافق و مخالف',
  'دوز داروهای این بیمار رو با وزن و eGFR چک کن',
  'قدم بعدی workup چیه؟',
]
const STUDY_CHIP_LABELS = ['خلاصه + نقشه ذهنی', '۵ سؤال بورد و تصحیح', 'تله‌ها', 'سناریوی بالینی']
const PATIENT_CHIP_LABELS = ['تحلیل قدم‌به‌قدم', 'تشخیص‌های افتراقی', 'چک دوز داروها', 'workup بعدی']

interface UiMessage {
  key: string
  id: string | null
  role: 'user' | 'assistant'
  text: string
  sources: Record<string, AssistantSource>
  steps: string[]
  pending?: boolean
  error?: string
  stop?: string | null
}

export interface AssistantChatProps {
  conversationId?: string | null
  mode: AssistantMode
  patientId?: string | null
  chapterId?: string | null
  topicId?: string | null
  /** Shown in the context bar only (never sent). */
  contextLabel?: string | null
  /** Text to put in the composer (e.g. a selected passage). */
  initialPrompt?: string | null
  /** Send initialPrompt immediately (quick-action chips). */
  autoSend?: boolean
  onConversation?: (id: string) => void
  variant?: 'sheet' | 'page'
}

let keySeq = 0
const nextKey = () => `m${++keySeq}`

export function AssistantChat({
  conversationId: initialConversationId = null,
  mode,
  patientId = null,
  chapterId = null,
  topicId = null,
  contextLabel,
  initialPrompt,
  autoSend,
  onConversation,
  variant = 'sheet',
}: AssistantChatProps) {
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState(initialPrompt && !autoSend ? initialPrompt : '')
  const [busy, setBusy] = useState(false)
  const [speakOn, setSpeakOn] = useState(getSpeakPref)
  const speakRef = useRef(speakOn)
  speakRef.current = speakOn
  const [voiceNote, setVoiceNote] = useState<string | null>(null)
  const [persianVoice, setPersianVoice] = useState(false)
  const voice = useVoiceInput(transcribeAudio, (text) => {
    setInput((cur) => (cur.trim() ? `${cur.trim()} ${text}` : text))
    inputRef.current?.focus()
  })

  // Read-aloud is only offered where the device has a Persian voice
  // (iOS has none by default, and a non-Persian voice is unintelligible).
  useEffect(() => {
    let alive = true
    void voicesReady().then(() => {
      if (!alive) return
      const ok = hasPersianVoice()
      setPersianVoice(ok)
      if (!ok && speakRef.current) setSpeakOn(false)
    })
    return () => {
      alive = false
    }
  }, [])
  const [loadingHistory, setLoadingHistory] = useState(!!initialConversationId)
  const [caseText, setCaseText] = useState('')
  const [caseState, setCaseState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [caseOpen, setCaseOpen] = useState(true)
  const [privacyNote, setPrivacyNote] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const autoSent = useRef(false)

  const isPatient = mode === 'patient' && !!patientId
  const firstTurn = !conversationId && messages.length === 0

  // ---- load an existing conversation
  useEffect(() => {
    if (!initialConversationId) return
    let alive = true
    getConversation(initialConversationId)
      .then(({ messages: ms }) => {
        if (!alive) return
        setMessages(ms.map((m) => ({ key: nextKey(), id: m.id, role: m.role, text: m.content, sources: m.sources, steps: m.steps ?? [] })))
      })
      .catch((e) => setToast(`بارگذاری گفت‌وگو ناموفق بود: ${e.message ?? e}`))
      .finally(() => alive && setLoadingHistory(false))
    return () => {
      alive = false
    }
  }, [initialConversationId])

  // ---- de-identified case summary for a new patient conversation
  useEffect(() => {
    if (!isPatient || initialConversationId) return
    let alive = true
    setCaseState('loading')
    getPatientCaseText(patientId!)
      .then((t) => {
        if (!alive) return
        setCaseText(t)
        setCaseState('ready')
      })
      .catch(() => alive && setCaseState('error'))
    return () => {
      alive = false
    }
  }, [isPatient, patientId, initialConversationId])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }, [])

  const send = useCallback(
    async (text: string) => {
      const q = text.trim()
      if (!q || busy) return
      if (isPatient && firstTurn && caseState === 'loading') return
      setBusy(true)
      setInput('')
      if (voice.state === 'recording') voice.cancel()
      stopSpeaking()
      let spokenText = ''
      let spokenSources: Record<string, AssistantSource> = {}
      const aKey = nextKey()
      setMessages((ms) => [
        ...ms,
        { key: nextKey(), id: null, role: 'user', text: q, sources: {}, steps: [] },
        { key: aKey, id: null, role: 'assistant', text: '', sources: {}, steps: [], pending: true },
      ])
      const patch = (fn: (m: UiMessage) => UiMessage) => setMessages((ms) => ms.map((m) => (m.key === aKey ? fn(m) : m)))
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        await askAssistant(
          {
            conversationId,
            mode,
            patientId: isPatient ? patientId : null,
            chapterId,
            topicId,
            message: q,
            caseText: isPatient && firstTurn ? caseText : null,
            debug: import.meta.env.DEV,
          },
          {
            onMeta: (m) => {
              if (!conversationId) {
                setConversationId(m.conversationId)
                onConversation?.(m.conversationId)
              }
              if (isPatient)
                setPrivacyNote(
                  `🔒 نام، کد، تخت و تاریخ تولد ارسال نشد${m.privacy.redactions ? ` · ${m.privacy.redactions.toLocaleString('fa-IR')} مورد حذف شد` : ''}`,
                )
              if (import.meta.env.DEV && m.payloadPreview) {
                console.info('[assistant] request payload (dev only)', { privacy: m.privacy, model: m.model, payload: m.payloadPreview })
              }
            },
            onStep: (t) => patch((m) => ({ ...m, steps: [...m.steps, t] })),
            onDelta: (t) => patch((m) => ({ ...m, text: m.text + t })),
            onReset: () => patch((m) => ({ ...m, text: '' })),
            onFinal: (t) => {
              spokenText = t
              patch((m) => ({ ...m, text: t }))
            },
            onSources: (s) => {
              spokenSources = s
              patch((m) => ({ ...m, sources: s }))
            },
            onDone: (d) => {
              patch((m) => ({ ...m, id: d.messageId, pending: false, stop: d.stop }))
              if (speakRef.current && spokenText) speak(answerPlainText(delatex(spokenText), spokenSources, false))
            },
            onError: (e) => patch((m) => ({ ...m, pending: false, error: e })),
          },
          ctrl.signal,
        )
      } catch (e) {
        const aborted = (e as Error)?.name === 'AbortError'
        patch((m) => ({ ...m, pending: false, error: aborted ? 'متوقف شد.' : `خطا: ${(e as Error)?.message ?? e}` }))
      } finally {
        patch((m) => (m.pending ? { ...m, pending: false } : m))
        setBusy(false)
        abortRef.current = null
      }
    },
    [busy, isPatient, firstTurn, caseState, conversationId, mode, patientId, chapterId, topicId, caseText, onConversation, voice],
  )

  // quick-action from outside (patient chips / «بپرس» on a selection)
  useEffect(() => {
    if (!autoSend || !initialPrompt || autoSent.current) return
    if (isPatient && caseState !== 'ready' && caseState !== 'error') return
    autoSent.current = true
    void send(initialPrompt)
  }, [autoSend, initialPrompt, isPatient, caseState, send])

  const chips = mode === 'patient' ? PATIENT_CHIPS : chapterId || mode === 'study' ? STUDY_CHIPS : []
  const chipLabels = mode === 'patient' ? PATIENT_CHIP_LABELS : STUDY_CHIP_LABELS

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia('(pointer: coarse)').matches) {
      e.preventDefault()
      void send(input)
    }
  }

  function toggleMic() {
    if (voice.state === 'transcribing') return
    if (voice.state === 'recording') {
      void voice.stop()
      return
    }
    stopSpeaking()
    setVoiceNote(null)
    void voice.start()
  }

  async function toggleSpeaker() {
    const next = !speakOn
    setSpeakOn(next)
    setSpeakPref(next)
    if (!next) {
      stopSpeaking()
      setVoiceNote(null)
      return
    }
    unlockSpeech() // inside the tap, so iOS allows speech later
  }

  useEffect(() => {
    if (!voice.error) return
    const msg: Record<string, string> = {
      'not-allowed': 'اجازهٔ میکروفون داده نشد (Settings › Safari › Microphone، یا تنظیمات اپ).',
      'too-short': 'صدایی ضبط نشد؛ دکمه را بزن، حرف بزن، بعد دوباره بزن.',
      unsupported: 'این مرورگر ضبط صدا را پشتیبانی نمی‌کند.',
      failed: voice.errorDetail ?? 'تبدیل صدا به متن ناموفق بود؛ دوباره امتحان کن.',
    }
    setVoiceNote(msg[voice.error])
  }, [voice.error, voice.errorDetail])

  function autosize() {
    const t = inputRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(160, t.scrollHeight)}px`
  }
  useEffect(autosize, [input])

  return (
    <div className={`as-chat as-v-${variant}`} dir="rtl">
      {contextLabel && (
        <div className="as-ctx">
          <span className="as-ctx-kind">{mode === 'patient' ? 'بیمار' : mode === 'study' ? 'فصل' : 'کلی'}</span>
          <span className="as-ctx-label" dir="auto">
            {contextLabel}
          </span>
        </div>
      )}

      <div className="as-list" ref={listRef}>
        {loadingHistory && <p className="as-hint">در حال بارگذاری…</p>}

        {isPatient && firstTurn && (
          <section className="as-case">
            <button type="button" className="as-case-head" onClick={() => setCaseOpen((v) => !v)} aria-expanded={caseOpen}>
              <span>خلاصهٔ کیس (بدون نام و کد) — دقیقاً همین متن ارسال می‌شود</span>
              <span aria-hidden="true">{caseOpen ? '▾' : '▸'}</span>
            </button>
            {caseOpen && (
              <>
                {caseState === 'loading' && <p className="as-hint">در حال آماده‌سازی خلاصه…</p>}
                {caseState === 'error' && <p className="as-hint">خلاصه ساخته نشد؛ می‌توانید کیس را دستی بنویسید.</p>}
                {caseState !== 'loading' && (
                  <textarea
                    className="as-case-text"
                    dir="auto"
                    value={caseText}
                    onChange={(e) => setCaseText(e.target.value)}
                    rows={8}
                    aria-label="خلاصهٔ کیس"
                  />
                )}
              </>
            )}
          </section>
        )}

        {!loadingHistory && messages.length === 0 && !isPatient && (
          <div className="as-empty">
            <b>سلام دکتر 👋</b>
            هر پاسخ فقط از کتاب‌ها، کارت‌ها و بانک سؤال خودت می‌آید و کنار هر جمله منبعش را می‌بینی.
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.key} className="as-msg u">
              <div className="as-b" dir="auto">
                {m.text}
              </div>
            </div>
          ) : (
            <AnswerBubble
              key={m.key}
              m={m}
              showNoteAction={isPatient}
              onCopy={async () => {
                await navigator.clipboard.writeText(answerPlainText(m.text, m.sources))
                flash('کپی شد')
              }}
              onNote={async () => {
                try {
                  await addProgressNote({ patientId: patientId!, date: new Date().toLocaleDateString('en-CA'), A: answerPlainText(m.text, m.sources) })
                  flash('به progress note امروز اضافه شد')
                } catch (e) {
                  flash(`خطا: ${(e as Error).message}`)
                }
              }}
              onCards={async () => {
                if (!m.id) return
                try {
                  const n = await makeFlashcards(m.id)
                  flash(`${n.toLocaleString('fa-IR')} کارت پیشنهادی ساخته شد (در صف بازبینی فصل)`)
                } catch (e) {
                  flash((e as Error).message)
                }
              }}
            />
          ),
        )}
        {privacyNote && <p className="as-privacy">{privacyNote}</p>}
      </div>

      {chips.length > 0 && messages.length === 0 && (
        <div className="as-chips">
          {chips.map((c, i) => (
            <button key={c} type="button" className="as-chip" disabled={busy || (isPatient && caseState === 'loading')} onClick={() => void send(c)}>
              {chipLabels[i] ?? c}
            </button>
          ))}
        </div>
      )}

      {toast && (
        <div className="as-toast" role="status">
          {toast}
        </div>
      )}

      {voiceNote && <p className="as-voice-note">{voiceNote}</p>}
      <div className="as-composer">
        {voice.supported && (
          <button
            type="button"
            className={voice.state === 'recording' ? 'as-ib mic live' : voice.state === 'transcribing' ? 'as-ib mic busy' : 'as-ib mic'}
            onClick={toggleMic}
            disabled={voice.state === 'transcribing'}
            aria-pressed={voice.state === 'recording'}
            aria-label={voice.state === 'recording' ? 'پایان ضبط' : 'صحبت کن'}
            title={voice.state === 'recording' ? 'پایان ضبط' : 'صحبت کن (فارسی)'}
          >
            {voice.state === 'transcribing' ? <span className="as-spin" aria-hidden="true" /> : <MicIcon />}
          </button>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            voice.state === 'recording'
              ? `● در حال ضبط… ${voice.seconds.toLocaleString('fa-IR')} ثانیه`
              : voice.state === 'transcribing'
                ? 'در حال تبدیل صدا به متن…'
                : 'سؤالت را بنویس…'
          }
          aria-label="پیام"
        />
        {speechSupported() && persianVoice && (
          <button
            type="button"
            className={speakOn ? 'as-ib spk on' : 'as-ib spk'}
            onClick={() => void toggleSpeaker()}
            aria-pressed={speakOn}
            aria-label={speakOn ? 'خواندن پاسخ‌ها با صدا: روشن' : 'خواندن پاسخ‌ها با صدا: خاموش'}
            title="خواندن پاسخ با صدا"
          >
            <SpeakerIcon on={speakOn} />
          </button>
        )}
        {busy ? (
          <button type="button" className="as-ib stop" onClick={() => abortRef.current?.abort()} aria-label="توقف">
            ■
          </button>
        ) : (
          <button type="button" className="as-ib send" onClick={() => void send(input)} disabled={!input.trim()} aria-label="ارسال">
            ➤
          </button>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- one answer
function AnswerBubble({
  m,
  showNoteAction,
  onCopy,
  onNote,
  onCards,
}: {
  m: UiMessage
  showNoteAction: boolean
  onCopy: () => void
  onNote: () => void
  onCards: () => void
}) {
  const [open, setOpen] = useState(false)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const srcRef = useRef<HTMLDivElement>(null)
  const ids = useMemo(() => Object.keys(m.sources).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))), [m.sources])
  const html = useMemo(() => renderAnswer(m.text, (id) => m.pending || id in m.sources), [m.text, m.sources, m.pending])

  function onClick(e: MouseEvent<HTMLDivElement>) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.cite')
    if (!btn) return
    const id = btn.dataset.s
    if (!id || !m.sources[id]) return
    setOpen(true)
    setFlashId(id)
    window.setTimeout(() => {
      srcRef.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 30)
    window.setTimeout(() => setFlashId(null), 1700)
  }

  async function run(name: string, fn: () => void | Promise<void>) {
    setBusyAction(name)
    try {
      await fn()
    } finally {
      setBusyAction(null)
    }
  }

  const hasChapterSource = ids.some((id) => m.sources[id].chapterId)

  return (
    <div className="as-msg a">
      <div className="as-b">
        {m.steps.length > 0 && (
          <div className="as-steps" aria-label="جست‌وجوها">
            {m.steps.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        )}
        {m.pending && !m.text && <p className="as-hint">در حال جست‌وجو در منابع…</p>}
        {m.text && <div className="as-ans" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />}
        {m.error && <p className="as-err">{m.error}</p>}
        {m.stop === 'truncated' && <p className="as-hint">(پاسخ کوتاه شد)</p>}

        {ids.length > 0 && (
          <details className="as-srcs" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
            <summary>منابع ({ids.length.toLocaleString('fa-IR')})</summary>
            <div ref={srcRef}>
              {ids.map((id) => {
                const s = m.sources[id]
                const href = s.chapterId ? `/academy/reader/${s.chapterId}${s.anchor ? `#${s.anchor}` : ''}` : null
                return (
                  <div key={id} data-id={id} className={flashId === id ? 'as-src flash' : 'as-src'}>
                    <div className="as-src-head">
                      <b>[{id.slice(1)}]</b> <span dir="auto">{s.label}</span>
                    </div>
                    {s.heading && (
                      <div className="as-src-sec" dir="auto">
                        {s.heading}
                      </div>
                    )}
                    <div className="as-src-text" dir="auto">
                      {cleanPassage(s.text).slice(0, 1500)}
                    </div>
                    {href && (
                      <Link className="as-src-open" to={href}>
                        باز کردن در فصل ←
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )}

        {!m.pending && m.text && !m.error && (
          <div className="as-actions">
            <button type="button" className="as-mini" onClick={() => void run('copy', onCopy)}>
              کپی
            </button>
            {showNoteAction && (
              <button type="button" className="as-mini" disabled={busyAction === 'note'} onClick={() => void run('note', onNote)}>
                افزودن به progress note
              </button>
            )}
            {hasChapterSource && m.id && (
              <button type="button" className="as-mini" disabled={busyAction === 'cards'} onClick={() => void run('cards', onCards)}>
                {busyAction === 'cards' ? 'در حال ساخت…' : 'ساخت فلش‌کارت'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MicIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="m17 9 4 6m0-6-4 6" />}
    </svg>
  )
}
