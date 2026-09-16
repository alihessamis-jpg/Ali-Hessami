import { useEffect, useState, type FormEvent } from 'react'
import { addImagingChallenge, deleteImagingChallenge, listImagingChallenges } from '../../lib/api/imagingChallenges'
import { getImagingSignedUrl, uploadImagingFile } from '../../lib/storage'
import { useAuth } from '../../context/AuthContext'
import type { ImagingChallenge } from '../../types/domain'

export function ImagingChallengesPanel() {
  const { session } = useAuth()
  const [challenges, setChallenges] = useState<ImagingChallenge[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [context, setContext] = useState('')
  const [questions, setQuestions] = useState('')
  const [discussion, setDiscussion] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    listImagingChallenges()
      .then((rows) => {
        setChallenges(rows)
        rows.forEach((r) => {
          if (r.storagePath) getImagingSignedUrl(r.storagePath).then((url) => setUrls((prev) => ({ ...prev, [r.id]: url })))
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load challenges'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!category.trim() || !session) return
    try {
      const storagePath = file ? await uploadImagingFile(session.user.id, file) : null
      const created = await addImagingChallenge({
        category: category.trim(),
        context: context || null,
        questions: questions || null,
        discussion: discussion || null,
        storagePath,
      })
      setChallenges((prev) => [...prev, created])
      if (storagePath) getImagingSignedUrl(storagePath).then((url) => setUrls((prev) => ({ ...prev, [created.id]: url })))
      setCategory('')
      setContext('')
      setQuestions('')
      setDiscussion('')
      setFile(null)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add challenge')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteImagingChallenge(id)
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
          <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} required />
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <textarea placeholder="Clinical context" value={context} onChange={(e) => setContext(e.target.value)} />
          <textarea placeholder="Questions" value={questions} onChange={(e) => setQuestions(e.target.value)} />
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
        <p className="empty-state">No imaging challenges yet.</p>
      ) : (
        <ul className="note-timeline">
          {challenges.map((c) => (
            <li key={c.id}>
              <div className="note-header">
                <strong onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  {c.category}
                </strong>
                <button className="link-button" onClick={() => void handleDelete(c.id)}>
                  Delete
                </button>
              </div>
              {openId === c.id && (
                <div>
                  {urls[c.id] && (
                    <a href={urls[c.id]} target="_blank" rel="noreferrer">
                      View image
                    </a>
                  )}
                  {c.context && <p><strong>Context:</strong> {c.context}</p>}
                  {c.questions && <p><strong>Questions:</strong> {c.questions}</p>}
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
