import { useEffect, useState, type FormEvent } from 'react'
import {
  addImagingChallenge,
  deleteImagingChallenge,
  listImagingChallenges,
  updateImagingChallenge,
} from '../../lib/api/imagingChallenges'
import { addReadingItemFromQuestion } from '../../lib/api/readingItems'
import { getImagingSignedUrl, uploadImagingFile } from '../../lib/storage'
import { useAuth } from '../../context/AuthContext'
import { matchesSearch } from '../../lib/textFilter'
import type { ImagingChallenge } from '../../types/domain'

function buildReadingItemFromChallenge(c: ImagingChallenge): { title: string; answer: string } {
  const title = [c.category, c.context, c.questions].filter(Boolean).join('\n\n')
  return { title, answer: c.discussion ?? '' }
}

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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [existingStoragePath, setExistingStoragePath] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savedToReview, setSavedToReview] = useState<Record<string, boolean>>({})

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

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!category.trim() || !session) return
    try {
      const storagePath = file ? await uploadImagingFile(session.user.id, file) : existingStoragePath
      const payload = {
        category: category.trim(),
        context: context || null,
        questions: questions || null,
        discussion: discussion || null,
        storagePath,
      }
      let saved: ImagingChallenge
      if (editingId) {
        saved = await updateImagingChallenge(editingId, payload)
        setChallenges((prev) => prev.map((c) => (c.id === editingId ? saved : c)))
      } else {
        saved = await addImagingChallenge(payload)
        setChallenges((prev) => [...prev, saved])
      }
      if (storagePath) getImagingSignedUrl(storagePath).then((url) => setUrls((prev) => ({ ...prev, [saved.id]: url })))
      setCategory('')
      setContext('')
      setQuestions('')
      setDiscussion('')
      setFile(null)
      setEditingId(null)
      setExistingStoragePath(null)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save challenge')
    }
  }

  function handleEdit(c: ImagingChallenge) {
    setCategory(c.category ?? '')
    setContext(c.context ?? '')
    setQuestions(c.questions ?? '')
    setDiscussion(c.discussion ?? '')
    setFile(null)
    setExistingStoragePath(c.storagePath ?? null)
    setEditingId(c.id)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    try {
      await deleteImagingChallenge(id)
      setChallenges((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  async function handleSaveToReadingReview(c: ImagingChallenge) {
    try {
      const { title, answer } = buildReadingItemFromChallenge(c)
      await addReadingItemFromQuestion({ title, answer, origin: 'Imaging Challenges' })
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
              setCategory('')
              setContext('')
              setQuestions('')
              setDiscussion('')
              setFile(null)
              setEditingId(null)
              setExistingStoragePath(null)
            }
            setShowForm((v) => !v)
          }}
        >
          {showForm ? 'Cancel' : 'New challenge'}
        </button>
      </div>

      {showForm && (
        <form className="soap-form" onSubmit={(e) => void handleSave(e)}>
          <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} required />
          {editingId && existingStoragePath && !file && (
            <p className="patient-meta">An image is already attached — choose a file only to replace it.</p>
          )}
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <textarea placeholder="Clinical context" value={context} onChange={(e) => setContext(e.target.value)} />
          <textarea placeholder="Questions" value={questions} onChange={(e) => setQuestions(e.target.value)} />
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
        <p className="empty-state">No imaging challenges yet.</p>
      ) : (
        <ul className="note-timeline">
          {challenges
            .filter((c) => matchesSearch([c.category, c.context, c.questions, c.discussion], search))
            .map((c) => (
            <li key={c.id}>
              <div className="note-header">
                <strong onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  {c.category}
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
                  {urls[c.id] && (
                    <a href={urls[c.id]} target="_blank" rel="noreferrer">
                      View image
                    </a>
                  )}
                  {c.context && <p><strong>Context:</strong> {c.context}</p>}
                  {c.questions && <p><strong>Questions:</strong> {c.questions}</p>}
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
