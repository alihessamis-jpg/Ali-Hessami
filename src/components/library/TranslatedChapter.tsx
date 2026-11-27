import { useEffect, useRef, useState } from 'react'
import { MarkdownSection } from '../MarkdownSection'
import { listChapterPassages, translatePassage, type ChapterPassage } from '../../lib/api/guidelines'

// Persian (right-to-left) view of an English chapter: the chapter's indexed
// passages (library_chunks), each shown with its cached Persian translation
// or translated on demand by the assistant edge function. Medical terms,
// drug names, numbers and statement labels stay in English.

function keyOf(p: ChapterPassage): string {
  return `${p.partNumber}:${p.sectionIdx}:${p.subIdx}`
}

function forDisplay(md: string): string {
  return md
    .replace(/\s*\{p\.(\d+)\}/g, ' «ص $1»')
    .replace(/\{#[\w-]+\}/g, '')
    .replace(/^\s*>\s*\[!(fa|pearl|flag|outside|discrepancy|explain)\]\s*$/gim, '>')
}

export function TranslatedChapter({ chapterId }: { chapterId: string }) {
  const [passages, setPassages] = useState<ChapterPassage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [runningAll, setRunningAll] = useState(false)
  const stopRef = useRef(false)

  useEffect(() => {
    setLoading(true)
    listChapterPassages(chapterId)
      .then(setPassages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load passages'))
      .finally(() => setLoading(false))
    return () => {
      stopRef.current = true
    }
  }, [chapterId])

  async function translateOne(p: ChapterPassage): Promise<void> {
    const k = keyOf(p)
    setBusy((prev) => new Set(prev).add(k))
    try {
      const text = await translatePassage(chapterId, p)
      setPassages((prev) => prev.map((x) => (keyOf(x) === k ? { ...x, translation: text } : x)))
    } finally {
      setBusy((prev) => {
        const next = new Set(prev)
        next.delete(k)
        return next
      })
    }
  }

  async function translateAll() {
    setError(null)
    setRunningAll(true)
    stopRef.current = false
    const queue = passages.filter((p) => !p.translation)
    const worker = async () => {
      while (queue.length > 0 && !stopRef.current) {
        const p = queue.shift()
        if (!p) break
        try {
          await translateOne(p)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Translation failed')
          stopRef.current = true
        }
      }
    }
    await Promise.all([worker(), worker()])
    setRunningAll(false)
  }

  if (loading) return <p className="np-small">در حال بارگذاری…</p>
  const done = passages.filter((p) => p.translation).length
  const pct = passages.length ? Math.round((done / passages.length) * 100) : 0

  return (
    <div className="tr-view" dir="rtl">
      <div className="tr-bar">
        <span>
          <b>
            ترجمهٔ فارسی: {done} از {passages.length} بخش
          </b>
          <span className="pbar">
            <i style={{ width: `${pct}%` }} />
          </span>
        </span>
        {done < passages.length &&
          (runningAll ? (
            <button type="button" className="np-btn ghost sm" onClick={() => (stopRef.current = true)}>
              توقف
            </button>
          ) : (
            <button type="button" className="np-btn sm" onClick={() => void translateAll()}>
              🔤 ترجمهٔ همهٔ بخش‌ها
            </button>
          ))}
      </div>
      <p className="np-small tr-note">
        ترجمه با هوش مصنوعی و فقط از روی همین متن انجام می‌شود؛ اصطلاحات پزشکی، داروها، اعداد و شمارهٔ توصیه‌ها انگلیسی می‌مانند. ترجمهٔ هر بخش یک بار ساخته و ذخیره می‌شود. برای تصمیم بالینی، متن اصلی (English) ملاک است.
      </p>
      {error && <p className="form-error">{error}</p>}
      {passages.length === 0 && <p className="np-small">این فصل هنوز فهرست نشده است.</p>}
      {passages.map((p) => {
        const k = keyOf(p)
        return (
          <section className="tr-pass" key={k} id={p.subIdx === 0 && p.anchor ? `fa-${p.anchor}` : undefined}>
            <div className="tr-meta">
              <span dir="auto">{p.heading}</span>
              {p.pageFrom != null && (
                <span className="pg">
                  p. {p.pageFrom}
                  {p.pageTo && p.pageTo !== p.pageFrom ? `–${p.pageTo}` : ''}
                </span>
              )}
            </div>
            {p.translation ? (
              <div className="tr-fa">
                <MarkdownSection text={forDisplay(p.translation)} />
              </div>
            ) : (
              <div className="tr-pending">
                <div className="tr-en" dir="ltr">
                  {p.content.replace(/\{p\.\d+\}|\{#[\w-]+\}/g, '').slice(0, 420)}
                  {p.content.length > 420 ? '…' : ''}
                </div>
                <button type="button" className="np-btn ghost sm" disabled={busy.has(k)} onClick={() => void translateOne(p).catch((e) => setError(String(e?.message ?? e)))}>
                  {busy.has(k) ? 'در حال ترجمه…' : '🔤 ترجمهٔ این بخش'}
                </button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
