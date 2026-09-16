import { useEffect, useState, type FormEvent } from 'react'
import { addReasoningCase, deleteReasoningCase, listReasoningCases } from '../../lib/api/reasoningCases'
import type { ReasoningCase } from '../../types/domain'

const emptyDraft = { title: '', chief: '', history: '', vitals: '', exam: '', labs: '', imaging: '', discussion: '' }

export function ReasoningCasesPanel() {
  const [cases, setCases] = useState<ReasoningCase[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    listReasoningCases()
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cases'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) return
    try {
      const created = await addReasoningCase({
        title: draft.title.trim(),
        age: null,
        sex: null,
        chief: draft.chief || null,
        history: draft.history || null,
        vitals: draft.vitals || null,
        exam: draft.exam || null,
        labs: draft.labs || null,
        imaging: draft.imaging || null,
        questions: [],
        discussion: draft.discussion || null,
      })
      setCases((prev) => [...prev, created])
      setDraft(emptyDraft)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add case')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReasoningCase(id)
      setCases((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New case'}</button>
      </div>

      {showForm && (
        <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
          <input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
          <input placeholder="Chief complaint" value={draft.chief} onChange={(e) => setDraft({ ...draft, chief: e.target.value })} />
          <textarea placeholder="History" value={draft.history} onChange={(e) => setDraft({ ...draft, history: e.target.value })} />
          <textarea placeholder="Vitals / exam" value={draft.vitals} onChange={(e) => setDraft({ ...draft, vitals: e.target.value })} />
          <textarea placeholder="Labs" value={draft.labs} onChange={(e) => setDraft({ ...draft, labs: e.target.value })} />
          <textarea placeholder="Imaging" value={draft.imaging} onChange={(e) => setDraft({ ...draft, imaging: e.target.value })} />
          <textarea placeholder="Discussion" value={draft.discussion} onChange={(e) => setDraft({ ...draft, discussion: e.target.value })} />
          <div className="form-actions">
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : cases.length === 0 ? (
        <p className="empty-state">No reasoning cases yet.</p>
      ) : (
        <ul className="note-timeline">
          {cases.map((c) => (
            <li key={c.id}>
              <div className="note-header">
                <strong onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  {c.title}
                </strong>
                <span>{c.chief}</span>
                <button className="link-button" onClick={() => void handleDelete(c.id)}>
                  Delete
                </button>
              </div>
              {openId === c.id && (
                <div>
                  {c.history && <p><strong>History:</strong> {c.history}</p>}
                  {c.vitals && <p><strong>Vitals/exam:</strong> {c.vitals}</p>}
                  {c.labs && <p><strong>Labs:</strong> {c.labs}</p>}
                  {c.imaging && <p><strong>Imaging:</strong> {c.imaging}</p>}
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
