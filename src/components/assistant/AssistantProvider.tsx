import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, matchPath, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import type { AssistantMode } from '../../lib/api/assistant'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { AssistantChat } from './AssistantChat'

export interface OpenAssistantOptions {
  mode?: AssistantMode
  patientId?: string | null
  chapterId?: string | null
  conversationId?: string | null
  prompt?: string | null
  autoSend?: boolean
}

interface AssistantApi {
  open: (opts?: OpenAssistantOptions) => void
  close: () => void
}

const AssistantContext = createContext<AssistantApi>({ open: () => {}, close: () => {} })

export function useAssistant() {
  return useContext(AssistantContext)
}

/** Context from the current route: patient page -> that patient, reader -> that chapter. */
function routeContext(pathname: string): OpenAssistantOptions {
  const p = matchPath('/patients/:id', pathname)
  if (p?.params.id && p.params.id !== 'quick-aki') return { mode: 'patient', patientId: p.params.id }
  const r = matchPath('/academy/reader/:id', pathname)
  if (r?.params.id) return { mode: 'study', chapterId: r.params.id }
  return { mode: 'general' }
}

async function contextLabel(o: OpenAssistantOptions): Promise<string | null> {
  if (o.patientId) {
    // display only, in this browser — never sent to the model
    const { data } = await supabase.from('patients').select('name, age, diagnosis').eq('id', o.patientId).maybeSingle()
    return data ? [data.name, data.age != null ? `${data.age} ساله` : null, data.diagnosis].filter(Boolean).join(' · ') : null
  }
  if (o.chapterId) {
    const { data } = await supabase.from('library_chapters').select('chapter_number, title').eq('id', o.chapterId).maybeSingle()
    return data ? `فصل ${data.chapter_number} · ${data.title}` : null
  }
  return null
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const reduced = usePrefersReducedMotion()
  const [session, setSession] = useState<(OpenAssistantOptions & { key: number; label: string | null }) | null>(null)

  const open = useCallback(
    (opts: OpenAssistantOptions = {}) => {
      const base = opts.patientId || opts.chapterId || opts.conversationId ? {} : routeContext(location.pathname)
      const o: OpenAssistantOptions = { ...base, ...opts }
      if (!o.mode) o.mode = o.patientId ? 'patient' : o.chapterId ? 'study' : 'general'
      const key = Date.now()
      setSession({ ...o, key, label: null })
      void contextLabel(o).then((label) => setSession((s) => (s && s.key === key ? { ...s, label } : s)))
    },
    [location.pathname],
  )
  const close = useCallback(() => setSession(null), [])

  // close on navigation (e.g. «باز کردن در فصل»)
  useEffect(() => {
    setSession(null)
  }, [location.pathname])

  useEffect(() => {
    if (!session) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSession(null)
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [session])

  const api = useMemo(() => ({ open, close }), [open, close])
  const hideFab = location.pathname === '/assistant' || location.pathname === '/login' || location.pathname === '/academy/review'

  return (
    <AssistantContext.Provider value={api}>
      {children}
      {!hideFab && !session && (
        <button type="button" className="as-fab" onClick={() => open()} aria-label="دستیار Nephron" title="دستیار Nephron">
          <span aria-hidden="true">✨</span>
        </button>
      )}
      <AnimatePresence>
        {session && (
          <>
            <motion.div key="as-bd" className="as-backdrop" onClick={close} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            <motion.div
              key="as-sheet"
              className="as-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="دستیار Nephron"
              initial={reduced ? { opacity: 0 } : { y: '100%' }}
              animate={reduced ? { opacity: 1 } : { y: 0 }}
              exit={reduced ? { opacity: 0 } : { y: '100%' }}
              transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            >
              <div className="as-sheet-bar" dir="rtl">
                <span className="as-sheet-title">✨ دستیار Nephron</span>
                <Link to="/assistant" className="as-sheet-link">
                  تاریخچه
                </Link>
                <button type="button" className="as-sheet-close" onClick={close}>
                  بستن
                </button>
              </div>
              <AssistantChat
                key={session.key}
                mode={session.mode ?? 'general'}
                patientId={session.patientId ?? null}
                chapterId={session.chapterId ?? null}
                conversationId={session.conversationId ?? null}
                contextLabel={session.label}
                initialPrompt={session.prompt ?? null}
                autoSend={session.autoSend}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AssistantContext.Provider>
  )
}
