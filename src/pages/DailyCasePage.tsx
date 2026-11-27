import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  askCase,
  deleteCaseImage,
  getDailyCase,
  gradeStage,
  listCaseAttempts,
  listCaseImages,
  saveAttempt,
  startAttempt,
  uploadCaseImage,
  waitForCase,
  type CaseImage,
} from '../lib/api/dailyCases'
import { addReadingItemFromQuestion, updateReadingItemSrs } from '../lib/api/readingItems'
import { getImagingSignedUrl } from '../lib/storage'
import { caseScore, CATEGORY_LABEL, REVIEW_THRESHOLD, stagePoints, addDaysIso, tehranToday } from '../lib/dailyCase'
import { describeError } from '../lib/debugError'
import { rootTopicForCategories } from '../lib/api/topicHub'
import { CASE_CATEGORY_TO_HUB } from '../lib/topicHub'
import { shamsiWeekdayLabel } from '../lib/dailyVerse'
import { toPersianDigits } from '../lib/shamsi'
import { CaseFigure, CaseText, DifficultyPill, LabTable, ScoreRing, SourceCard } from '../components/dailyCase/CaseParts'
import type { CaseAttempt, CaseStage, DailyCase, StageResponse } from '../types/dailyCase'

const stripCites = (s: string) => s.replace(/\s*\[S\d+(?:\s*[,،]\s*S\d+)*\]/g, '')

const STAGE_FA: Record<string, string> = {
  presentation: 'شرح حال',
  exam: 'معاینه',
  labs: 'آزمایش‌های اولیه',
  imaging: 'تصویربرداری',
  workup: 'بررسی تکمیلی / پاتولوژی',
  diagnosis: 'تشخیص',
  management: 'درمان',
}

export function DailyCasePage() {
  const { id } = useParams<{ id: string }>()
  const [params, setParams] = useSearchParams()
  const [c, setC] = useState<DailyCase | null>(null)
  const [attempt, setAttempt] = useState<CaseAttempt | null>(null)
  const [pastBest, setPastBest] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Highest stage index the user has opened; an answered stage's successor
  // stays locked until «باز کردن مرحلهٔ بعد» so the feedback can be read first.
  const [opened, setOpened] = useState(0)
  const lastTick = useRef(Date.now())

  // ---- load (and wait while the server is still writing the case)
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        let row = await getDailyCase(id)
        if (!row) throw new Error('کیس پیدا نشد')
        if (cancelled) return
        setC(row)
        if (row.status === 'generating') row = await waitForCase(id, (x) => !cancelled && setC(x))
        if (cancelled) return
        setC(row)
        const attempts = await listCaseAttempts(id)
        if (cancelled) return
        const done = attempts.filter((a) => a.completedAt && a.score != null)
        setPastBest(done.length ? Math.max(...done.map((a) => a.score as number)) : null)
        const open = [...attempts].reverse().find((a) => !a.completedAt)
        const latest = open ?? (params.get('again') ? null : attempts[attempts.length - 1] ?? null)
        setAttempt(latest)
        if (latest) setOpened(Math.min(latest.stageIndex, 6))
      } catch (e) {
        if (!cancelled) setError(describeError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const cj = c?.caseJson ?? null
  const stages = cj?.stages ?? []
  const answered = attempt?.stageResponses.length ?? 0
  const complete = !!attempt?.completedAt

  function elapsed(): number {
    const now = Date.now()
    const d = Math.round((now - lastTick.current) / 1000)
    lastTick.current = now
    return Math.min(d, 30 * 60) // ignore idle gaps longer than 30 min
  }

  async function begin() {
    if (!c) return
    try {
      const a = await startAttempt(c.id)
      lastTick.current = Date.now()
      setAttempt(a)
      setOpened(0)
      if (params.get('again')) setParams({}, { replace: true })
    } catch (e) {
      setError(describeError(e))
    }
  }

  async function record(resp: StageResponse) {
    if (!attempt || !c || !cj) return
    const responses = [...attempt.stageResponses, resp]
    const finished = responses.length >= stages.length
    const timeSpent = attempt.timeSpent + elapsed()
    const patch: Parameters<typeof saveAttempt>[1] = {
      stageResponses: responses,
      stageIndex: responses.length,
      hintsUsed: attempt.hintsUsed + resp.hints,
      timeSpent,
    }
    if (finished) {
      patch.score = caseScore(responses, stages.length)
      patch.completedAt = new Date().toISOString()
    }
    let saved = await saveAttempt(attempt.id, patch)
    // Scores under 70 go into the Leitner review queue (Today → «Saved questions due»), first review tomorrow.
    if (finished && (saved.score ?? 0) < REVIEW_THRESHOLD && !saved.reviewItemId) {
      try {
        const item = await addReadingItemFromQuestion({
          title: `کیس روز (${c.topicName ?? ''}): ${cj.title} — تشخیص و درمان؟`,
          answer: `${cj.final_diagnosis}\n\n${cj.learning_points.map((p) => `• ${p.replace(/\[S\d+(?:\s*[,،]\s*S\d+)*\]/g, '')}`).join('\n')}`,
          origin: 'Daily Case',
        })
        const today = tehranToday()
        await updateReadingItemSrs(item.id, { intervalIndex: -1, lastReviewed: null, nextReview: addDaysIso(today, 1), reviewHistory: [] })
        saved = await saveAttempt(saved.id, { reviewItemId: item.id })
      } catch (e) {
        setError(`نتیجه ذخیره شد ولی افزودن به صف مرور نشد — ${describeError(e)}`)
      }
    }
    setAttempt(saved)
  }

  if (loading && !c) return <p className="np-page">Loading…</p>
  if (error && !c) return <p className="np-page form-error">{error}</p>
  if (!c) return null

  if (c.status === 'generating') {
    return (
      <div className="np-page" dir="rtl">
        <div className="np-card dc-wait np-fa">
          <div className="dc-spinner" aria-hidden="true" />
          <h2>در حال ساخت کیس از منابع کتابخانه…</h2>
          <p className="np-small">بازیابی فصل‌ها و گایدلاین‌ها، نوشتن مراحل، و بازبینی سازگاری (self-check). معمولاً ۱ تا ۴ دقیقه.</p>
        </div>
      </div>
    )
  }
  if (c.status === 'failed' || !cj) {
    return (
      <div className="np-page" dir="rtl">
        <div className="np-card np-fa">
          <h2>ساخت این کیس ناموفق بود</h2>
          <p className="form-error" dir="auto">{c.error}</p>
          <Link to="/daily-case" className="td-outline">
            بازگشت به آرشیو
          </Link>
        </div>
      </div>
    )
  }

  const revealed = attempt ? Math.min(stages.length, complete ? stages.length : Math.max(opened + 1, answered)) : 0
  const score = attempt?.score ?? null

  return (
    <div className="np-page dc-page" dir="rtl">
      <header className="np-card dc-header np-fade">
        <div className="np-head">
          <div className="np-head-l">
            <span className="np-ic" aria-hidden="true">
              ⚕
            </span>
            <div>
              <span className="np-small np-fa">
                {c.kind === 'daily' ? 'کیس روز' : 'کیس اضافه'} · {shamsiWeekdayLabel(c.caseDate)} · <span dir="ltr">{c.caseDate}</span>
              </span>
              <h1 className="dc-title np-fa" dir="auto">
                {cj.title}
              </h1>
            </div>
          </div>
          <DifficultyPill d={c.difficulty} />
        </div>
        <div className="dc-meta np-fa">
          <span className="dc-chip">{CATEGORY_LABEL[c.topicCategory ?? ''] ?? c.topicCategory}</span>
          {complete || pastBest != null ? <span className="dc-chip" dir="ltr">{c.topicName}</span> : null}
          <span className="dc-chip" dir="ltr">
            {cj.patient.age} · {cj.patient.sex === 'female' ? '♀' : '♂'} · {cj.patient.weight_kg} kg · {cj.patient.height_cm} cm
          </span>
          {pastBest != null && <span className="dc-chip">بهترین نمره: {toPersianDigits(pastBest)}</span>}
        </div>
        {/* progress */}
        <ol className="dc-progress" aria-label="مراحل">
          {stages.map((s, i) => {
            const r = attempt?.stageResponses[i]
            const cls = r ? (r.skipped ? 'skip' : stagePoints(r) >= 0.7 ? 'good' : stagePoints(r) >= 0.4 ? 'mid' : 'bad') : i < revealed ? 'now' : ''
            return <li key={s.key} className={cls} title={STAGE_FA[s.key]} />
          })}
        </ol>
      </header>

      {error && <p className="form-error">{error}</p>}

      {!attempt && (
        <div className="np-card np-fa dc-intro">
          <p>
            کیس در {toPersianDigits(stages.length)} مرحله باز می‌شود. در هر مرحله قبل از باز شدن مرحلهٔ بعد جواب بده؛ بعد فیدبک، پاسخ کامل با منبع و
            یک Board pearl می‌بینی. Hint {toPersianDigits(25)}٪ از امتیاز همان مرحله کم می‌کند؛ Skip یعنی صفر برای آن مرحله.
          </p>
          <button type="button" className="np-btn" onClick={() => void begin()}>
            {pastBest != null ? 'حل دوباره' : 'شروع کیس'}
          </button>
        </div>
      )}

      {attempt && (
        <div className="dc-timeline">
          {stages.map((s, i) => {
            if (i >= revealed) {
              return (
                <div key={s.key} className="dc-stage locked np-fa">
                  <span className="dc-dot" aria-hidden="true">
                    🔒
                  </span>
                  <span>
                    مرحلهٔ {toPersianDigits(i + 1)} — {STAGE_FA[s.key]}
                  </span>
                </div>
              )
            }
            const resp = attempt.stageResponses[i] ?? null
            return (
              <StageCard
                key={`${attempt.id}-${s.key}`}
                index={i}
                stage={s}
                c={c}
                response={resp}
                isCurrent={!resp && !complete}
                isLast={i === stages.length - 1}
                nextLocked={!!resp && i + 1 < stages.length && i + 1 >= revealed}
                onOpenNext={() => setOpened(i + 1)}
                onSubmit={record}
              />
            )
          })}
        </div>
      )}

      {complete && score != null && (
        <FinalPanel
          c={c}
          score={score}
          attempt={attempt!}
          onAgain={() => {
            setPastBest((b) => Math.max(b ?? 0, score))
            void begin()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      {attempt && !complete && (
        <CaseChat caseId={c.id} revealedThrough={revealed - 1} answeredThrough={answered - 1} />
      )}

      <CaseImages caseId={c.id} stages={stages} />

      <Link to="/daily-case" className="td-outline np-fa">
        آرشیو کیس‌ها
      </Link>
    </div>
  )
}

// ------------------------------------------------------------------ one stage
function StageCard({
  index,
  stage,
  c,
  response,
  isCurrent,
  isLast,
  nextLocked,
  onOpenNext,
  onSubmit,
}: {
  index: number
  stage: CaseStage
  c: DailyCase
  response: StageResponse | null
  isCurrent: boolean
  isLast: boolean
  nextLocked: boolean
  onOpenNext: () => void
  onSubmit: (r: StageResponse) => Promise<void>
}) {
  const q = stage.question
  const [answer, setAnswer] = useState('')
  const [choice, setChoice] = useState<number | null>(null)
  const [hints, setHints] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showModel, setShowModel] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isCurrent && index > 0) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isCurrent, index])

  async function submit(skip: boolean) {
    setBusy(true)
    setErr(null)
    try {
      const fb = skip ? null : await gradeStage(c.id, index, answer, q.type === 'mcq' ? choice : null)
      await onSubmit({
        stage: stage.key,
        answer: q.type === 'mcq' ? (choice != null ? q.options[choice] : '') : answer,
        choice: q.type === 'mcq' ? choice : null,
        skipped: skip,
        hints,
        feedback: fb,
        answeredAt: new Date().toISOString(),
      })
    } catch (e) {
      setErr(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const figures = stage.figure_ids.map((f) => c.sources[f]).filter(Boolean)
  const canSubmit = q.type === 'mcq' ? choice != null : answer.trim().length > 0
  const hintsShown = response ? response.hints : hints

  return (
    <section className={`dc-stage np-card np-fade ${isCurrent ? 'current' : ''}`} ref={ref}>
      <div className="np-head">
        <div className="np-head-l">
          <span className="dc-num">{toPersianDigits(index + 1)}</span>
          <h2 className="np-fa">{STAGE_FA[stage.key]}</h2>
        </div>
        {response && (
          <span className="np-pill np-fa" style={response.skipped ? { color: '#52627a', background: '#eef2f8' } : { color: '#1e5bd8', background: '#e3edfd' }}>
            {response.skipped ? 'Skip' : `${toPersianDigits(Math.round(stagePoints(response) * 10 * 10) / 10)} / ۱۰`}
          </span>
        )}
      </div>

      <CaseText text={stage.content} sources={c.sources} />
      {stage.labs.length > 0 && <LabTable labs={stage.labs} />}
      {figures.length > 0 && (
        <div className="dc-figs">
          {figures.map((f) => (
            <CaseFigure key={f.id} s={f} />
          ))}
        </div>
      )}

      {/* question */}
      <div className="dc-q np-fa">
        <div className="dc-q-label">سؤال</div>
        <CaseText text={q.prompt} sources={c.sources} />
        {q.type === 'mcq' && (
          <div className="dc-options" role="radiogroup">
            {q.options.map((o, oi) => {
              const picked = response ? response.choice === oi : choice === oi
              const state = response ? (oi === q.correct_option ? 'right' : picked ? 'wrong' : '') : picked ? 'picked' : ''
              return (
                <button
                  key={oi}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  className={`dc-opt ${state}`}
                  disabled={!!response || busy}
                  onClick={() => setChoice(oi)}
                  dir="auto"
                >
                  <span className="dc-opt-l">{String.fromCharCode(65 + oi)}</span> {o}
                </button>
              )
            })}
          </div>
        )}
        {q.type === 'free' && !response && (
          <div className="np-field">
            <textarea
              rows={4}
              dir="auto"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="پاسخ خودت را بنویس (DDx، آزمایش بعدی، تفسیر…) — فارسی یا انگلیسی"
              disabled={busy}
            />
          </div>
        )}
        {q.type === 'free' && response && !response.skipped && <blockquote className="dc-your" dir="auto">{response.answer}</blockquote>}

        {hintsShown > 0 && (
          <ul className="dc-hints">
            {q.hints.slice(0, hintsShown).map((h, hi) => (
              <li key={hi} dir="auto">
                💡 {h}
              </li>
            ))}
          </ul>
        )}

        {isCurrent && (
          <div className="dc-actions">
            <button type="button" className="np-btn" disabled={!canSubmit || busy} onClick={() => void submit(false)}>
              {busy ? 'در حال تصحیح…' : 'ثبت پاسخ'}
            </button>
            {hints < q.hints.length && (
              <button type="button" className="np-btn ghost sm" disabled={busy} onClick={() => setHints((h) => h + 1)}>
                Hint ({toPersianDigits(hints + 1)}/{toPersianDigits(q.hints.length)}) · −۲۵٪
              </button>
            )}
            <button type="button" className="np-btn ghost sm" disabled={busy} onClick={() => void submit(true)}>
              Skip
            </button>
          </div>
        )}
        {err && <p className="form-error">{err}</p>}
      </div>

      {/* feedback */}
      {response && (
        <div className="dc-fb np-fa">
          {response.feedback && (
            <>
              {response.feedback.comment && <p dir="auto">{response.feedback.comment}</p>}
              {response.feedback.correct.length > 0 && (
                <div className="dc-fb-ok">
                  <b>✓ نکات درست</b>
                  <ul>
                    {response.feedback.correct.map((x, k) => (
                      <li key={k} dir="auto">
                        {stripCites(x)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {response.feedback.missed.length > 0 && (
                <div className="dc-fb-miss">
                  <b>✗ نکات جاافتاده</b>
                  <ul>
                    {response.feedback.missed.map((x, k) => (
                      <li key={k} dir="auto">
                        {stripCites(x)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {response.feedback.gradedBy === 'fallback' && <p className="np-small">تصحیح با کلیدواژه انجام شد (AI در دسترس نبود).</p>}
            </>
          )}
          <button type="button" className="dc-toggle" onClick={() => setShowModel((v) => !v)}>
            {showModel ? '▾' : '▸'} پاسخ کامل
          </button>
          {showModel && <CaseText text={q.model_answer} sources={c.sources} className="dc-model" />}
          <div className="dc-pearl">
            <b>Board pearl</b>
            <CaseText text={stage.pearl} sources={c.sources} />
          </div>
          {nextLocked && !isLast && (
            <button type="button" className="np-btn" onClick={onOpenNext}>
              باز کردن مرحلهٔ بعد ←
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ end of case
function FinalPanel({ c, score, attempt, onAgain }: { c: DailyCase; score: number; attempt: CaseAttempt; onAgain: () => void }) {
  const cj = c.caseJson!
  const ids = Object.keys(c.sources)
    .filter((k) => k.startsWith('S'))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  const major = c.selfCheck?.issues.filter((i) => i.severity === 'major') ?? []
  return (
    <section className="np-card dc-final np-fade np-fa">
      <div className="dc-final-top">
        <ScoreRing score={score} />
        <div>
          <span className="np-small">تشخیص نهایی</span>
          <h2 dir="auto">{cj.final_diagnosis}</h2>
          <span className="np-small">
            Hint: {toPersianDigits(attempt.hintsUsed)} · زمان: {toPersianDigits(Math.max(1, Math.round(attempt.timeSpent / 60)))} دقیقه
            {attempt.reviewItemId ? ' · به صف مرور اضافه شد' : ''}
          </span>
        </div>
      </div>

      <h3>خلاصهٔ کیس</h3>
      <CaseText text={cj.summary} sources={c.sources} />

      <h3>Key learning points</h3>
      <CaseText text={cj.learning_points.map((p) => `- ${p}`).join('\n')} sources={c.sources} />

      {cj.mnemonic?.text && (
        <div className="dc-mnemonic">
          <b>رمز (mnemonic):</b> <span dir="auto">{cj.mnemonic.text}</span>
          <CaseText text={cj.mnemonic.explanation} sources={c.sources} dir="auto" />
        </div>
      )}

      {cj.doses.length > 0 && (
        <>
          <h3>دوز داروها برای این بیمار</h3>
          <div className="as-table" dir="ltr">
            <table className="dc-dose-table">
              <thead>
                <tr>
                  <th>Drug</th>
                  <th>Source dose</th>
                  <th>This patient</th>
                  <th>Max / renal</th>
                </tr>
              </thead>
              <tbody>
                {cj.doses.map((d, i) => (
                  <tr key={i}>
                    <td>
                      <b>{d.drug}</b>
                      <div className="np-small">{d.indication}</div>
                    </td>
                    <td dir="auto">
                      {d.source_dose} <span className="np-small">[{d.source_ids.join(', ')}]</span>
                    </td>
                    <td dir="auto">{d.calculation}</td>
                    <td dir="auto">
                      {d.max_dose}
                      {d.renal_adjustment && <div className="np-small">{d.renal_adjustment}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {cj.not_found.length > 0 && (
        <div className="dc-nf">
          <b>در منابع Nephron یافت نشد:</b>
          <ul>
            {cj.not_found.map((x, i) => (
              <li key={i} dir="auto">
                {x}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(major.length > 0 || c.selfCheck?.skipped) && (
        <details className="dc-selfcheck">
          <summary>یادداشت‌های بازبینی خودکار (self-check)</summary>
          {c.selfCheck?.skipped && <p className="np-small">{c.selfCheck.skipped}</p>}
          <ul>
            {major.map((i, k) => (
              <li key={k} dir="auto">
                <b>{i.location}</b>: {i.problem} → {i.fix}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="dc-sources">
        <summary>منابع ({toPersianDigits(ids.length)})</summary>
        {ids.map((k) => (
          <SourceCard key={k} s={c.sources[k]} />
        ))}
      </details>

      <TopicHubLink caseCategory={c.topicCategory} />

      <div className="dc-actions">
        <button type="button" className="np-btn ghost" onClick={onAgain}>
          حل دوباره
        </button>
        <Link to="/daily-case" className="np-btn">
          آرشیو
        </Link>
      </div>
    </section>
  )
}

/** «مرور این مبحث در Topic Hub» — the root topic of the matching Academy category. */
function TopicHubLink({ caseCategory }: { caseCategory: string | null }) {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    const hubs = caseCategory ? CASE_CATEGORY_TO_HUB[caseCategory] ?? [] : []
    rootTopicForCategories(hubs)
      .then(setTarget)
      .catch(() => setTarget(null))
  }, [caseCategory])
  if (!target) return null
  return (
    <Link to={`/academy/${target.id}`} className="dc-hublink">
      📚 مرور این مبحث در Topic Hub — <span dir="auto">{target.name}</span>
    </Link>
  )
}

// ------------------------------------------------------------------ chat with the case
function CaseChat({ caseId, revealedThrough, answeredThrough }: { caseId: string; revealedThrough: number; answeredThrough: number }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msgs, setMsgs] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
  async function send() {
    const question = q.trim()
    if (!question) return
    setBusy(true)
    setQ('')
    const history = [...msgs, { role: 'user' as const, text: question }]
    setMsgs(history)
    try {
      const { answer } = await askCase(caseId, revealedThrough, answeredThrough, question, msgs)
      setMsgs([...history, { role: 'assistant', text: answer }])
    } catch (e) {
      setMsgs([...history, { role: 'assistant', text: `⚠️ ${describeError(e)}` }])
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="np-card dc-chat np-fa">
      <button type="button" className="dc-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} سؤال از کیس (مثلاً «C3 چند بود؟»)
      </button>
      {open && (
        <>
          <p className="np-small">فقط از داده‌های مراحلی که باز شده جواب می‌دهد و چیزی را زودتر لو نمی‌دهد.</p>
          <div className="dc-chat-log">
            {msgs.map((m, i) => (
              <p key={i} className={m.role === 'user' ? 'me' : 'att'} dir="auto">
                {m.text}
              </p>
            ))}
          </div>
          <form
            className="dc-chat-form"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <input dir="auto" value={q} onChange={(e) => setQ(e.target.value)} placeholder="سؤالت را بپرس…" disabled={busy} />
            <button type="submit" className="np-btn sm" disabled={busy || !q.trim()}>
              {busy ? '…' : 'بپرس'}
            </button>
          </form>
        </>
      )}
    </section>
  )
}

// ------------------------------------------------------------------ user-uploaded real images
function CaseImages({ caseId, stages }: { caseId: string; stages: CaseStage[] }) {
  const [images, setImages] = useState<CaseImage[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const [stageKey, setStageKey] = useState<string>('imaging')
  const [caption, setCaption] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listCaseImages(caseId)
      .then(setImages)
      .catch(() => undefined)
  }, [caseId])
  useEffect(() => {
    for (const img of images) {
      if (urls[img.id]) continue
      getImagingSignedUrl(img.storagePath)
        .then((u) => setUrls((p) => ({ ...p, [img.id]: u })))
        .catch(() => undefined)
    }
  }, [images, urls])

  async function upload() {
    const file = fileRef.current?.files?.[0]
    if (!file || !confirmed) return
    setBusy(true)
    setErr(null)
    try {
      const img = await uploadCaseImage(caseId, stageKey, file, caption)
      setImages((p) => [...p, img])
      setCaption('')
      setConfirmed(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      setErr(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const byStage = useMemo(() => Object.fromEntries(stages.map((s) => [s.key, STAGE_FA[s.key]])), [stages])

  return (
    <section className="np-card np-fa dc-images">
      <button type="button" className="dc-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} تصاویر واقعی ({toPersianDigits(images.length)})
      </button>
      {open && (
        <>
          <p className="np-small">
            تصاویر این اپ هرگز با هوش مصنوعی ساخته نمی‌شوند. اگر تصویر واقعی مشابه (سونوگرافی، بیوپسی…) داری، اینجا آپلود کن — فقط در فضای خصوصی خودت
            ذخیره می‌شود.
          </p>
          {images.length > 0 && (
            <div className="dc-figs">
              {images.map((img) => (
                <figure key={img.id} className="dc-fig">
                  {urls[img.id] ? <img src={urls[img.id]} alt={img.caption ?? ''} loading="lazy" /> : <div className="dc-fig-ph">…</div>}
                  <figcaption dir="auto">
                    {img.stageKey ? `${byStage[img.stageKey] ?? img.stageKey} — ` : ''}
                    {img.caption}
                    <button
                      type="button"
                      className="dc-x"
                      aria-label="حذف"
                      onClick={() => void deleteCaseImage(img).then(() => setImages((p) => p.filter((x) => x.id !== img.id)))}
                    >
                      ×
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <div className="dc-upload">
            <div className="np-f2">
              <div className="np-field">
                <label>مرحله</label>
                <select value={stageKey} onChange={(e) => setStageKey(e.target.value)}>
                  {stages.map((s) => (
                    <option key={s.key} value={s.key}>
                      {STAGE_FA[s.key]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="np-field">
                <label>توضیح</label>
                <input dir="auto" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="مثلاً US: bilateral nephrocalcinosis" />
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" />
            <label className="dc-warn">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>
                ⚠️ تأیید می‌کنم همهٔ اطلاعات هویتی بیمار (نام، شماره پرونده، تاریخ تولد، نام بیمارستان، چهره) از تصویر حذف شده است.
              </span>
            </label>
            <button type="button" className="np-btn sm" disabled={!confirmed || busy} onClick={() => void upload()}>
              {busy ? 'در حال آپلود…' : 'آپلود'}
            </button>
            {err && <p className="form-error">{err}</p>}
          </div>
        </>
      )}
    </section>
  )
}
