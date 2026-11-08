import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listDailyVerses, setDailyVerseMemorized } from '../lib/api/dailyVerses'
import { shamsiWeekdayLabel } from '../lib/dailyVerse'
import { toPersianDigits } from '../lib/shamsi'
import { describeError } from '../lib/debugError'
import { EmptyState } from '../components/illustrations/EmptyState'
import type { DailyVerse } from '../types/domain'

// دفتر ابیات — every daily verse, with its weekday and Shamsi date, for
// re-reading and self-testing (practice mode hides the second hemistich
// until tapped).
export function VersesPage() {
  const [verses, setVerses] = useState<DailyVerse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [poetFilter, setPoetFilter] = useState<string | null>(null)
  const [practice, setPractice] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  useEffect(() => {
    listDailyVerses()
      .then(setVerses)
      .catch((err) => setError(`دفتر ابیات بارگذاری نشد — ${describeError(err)}`))
      .finally(() => setLoading(false))
  }, [])

  const poets = useMemo(() => Array.from(new Set(verses.map((v) => v.poet))), [verses])
  const shown = useMemo(() => (poetFilter ? verses.filter((v) => v.poet === poetFilter) : verses), [verses, poetFilter])
  const memorizedCount = verses.filter((v) => v.memorized).length

  async function toggleMemorized(v: DailyVerse) {
    try {
      const updated = await setDailyVerseMemorized(v.id, !v.memorized)
      setVerses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    } catch (err) {
      setError(describeError(err))
    }
  }

  function reveal(id: string) {
    setRevealed((prev) => new Set(prev).add(id))
  }

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page" dir="rtl">
      <div className="np-card np-fade">
        <div className="np-head">
          <div className="np-head-l">
            <span className="vs-quill" aria-hidden="true">
              ❦
            </span>
            <h2 className="np-fa">دفتر ابیات</h2>
          </div>
          <span className="np-pill np-fa" style={{ color: '#7A4A0B', background: '#FBEFD9' }}>
            {toPersianDigits(verses.length)} بیت · {toPersianDigits(memorizedCount)} حفظ‌شده
          </span>
        </div>
        <p className="np-small np-fa" style={{ margin: 0 }}>
          هر روز یک بیت در صفحه‌ی Today می‌آید و این‌جا با تاریخش ثبت می‌شود. بیت‌ها با مرور فاصله‌دار در صف Today برمی‌گردند تا
          وقتی «حفظ شد» را بزنید.
        </p>
        <div className="vs-actions">
          <button
            type="button"
            className={practice ? 'vs-chip on' : 'vs-chip'}
            onClick={() => {
              setPractice((p) => !p)
              setRevealed(new Set())
            }}
          >
            {practice ? 'حالت تمرین: روشن' : 'حالت تمرین (پنهان کردن مصراع دوم)'}
          </button>
          <Link to="/today" className="vs-chip">
            بازگشت به Today
          </Link>
        </div>
        {poets.length > 1 && (
          <div className="vs-chips">
            <button type="button" className={poetFilter === null ? 'vs-chip on' : 'vs-chip'} onClick={() => setPoetFilter(null)}>
              همه
            </button>
            {poets.map((p) => (
              <button key={p} type="button" className={poetFilter === p ? 'vs-chip on' : 'vs-chip'} onClick={() => setPoetFilter(p)}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      {shown.length === 0 ? (
        <div className="np-card np-fade">
          <EmptyState>هنوز بیتی ثبت نشده — صفحه‌ی Today را باز کنید تا بیت امروز ذخیره شود.</EmptyState>
        </div>
      ) : (
        <div className="vs-list">
          {shown.map((v) => {
            const hidden = practice && !revealed.has(v.id)
            return (
              <div key={v.id} className="np-card vs-item">
                <div className="np-head">
                  <span className="np-small np-fa">{shamsiWeekdayLabel(v.shownOn)}</span>
                  <span className="vs-poet np-fa">{v.poet}</span>
                </div>
                <div className="vs-beyt">
                  <p className="vs-mesra">{v.line1}</p>
                  <p
                    className={hidden ? 'vs-mesra vs-mesra-2 vs-hidden' : 'vs-mesra vs-mesra-2'}
                    onClick={hidden ? () => reveal(v.id) : undefined}
                    title={hidden ? 'برای دیدن، لمس کنید' : undefined}
                  >
                    {v.line2}
                  </p>
                </div>
                <div className="np-head">
                  <span className="np-small np-fa">{v.source ?? ''}</span>
                  <button type="button" className={v.memorized ? 'vs-chip on' : 'vs-chip'} onClick={() => void toggleMemorized(v)}>
                    {v.memorized ? '✓ حفظ شد' : 'حفظ شد؟'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
