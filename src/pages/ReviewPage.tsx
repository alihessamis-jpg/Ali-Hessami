import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ensureLibraryBookSeeded, listAllLibraryCards, listReadingLog, updateLibraryCardFsrs } from '../lib/api/library'
import { getUserSettings } from '../lib/api/settings'
import { computeReadingStreak } from '../lib/libraryNote'
import { fsrsPreviewAll, isCardMastered, scheduleFsrs, type FsrsPreviewMap } from '../lib/fsrs'
import { HeroScene } from '../components/hero/HeroScene'
import type { FsrsRating, LibraryCard, LibraryChapter, McqOptions, PatientCaseVignette } from '../types/domain'

function todayStorageKey() {
  const d = new Date()
  return `nephron-new-cards-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadIntroducedToday(): Set<string> {
  try {
    const raw = localStorage.getItem(todayStorageKey())
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveIntroducedToday(ids: Set<string>) {
  try {
    localStorage.setItem(todayStorageKey(), JSON.stringify([...ids]))
  } catch {
    // per-viewer convenience only -- fine if storage is unavailable
  }
}

const TYPE_LABEL: Record<LibraryCard['kind'], string> = {
  cloze: 'CLOZE',
  table_cell: 'TABLE',
  mcq: 'BOARD MCQ',
  patient_case: 'PATIENT CASE',
  basic: 'CARD',
}

const TYPE_STYLE: Record<LibraryCard['kind'], { stripe: string; color: string; background: string }> = {
  cloze: { stripe: '#7C5CE0', color: '#5131B5', background: '#ECE6FD' },
  table_cell: { stripe: '#0B6670', color: '#0B6670', background: '#DDF2F3' },
  mcq: { stripe: '#1E5BD8', color: '#1546A8', background: '#E3EDFD' },
  patient_case: { stripe: '#C2410C', color: '#9A3412', background: '#FDEBDD' },
  basic: { stripe: '#5B6B82', color: '#3B4A60', background: '#EEF2F8' },
}

function isMcqOptions(o: LibraryCard['options']): o is McqOptions {
  return !!o && 'choices' in o
}
function isVignette(o: LibraryCard['options']): o is PatientCaseVignette {
  return !!o && 'stats' in o
}

function clozeParts(front: string): [string, string] {
  const idx = front.indexOf('_____')
  if (idx < 0) return [front, '']
  return [front.slice(0, idx), front.slice(idx + 5)]
}

export function ReviewPage() {
  const [searchParams] = useSearchParams()
  const chapterScope = searchParams.get('chapter')

  const [allDue, setAllDue] = useState<LibraryCard[]>([])
  const [chapters, setChapters] = useState<LibraryChapter[]>([])
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hyOnly, setHyOnly] = useState(false)

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [mcqChoice, setMcqChoice] = useState<number | null>(null)
  const [grades, setGrades] = useState<Array<{ card: LibraryCard; rating: FsrsRating }>>([])
  const [startedAt] = useState(() => Date.now())

  useEffect(() => {
    setLoading(true)
    Promise.all([listAllLibraryCards(), ensureLibraryBookSeeded(), listReadingLog(), getUserSettings()])
      .then(([cardRows, seeded, log, settings]) => {
        const now = new Date()
        let approved = cardRows.filter((c) => c.status === 'approved')
        if (chapterScope) approved = approved.filter((c) => c.chapterId === chapterScope)

        const dueCards = approved.filter((c) => c.reps > 0 && new Date(c.due) <= now)
        dueCards.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())

        const introducedToday = loadIntroducedToday()
        const newPool = approved
          .filter((c) => c.reps === 0)
          .sort((a, b) => {
            if (a.highYield !== b.highYield) return a.highYield ? -1 : 1
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          })

        const alreadyIntroduced = newPool.filter((c) => introducedToday.has(c.id))
        const remainingSlots = Math.max(0, settings.dailyNewCardLimit - alreadyIntroduced.length)
        const freshNew = newPool.filter((c) => !introducedToday.has(c.id)).slice(0, remainingSlots)

        const nextIntroduced = new Set(introducedToday)
        for (const c of freshNew) nextIntroduced.add(c.id)
        saveIntroducedToday(nextIntroduced)

        setAllDue([...dueCards, ...alreadyIntroduced, ...freshNew])
        setChapters(seeded.chapters)
        setStreak(computeReadingStreak(log))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load review queue'))
      .finally(() => setLoading(false))
  }, [chapterScope])

  const cards = useMemo(() => (hyOnly ? allDue.filter((c) => c.highYield) : allDue), [allDue, hyOnly])
  const highYieldDueCount = useMemo(() => allDue.filter((c) => c.highYield).length, [allDue])

  useEffect(() => {
    setIndex(0)
  }, [hyOnly])

  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters])
  const current = cards[index]
  const preview: FsrsPreviewMap | null = current ? fsrsPreviewAll(current) : null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return
      if (e.code === 'Space' && !revealed && current.kind !== 'mcq') {
        e.preventDefault()
        setRevealed(true)
      } else if (/^[1-4]$/.test(e.key)) {
        const ratings: FsrsRating[] = ['again', 'hard', 'good', 'easy']
        if (revealed || (current.kind === 'mcq' && mcqChoice != null)) void handleGrade(ratings[Number(e.key) - 1])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, revealed, mcqChoice])

  async function handleGrade(rating: FsrsRating) {
    if (!current) return
    const { next } = scheduleFsrs(current, rating)
    try {
      await updateLibraryCardFsrs(current.id, next)
    } catch {
      // keep the session moving even if persistence fails
    }
    setGrades((prev) => [...prev, { card: { ...current, ...next }, rating }])
    setRevealed(false)
    setMcqChoice(null)
    setIndex((i) => i + 1)
  }

  function handleMcqPick(choiceIndex: number, correct: boolean) {
    setMcqChoice(choiceIndex)
    setRevealed(true)
    void correct
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  if (cards.length === 0) {
    return (
      <div className="np-page">
        <div className="rv">
          <div className="rtop">
            <Link className="x" to="/academy" aria-label="Back to Library">
              ×
            </Link>
          </div>
          <div className="np-card np-fade">
            <p className="empty-state">
              {hyOnly ? 'No high-yield cards due right now.' : 'Nothing due right now — nice work.'}
            </p>
            {hyOnly && allDue.length > 0 ? (
              <button type="button" className="np-btn ghost" onClick={() => setHyOnly(false)}>
                Show all due cards ({allDue.length})
              </button>
            ) : (
              <Link className="np-btn" to="/academy">
                Back to Library
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (index >= cards.length) {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
    const counts: Record<FsrsRating, number> = { again: 0, hard: 0, good: 0, easy: 0 }
    for (const g of grades) counts[g.rating]++
    const recallPct = grades.length > 0 ? Math.round(((counts.good + counts.easy) / grades.length) * 100) : 0
    const newlyMastered = grades.filter((g) => isCardMastered(g.card)).length
    const missed = grades.filter((g) => g.rating === 'again')
    const total = grades.length || 1
    const dist = [
      { key: 'Again', count: counts.again, color: '#F08A80' },
      { key: 'Hard', count: counts.hard, color: '#F5C26B' },
      { key: 'Good', count: counts.good, color: '#7FA8F0' },
      { key: 'Easy', count: counts.easy, color: '#7CCB9D' },
    ]
    return (
      <div className="np-page">
        <div className="rv">
          <section className="sum np-fade">
            <HeroScene scene="channels" page="review" className="hero-scene" />
            <div className="hero-scrim" />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="eyebrow" style={{ color: '#B9A6F5' }}>
                SESSION COMPLETE
              </span>
              <h1 style={{ fontSize: 26 }}>
                {grades.length} cards · {minutes} min
              </h1>
            </div>
            <div className="sgrid">
              <div>
                <b>{recallPct}%</b>
                <span>recall</span>
              </div>
              <div>
                <b style={{ color: '#9ED9B6' }}>+{newlyMastered}</b>
                <span>to Mastered</span>
              </div>
              <div>
                <b style={{ color: '#FFC46B' }}>{streak}</b>
                <span>streak days</span>
              </div>
            </div>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="dist" aria-label={dist.map((d) => `${d.key} ${d.count}`).join(', ')}>
                {dist.map((d) => (
                  <i key={d.key} style={{ width: `${(d.count / total) * 100}%`, background: d.color }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#A9C6FF' }}>
                {dist.map((d) => (
                  <span key={d.key}>
                    {d.key} {d.count}
                  </span>
                ))}
              </div>
            </div>
            {missed.length > 0 && (
              <div className="weak">
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: '#A9C6FF' }}>MISSED — REREAD THE SOURCE</span>
                {missed.map((g) => {
                  const chapter = chapterById.get(g.card.chapterId)
                  return (
                    <Link key={g.card.id} to={`/academy/reader/${g.card.chapterId}${g.card.sectionNumber ? `#s${g.card.sectionNumber}` : ''}`}>
                      <span style={{ flex: 1 }}>
                        {chapter ? `Ch ${chapter.chapterNumber}` : ''} {g.card.sectionNumber ? `§ ${g.card.sectionNumber}` : ''} · {g.card.front.slice(0, 40)}
                      </span>
                      <span style={{ color: '#A9C6FF' }}>{g.card.page ? `p. ${g.card.page}` : ''}</span>
                    </Link>
                  )
                })}
              </div>
            )}
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
              <Link className="np-btn white" to="/academy">
                Back to Library
              </Link>
              {chapterScope && (
                <Link className="np-btn glass" to={`/academy/reader/${chapterScope}`}>
                  Continue reading
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    )
  }

  const chapter = chapterById.get(current.chapterId)
  const style = TYPE_STYLE[current.kind]
  const [before, after] = current.kind === 'cloze' ? clozeParts(current.front) : ['', '']

  return (
    <div className="np-page">
      <div className="rv">
        <div className="rtop np-fade">
          <Link className="x" to="/academy" aria-label="End session">
            ×
          </Link>
          <div className="rbar" aria-label="Progress">
            <i style={{ width: `${(index / cards.length) * 100}%` }} />
          </div>
          <span className="rcount">
            {index + 1} / {cards.length}
          </span>
          {highYieldDueCount > 0 && (
            <button
              type="button"
              className="np-pill"
              style={{
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: hyOnly ? '#93590B' : '#5B6B82',
                background: hyOnly ? '#FDF0D5' : 'rgba(255,255,255,.12)',
              }}
              onClick={() => setHyOnly((v) => !v)}
              title="High-yield only"
            >
              ⭐ High-yield only
            </button>
          )}
        </div>

        <div className="stage">
          <div className={revealed ? 'cardx on revealed' : 'cardx on'}>
            <div className="face" style={{ '--stripe': style.stripe } as React.CSSProperties}>
              <div className="src">
                <span className="chip2">
                  {chapter ? `Ch ${chapter.chapterNumber}` : 'Chapter'} {current.sectionNumber ? `· § ${current.sectionNumber}` : ''}{' '}
                  {current.page ? `· p. ${current.page}` : ''}
                </span>
                <span className="typ" style={{ color: style.color, background: style.background }}>
                  {TYPE_LABEL[current.kind]}
                </span>
              </div>

              {current.kind === 'patient_case' && isVignette(current.options) && (
                <div className="vig" dir="ltr">
                  {current.options.stats.map((s) => (
                    <div key={s.label}>
                      <span>{s.label}</span>
                      <b className={s.flag === 'hi' ? 'hi' : s.flag === 'lo' ? 'lo' : ''}>{s.value}</b>
                    </div>
                  ))}
                </div>
              )}

              {current.kind === 'mcq' && isMcqOptions(current.options) ? (
                <>
                  <p className="q" dir="rtl">
                    {current.front}
                  </p>
                  <div className="opts" dir="rtl">
                    {current.options.choices.map((choice, i) => {
                      const cls =
                        mcqChoice == null
                          ? 'opt'
                          : choice.correct
                            ? 'opt right'
                            : i === mcqChoice
                              ? 'opt wrong'
                              : 'opt dim'
                      return (
                        <button key={i} className={cls} disabled={mcqChoice != null} onClick={() => handleMcqPick(i, choice.correct)}>
                          <span className="k">{choice.label}</span>
                          <span className="tx">{choice.text}</span>
                        </button>
                      )
                    })}
                  </div>
                  {revealed && current.options.explanation && (
                    <div className="expl on" dir="rtl">
                      <span className="h">EXPLANATION</span>
                      {current.options.explanation}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="q" dir="rtl">
                    {current.kind === 'cloze' ? (
                      <>
                        {before}
                        <span className="blank">{current.back}</span>
                        {after}
                      </>
                    ) : (
                      current.front
                    )}
                  </p>
                  {current.kind !== 'cloze' && revealed && (
                    <p className="ctx" dir="rtl">
                      {current.back}
                    </p>
                  )}
                </>
              )}
            </div>

            {current.kind === 'mcq' ? (
              mcqChoice != null && (
                <div className="grade on">
                  {(['again', 'hard', 'good', 'easy'] as FsrsRating[]).map((r, i) => (
                    <button key={r} className={`g${i + 1}`} onClick={() => void handleGrade(r)}>
                      <b>{r[0].toUpperCase() + r.slice(1)}</b>
                      <span>{preview?.[r].label}</span>
                    </button>
                  ))}
                </div>
              )
            ) : !revealed ? (
              <button className="reveal" onClick={() => setRevealed(true)}>
                Show answer <kbd>Space</kbd>
              </button>
            ) : (
              <div className="grade on">
                {(['again', 'hard', 'good', 'easy'] as FsrsRating[]).map((r, i) => (
                  <button key={r} className={`g${i + 1}`} onClick={() => void handleGrade(r)}>
                    <b>{r[0].toUpperCase() + r.slice(1)}</b>
                    <span>{preview?.[r].label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="hint">Keyboard: Space = show · 1 Again · 2 Hard · 3 Good · 4 Easy.</p>
      </div>
    </div>
  )
}
