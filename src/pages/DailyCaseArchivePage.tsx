import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listCaseAttempts, listDailyCases, requestCase } from '../lib/api/dailyCases'
import { bestScores, caseStreak, CATEGORY_LABEL, DIFFICULTY_LABEL, statsByCategory, tehranToday } from '../lib/dailyCase'
import { shamsiWeekdayLabel } from '../lib/dailyVerse'
import { toPersianDigits } from '../lib/shamsi'
import { describeError } from '../lib/debugError'
import { DifficultyPill } from '../components/dailyCase/CaseParts'
import { EmptyState } from '../components/illustrations/EmptyState'
import type { CaseAttempt, CaseDifficulty, DailyCase } from '../types/dailyCase'

type Row = DailyCase & { finalDiagnosis?: string | null }
type ScoreFilter = 'all' | 'unsolved' | 'lt70' | 'ge70'

const GREG = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Archive of every Daily Case: Shamsi + Gregorian date and weekday, filters
// (topic / difficulty / score), search, «حل دوباره», and per-topic stats.
export function DailyCaseArchivePage() {
  const navigate = useNavigate()
  const [cases, setCases] = useState<Row[]>([])
  const [attempts, setAttempts] = useState<CaseAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cat, setCat] = useState<string | null>(null)
  const [diff, setDiff] = useState<CaseDifficulty | null>(null)
  const [scoreF, setScoreF] = useState<ScoreFilter>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([listDailyCases(), listCaseAttempts()])
      .then(([c, a]) => {
        setCases(c)
        setAttempts(a)
      })
      .catch((e) => setError(describeError(e)))
      .finally(() => setLoading(false))
  }, [])

  const best = useMemo(() => bestScores(attempts), [attempts])
  const inProgress = useMemo(() => new Set(attempts.filter((a) => !a.completedAt).map((a) => a.caseId)), [attempts])
  const stats = useMemo(() => statsByCategory(cases, attempts), [cases, attempts])
  const categories = useMemo(() => [...new Set(cases.map((c) => c.topicCategory).filter(Boolean))] as string[], [cases])
  const streak = useMemo(() => {
    const dateById = new Map(cases.filter((c) => c.kind === 'daily').map((c) => [c.id, c.caseDate]))
    return caseStreak(attempts.filter((a) => a.completedAt && dateById.has(a.caseId)).map((a) => dateById.get(a.caseId)!), tehranToday())
  }, [cases, attempts])
  const solved = [...best.values()]
  const overallAvg = solved.length ? Math.round(solved.reduce((a, b) => a + b, 0) / solved.length) : null

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return cases.filter((c) => {
      if (cat && c.topicCategory !== cat) return false
      if (diff && c.difficulty !== diff) return false
      const s = best.get(c.id)
      if (scoreF === 'unsolved' && s != null) return false
      if (scoreF === 'lt70' && !(s != null && s < 70)) return false
      if (scoreF === 'ge70' && !(s != null && s >= 70)) return false
      if (needle) {
        // the diagnosis is searchable only once the case has been solved
        const hay = [c.title, c.topicName, s != null ? c.finalDiagnosis : ''].join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [cases, cat, diff, scoreF, q, best])

  async function newCase() {
    setBusy(true)
    try {
      const { caseId } = await requestCase('manual')
      navigate(`/daily-case/${caseId}`)
    } catch (e) {
      setError(describeError(e))
      setBusy(false)
    }
  }

  if (loading) return <p className="np-page">Loading…</p>

  return (
    <div className="np-page dc-page" dir="rtl">
      <div className="np-card np-fade np-fa">
        <div className="np-head">
          <div className="np-head-l">
            <span className="np-ic" aria-hidden="true">
              ⚕
            </span>
            <h2>آرشیو کیس‌های روز</h2>
          </div>
          <button type="button" className="np-btn sm" onClick={() => void newCase()} disabled={busy}>
            {busy ? '…' : '+ کیس جدید'}
          </button>
        </div>
        <div className="dc-kpis">
          <div>
            <b>{toPersianDigits(cases.filter((c) => c.status === 'ready').length)}</b>
            <span>کیس</span>
          </div>
          <div>
            <b>{toPersianDigits(best.size)}</b>
            <span>حل‌شده</span>
          </div>
          <div>
            <b>{overallAvg == null ? '—' : toPersianDigits(overallAvg)}</b>
            <span>میانگین نمره</span>
          </div>
          <div>
            <b>{toPersianDigits(streak)}</b>
            <span>روز پیاپی</span>
          </div>
        </div>
      </div>

      {stats.length > 0 && (
        <div className="np-card np-fa">
          <h2>نمره در هر مبحث (اولین تلاش)</h2>
          <div className="dc-stats">
            {stats.map((s, i) => (
              <div key={s.key} className="dc-stat-row">
                <span dir="ltr">{s.label}</span>
                <div className="dc-bar" aria-hidden="true">
                  <i style={{ width: `${s.avg}%`, background: s.avg >= 85 ? '#0f8b5f' : s.avg >= 70 ? '#1e5bd8' : s.avg >= 50 ? '#c27a0e' : '#c0392b' }} />
                </div>
                <b>{toPersianDigits(s.avg)}</b>
                <span className="np-small">({toPersianDigits(s.cases)})</span>
                {i === 0 && s.avg < 70 && <span className="dc-weak">نقطهٔ ضعف</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="np-card np-fa dc-filters">
        <div className="np-field">
          <input dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در عنوان، مبحث، تشخیص (کیس‌های حل‌شده)…" />
        </div>
        <div className="np-chips">
          <button type="button" className={`np-chip ${cat == null ? 'on' : ''}`} onClick={() => setCat(null)}>
            همهٔ مباحث
          </button>
          {categories.map((k) => (
            <button key={k} type="button" className={`np-chip ${cat === k ? 'on' : ''}`} onClick={() => setCat(cat === k ? null : k)}>
              {CATEGORY_LABEL[k] ?? k}
            </button>
          ))}
        </div>
        <div className="np-chips">
          {(['moderate', 'hard', 'board-killer'] as CaseDifficulty[]).map((d) => (
            <button key={d} type="button" className={`np-chip ${diff === d ? 'on' : ''}`} onClick={() => setDiff(diff === d ? null : d)}>
              {DIFFICULTY_LABEL[d]}
            </button>
          ))}
          {(
            [
              ['all', 'همه'],
              ['unsolved', 'حل‌نشده'],
              ['lt70', 'نمره < ۷۰'],
              ['ge70', 'نمره ≥ ۷۰'],
            ] as [ScoreFilter, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" className={`np-chip ${scoreF === k ? 'on' : ''}`} onClick={() => setScoreF(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      {shown.length === 0 ? (
        <div className="np-card">
          <EmptyState>{cases.length ? 'کیسی با این فیلترها نیست.' : 'هنوز کیسی ساخته نشده.'}</EmptyState>
        </div>
      ) : (
        <ul className="dc-archive">
          {shown.map((c) => {
            const s = best.get(c.id)
            const [y, m, d] = c.caseDate.split('-').map(Number)
            return (
              <li key={c.id} className="np-card dc-arch-item">
                <div className="dc-arch-date np-fa">
                  <b>{shamsiWeekdayLabel(c.caseDate)}</b>
                  <span dir="ltr">{GREG.format(new Date(Date.UTC(y, m - 1, d)))}</span>
                  {c.kind === 'manual' && <span className="dc-chip">اضافه</span>}
                </div>
                <Link to={`/daily-case/${c.id}`} className="dc-arch-main">
                  <b className="np-fa" dir="auto">
                    {c.status === 'ready' ? c.title : c.status === 'generating' ? 'در حال ساخت…' : 'ساخت ناموفق'}
                  </b>
                  <div className="dc-meta np-fa">
                    <span className="dc-chip">{CATEGORY_LABEL[c.topicCategory ?? ''] ?? c.topicCategory}</span>
                    <DifficultyPill d={c.difficulty} />
                    {s != null && (
                      <span className="dc-chip" dir="ltr">
                        {c.topicName}
                      </span>
                    )}
                    {s != null && c.finalDiagnosis && (
                      <span className="dc-chip dc-dx" dir="auto">
                        {c.finalDiagnosis}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="dc-arch-score np-fa">
                  {s != null ? (
                    <b className={s >= 70 ? 'ok' : 'low'}>{toPersianDigits(s)}</b>
                  ) : inProgress.has(c.id) ? (
                    <span className="np-small">در حال حل</span>
                  ) : (
                    <span className="np-small">—</span>
                  )}
                  {s != null && c.status === 'ready' && (
                    <Link to={`/daily-case/${c.id}?again=1`} className="dc-link">
                      حل دوباره
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
