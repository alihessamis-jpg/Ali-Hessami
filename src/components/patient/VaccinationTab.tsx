import { useEffect, useState, type FormEvent } from 'react'
import { addVaccination, deleteVaccination, listVaccinations } from '../../lib/api/vaccinations'
import { knownVaccineIsLive, STANDARD_VACCINES } from '../../lib/vaccineReference'
import { toShamsi } from '../../lib/shamsi'
import type { Patient, Vaccination, VaccinationDraft } from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyDraft = {
  vaccineName: '',
  isLive: false,
  doseNumber: '',
  dateGiven: today(),
  notes: '',
}

export function VaccinationTab({ patientId, patient }: Props) {
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listVaccinations(patientId)
      .then(setVaccinations)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load vaccinations'))
      .finally(() => setLoading(false))
  }

  function handleNameChange(name: string) {
    const known = knownVaccineIsLive(name)
    setDraft((prev) => ({ ...prev, vaccineName: name, isLive: known != null ? known : prev.isLive }))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.vaccineName.trim()) return
    try {
      const payload: VaccinationDraft = {
        patientId,
        vaccineName: draft.vaccineName.trim(),
        isLive: draft.isLive,
        doseNumber: draft.doseNumber || null,
        dateGiven: draft.dateGiven,
        notes: draft.notes || null,
      }
      const created = await addVaccination(payload)
      setVaccinations((prev) => [created, ...prev])
      setDraft({ ...emptyDraft, dateGiven: draft.dateGiven })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vaccination')
    }
  }

  const liveVaccinesGiven = vaccinations.filter((v) => v.isLive)

  if (loading) return <p>Loading…</p>

  return (
    <div>
      {error && <p className="form-error">{error}</p>}

      {patient.transplantStatus && liveVaccinesGiven.length > 0 && (
        <div className="aki-banner aki-banner--warning">
          Live vaccine(s) on record ({liveVaccinesGiven.map((v) => v.vaccineName).join(', ')}) — this patient's
          transplant status is "{patient.transplantStatus}". Live vaccines must be completed before transplant and
          are generally contraindicated afterward on immunosuppression; verify timing.
        </div>
      )}

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Vaccination log</h2>
        </div>
        <p className="patient-meta">
          Pick a vaccine from the list or type a custom name. Live vaccines are flagged automatically for known
          vaccines — double-check the box for anything unlisted.
        </p>
        <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
          <div className="field-grid">
            <label>
              Vaccine
              <input
                list="vaccine-name-options"
                value={draft.vaccineName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. MMR"
                required
              />
              <datalist id="vaccine-name-options">
                {STANDARD_VACCINES.map((v) => (
                  <option key={v.name} value={v.name} />
                ))}
              </datalist>
            </label>
            <label>
              Dose number
              <input
                value={draft.doseNumber}
                onChange={(e) => setDraft({ ...draft, doseNumber: e.target.value })}
                placeholder="e.g. 1st, 2nd, booster"
              />
            </label>
            <label>
              Date given
              <input
                type="date"
                value={draft.dateGiven}
                onChange={(e) => setDraft({ ...draft, dateGiven: e.target.value || today() })}
                required
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={draft.isLive} onChange={(e) => setDraft({ ...draft, isLive: e.target.checked })} />
              Live vaccine
            </label>
          </div>
          <label>
            Notes
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Add vaccination</button>
          </div>
        </form>

        {vaccinations.length === 0 ? (
          <p className="empty-state">No vaccinations logged yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vaccine</th>
                <th>Dose</th>
                <th>Live?</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vaccinations.map((v) => (
                <tr key={v.id} className={v.isLive && patient.transplantStatus ? 'row-abnormal' : undefined}>
                  <td>{toShamsi(v.dateGiven)}</td>
                  <td>{v.vaccineName}</td>
                  <td>{v.doseNumber || '—'}</td>
                  <td>{v.isLive ? 'Live' : 'Inactivated'}</td>
                  <td>{v.notes}</td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() => void deleteVaccination(v.id).then(() => setVaccinations((prev) => prev.filter((x) => x.id !== v.id)))}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
