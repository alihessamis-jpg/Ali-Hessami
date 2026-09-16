import { useEffect, useState, type FormEvent } from 'react'
import { addLabEntry, deleteLabEntry, listLabEntries } from '../../lib/api/labs'
import { COMMON_LAB_TESTS, LAB_CATEGORIES } from '../../lib/labPresets'
import type { LabEntry } from '../../types/domain'

interface Props {
  patientId: string
}

const emptyDraft = { date: new Date().toISOString().slice(0, 10), category: '', test: '', value: '', unit: '', ref: '', comment: '' }

export function LabsTab({ patientId }: Props) {
  const [entries, setEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listLabEntries(patientId)
      .then((rows) => setEntries(rows.slice().reverse()))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load labs'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.test.trim() || !draft.date) return
    setSubmitting(true)
    setError(null)
    try {
      const entry = await addLabEntry({
        patientId,
        date: draft.date,
        category: draft.category || null,
        test: draft.test.trim(),
        value: draft.value === '' ? null : Number(draft.value),
        unit: draft.unit || null,
        ref: draft.ref || null,
        comment: draft.comment || null,
      })
      setEntries((prev) => [entry, ...prev])
      setDraft({ ...emptyDraft, date: draft.date })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add lab entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLabEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <datalist id="lab-category-options">
        {LAB_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <datalist id="lab-test-options">
        {COMMON_LAB_TESTS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        <input
          placeholder="Category"
          list="lab-category-options"
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        />
        <input
          placeholder="Test"
          list="lab-test-options"
          value={draft.test}
          onChange={(e) => setDraft({ ...draft, test: e.target.value })}
          required
        />
        <input placeholder="Value" type="number" step="any" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
        <input placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        <input placeholder="Reference range" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} />
        <input placeholder="Comment" value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No labs recorded yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Test</th>
              <th>Value</th>
              <th>Unit</th>
              <th>Ref range</th>
              <th>Comment</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{e.date}</td>
                <td>{e.category}</td>
                <td>{e.test}</td>
                <td>{e.value ?? ''}</td>
                <td>{e.unit}</td>
                <td>{e.ref}</td>
                <td>{e.comment}</td>
                <td>
                  <button className="link-button" onClick={() => void handleDelete(e.id)}>
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
