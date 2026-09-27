import { useEffect, useState, type FormEvent } from 'react'
import { addStudyNote, deleteStudyNote, listStudyNotes } from '../../lib/api/studyNotes'
import { matchesSearch } from '../../lib/textFilter'
import type { StudyNote } from '../../types/domain'

export function StudyNotesPanel() {
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    listStudyNotes()
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load notes'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() && !content.trim()) return
    try {
      const note = await addStudyNote({ title: title || null, content: content || null })
      setNotes((prev) => [note, ...prev])
      setTitle('')
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteStudyNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Note content" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="form-actions">
          <button type="submit">Add note</button>
        </div>
      </form>

      <input
        placeholder="Search notes…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ margin: '12px 0', width: '100%', maxWidth: 360 }}
      />

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : notes.length === 0 ? (
        <p className="empty-state">No study notes yet.</p>
      ) : (
        <ul className="note-timeline">
          {notes.filter((n) => matchesSearch([n.title, n.content], search)).map((n) => (
            <li key={n.id}>
              <div className="note-header">
                <strong>{n.title || 'Untitled'}</strong>
                <button className="link-button" onClick={() => void handleDelete(n.id)}>
                  Delete
                </button>
              </div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
