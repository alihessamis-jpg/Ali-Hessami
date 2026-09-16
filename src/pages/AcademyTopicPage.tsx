import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listAcademyProgress, listAcademyTopics, saveAcademyProgress, updateAcademyTopic } from '../lib/api/academy'
import { scheduleReview } from '../lib/srs'
import { toShamsi } from '../lib/shamsi'
import { useAuth } from '../context/AuthContext'
import type { AcademyProgress, AcademyTopic } from '../types/domain'

const SECTIONS: Array<{ key: keyof AcademyTopic; label: string }> = [
  { key: 'summary', label: 'Summary' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'reasoning', label: 'Clinical reasoning' },
  { key: 'tests', label: 'Tests' },
  { key: 'interpretation', label: 'Interpretation' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'redFlags', label: 'Red flags' },
  { key: 'pearls', label: 'Pearls' },
  { key: 'selfTest', label: 'Self test' },
  { key: 'caseStem', label: 'Case stem' },
  { key: 'caseDiscussion', label: 'Case discussion' },
]

const emptyProgress: AcademyProgress = { topicId: '', intervalIndex: -1, lastReviewed: null, nextReview: null, reviewHistory: [] }

export function AcademyTopicPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const [topic, setTopic] = useState<AcademyTopic | null>(null)
  const [progress, setProgress] = useState<AcademyProgress>(emptyProgress)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AcademyTopic | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !session) return
    Promise.all([listAcademyTopics(), listAcademyProgress(session.user.id)])
      .then(([topics, progressRows]) => {
        const found = topics.find((t) => t.id === id) ?? null
        setTopic(found)
        setDraft(found)
        setProgress(progressRows.find((p) => p.topicId === id) ?? { ...emptyProgress, topicId: id })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load topic'))
  }, [id, session])

  async function handleSave() {
    if (!draft || !id) return
    try {
      const updated = await updateAcademyTopic(id, draft)
      setTopic(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  async function handleReview(rating: 'easy' | 'moderate' | 'difficult') {
    if (!id || !session) return
    const next = scheduleReview(progress, rating)
    setProgress({ ...next, topicId: id })
    try {
      await saveAcademyProgress(session.user.id, id, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    }
  }

  if (!id) return null
  if (error) return <p className="form-error">{error}</p>
  if (!topic || !draft) return <p>Loading…</p>

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/academy" className="back-link">
            ← Academy
          </Link>
          <h1>{topic.name}</h1>
        </div>
        <button onClick={() => setEditing((v) => !v)}>{editing ? 'Cancel' : 'Edit'}</button>
      </div>

      <div className="calc-strip">
        <div>
          <span className="calc-label">Next review</span>
          <span className="calc-value">{progress.nextReview ? toShamsi(progress.nextReview) : '—'}</span>
        </div>
        <div>
          <span className="calc-label">Interval</span>
          <span className="calc-value">{progress.intervalIndex >= 0 ? `${progress.intervalIndex + 1}` : '—'}</span>
        </div>
        <div>
          <span className="calc-label">Reviews</span>
          <span className="calc-value">{progress.reviewHistory.length}</span>
        </div>
      </div>

      <div className="form-actions" style={{ marginBottom: 20 }}>
        <button onClick={() => void handleReview('difficult')}>Difficult</button>
        <button onClick={() => void handleReview('moderate')}>Moderate</button>
        <button onClick={() => void handleReview('easy')}>Easy</button>
      </div>

      {editing ? (
        <div>
          {SECTIONS.map(({ key, label }) => (
            <label key={key} style={{ display: 'block', marginBottom: 12 }}>
              {label}
              <textarea
                value={(draft[key] as string) ?? ''}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <button onClick={() => void handleSave()}>Save topic</button>
        </div>
      ) : (
        <div>
          {SECTIONS.map(({ key, label }) =>
            topic[key] ? (
              <section key={key} style={{ marginBottom: 16 }}>
                <h3>{label}</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{topic[key] as string}</p>
              </section>
            ) : null
          )}
          {SECTIONS.every(({ key }) => !topic[key]) && (
            <p className="empty-state">No content yet — click Edit to write this topic up.</p>
          )}
        </div>
      )}
    </div>
  )
}
