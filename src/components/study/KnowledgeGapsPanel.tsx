import { useEffect, useState, type FormEvent } from 'react'
import { addKnowledgeGap, deleteKnowledgeGap, listKnowledgeGaps, updateKnowledgeGap } from '../../lib/api/knowledgeGaps'
import { toShamsi } from '../../lib/shamsi'
import type { KnowledgeGap } from '../../types/domain'

export function KnowledgeGapsPanel() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')

  useEffect(() => {
    listKnowledgeGaps()
      .then(setGaps)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    try {
      const gap = await addKnowledgeGap({
        topic: topic.trim(),
        description: description || null,
        date: new Date().toISOString().slice(0, 10),
        priority,
        reviewDate: null,
        status: 'open',
      })
      setGaps((prev) => [gap, ...prev])
      setTopic('')
      setDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    }
  }

  async function toggleStatus(gap: KnowledgeGap) {
    try {
      const updated = await updateKnowledgeGap(gap.id, { status: gap.status === 'resolved' ? 'open' : 'resolved' })
      setGaps((prev) => prev.map((g) => (g.id === gap.id ? updated : g)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteKnowledgeGap(id)
      setGaps((prev) => prev.filter((g) => g.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} required />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button type="submit">Add</button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : gaps.length === 0 ? (
        <p className="empty-state">No knowledge gaps logged.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Description</th>
              <th>Priority</th>
              <th>Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((g) => (
              <tr key={g.id} style={{ opacity: g.status === 'resolved' ? 0.5 : 1 }}>
                <td>{g.topic}</td>
                <td>{g.description}</td>
                <td>{g.priority}</td>
                <td>{toShamsi(g.date)}</td>
                <td>
                  <button className="link-button" onClick={() => void toggleStatus(g)}>
                    {g.status}
                  </button>
                </td>
                <td>
                  <button className="link-button" onClick={() => void handleDelete(g.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
