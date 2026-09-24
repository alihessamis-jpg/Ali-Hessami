import { useEffect, useState, type FormEvent } from 'react'
import {
  addFollowUpItem,
  deleteFollowUpItem,
  listFollowUpItems,
  setFollowUpResolved,
} from '../../lib/api/followUps'
import { listImagingEntries } from '../../lib/api/imaging'
import { daysSince } from '../../lib/dates'
import { toShamsi } from '../../lib/shamsi'
import type { FollowUpCategory, FollowUpItem, ImagingEntry } from '../../types/domain'

interface Props {
  patientId: string
}

export const CATEGORY_LABELS: Record<FollowUpCategory, string> = {
  culture: 'Culture',
  imaging: 'Imaging (CT/MRI/US)',
  document: 'Document (e.g. operative note)',
  specialized_lab: 'Specialized lab (C3, C4, ANA, dsDNA, etc.)',
  other: 'Other',
}

export const CULTURE_FOLLOW_UP_DAYS = 2

const emptyDraft = {
  category: 'culture' as FollowUpCategory,
  description: '',
  orderedDate: new Date().toISOString().slice(0, 10),
  notes: '',
}

export function FollowUpTab({ patientId }: Props) {
  const [items, setItems] = useState<FollowUpItem[]>([])
  const [imagingEntries, setImagingEntries] = useState<ImagingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [showResolved, setShowResolved] = useState(false)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listFollowUpItems(patientId)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load follow-up items'))
      .finally(() => setLoading(false))
    listImagingEntries(patientId)
      .then(setImagingEntries)
      .catch(() => undefined)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.description.trim()) return
    try {
      const item = await addFollowUpItem({
        patientId,
        category: draft.category,
        description: draft.description.trim(),
        orderedDate: draft.orderedDate,
        resolved: false,
        resolvedDate: null,
        notes: draft.notes || null,
      })
      setItems((prev) => [item, ...prev])
      setDraft({ ...emptyDraft, orderedDate: draft.orderedDate })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add follow-up item')
    }
  }

  async function handleResolve(item: FollowUpItem) {
    try {
      await setFollowUpResolved(item.id, !item.resolved)
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteFollowUpItem(id)
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const pending = items.filter((i) => !i.resolved).sort((a, b) => a.orderedDate.localeCompare(b.orderedDate))
  const resolved = items.filter((i) => i.resolved).sort((a, b) => b.orderedDate.localeCompare(a.orderedDate))
  const unreportedImaging = imagingEntries.filter((e) => !e.report && !e.impression)

  return (
    <div>
      <p className="empty-state">
        Track orders sent out that haven't come back yet — cultures, specialized serologies, operative notes,
        imaging. Cultures are flagged once {CULTURE_FOLLOW_UP_DAYS} days have passed since they were sent.
      </p>

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as FollowUpCategory })}>
          {(Object.keys(CATEGORY_LABELS) as FollowUpCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <input
          placeholder="Description (e.g. Blood culture, C3/C4/ANA/dsDNA, Operative note)"
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          required
        />
        <input
          type="date"
          value={draft.orderedDate}
          onChange={(e) => setDraft({ ...draft, orderedDate: e.target.value || new Date().toISOString().slice(0, 10) })}
          required
        />
        <input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        <button type="submit">Add</button>
      </form>

      {error && <p className="form-error">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : pending.length === 0 ? (
        <p className="empty-state">No pending follow-ups.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Description</th>
              <th>Ordered</th>
              <th>Status</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((item) => {
              const days = daysSince(item.orderedDate)
              const overdueCulture = item.category === 'culture' && days >= CULTURE_FOLLOW_UP_DAYS
              return (
                <tr key={item.id} className={overdueCulture ? 'row-abnormal' : ''}>
                  <td>{CATEGORY_LABELS[item.category]}</td>
                  <td>{item.description}</td>
                  <td>{toShamsi(item.orderedDate)}</td>
                  <td className={overdueCulture ? 'value-abnormal' : undefined}>
                    {overdueCulture
                      ? `⚠ Follow up — sent ${days} day${days === 1 ? '' : 's'} ago`
                      : `Sent ${days} day${days === 1 ? '' : 's'} ago`}
                  </td>
                  <td>{item.notes}</td>
                  <td>
                    <button className="link-button" onClick={() => void handleResolve(item)}>
                      Mark resolved
                    </button>
                    <button className="link-button" onClick={() => void handleDelete(item.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {unreportedImaging.length > 0 && (
        <div className="dash-card" style={{ marginTop: 16 }}>
          <div className="dash-card-header">
            <h2 className="dash-card-title">Imaging awaiting report</h2>
          </div>
          <p className="patient-meta">Auto-detected from the Imaging tab — no report or impression entered yet.</p>
          <ul className="study-link-list">
            {unreportedImaging.map((e) => (
              <li key={e.id} className="value-abnormal">
                {e.category || 'Imaging'} ({toShamsi(e.date ?? '')}) — not yet reported
              </li>
            ))}
          </ul>
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="link-button" onClick={() => setShowResolved((v) => !v)}>
            {showResolved ? 'Hide' : 'Show'} resolved ({resolved.length})
          </button>
          {showResolved && (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Ordered</th>
                  <th>Resolved</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((item) => (
                  <tr key={item.id} style={{ opacity: 0.6 }}>
                    <td>{CATEGORY_LABELS[item.category]}</td>
                    <td>{item.description}</td>
                    <td>{toShamsi(item.orderedDate)}</td>
                    <td>{item.resolvedDate ? toShamsi(item.resolvedDate) : '—'}</td>
                    <td>
                      <button className="link-button" onClick={() => void handleResolve(item)}>
                        Reopen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
