import { useEffect, useState, type FormEvent } from 'react'
import { addLabChallenge, deleteLabChallenge, listLabChallenges } from '../../lib/api/labChallenges'
import type { LabChallenge } from '../../types/domain'

export function LabChallengesPanel() {
  const [challenges, setChallenges] = useState<LabChallenge[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [rows, setRows] = useState('')
  const [prompt, setPrompt] = useState('')
  const [discussion, setDiscussion] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    listLabChallenges()
      .then(setChallenges)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load challenges'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const values = rows
      .split('\n')
      .map((line) => line.split(',').map((s) => s.trim()))
      .filter((parts) => parts[0])
      .map((parts) => [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''] as [string, string, string])
    try {
      const created = await addLabChallenge({ title: title.trim(), values, prompt: prompt || null, discussion: discussion || null })
      setChallenges((prev) => [...prev, created])
      setTitle('')
      setRows('')
      setPrompt('')
      setDiscussion('')
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add challenge')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLabChallenge(id)
      setChallenges((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New challenge'}</button>
      </div>

      {showForm && (
        <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label>
            Values — one per line: test, value, unit
            <textarea placeholder="Creatinine, 1.8, mg/dL" value={rows} onChange={(e) => setRows(e.target.value)} />
          </label>
          <textarea placeholder="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <textarea placeholder="Discussion" value={discussion} onChange={(e) => setDiscussion(e.target.value)} />
          <div className="form-actions">
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : challenges.length === 0 ? (
        <p className="empty-state">No lab challenges yet.</p>
      ) : (
        <ul className="note-timeline">
          {challenges.map((c) => (
            <li key={c.id}>
              <div className="note-header">
                <strong onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  {c.title}
                </strong>
                <button className="link-button" onClick={() => void handleDelete(c.id)}>
                  Delete
                </button>
              </div>
              {openId === c.id && (
                <div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Value</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.values.map(([test, value, unit], i) => (
                        <tr key={i}>
                          <td>{test}</td>
                          <td>{value}</td>
                          <td>{unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {c.prompt && <p><strong>Prompt:</strong> {c.prompt}</p>}
                  {c.discussion && <p><strong>Discussion:</strong> {c.discussion}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
