import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addAcademyTopic, listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { useAuth } from '../context/AuthContext'
import { matchesSearch } from '../lib/textFilter'
import { sortSubTopics } from '../lib/sortSubTopics'
import type { AcademyProgress, AcademyTopic } from '../types/domain'

export function AcademyPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [progress, setProgress] = useState<Record<string, AcademyProgress>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([listAcademyTopics(), listAcademyProgress(session.user.id)])
      .then(([topicRows, progressRows]) => {
        setTopics(topicRows)
        setProgress(Object.fromEntries(progressRows.map((p) => [p.topicId, p])))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load Academy'))
      .finally(() => setLoading(false))
  }, [session])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const topic = await addAcademyTopic({
        category: category || null,
        name: name.trim(),
        summary: null,
        keyPoints: [],
        studyLinks: [],
        presentation: null,
        reasoning: null,
        tests: null,
        interpretation: null,
        imaging: null,
        treatment: null,
        redFlags: null,
        pearls: null,
        selfTest: null,
        caseStem: null,
        caseQuestions: [],
        caseDiscussion: null,
      })
      setTopics((prev) => [...prev, topic])
      setName('')
      setCategory('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create topic')
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const dueCount = topics.filter((t) => {
    const p = progress[t.id]
    return !p || !p.nextReview || p.nextReview <= today
  }).length

  function sectionSummary(t: AcademyTopic): string {
    const sections: Array<[string, unknown]> = [
      ['Summary', t.summary],
      ['key points', t.keyPoints.length > 0 ? t.keyPoints : null],
      ['tests', t.tests],
      ['approach', t.reasoning],
      ['treatment', t.treatment],
      ['red flags', t.redFlags],
      ['pearls', t.pearls],
      ['self-test', t.selfTest],
    ]
    const filled = sections.filter(([, value]) => !!value).map(([label]) => label)
    return filled.length > 0 ? filled.join(' · ') : 'No content yet'
  }

  const searching = search.trim() !== ''
  const matchedIds = new Set(
    topics
      .filter((t) =>
        matchesSearch(
          [
            t.name,
            t.category,
            t.summary,
            t.presentation,
            t.reasoning,
            t.tests,
            t.interpretation,
            t.imaging,
            t.treatment,
            t.redFlags,
            t.pearls,
            t.selfTest,
            t.caseStem,
            t.keyPoints.join(' '),
          ],
          search
        )
      )
      .map((t) => t.id)
  )

  // A topic is top-level if it has no parent, or its parent was deleted —
  // orphaned sub-topics would otherwise vanish from the page entirely.
  const topicIds = new Set(topics.map((t) => t.id))
  const topLevelTopics = topics.filter((t) => !t.parentTopicId || !topicIds.has(t.parentTopicId))
  const childrenByParent = new Map<string, AcademyTopic[]>()
  for (const t of topics) {
    if (t.parentTopicId && topicIds.has(t.parentTopicId)) {
      const list = childrenByParent.get(t.parentTopicId) ?? []
      list.push(t)
      childrenByParent.set(t.parentTopicId, list)
    }
  }
  for (const [parentId, list] of childrenByParent) {
    childrenByParent.set(parentId, sortSubTopics(list))
  }

  const visibleTopLevelTopics = topLevelTopics.filter((t) => {
    if (!searching) return true
    if (matchedIds.has(t.id)) return true
    return (childrenByParent.get(t.id) ?? []).some((c) => matchedIds.has(c.id))
  })

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow amber" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Academy</h1>
            <p className="np-sub">
              Your own topic library on a spaced-repetition schedule. {dueCount} of {topics.length} topics due
              for review.
            </p>
          </div>
          <svg className="np-art" width="96" height="96" viewBox="0 0 90 90" fill="none" aria-hidden="true">
            <circle className="acd-tw" cx="14" cy="16" r="2" fill="#FFE2B0" />
            <circle className="acd-tw" cx="78" cy="22" r="2.5" fill="#FFE2B0" style={{ animationDelay: '.5s' }} />
            <circle className="acd-tw" cx="72" cy="78" r="2" fill="#FFE2B0" style={{ animationDelay: '1s' }} />
            <g className="acd-cap">
              <path d="M45 22 8 38l37 16 37-16z" fill="#FFFFFF" />
              <path d="M22 45v14c10 8 36 8 46 0V45L45 55z" fill="#9CC2FF" />
              <path d="M76 41v18" stroke="#FFC46B" strokeWidth={3} strokeLinecap="round" />
              <circle cx="76" cy="62" r="4" fill="#FFC46B" />
            </g>
          </svg>
        </div>
        <div style={{ position: 'relative', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="np-tag" style={{ fontSize: 12, color: '#3D2A00', background: '#FFC46B', padding: '5px 10px' }}>
            {dueCount} due
          </span>
          <span className="np-tag" style={{ fontSize: 12, color: '#fff', background: 'rgba(255,255,255,.12)', padding: '5px 10px' }}>
            {topics.length} topics
          </span>
        </div>
      </section>

      <div className="np-toolbar np-fade" style={{ animationDelay: '.08s' }}>
        <div className="np-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label className="np-sr" htmlFor="acd-search">
            Search topics (e.g. vaccinations in dialysis patients)
          </label>
          <input
            id="acd-search"
            placeholder="Search topics (e.g. vaccinations in dialysis patients)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="button" className="np-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New topic
            </>
          )}
        </button>
      </div>

      {showForm && (
        <form className="np-card np-fade" onSubmit={(e) => void handleCreate(e)}>
          <h2>New topic</h2>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="acd-name">Topic name</label>
              <input id="acd-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="np-field">
              <label htmlFor="acd-cat">Category</label>
              <input id="acd-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="np-btn">
            Add
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : topics.length === 0 ? (
        <section className="np-empty np-fade">
          <b style={{ fontSize: 15 }}>No topics yet</b>
          <span className="np-small">Build your own topic library — add your first topic above.</span>
        </section>
      ) : visibleTopLevelTopics.length === 0 ? (
        <section className="np-empty np-fade">
          <b style={{ fontSize: 15 }}>No topics match.</b>
        </section>
      ) : (
        <div className="acd-tgrid">
          {visibleTopLevelTopics.map((t, i) => {
            const p = progress[t.id]
            const due = !p || !p.nextReview || p.nextReview <= today
            const allChildren = childrenByParent.get(t.id) ?? []
            return (
              <Link
                key={t.id}
                to={`/academy/${t.id}`}
                className="acd-topic np-fade"
                style={{ animationDelay: `${0.14 + i * 0.05}s` }}
              >
                <div className="np-head">
                  <span className="np-tag" style={{ color: '#1546A8', background: '#E3EDFD' }}>
                    {t.category ?? 'Uncategorized'}
                  </span>
                  {due && (
                    <span className="np-tag" style={{ color: '#93590B', background: '#FDF0DC' }}>
                      Due
                    </span>
                  )}
                </div>
                <b dir="auto">{t.name}</b>
                <span className="np-small">
                  {sectionSummary(t)}
                  {allChildren.length > 0 ? ` · ${allChildren.length} sub-topic${allChildren.length === 1 ? '' : 's'}` : ''}
                </span>
                <span className="acd-open-l">Open topic →</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
