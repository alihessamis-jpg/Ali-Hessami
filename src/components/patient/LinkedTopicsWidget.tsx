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
    <section className="np-card np-fade" style={{ animationDelay: '.3s' }}>
      <h2>Linked study topics</h2>
      {error && <p className="form-error">{error}</p>}
      <span className="np-small">Link this patient to a topic to review together.</span>
      {linked.length > 0 && (
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
        <form className="inline-form" onSubmit={(e) => void handleLink(e)}>
          <select value={selectedTopicId} onChange={(e) => setSelectedTopicId(e.target.value)}>
            <option value="">Select a topic…</option>
            {linkable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.category ? `${t.category} — ` : ''}
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit" className="np-btn sm" disabled={!selectedTopicId}>
            Link
          </button>
          <button type="button" className="np-btn ghost sm" onClick={() => setShowPicker(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button type="button" className="pc-topicr" onClick={() => setShowPicker(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5" />
          </svg>
          Link study topic
        </button>
      )}
    </section>
  )
}
