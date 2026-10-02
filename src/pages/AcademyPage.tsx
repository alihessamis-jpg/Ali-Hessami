import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addAcademyTopic, listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { useAuth } from '../context/AuthContext'
import { AcademyIcon } from '../components/icons'
import { matchesSearch } from '../lib/textFilter'
import { sortSubTopics } from '../lib/sortSubTopics'
import type { AcademyProgress, AcademyTopic } from '../types/domain'

export function AcademyPage() {
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
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <span className="page-title-icon">
              <AcademyIcon />
            </span>
            Academy
          </h1>
          <p className="empty-state" style={{ margin: 0 }}>
            {dueCount} of {topics.length} topics due for review. No content is pre-loaded — build your own
            topic library.
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New topic'}</button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
          <input placeholder="Topic name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
          <button type="submit">Add</button>
        </form>
      )}

      <input
        placeholder="Search topics… (e.g. vaccinations in dialysis patients)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ margin: '12px 0', width: '100%', maxWidth: 420 }}
      />

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : topics.length === 0 ? (
        <p className="empty-state">No topics yet.</p>
      ) : visibleTopLevelTopics.length === 0 ? (
        <p className="empty-state">No topics match your search.</p>
      ) : (
        <div className="topic-grid">
          {visibleTopLevelTopics.map((t) => {
            const p = progress[t.id]
            const due = !p || !p.nextReview || p.nextReview <= today
            const allChildren = childrenByParent.get(t.id) ?? []
            return (
              <div key={t.id} className="topic-card">
                <div className="topic-card-header">
                  <span className="icon-chip">
                    <AcademyIcon />
                  </span>
                  {due && <span className="status-badge status-badge--dialysis">Due for review</span>}
                </div>
                <Link to={`/academy/${t.id}`} className="topic-card-title-link">
                  <h3 className="topic-card-title">{t.name}</h3>
                </Link>
                <p className="topic-card-meta">{t.category ?? 'Uncategorized'}</p>
                <p className="topic-card-sections">{sectionSummary(t)}</p>
                <Link to={`/academy/${t.id}`} className="link-button">
                  Open topic →
                </Link>
                {allChildren.length > 0 && (
                  <p className="topic-card-meta topic-card-subtopic-count">
                    {allChildren.length} sub-topic{allChildren.length === 1 ? '' : 's'} — open the topic to see them
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
