import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { listAcademyTopics } from '../../lib/api/academy'
import { linkTopicPatient, listTopicIdsForPatient, unlinkTopicPatient } from '../../lib/api/academyTopicPatients'
import type { AcademyTopic } from '../../types/domain'

interface Props {
  patientId: string
}

export function LinkedTopicsWidget({ patientId }: Props) {
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [linkedIds, setLinkedIds] = useState<string[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listAcademyTopics(), listTopicIdsForPatient(patientId)])
      .then(([t, ids]) => {
        setTopics(t)
        setLinkedIds(ids)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load study topics'))
  }, [patientId])

  async function handleLink(e: FormEvent) {
    e.preventDefault()
    if (!selectedTopicId) return
    try {
      await linkTopicPatient(selectedTopicId, patientId)
      setLinkedIds((prev) => [...prev, selectedTopicId])
      setSelectedTopicId('')
      setShowPicker(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link topic')
    }
  }

  async function handleUnlink(topicId: string) {
    try {
      await unlinkTopicPatient(topicId, patientId)
      setLinkedIds((prev) => prev.filter((id) => id !== topicId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink topic')
    }
  }

  const linked = topics.filter((t) => linkedIds.includes(t.id))
  const linkable = topics.filter((t) => !linkedIds.includes(t.id))

  if (topics.length === 0 && !error) return null

  return (
    <div className="dash-card" style={{ marginBottom: 20 }}>
      <div className="dash-card-header">
        <h2 className="dash-card-title">Linked study topics</h2>
      </div>
      {error && <p className="form-error">{error}</p>}
      {linked.length === 0 ? (
        <p className="empty-state">No topics linked yet — link this patient to a study topic to review together.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {linked.map((t) => (
            <span key={t.id} className="checkpoint-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Link to={`/academy/${t.id}`}>{t.name}</Link>
              <button
                type="button"
                className="link-button"
                onClick={() => void handleUnlink(t.id)}
                aria-label={`Unlink ${t.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {showPicker ? (
        <form className="inline-form" style={{ marginTop: 10 }} onSubmit={(e) => void handleLink(e)}>
          <select value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)}>
            <option value="">Select a topic…</option>
            {linkable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.category ? `${t.category} — ` : ''}
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit" disabled={!selectedTopicId}>
            Link
          </button>
          <button type="button" className="button-secondary" onClick={() => setShowPicker(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="button-secondary" style={{ marginTop: 10 }} onClick={() => setShowPicker(true)}>
          + Link study topic
        </button>
      )}
    </div>
  )
}
