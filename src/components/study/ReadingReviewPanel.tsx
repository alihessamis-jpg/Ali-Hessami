import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addReadingItem,
  deleteReadingItem,
  listReadingItems,
  setReadingItemCheckpoint,
  setReadingItemTopic,
} from '../../lib/api/readingItems'
import { listAcademyTopics } from '../../lib/api/academy'
import { checkpointDueDate, REVIEW_CHECKPOINTS } from '../../lib/readingReview'
import { toShamsi } from '../../lib/shamsi'
import type { AcademyTopic, ReadingItem, ReviewCheckpointKey } from '../../types/domain'

function emptyDraft() {
  return { title: '', source: '', dateRead: new Date().toISOString().slice(0, 10), topicId: '' }
}

export function ReadingReviewPanel() {
  const [items, setItems] = useState<ReadingItem[]>([])
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    setLoading(true)
    Promise.all([listReadingItems(), listAcademyTopics()])
      .then(([readingRows, topicRows]) => {
        setItems(readingRows)
        setTopics(topicRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reading list'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const item = await addReadingItem({
        title: draft.title.trim(),
        source: draft.source || null,
        dateRead: draft.dateRead,
        review3dDone: false,
        review7dDone: false,
        review14dDone: false,
        review30dDone: false,
        review90dDone: false,
        topicId: draft.topicId || null,
      })
      setItems((prev) => [item, ...prev])
      setDraft({ ...emptyDraft(), dateRead: draft.dateRead, topicId: draft.topicId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTopicChange(item: ReadingItem, topicId: string) {
    try {
      const updated = await setReadingItemTopic(item.id, topicId || null)
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update topic link')
    }
  }

  async function toggleCheckpoint(item: ReadingItem, key: ReviewCheckpointKey) {
    try {
      const updated = await setReadingItemCheckpoint(item.id, key, !item[key])
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReadingItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <p className="empty-state">
        Log what you read and get reminded to review it at 3 days, 1 week, 14 days, 1 month, and 3 months —
        a fixed spaced-review schedule, separate from Academy/Flashcards' adaptive one.
      </p>

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input
          placeholder="Title (article, chapter, guideline...)"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          required
        />
        <input
          placeholder="Source / link (optional)"
          value={draft.source}
          onChange={(e) => setDraft({ ...draft, source: e.target.value })}
        />
        <input
          type="date"
          value={draft.dateRead}
          onChange={(e) => setDraft({ ...draft, dateRead: e.target.value || new Date().toISOString().slice(0, 10) })}
          required
        />
        <select value={draft.topicId} onChange={(e) => setDraft({ ...draft, topicId: e.target.value })}>
          <option value="">No topic</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.category ? `${t.category} — ` : ''}
              {t.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Nothing logged yet.</p>
      ) : (
        <ul className="reading-item-list">
          {items.map((item) => (
            <li key={item.id} className="dash-card">
              <div className="dash-card-header">
                <div>
                  <h3 style={{ margin: 0 }}>{item.title}</h3>
                  <span className="patient-meta">
                    {[item.source, `Read ${toShamsi(item.dateRead)}`].filter(Boolean).join(' · ')}
                  </span>
                  {item.topicId && (
                    <div>
                      <Link to={`/academy/${item.topicId}`} className="study-link">
                        {topics.find((t) => t.id === item.topicId)?.name ?? 'Topic'}
                      </Link>
                    </div>
                  )}
                </div>
                <button className="link-button" onClick={() => void handleDelete(item.id)}>
                  Delete
                </button>
              </div>
              <div className="form-actions" style={{ marginBottom: 8 }}>
                <select value={item.topicId ?? ''} onChange={(e) => void handleTopicChange(item, e.target.value)}>
                  <option value="">No topic</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.category ? `${t.category} — ` : ''}
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="checkpoint-row">
                {REVIEW_CHECKPOINTS.map((cp) => {
                  const done = item[cp.key]
                  const dueDate = checkpointDueDate(item, cp)
                  const isDue = !done && dueDate <= today
                  return (
                    <button
                      key={cp.key}
                      type="button"
                      className={`checkpoint-chip ${done ? 'checkpoint-chip--done' : isDue ? 'checkpoint-chip--due' : ''}`}
                      onClick={() => void toggleCheckpoint(item, cp.key)}
                    >
                      {cp.label}
                      {done ? ' ✓' : isDue ? ' — due' : ` — ${toShamsi(dueDate)}`}
                    </button>
                  )
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
