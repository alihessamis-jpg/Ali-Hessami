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
        <ul className="patient-list">
          {topics.map((t) => {
            const p = progress[t.id]
            const due = !p || !p.nextReview || p.nextReview <= today
            return (
              <li key={t.id}>
                <Link to={`/academy/${t.id}`}>
                  <span className="patient-name">{t.name}</span>
                  <span className="patient-meta">
                    {t.category ?? 'Uncategorized'} · {due ? 'Due for review' : `Next review ${p?.nextReview}`}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
