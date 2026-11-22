import { useEffect, useState } from 'react'
import { getAssistantPatientModel, setAssistantPatientModel, type AssistantModel } from '../../lib/api/assistant'
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
  const [model, setModel] = useState<AssistantModel | null>(null)

  useEffect(() => {
    getAssistantPatientModel().then(setModel).catch(() => setModel('claude-sonnet-5-5'))
  }, [])

  async function changeModel(m: AssistantModel) {
    const prev = model
    setModel(m)
    try {
      await setAssistantPatientModel(m)
      setMsg('مدل کیس‌های بیمار ذخیره شد')
    } catch (e) {
      setModel(prev)
      setMsg(`خطا: ${describeError(e, 'ذخیره نشد')}`)
    }
  }

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
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        <span>مدل دستیار برای کیس‌های بیمار</span>
        <select value={model ?? ''} disabled={!model} onChange={(e) => void changeModel(e.target.value as AssistantModel)}>
          <option value="claude-sonnet-5-5">Claude Sonnet 5.5 — سریع‌تر و ارزان‌تر (پیش‌فرض)</option>
          <option value="claude-opus-5-5">Claude Opus 5.5 — استدلال عمیق‌تر برای کیس‌های پیچیده</option>
        </select>
        <span className="np-small">الان دستیار با Gemini (سطح رایگان، با کلید GEMINI_API_KEY) کار می‌کند. این انتخاب فقط وقتی اثر دارد که ANTHROPIC_API_KEY هم ثبت شود.</span>
      </label>
      {msg && <span className="np-small">{msg}</span>}
    </section>
  )
}
