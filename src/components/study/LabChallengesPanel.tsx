import { useEffect, useState, type FormEvent } from 'react'
import { addLabChallenge, deleteLabChallenge, listLabChallenges, updateLabChallenge } from '../../lib/api/labChallenges'
import { addReadingItemFromQuestion } from '../../lib/api/readingItems'
import { matchesSearch } from '../../lib/textFilter'
import type { LabChallenge } from '../../types/domain'

function buildReadingItemFromChallenge(c: LabChallenge): { title: string; answer: string } {
  const valuesText = c.values.map(([test, value, unit]) => [test, value, unit].filter(Boolean).join(' ')).join(', ')
  const title = [c.title, valuesText, c.prompt].filter(Boolean).join('\n\n')
  return { title, answer: c.discussion ?? '' }
}

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savedToReview, setSavedToReview] = useState<Record<string, boolean>>({})

  useEffect(() => {
    listLabChallenges()
      .then(setChallenges)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load challenges'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const values = rows
      .split('\n')
      .map((line) => line.split(',').map((s) => s.trim()))
      .filter((parts) => parts[0])
      .map((parts) => [parts[0] ?? '', parts[1] ?? '', parts[2] ?? ''] as [string, string, string])
    try {
      const payload = { title: title.trim(), values, prompt: prompt || null, discussion: discussion || null }
      if (editingId) {
        const updated = await updateLabChallenge(editingId, payload)
        setChallenges((prev) => prev.map((c) => (c.id === editingId ? updated : c)))
      } else {
        const created = await addLabChallenge(payload)
        setChallenges((prev) => [...prev, created])
      }
      setTitle('')
      setRows('')
      setPrompt('')
      setDiscussion('')
      setEditingId(null)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save challenge')
    }
  }

  function handleEdit(c: LabChallenge) {
    setTitle(c.title)
    setRows(c.values.map(([test, value, unit]) => [test, value, unit].filter(Boolean).join(', ')).join('\n'))
    setPrompt(c.prompt ?? '')
    setDiscussion(c.discussion ?? '')
    setEditingId(c.id)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    try {
      await deleteLabChallenge(id)
      setChallenges((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleSaveToReadingReview(c: LabChallenge) {
    try {
      const { title, answer } = buildReadingItemFromChallenge(c)
      await addReadingItemFromQuestion({ title, answer, origin: 'Lab Challenges' })
      setSavedToReview((prev) => ({ ...prev, [c.id]: true }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save to reading review')
    }
  }

  return (
    <div>
      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button
          onClick={() => {
            if (showForm) {
              setTitle('')
              setRows('')
              setPrompt('')
              setDiscussion('')
              setEditingId(null)
            }
            setShowForm((v) => !v)
          }}
        >
          {showForm ? 'Cancel' : 'New challenge'}
        </button>
      </div>

      {showForm && (
        <form className="soap-form" onSubmit={(e) => void handleSave(e)}>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label>
            Values — one per line: test, value, unit
            <textarea placeholder="Creatinine, 1.8, mg/dL" value={rows} onChange={(e) => setRows(e.target.value)} />
          </label>
          <textarea placeholder="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <textarea placeholder="Discussion" value={discussion} onChange={(e) => setDiscussion(e.target.value)} />
          <div className="form-actions">
            <button type="submit">{editingId ? 'Save changes' : 'Save'}</button>
          </div>
        </form>
      )}

      <input
        placeholder="Search challenges…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ margin: '12px 0', width: '100%', maxWidth: 360 }}
      />

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : challenges.length === 0 ? (
        <p className="empty-state">No lab challenges yet.</p>
      ) : (
        <ul className="note-timeline">
          {challenges
            .filter((c) => matchesSearch([c.title, c.prompt, c.discussion, ...c.values.flat()], search))
            .map((c) => (
            <li key={c.id}>
              <div className="note-header">
                <strong onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  {c.title}
                </strong>
                <button className="link-button" onClick={() => handleEdit(c)}>
                  Edit
                </button>
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
                  {c.discussion && (
                    <div className="form-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        disabled={savedToReview[c.id]}
                        onClick={() => void handleSaveToReadingReview(c)}
                      >
                        {savedToReview[c.id] ? 'Saved to reading review' : 'Save to reading review'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
