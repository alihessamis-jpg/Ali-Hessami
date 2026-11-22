import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { BookIcon, FlashcardsIcon, PatientsIcon, QuizIcon, SearchIcon } from '../icons'
import {
  globalSearch,
  pageLabel,
  passageHref,
  snippetToSafeHtml,
  type GlobalSearchResults,
  type QuestionHit,
} from '../../lib/api/search'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

// ---------------------------------------------------------------- context
interface GlobalSearchApi {
  open: (initial?: string) => void
}

const GlobalSearchContext = createContext<GlobalSearchApi>({ open: () => {} })

export function useGlobalSearch() {
  return useContext(GlobalSearchContext)
}

export function GlobalSearchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; initial: string }>({ open: false, initial: '' })
  const open = useCallback((initial = '') => setState({ open: true, initial }), [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  // ⌘K / Ctrl+K anywhere, or "/" when not typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        open()
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const api = useMemo(() => ({ open }), [open])
  return (
    <GlobalSearchContext.Provider value={api}>
      {children}
      <AnimatePresence>{state.open && <SearchOverlay key="gs" initial={state.initial} onClose={close} />}</AnimatePresence>
    </GlobalSearchContext.Provider>
  )
}

/** The magnifier button placed in the mobile header and the sidebar. */
export function GlobalSearchButton({ className, label = 'جستجو' }: { className?: string; label?: string }) {
  const { open } = useGlobalSearch()
  return (
    <button type="button" className={className ?? 'gs-trigger'} onClick={() => open()} aria-label="جستجوی سراسری" title="جستجو (⌘K)">
      <SearchIcon />
      <span>{label}</span>
    </button>
  )
}

// ---------------------------------------------------------------- overlay
const EMPTY: GlobalSearchResults = { library: [], cards: [], questions: [], patients: [] }

function Snip({ html }: { html: string }) {
  return <span className="gs-snip" dir="auto" dangerouslySetInnerHTML={{ __html: snippetToSafeHtml(html) }} />
}

function SearchOverlay({ initial, onClose }: { initial: string; onClose: () => void }) {
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState(initial)
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState('')
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)
  const reqId = useRef(0)

  useEffect(() => {
    inputRef.current?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Debounced search; stale responses are dropped.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(EMPTY)
      setSearched('')
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++reqId.current
    const t = window.setTimeout(async () => {
      const r = await globalSearch(term)
      if (id !== reqId.current) return
      setResults(r)
      setSearched(term)
      setLoading(false)
    }, 280)
    return () => window.clearTimeout(t)
  }, [q])

  function go(path: string) {
    onClose()
    navigate(path)
  }

  const total = results.library.length + results.cards.length + results.questions.length + results.patients.length
  const motionProps = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 8 } }

  return (
    <>
      <motion.div className="gs-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.div
        className="gs-panel"
        role="dialog"
        aria-modal="true"
        aria-label="جستجوی سراسری"
        dir="rtl"
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        {...motionProps}
      >
        <div className="gs-bar">
          <SearchIcon className="gs-bar-icon" />
          <input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            dir="auto"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو در کتاب‌ها، کارت‌ها، سؤالات و بیماران…"
            aria-label="عبارت جستجو"
          />
          {loading && <span className="gs-spin" aria-hidden="true" />}
          <button type="button" className="gs-close" onClick={onClose}>
            بستن
          </button>
        </div>

        <div className="gs-body">
          {q.trim().length < 2 && (
            <p className="gs-hint">
              فارسی یا انگلیسی بنویسید؛ مثلاً «سندرم نفروتیک»، <bdi>C3NeF</bdi> یا <bdi>rituximab</bdi>.
            </p>
          )}
          {searched && !loading && total === 0 && <p className="gs-hint">نتیجه‌ای برای «{searched}» پیدا نشد.</p>}

          {results.library.length > 0 && (
            <section className="gs-group">
              <h3>
                <BookIcon /> کتاب‌ها <span className="gs-count">{results.library.length}</span>
              </h3>
              {results.library.map((h) => (
                <button key={h.chunkId} type="button" className="gs-item" onClick={() => go(passageHref(h.chapterId, h.anchor))}>
                  <span className="gs-src" dir="ltr">
                    {h.bookTitle ? `${h.bookTitle} · ` : ''}Ch {h.chapterNumber}
                    {h.partNumber != null ? ` · Part ${h.partNumber}` : ''}
                    {pageLabel(h.pageFrom, h.pageTo) ? ` · ${pageLabel(h.pageFrom, h.pageTo)}` : ''}
                  </span>
                  <span className="gs-title" dir="auto">
                    {h.heading || h.chapterTitle}
                  </span>
                  <Snip html={h.snippet} />
                </button>
              ))}
            </section>
          )}

          {results.cards.length > 0 && (
            <section className="gs-group">
              <h3>
                <FlashcardsIcon /> کارت‌ها <span className="gs-count">{results.cards.length}</span>
              </h3>
              {results.cards.map((c) => (
                <button
                  key={c.cardId}
                  type="button"
                  className="gs-item"
                  disabled={!c.chapterId}
                  onClick={() => c.chapterId && go(passageHref(c.chapterId, c.sectionNumber ? `s${c.sectionNumber}` : null))}
                >
                  {c.chapterTitle && (
                    <span className="gs-src" dir="ltr">
                      {c.chapterTitle}
                    </span>
                  )}
                  <Snip html={c.snippet || c.front} />
                </button>
              ))}
            </section>
          )}

          {results.questions.length > 0 && (
            <section className="gs-group">
              <h3>
                <QuizIcon /> سؤالات <span className="gs-count">{results.questions.length}</span>
              </h3>
              {results.questions.map((x) => (
                <QuestionRow
                  key={x.questionId}
                  hit={x}
                  expanded={openQuestion === x.questionId}
                  onToggle={() => setOpenQuestion((cur) => (cur === x.questionId ? null : x.questionId))}
                  onOpenChapter={(id) => go(passageHref(id, null))}
                />
              ))}
            </section>
          )}

          {results.patients.length > 0 && (
            <section className="gs-group">
              <h3>
                <PatientsIcon /> بیماران <span className="gs-count">{results.patients.length}</span>
              </h3>
              {results.patients.map((p) => (
                <button key={p.id} type="button" className="gs-item gs-patient" onClick={() => go(`/patients/${p.id}`)}>
                  <span className="gs-title" dir="auto">
                    {p.name}
                  </span>
                  {(p.code || p.bed || p.diagnosis) && (
                    <span className="gs-snip">
                      {[
                        p.code && (
                          <span key="c">
                            کد <bdi>{p.code}</bdi>
                          </span>
                        ),
                        p.bed && (
                          <span key="b">
                            تخت <bdi>{p.bed}</bdi>
                          </span>
                        ),
                        p.diagnosis && (
                          <bdi key="d">{p.diagnosis}</bdi>
                        ),
                      ]
                        .filter(Boolean)
                        .flatMap((el, i) => (i ? [<span key={`s${i}`}> · </span>, el] : [el]))}
                    </span>
                  )}
                </button>
              ))}
            </section>
          )}
        </div>
      </motion.div>
    </>
  )
}

function QuestionRow({
  hit,
  expanded,
  onToggle,
  onOpenChapter,
}: {
  hit: QuestionHit
  expanded: boolean
  onToggle: () => void
  onOpenChapter: (chapterId: string) => void
}) {
  return (
    <div className={expanded ? 'gs-item gs-q open' : 'gs-item gs-q'}>
      <button type="button" className="gs-q-head" onClick={onToggle} aria-expanded={expanded}>
        {(hit.chapterTitle || hit.topic) && (
          <span className="gs-src" dir="ltr">
            {hit.chapterTitle ?? hit.topic}
          </span>
        )}
        <Snip html={hit.snippet || hit.question} />
      </button>
      {expanded && (
        <div className="gs-q-body" dir="rtl">
          <p>{hit.question}</p>
          {hit.options && hit.options.length > 0 && (
            <ol>
              {hit.options.map((o, i) => (
                <li key={i} className={i === hit.correctIndex ? 'correct' : undefined}>
                  <bdi>{o}</bdi>
                </li>
              ))}
            </ol>
          )}
          {hit.explanation && <p className="gs-muted">{hit.explanation}</p>}
          {hit.chapterId && (
            <button type="button" className="gs-link" onClick={() => onOpenChapter(hit.chapterId!)}>
              باز کردن فصل ←
            </button>
          )}
        </div>
      )}
    </div>
  )
}
