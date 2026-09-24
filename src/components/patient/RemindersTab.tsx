import { useEffect, useState, type FormEvent } from 'react'
import { addReminder, deleteReminder, listRemindersForPatient, setReminderDone } from '../../lib/api/reminders'
import { toShamsi } from '../../lib/shamsi'
import type { PatientReminder, ReminderType } from '../../types/domain'

interface Props {
  patientId: string
}

const TYPE_LABELS: Record<ReminderType, string> = {
  follow_up: 'Follow-up',
  surgery: 'Surgery date',
  custom: 'Custom',
}

const emptyDraft = { type: 'follow_up' as ReminderType, title: '', note: '', eventDate: new Date().toISOString().slice(0, 10) }

export function RemindersTab({ patientId }: Props) {
  const [reminders, setReminders] = useState<PatientReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listRemindersForPatient(patientId)
      .then(setReminders)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reminders'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) return
    try {
      const reminder = await addReminder({
        patientId,
        type: draft.type,
        title: draft.title.trim(),
        note: draft.note || null,
        eventDate: draft.eventDate,
        done: false,
      })
      setReminders((prev) => [...prev, reminder].sort((a, b) => a.eventDate.localeCompare(b.eventDate)))
      setDraft({ ...emptyDraft, eventDate: draft.eventDate })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add reminder')
    }
  }

  async function toggleDone(reminder: PatientReminder) {
    try {
      await setReminderDone(reminder.id, !reminder.done)
      setReminders((prev) => prev.map((r) => (r.id === reminder.id ? { ...r, done: !r.done } : r)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteReminder(id)
      setReminders((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <p className="empty-state">
        For "Surgery date", set the actual OT date — the Dashboard will remind you the day before
        so pre-op labs/coordination happen on time. For "Follow-up"/"Custom", the date is when the
        task itself is due.
      </p>
      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ReminderType })}>
          <option value="follow_up">Follow-up</option>
          <option value="surgery">Surgery date</option>
          <option value="custom">Custom</option>
        </select>
        <input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
        <input
          type="date"
          value={draft.eventDate}
          onChange={(e) => setDraft({ ...draft, eventDate: e.target.value || new Date().toISOString().slice(0, 10) })}
          required
        />
        <input placeholder="Note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        <button type="submit">Add</button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : reminders.length === 0 ? (
        <p className="empty-state">No reminders yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Title</th>
              <th>Date</th>
              <th>Note</th>
              <th>Done</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reminders.map((r) => (
              <tr key={r.id} style={{ opacity: r.done ? 0.5 : 1 }}>
                <td>{TYPE_LABELS[r.type]}</td>
                <td>{r.title}</td>
                <td>{toShamsi(r.eventDate)}</td>
                <td>{r.note}</td>
                <td>
                  <input type="checkbox" checked={r.done} onChange={() => void toggleDone(r)} />
                </td>
                <td>
                  <button className="link-button" onClick={() => void handleDelete(r.id)}>
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
