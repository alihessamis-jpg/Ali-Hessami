import { useEffect, useState, type FormEvent } from 'react'
import {
  addNephroticEvent,
  deleteNephroticEvent,
  listNephroticEvents,
} from '../../lib/api/nephroticEvents'
import {
  classifyNephroticSyndrome,
  isPreSteroidNewDiagnosis,
  NEPHROTIC_CLASSIFICATION_LABEL,
} from '../../lib/nephroticSyndrome'
import { toShamsi } from '../../lib/shamsi'
import type { NephroticEvent, NephroticEventType } from '../../types/domain'

interface Props {
  patientId: string
}

const EVENT_TYPE_LABELS: Record<NephroticEventType, string> = {
  diagnosis: 'New diagnosis',
  relapse: 'Relapse',
  remission: 'Remission',
  no_response_4wk: 'No response after 4wk steroids',
}

const COMPLICATIONS_WATCH = [
  'Infection — peritonitis, cellulitis, sepsis (immunoglobulin loss)',
  'Thromboembolism — hypercoagulable state (antithrombin III loss)',
  'Acute kidney injury — intravascular volume depletion',
  'Hypovolemia — despite edema, intravascular volume can be low',
  'Hyperlipidemia',
]

function emptyDraft() {
  return {
    date: new Date().toISOString().slice(0, 10),
    eventType: 'diagnosis' as NephroticEventType,
    duringTaper: false,
    notes: '',
  }
}

export function NephroticSyndromeTab({ patientId }: Props) {
  const [events, setEvents] = useState<NephroticEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listNephroticEvents(patientId)
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load events'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const event = await addNephroticEvent({
        patientId,
        date: draft.date,
        eventType: draft.eventType,
        duringTaper: draft.eventType === 'relapse' ? draft.duringTaper : false,
        notes: draft.notes || null,
      })
      setEvents((prev) => [event, ...prev])
      setDraft({ ...emptyDraft(), date: draft.date })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add event')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNephroticEvent(id)
      setEvents((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const classification = classifyNephroticSyndrome(events)
  const preSteroid = isPreSteroidNewDiagnosis(events)

  return (
    <div>
      <p className="empty-state">
        Log the nephrotic syndrome course (diagnosis, relapses, remissions) to get the steroid-response
        category and relevant reminders — this is a reference aid, not a substitute for clinical judgement.
      </p>

      {preSteroid && (
        <div className="aki-banner aki-banner--warning">
          <strong>New nephrotic syndrome — before starting steroids</strong>
          <span className="patient-meta">
            Get a CXR (screen for TB / mediastinal widening) and a PPD (tuberculin skin test) before starting
            corticosteroids.
          </span>
        </div>
      )}

      {events.length > 0 && (
        <div className={`aki-banner ${classification !== 'sensitive' && classification !== 'insufficient-data' ? 'aki-banner--warning' : ''}`}>
          <strong>Nephrotic syndrome: {NEPHROTIC_CLASSIFICATION_LABEL[classification]}</strong>
          <span className="patient-meta">Based on {events.length} logged event{events.length === 1 ? '' : 's'}</span>
        </div>
      )}

      {events.length > 0 && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Complications to watch for</h2>
          </div>
          <ul className="study-link-list">
            {COMPLICATIONS_WATCH.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
        <select
          value={draft.eventType}
          onChange={(e) => setDraft({ ...draft, eventType: e.target.value as NephroticEventType })}
        >
          {(Object.keys(EVENT_TYPE_LABELS) as NephroticEventType[]).map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {draft.eventType === 'relapse' && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.duringTaper}
              onChange={(e) => setDraft({ ...draft, duringTaper: e.target.checked })}
            />
            During steroid taper / within 2wk of stopping
          </label>
        )}
        <input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : events.length === 0 ? (
        <p className="empty-state">No events logged yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>During taper</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{toShamsi(e.date)}</td>
                <td>{EVENT_TYPE_LABELS[e.eventType]}</td>
                <td>{e.eventType === 'relapse' && e.duringTaper ? 'Yes' : ''}</td>
                <td>{e.notes}</td>
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
