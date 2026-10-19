import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAllLibraryCards, listAllLibraryChapters } from '../lib/api/library'
import { getUserSettings } from '../lib/api/settings'
import {
  computeChapterCoverage,
  computeDueForecast,
  computeReviewActivityByDay,
  computeReviewStreak,
  computeStaleChapters,
  daysUntil,
} from '../lib/examPlan'
import { HeroScene } from '../components/hero/HeroScene'
import { useCountUp } from '../hooks/useCountUp'
import type { LibraryCard, LibraryChapter } from '../types/domain'

const HEATMAP_WEEKS = 12
const HEATMAP_DAYS = HEATMAP_WEEKS * 7

function heatColor(count: number): string {
  if (count === 0) return '#EEF2F8'
  if (count < 5) return '#BFDBFE'
  if (count < 15) return '#60A5FA'
  if (count < 30) return '#1E5BD8'
  return '#12357A'
}

export function ExamPlanPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cards, setCards] = useState<LibraryCard[]>([])
  const [chapters, setChapters] = useState<LibraryChapter[]>([])
  const [examDate, setExamDate] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listAllLibraryCards(), listAllLibraryChapters(), getUserSettings()])
      .then(([cardRows, chapterRows, settings]) => {
        setCards(cardRows)
        setChapters(chapterRows)
        setExamDate(settings.examDate)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load exam plan'))
      .finally(() => setLoading(false))
  }, [])

  const now = useMemo(() => new Date(), [])
  const coverage = useMemo(() => computeChapterCoverage(chapters, cards), [chapters, cards])
  const forecast = useMemo(() => computeDueForecast(cards, 30, now), [cards, now])
  const activity = useMemo(() => computeReviewActivityByDay(cards), [cards])
  const streak = useMemo(() => computeReviewStreak(activity, now), [activity, now])
  const staleChapters = useMemo(() => computeStaleChapters(chapters, cards, now, 21), [chapters, cards, now])
  const examDaysLeft = examDate ? daysUntil(examDate, now) : null

  const heatmapDays = useMemo(() => {
    const days: Array<{ date: string; count: number }> = []
    const cursor = new Date(now)
    cursor.setDate(cursor.getDate() - (HEATMAP_DAYS - 1))
    for (let i = 0; i < HEATMAP_DAYS; i++) {
      const key = cursor.toISOString().slice(0, 10)
      days.push({ date: key, count: activity.get(key) ?? 0 })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [activity, now])

  const maxForecast = Math.max(1, ...forecast.map((d) => d.count))
  const examDisplay = useCountUp(examDaysLeft != null && examDaysLeft >= 0 ? examDaysLeft : null)

  if (loading) return <p>Loading…</p>

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <HeroScene scene="dawn" page="exam-plan" className="hero-scene" />
        <div className="hero-scrim" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Exam Plan</h1>
            <p className="np-sub">
              {examDate
                ? `Board exam on ${examDate}`
                : 'Set your exam date in Settings to see a countdown here.'}
            </p>
          </div>
          {examDaysLeft != null && (
            <svg width="112" height="112" viewBox="0 0 112 112" fill="none" aria-hidden="true" style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
              <circle cx="56" cy="56" r="48" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
              <text x="56" y="58" textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800" fontFamily="Plus Jakarta Sans">
                {examDaysLeft < 0 ? 'Past' : Math.round(examDisplay ?? examDaysLeft)}
              </text>
              <text x="56" y="76" textAnchor="middle" fill="#A9C6FF" fontSize="10" fontFamily="Plus Jakarta Sans">
                {examDaysLeft < 0 ? 'exam date' : 'days left'}
              </text>
            </svg>
          )}
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="np-grid2">
        <section className="np-card np-fade" style={{ animationDelay: '.1s' }}>
          <h2>Coverage</h2>
          <div className="td-row">
            <span className="td-dot" style={{ background: '#1E5BD8' }} />
            <b>{coverage.chaptersWithItemsPct}% of chapters have cards</b>
            <span className="np-small">
              {coverage.chaptersWithItems} / {coverage.totalChapters}
            </span>
          </div>
          <div className="td-row">
            <span className="td-dot" style={{ background: '#17663A' }} />
            <b>{coverage.itemsReviewedPct}% of items reviewed at least once</b>
            <span className="np-small">
              {coverage.itemsReviewed} / {coverage.totalItems}
            </span>
          </div>
          <div className="td-row">
            <span className="td-dot" style={{ background: '#FFC46B' }} />
            <b>{streak} day review streak</b>
          </div>
        </section>

        <section className="np-card np-fade" style={{ animationDelay: '.16s' }}>
          <h2>Due reviews — next 30 days</h2>
          <svg
            width="100%"
            height="90"
            viewBox={`0 0 300 90`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Forecast: ${forecast.map((d) => `${d.date} ${d.count}`).join(', ')}`}
          >
            {forecast.map((d, i) => {
              const barWidth = 300 / forecast.length - 2
              const barHeight = Math.max(2, (d.count / maxForecast) * 70)
              return (
                <rect
                  key={d.date}
                  x={i * (300 / forecast.length)}
                  y={80 - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={1.5}
                  fill={i === 0 ? '#1546A8' : '#9DBFF2'}
                />
              )
            })}
          </svg>
          <span className="np-small">Today · {forecast[0]?.count ?? 0} due (includes overdue) — out to day 30</span>
        </section>
      </div>

      <section className="np-card np-fade" style={{ animationDelay: '.22s' }}>
        <h2>Review activity</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${HEATMAP_WEEKS}, 1fr)`,
            gridTemplateRows: 'repeat(7, 1fr)',
            gridAutoFlow: 'column',
            gap: 3,
            maxWidth: 320,
          }}
          role="img"
          aria-label={`Review activity for the last ${HEATMAP_DAYS} days`}
        >
          {heatmapDays.map((d) => (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} review${d.count === 1 ? '' : 's'}`}
              style={{ width: '100%', aspectRatio: '1', borderRadius: 3, background: heatColor(d.count) }}
            />
          ))}
        </div>
        <span className="np-small">Last {HEATMAP_WEEKS} weeks, darker = more reviews that day.</span>
      </section>

      <section className="np-card np-fade" style={{ animationDelay: '.28s', gap: 0 }}>
        <div className="np-head" style={{ paddingBottom: 8 }}>
          <h2>Going stale</h2>
          <span className="np-small">{staleChapters.length} chapters</span>
        </div>
        {staleChapters.length === 0 ? (
          <span className="np-small">Every studied chapter has been reviewed in the last 3 weeks.</span>
        ) : (
          staleChapters.map((s) => (
            <Link key={s.chapter.id} to={`/academy/reader/${s.chapter.id}`} className="td-row">
              <span className="td-dot" style={{ background: s.daysSinceReview === null ? '#5B6B82' : '#C2410C' }} />
              <b style={{ flex: 1 }}>
                Ch {s.chapter.chapterNumber} · {s.chapter.title}
              </b>
              <span className="np-small">
                {s.daysSinceReview === null ? 'never reviewed' : `${s.daysSinceReview} days since last review`}
              </span>
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
