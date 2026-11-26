import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  attachGuidelinePdf,
  guidelinePdfUrl,
  importGuidelinePackage,
  listGuidelines,
  parseGuidelinePackage,
  type GuidelineImportProgress,
  type GuidelineWithChapters,
} from '../../lib/api/guidelines'
import { useAssistant } from '../assistant/AssistantProvider'
import { BookIcon, UploadIcon } from '../icons'
import type { GuidelineHighlight } from '../../types/domain'

const TONE: Record<string, { color: string; background: string }> = {
  pearl: { color: '#17663A', background: '#DDF3E6' },
  flag: { color: '#9B3A31', background: '#FDECEB' },
  info: { color: '#1546A8', background: '#E3EDFD' },
}

const ASK_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: 'خلاصهٔ توصیه‌ها برای کودکان',
    prompt:
      'مهم‌ترین توصیه‌ها و practice pointهای این گایدلاین را که به کودکان و نوزادان مربوط است، با شمارهٔ توصیه، درجهٔ شواهد و شمارهٔ صفحه خلاصه کن.',
  },
  {
    label: 'چه چیزی تغییر کرده؟',
    prompt: 'این گایدلاین نسبت به نسخهٔ قبلی چه تغییرات عملی مهمی دارد؟ فقط بر اساس متن خود گایدلاین و با ذکر منبع پاسخ بده.',
  },
  {
    label: '۵ سؤال بورد',
    prompt: 'از این گایدلاین ۵ سؤال چهارگزینه‌ای در سطح بورد فوق‌تخصص نفرولوژی کودکان بساز؛ یکی‌یکی بپرس و بعد از جواب من تصحیح کن.',
  },
]

function isDraft(status: string | null | undefined): boolean {
  return !!status && /draft/i.test(status)
}

export function GuidelinesPanel({ search }: { search: string }) {
  const { open: openAssistant } = useAssistant()
  const [items, setItems] = useState<GuidelineWithChapters[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<GuidelineImportProgress | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
  const pkgInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const pdfTarget = useRef<string | null>(null)

  function load() {
    setLoading(true)
    listGuidelines()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load guidelines'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePackage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setNotice(null)
    try {
      const pkg = parseGuidelinePackage(await file.text())
      const result = await importGuidelinePackage(pkg, setProgress)
      setNotice(
        `Imported ${result.guidelines} guideline${result.guidelines === 1 ? '' : 's'} — ${result.chaptersCreated} new, ${result.chaptersUpdated} updated chapters. The assistant can search them now.`
      )
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setProgress(null)
    }
  }

  async function handlePdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    const bookId = pdfTarget.current
    if (!file || !bookId) return
    setPdfBusy(bookId)
    setError(null)
    try {
      const path = await attachGuidelinePdf(bookId, file)
      setItems((prev) => prev.map((g) => (g.book.id === bookId ? { ...g, book: { ...g.book, pdfPath: path } } : g)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF upload failed')
    } finally {
      setPdfBusy(null)
    }
  }

  async function openPdf(path: string) {
    // Open the tab synchronously (iOS Safari blocks window.open after an await).
    const win = window.open('', '_blank')
    try {
      const url = await guidelinePdfUrl(path)
      if (win) win.location.href = url
      else window.location.href = url
    } catch (err) {
      win?.close()
      setError(err instanceof Error ? err.message : 'Could not open the PDF')
    }
  }

  const q = search.trim().toLowerCase()
  const visible = items.filter(
    (g) =>
      !q ||
      [g.book.title, g.book.organization, g.book.summary, g.book.scope, ...g.chapters.map((c) => c.title)]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
  )

  return (
    <div className="parts np-fade gl-list" style={{ animationDelay: '.16s' }}>
      <div className="gl-bar">
        <span className="np-small" style={{ flex: 1, minWidth: 0 }}>
          Clinical practice guidelines with Nephron's analysis and highlights. Every chapter is indexed for the AI assistant.
        </span>
        <button type="button" className="np-btn ghost sm" onClick={() => pkgInput.current?.click()} disabled={!!progress}>
          <UploadIcon width={16} height={16} />
          Import guideline package
        </button>
        <input ref={pkgInput} type="file" accept=".json,application/json" hidden onChange={(e) => void handlePackage(e)} />
        <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => void handlePdf(e)} />
      </div>

      {progress && (
        <div className="np-card gl-progress" role="status">
          <b>
            Importing… {progress.done}/{progress.total}
          </b>
          <span className="np-small">{progress.current}</span>
          <span className="pbar">
            <i style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
          </span>
        </div>
      )}
      {notice && <p className="np-small gl-notice">{notice}</p>}
      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p className="np-small">Loading guidelines…</p>
      ) : items.length === 0 ? (
        <section className="np-empty">
          <b style={{ fontSize: 15 }}>No guidelines yet</b>
          <span className="np-small">
            Import a Nephron guideline package (.json) to add guidelines here — each comes with a Persian analysis chapter and the full original text.
          </span>
        </section>
      ) : visible.length === 0 ? (
        <p className="empty-state">No guidelines match.</p>
      ) : (
        visible.map(({ book, chapters }) => {
          const analysis = chapters.find((c) => c.partRoman === 'A') ?? chapters[0]
          const originals = chapters.filter((c) => c !== analysis)
          const draft = isDraft(book.docStatus)
          const highlights: GuidelineHighlight[] = book.highlights ?? []
          return (
            <article className="np-card gl-card" key={book.id}>
              <div className="gl-tags">
                {book.organization && (
                  <span className="np-tag" style={{ color: '#1546A8', background: '#E3EDFD' }}>
                    {book.organization}
                  </span>
                )}
                {book.year && (
                  <span className="np-tag" style={{ color: '#5B6B82', background: '#EEF2F8' }}>
                    {book.year}
                  </span>
                )}
                {book.docStatus && (
                  <span className="np-tag" style={draft ? { color: '#93590B', background: '#FDF0DC' } : { color: '#17663A', background: '#DDF3E6' }}>
                    {book.docStatus}
                  </span>
                )}
              </div>
              <h2 className="gl-title">{book.title}</h2>
              {book.scope && <span className="np-small">{book.scope}</span>}
              {book.summary && (
                <p className="gl-summary" dir="rtl">
                  {book.summary}
                </p>
              )}

              {highlights.length > 0 && (
                <ul className="gl-hl" dir="rtl">
                  {highlights.map((h, i) => (
                    <li key={i} style={TONE[h.tone ?? 'info'] ?? TONE.info}>
                      <b>{h.label}</b>
                      <span dir="auto">{h.text}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="gl-actions">
                {analysis && (
                  <Link className="np-btn sm" to={`/academy/reader/${analysis.id}`}>
                    <BookIcon width={16} height={16} />
                    تحلیل و نکات کلیدی
                  </Link>
                )}
                {book.pdfPath ? (
                  <button type="button" className="np-btn ghost sm" onClick={() => void openPdf(book.pdfPath as string)}>
                    Open PDF
                  </button>
                ) : (
                  <button
                    type="button"
                    className="np-btn ghost sm"
                    disabled={pdfBusy === book.id}
                    onClick={() => {
                      pdfTarget.current = book.id
                      pdfInput.current?.click()
                    }}
                  >
                    <UploadIcon width={16} height={16} />
                    {pdfBusy === book.id ? 'Uploading…' : 'Attach PDF'}
                  </button>
                )}
              </div>

              {analysis && (
                <div className="pc-ai-chips reader gl-ai" dir="rtl">
                  {ASK_PROMPTS.map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      className="pc-ai-chip"
                      onClick={() => openAssistant({ mode: 'study', chapterId: analysis.id, prompt: `«${book.title}»: ${a.prompt}`, autoSend: true })}
                    >
                      ✨ {a.label}
                    </button>
                  ))}
                </div>
              )}

              {originals.length > 0 && (
                <details className="gl-chs">
                  <summary>
                    Original text · {originals.length} chapters
                    {book.totalPages ? ` · ${book.totalPages} pp` : ''}
                  </summary>
                  <div className="chs">
                    {originals.map((c) => (
                      <Link key={c.id} className="ch" to={`/academy/reader/${c.id}`}>
                        <span className="cn">{c.chapterNumber}</span>
                        <span>
                          <span className="ct">{c.title}</span>
                          <span className="cm">
                            {c.startPage != null && (
                              <span>
                                p. {c.startPage}–{c.endPage}
                              </span>
                            )}
                            {c.subtitle && <span>{c.subtitle}</span>}
                            {c.status === 'reading' && <span>Reading {c.readingPct}%</span>}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </details>
              )}
              {book.citation && <span className="np-small gl-cite">{book.citation}</span>}
            </article>
          )
        })
      )}
    </div>
  )
}
