import { useEffect, useState, type FormEvent } from 'react'
import {
  addUrineOutputEntry,
  deleteUrineOutputEntry,
  listUrineOutputEntries,
} from '../../lib/api/urineOutput'
import { listRemindersForPatient } from '../../lib/api/reminders'
import { hasObstructiveUropathy } from '../../lib/clinicalFlags'
import { OLIGURIA_THRESHOLD_ML_KG_HR, POLYURIA_THRESHOLD_ML_KG_HR, urineOutputRate } from '../../lib/formulas'
import { toShamsi } from '../../lib/shamsi'
import type { Patient, UrineOutputEntry } from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
}

function nowForDatetimeLocal(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function emptyDraft() {
  return { recordedAt: nowForDatetimeLocal(), volumeMl: '', durationHours: '1', notes: '' }
}

export function UrineOutputTab({ patientId, patient }: Props) {
  const [entries, setEntries] = useState<UrineOutputEntry[]>([])
  const [recentSurgery, setRecentSurgery] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    Promise.all([listUrineOutputEntries(patientId), listRemindersForPatient(patientId)])
      .then(([entryRows, reminders]) => {
        setEntries(entryRows)
        const today = new Date().toISOString().slice(0, 10)
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        setRecentSurgery(
          reminders.some((r) => r.type === 'surgery' && r.eventDate <= today && r.eventDate >= sevenDaysAgo)
        )
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load urine output'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.recordedAt || draft.volumeMl === '') return
    setSubmitting(true)
    setError(null)
    try {
      const entry = await addUrineOutputEntry({
        patientId,
        recordedAt: new Date(draft.recordedAt).toISOString(),
        volumeMl: Number(draft.volumeMl),
        durationHours: draft.durationHours === '' ? 1 : Number(draft.durationHours),
        notes: draft.notes || null,
      })
      setEntries((prev) => [entry, ...prev])
      setDraft(emptyDraft())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteUrineOutputEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const showObstructiveWatch = hasObstructiveUropathy(patient) && recentSurgery

  return (
    <div>
      {showObstructiveWatch && (
        <div className="aki-banner aki-banner--warning">
          <strong>Post-obstructive diuresis watch</strong>
          <span className="patient-meta">
            Obstructive uropathy with recent surgery — watch urine output closely. If polyuria develops
            (&gt;{POLYURIA_THRESHOLD_ML_KG_HR} mL/kg/hr), switch IV fluids to replacement instead of standard
            maintenance.
          </span>
        </div>
      )}

      {!patient.weight && (
        <p className="empty-state">Add the patient's weight in Assessment to see rates in mL/kg/hr.</p>
      )}

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input
          type="datetime-local"
          value={draft.recordedAt}
          onChange={(e) => setDraft({ ...draft, recordedAt: e.target.value })}
          required
        />
        <input
          placeholder="Volume (mL)"
          type="number"
          step="any"
          value={draft.volumeMl}
          onChange={(e) => setDraft({ ...draft, volumeMl: e.target.value })}
          required
        />
        <input
          placeholder="Duration (hours)"
          type="number"
          step="any"
          value={draft.durationHours}
          onChange={(e) => setDraft({ ...draft, durationHours: e.target.value })}
        />
        <input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No urine output recorded yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Volume (mL)</th>
              <th>Duration (hr)</th>
              <th>Rate (mL/kg/hr)</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const rate = patient.weight ? urineOutputRate(e.volumeMl, e.durationHours, patient.weight) : null
              const abnormal = rate != null && (rate < OLIGURIA_THRESHOLD_ML_KG_HR || rate > POLYURIA_THRESHOLD_ML_KG_HR)
              return (
                <tr key={e.id} className={abnormal ? 'row-abnormal' : ''}>
                  <td>
                    {toShamsi(e.recordedAt)}{' '}
                    {new Date(e.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>{e.volumeMl}</td>
                  <td>{e.durationHours}</td>
                  <td className={abnormal ? 'value-abnormal' : ''}>
                    {rate != null
                      ? `${rate.toFixed(2)}${rate < OLIGURIA_THRESHOLD_ML_KG_HR ? ' — oliguria' : rate > POLYURIA_THRESHOLD_ML_KG_HR ? ' — polyuria' : ''}`
                      : '—'}
                  </td>
                  <td>{e.notes}</td>
                  <td>
                    <button className="link-button" onClick={() => void handleDelete(e.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
