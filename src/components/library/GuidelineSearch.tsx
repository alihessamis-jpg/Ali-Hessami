import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { searchGuidelines, type GuidelineSearchHit } from '../../lib/api/guidelines'
import { useAssistant } from '../assistant/AssistantProvider'

// Full-text search across every imported guideline (English text and the
// Persian translations made so far). Each hit cites its source — guideline,
// chapter, section and PDF page — and opens the Reader at that spot.

/** pgroonga snippet HTML -> React nodes with <mark> for the matched keywords; all other markup dropped. */
function renderSnippet(html: string): ReactNode[] {
  const parts = html.split(/(<span class="keyword">[\s\S]*?<\/span>)/g)
  const decode = (s: string) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/\{p\.\d+\}|\{#[\w-]+\}|\*\*|#{2,4} |```/g, '')
  return parts.map((p, i) =>
    p.startsWith('<span class="keyword">') ? <mark key={i}>{decode(p)}</mark> : <span key={i}>{decode(p)}</span>
  )
}

function pageLabel(h: GuidelineSearchHit): string {
  if (h.pageFrom == null) return ''
  return h.pageTo && h.pageTo !== h.pageFrom ? `ص ${h.pageFrom}–${h.pageTo}` : `ص ${h.pageFrom}`
}

export function GuidelineSearch() {
  const { open: openAssistant } = useAssistant()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<GuidelineSearchHit[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQ, setLastQ] = useState('')

  async function run(e?: FormEvent) {
    e?.preventDefault()
    const term = q.trim()
    if (!term) return
    setBusy(true)
    setError(null)
    try {
      setHits(await searchGuidelines(term, 30))
      setLastQ(term)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }

  function askAi() {
    const term = (lastQ || q).trim()
    if (!term) return
    openAssistant({
      mode: 'general',
      prompt: `${term}\n\nفقط بر اساس گایدلاین‌های موجود در کتابخانه پاسخ بده؛ برای هر نکته نام گایدلاین، شمارهٔ توصیه یا practice point، درجهٔ شواهد و شمارهٔ صفحه را بیاور و اگر گایدلاین جدیدتری وجود دارد آن را ملاک قرار بده.`,
      autoSend: true,
    })
  }

  return (
    <section className="np-card gl-search" dir="rtl">
      <h2>جستجو در همهٔ گایدلاین‌ها با ذکر منبع</h2>
      <form onSubmit={(e) => void run(e)} className="gl-ask">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="مثلاً: rituximab SDNS · renal angina index · VCUG · پروتئینوری"
          aria-label="Search guidelines"
          dir="auto"
        />
        <button type="submit" className="np-btn" disabled={busy || !q.trim()}>
          {busy ? '…' : 'جستجو'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {hits && (
        <>
          <div className="gl-search-head">
            <span className="np-small">
              {hits.length > 0 ? `${hits.length} نتیجه برای «${lastQ}»` : `نتیجه‌ای برای «${lastQ}» پیدا نشد — با اصطلاح انگلیسی هم امتحان کنید.`}
            </span>
            <button type="button" className="np-btn ghost sm" onClick={askAi}>
              ✨ پاسخ هوش مصنوعی با منبع
            </button>
          </div>
          <ol className="gl-hits">
            {hits.map((h) => (
              <li key={`${h.chunkId}-${h.lang}`}>
                <Link to={`/academy/reader/${h.chapterId}${h.lang === 'fa' ? '?lang=fa' : ''}${h.anchor ? `#${h.lang === 'fa' ? 'fa-' : ''}${h.anchor}` : ''}`}>
                  <span className="gl-hit-text" dir={h.lang === 'fa' ? 'rtl' : 'ltr'}>
                    {renderSnippet(h.snippet)}
                  </span>
                  <span className="gl-hit-src">
                    <span className={`gl-lang ${h.lang}`}>{h.lang === 'fa' ? 'فا' : 'EN'}</span>
                    <span dir="auto">
                      📖 {h.bookTitle} · {h.chapterTitle}
                      {h.heading && h.heading !== h.chapterTitle ? ` · ${h.heading}` : ''}
                    </span>
                    {pageLabel(h) && <b>{pageLabel(h)}</b>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
