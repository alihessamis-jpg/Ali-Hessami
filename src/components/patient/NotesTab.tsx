import { useEffect, useState, type FormEvent } from 'react'
import { addProgressNote, deleteProgressNote, listProgressNotes } from '../../lib/api/notes'
import { upsertGrowthMeasurement } from '../../lib/api/growth'
import { updatePatient } from '../../lib/api/patients'
import { toShamsi } from '../../lib/shamsi'
import type { Patient, ProgressNote } from '../../types/domain'

interface Props {
  patientId: string
  onPatientUpdated: (patient: Patient) => void
}

const emptyDraft = {
  date: new Date().toISOString().slice(0, 10),
  weight: '',
  bp: '',
  uo: '',
  S: '',
  O: '',
  A: '',
  P: '',
}

export function NotesTab({ patientId, onPatientUpdated }: Props) {
  const [notes, setNotes] = useState<ProgressNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listProgressNotes(patientId)
      .then(setNotes)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load notes'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.date) return
    setSubmitting(true)
    setError(null)
    try {
      const note = await addProgressNote({
        patientId,
        date: draft.date,
        weight: draft.weight === '' ? null : Number(draft.weight),
        bp: draft.bp || null,
        uo: draft.uo || null,
        S: draft.S || null,
        O: draft.O || null,
        A: draft.A || null,
        P: draft.P || null,
      })
      setNotes((prev) => [note, ...prev])
      if (note.weight != null) {
        upsertGrowthMeasurement(patientId, note.date, { weightKg: note.weight }).catch(() => undefined)
        updatePatient(patientId, { weight: note.weight }).then(onPatientUpdated).catch(() => undefined)
      }
      setDraft({ ...emptyDraft, date: draft.date })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProgressNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
        <div className="field-grid">
          <label>
            Date
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value || new Date().toISOString().slice(0, 10) })}
              required
            />
          </label>
          <label>
            Weight (kg)
            <input type="number" step="any" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
          </label>
          <label>
            BP
            <input value={draft.bp} onChange={(e) => setDraft({ ...draft, bp: e.target.value })} />
          </label>
          <label>
            UO
            <input value={draft.uo} onChange={(e) => setDraft({ ...draft, uo: e.target.value })} />
          </label>
        </div>
        <label>
          S — Subjective
          <textarea value={draft.S} onChange={(e) => setDraft({ ...draft, S: e.target.value })} />
        </label>
        <label>
          O — Objective
          <textarea value={draft.O} onChange={(e) => setDraft({ ...draft, O: e.target.value })} />
        </label>
        <label>
          A — Assessment
          <textarea value={draft.A} onChange={(e) => setDraft({ ...draft, A: e.target.value })} />
        </label>
        <label>
          P — Plan
          <textarea value={draft.P} onChange={(e) => setDraft({ ...draft, P: e.target.value })} />
        </label>
        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            Add note
          </button>
        </div>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : notes.length === 0 ? (
        <p className="empty-state">No progress notes yet.</p>
      ) : (
        <ul className="note-timeline">
          {notes.map((n) => (
            <li key={n.id}>
              <div className="note-header">
                <strong>{toShamsi(n.date)}</strong>
                <span>
                  {[n.weight != null ? `${n.weight} kg` : null, n.bp, n.uo].filter(Boolean).join(' · ')}
                </span>
                <button className="link-button" onClick={() => void handleDelete(n.id)}>
                  Delete
                </button>
              </div>
              <dl className="soap-grid">
                <dt>S</dt>
                <dd>{n.S}</dd>
                <dt>O</dt>
                <dd>{n.O}</dd>
                <dt>A</dt>
                <dd>{n.A}</dd>
                <dt>P</dt>
                <dd>{n.P}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
