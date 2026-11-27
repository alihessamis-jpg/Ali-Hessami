import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCaseForDate, getDailyCase, listCaseAttempts, listDailyCases, requestCase, waitForCase } from '../../lib/api/dailyCases'
import { caseStatus, caseStreak, CATEGORY_LABEL, tehranToday } from '../../lib/dailyCase'
import { describeError } from '../../lib/debugError'
import { toPersianDigits } from '../../lib/shamsi'
import { DifficultyPill } from './CaseParts'
import type { CaseAttempt, DailyCase } from '../../types/dailyCase'

/**
 * Today → «کیس روز». Shows today's case (made by the 03:00 Tehran cron; if
 * it isn't there yet it is requested now), its status/score and the streak.
 * The title never names the diagnosis.
 */
export function DailyCaseCard() {
  const navigate = useNavigate()
  const today = tehranToday()
  const [c, setC] = useState<DailyCase | null>(null)
  const [attempts, setAttempts] = useState<CaseAttempt[]>([])
  const [streak, setStreak] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [all, allAttempts] = await Promise.all([listDailyCases(), listCaseAttempts()])
        if (cancelled) return
        const dailyById = new Map(all.filter((x) => x.kind === 'daily').map((x) => [x.id, x.caseDate]))
        setStreak(caseStreak(allAttempts.filter((a) => a.completedAt && dailyById.has(a.caseId)).map((a) => dailyById.get(a.caseId)!), today))
        let row = await getCaseForDate(today)
        if (!row || row.status === 'failed') {
          const { caseId } = await requestCase('daily')
          row = await getDailyCase(caseId)
        }
        if (cancelled) return
        setC(row)
        if (row) setAttempts(allAttempts.filter((a) => a.caseId === row!.id))
        // still generating → keep polling quietly
        if (row?.status === 'generating') {
          const done = await waitForCase(row.id, (x) => !cancelled && setC(x))
          if (!cancelled) setC(done)
        }
      } catch (e) {
        if (!cancelled) setError(describeError(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [today])

  async function newCase() {
    setBusy(true)
    setError(null)
    try {
      const { caseId } = await requestCase('manual')
      navigate(`/daily-case/${caseId}`)
    } catch (e) {
      setError(describeError(e))
      setBusy(false)
    }
  }

  const { status, score } = caseStatus(attempts)
  const statusLabel =
    c?.status === 'generating'
      ? 'در حال ساخت…'
      : c?.status === 'failed'
        ? 'ساخت ناموفق'
        : status === 'done'
          ? `تمام‌شده · نمره ${toPersianDigits(score ?? 0)}`
          : status === 'in-progress'
            ? 'در حال حل'
            : 'شروع‌نشده'

  return (
    <section className="np-card np-fade dc-today" style={{ animationDelay: '0.07s' }} dir="rtl">
      <div className="np-head">
        <div className="np-head-l">
          <span className="np-ic" aria-hidden="true">
            ⚕
          </span>
          <h2 className="np-fa">Daily Case Challenge · کیس روز</h2>
        </div>
        {streak > 0 && (
          <span className="np-pill np-fa" style={{ color: '#a3222f', background: '#fde4e6' }} title="روزهای متوالی">
            🔥 {toPersianDigits(streak)} روز
          </span>
        )}
      </div>

      {!c && !error && <p className="np-small np-fa">در حال آماده‌سازی کیس امروز…</p>}
      {c && (
        <Link to={`/daily-case/${c.id}`} className="dc-today-body">
          <b className="np-fa" dir="auto">
            {c.status === 'ready' ? c.title : 'کیس امروز از منابع کتابخانه ساخته می‌شود'}
          </b>
          <div className="dc-meta np-fa">
            <span className="dc-chip">{CATEGORY_LABEL[c.topicCategory ?? ''] ?? c.topicCategory ?? '—'}</span>
            <DifficultyPill d={c.difficulty} />
            <span className={`dc-chip dc-st-${c.status === 'ready' ? status : c.status}`}>{statusLabel}</span>
          </div>
        </Link>
      )}
      {error && <p className="form-error np-fa">{error}</p>}

      <div className="dc-today-actions np-fa">
        {c?.status === 'ready' && (
          <Link to={`/daily-case/${c.id}`} className="np-btn sm">
            {status === 'done' ? 'مرور کیس' : status === 'in-progress' ? 'ادامه' : 'شروع'}
          </Link>
        )}
        <Link to="/daily-case" className="np-btn ghost sm">
          آرشیو
        </Link>
        <button type="button" className="np-btn ghost sm" onClick={() => void newCase()} disabled={busy}>
          {busy ? '…' : '+ کیس جدید'}
        </button>
      </div>
    </section>
  )
}
