import { useEffect, useState, type FormEvent } from 'react'
import { addMedication, deleteMedication, listMedications, updateMedication } from '../../lib/api/medications'
import type { Medication } from '../../types/domain'

interface Props {
  patientId: string
}

const emptyDraft = { name: '', dose: '', route: '', freq: '', indication: '', renalAdj: '', notes: '' }

export function MedicationsTab({ patientId }: Props) {
  const [meds, setMeds] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listMedications(patientId)
      .then(setMeds)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load medications'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const med = await addMedication({
        patientId,
        name: draft.name.trim(),
        dose: draft.dose || null,
        doseKg: null,
        route: draft.route || null,
        freq: draft.freq || null,
        start: new Date().toISOString().slice(0, 10),
        stop: null,
        indication: draft.indication || null,
        renalAdj: draft.renalAdj || null,
        notes: draft.notes || null,
        active: true,
      })
      setMeds((prev) => [med, ...prev])
      setDraft(emptyDraft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add medication')
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleActive(med: Medication) {
    try {
      const updated = await updateMedication(med.id, {
        active: !med.active,
        stop: med.active ? new Date().toISOString().slice(0, 10) : null,
      })
      setMeds((prev) => prev.map((m) => (m.id === med.id ? updated : m)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMedication(id)
      setMeds((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input placeholder="Medication" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
        <input placeholder="Dose" value={draft.dose} onChange={(e) => setDraft({ ...draft, dose: e.target.value })} />
        <input placeholder="Route" value={draft.route} onChange={(e) => setDraft({ ...draft, route: e.target.value })} />
        <input placeholder="Frequency" value={draft.freq} onChange={(e) => setDraft({ ...draft, freq: e.target.value })} />
        <input placeholder="Indication" value={draft.indication} onChange={(e) => setDraft({ ...draft, indication: e.target.value })} />
        <input placeholder="Renal adjustment" value={draft.renalAdj} onChange={(e) => setDraft({ ...draft, renalAdj: e.target.value })} />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : meds.length === 0 ? (
        <p className="empty-state">No medications recorded yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose</th>
              <th>Route</th>
              <th>Freq</th>
              <th>Indication</th>
              <th>Renal adj.</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {meds.map((m) => (
              <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                <td>{m.name}</td>
                <td>{m.dose}</td>
                <td>{m.route}</td>
                <td>{m.freq}</td>
                <td>{m.indication}</td>
                <td>{m.renalAdj}</td>
                <td>
                  <button className="link-button" onClick={() => void toggleActive(m)}>
                    {m.active ? 'Active' : 'Stopped'}
                  </button>
                </td>
                <td>
                  <button className="link-button" onClick={() => void handleDelete(m.id)}>
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
