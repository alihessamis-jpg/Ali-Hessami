import { useState } from 'react'
import { reindexLibrary } from '../../lib/api/search'
import { describeError } from '../../lib/describeError'

/**
 * Notes are re-chunked automatically by a DB trigger whenever a chapter or
 * part note changes; this button rebuilds the whole search index by hand
 * (e.g. after a bulk SQL import that bypassed the triggers).
 */
export function ReindexLibraryCard() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const n = await reindexLibrary()
      setMsg(`نمایه بازسازی شد · ${n.toLocaleString('fa-IR')} بخش`)
    } catch (e) {
      setMsg(`خطا: ${describeError(e, 'بازسازی ناموفق بود')}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="np-card np-fade" style={{ animationDelay: '.43s' }} dir="rtl">
      <h2>نمایهٔ جستجو و دستیار</h2>
      <span className="np-small" style={{ lineHeight: 1.8 }}>
        یادداشت‌های فصل‌ها بعد از هر ویرایش خودکار نمایه می‌شوند. اگر نتیجه‌ای جا افتاده بود، دستی بازسازی کنید.
      </span>
      <button type="button" onClick={() => void run()} disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {busy ? 'در حال بازسازی…' : 'بازسازی نمایه'}
      </button>
      {msg && <span className="np-small">{msg}</span>}
    </section>
  )
}
