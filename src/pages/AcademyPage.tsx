import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addAcademyTopic, listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { useAuth } from '../context/AuthContext'
import { AcademyIcon } from '../components/icons'
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

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : topics.length === 0 ? (
        <p className="empty-state">No topics yet.</p>
      ) : (
        <div className="topic-grid">
          {topics.map((t) => {
            const p = progress[t.id]
            const due = !p || !p.nextReview || p.nextReview <= today
            return (
              <Link key={t.id} to={`/academy/${t.id}`} className="topic-card">
                <div className="topic-card-header">
                  <span className="icon-chip">
                    <AcademyIcon />
                  </span>
                  {due && <span className="status-badge status-badge--dialysis">Due for review</span>}
                </div>
                <h3 className="topic-card-title">{t.name}</h3>
                <p className="topic-card-meta">
                  {t.category ?? 'Uncategorized'}
                  {t.parentTopicId && ` · Sub-topic of ${topics.find((p) => p.id === t.parentTopicId)?.name ?? '…'}`}
                </p>
                <p className="topic-card-sections">{sectionSummary(t)}</p>
                <span className="link-button">Open topic →</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
