import { useEffect, useState, type FormEvent } from 'react'
import { addVaccination, deleteVaccination, listVaccinations } from '../../lib/api/vaccinations'
import { listMedications } from '../../lib/api/medications'
import { listLabEntries } from '../../lib/api/labs'
import { knownVaccineIsLive, STANDARD_VACCINES } from '../../lib/vaccineReference'
import { assessEculizumabChecklist } from '../../lib/eculizumabChecklist'
import { toShamsi } from '../../lib/shamsi'
import type { LabEntry, Patient, Vaccination, VaccinationDraft } from '../../types/domain'

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
  const [activeMedNames, setActiveMedNames] = useState<string[]>([])
  const [labEntries, setLabEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    Promise.all([listVaccinations(patientId), listMedications(patientId), listLabEntries(patientId)])
      .then(([v, meds, labs]) => {
        setVaccinations(v)
        setActiveMedNames(meds.filter((m) => m.active).map((m) => m.name.toLowerCase()))
        setLabEntries(labs)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load vaccinations'))
      .finally(() => setLoading(false))
  }

  const eculizumabChecklist = assessEculizumabChecklist(activeMedNames, vaccinations, labEntries)

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

      {eculizumabChecklist && (
        <div className={`aki-banner ${eculizumabChecklist.anyMissing ? 'aki-banner--warning' : ''}`}>
          <strong>{eculizumabChecklist.anyMissing ? '⚠ Pre-eculizumab checklist incomplete' : 'Pre-eculizumab checklist complete'}</strong>
          <span className="patient-meta">
            Vaccines and prophylaxis should be completed at least 2 weeks before starting eculizumab — see the HUS
            Academy topic for the vaccine valency/spacing/booster schedule.
          </span>
          <ul className="study-link-list" style={{ marginTop: 8 }}>
            <li className={eculizumabChecklist.meningococcalGiven ? undefined : 'value-abnormal'}>
              Meningococcal vaccine:{' '}
              {eculizumabChecklist.meningococcalGiven
                ? `given ${toShamsi(eculizumabChecklist.meningococcalGiven.dateGiven)} (${eculizumabChecklist.meningococcalGiven.vaccineName})`
                : 'not on record'}
            </li>
            <li className={eculizumabChecklist.pneumococcalGiven ? undefined : 'value-abnormal'}>
              Pneumococcal vaccine:{' '}
              {eculizumabChecklist.pneumococcalGiven
                ? `given ${toShamsi(eculizumabChecklist.pneumococcalGiven.dateGiven)} (${eculizumabChecklist.pneumococcalGiven.vaccineName})`
                : 'not on record'}
            </li>
            <li className={eculizumabChecklist.penicillinActive ? undefined : 'value-abnormal'}>
              Penicillin V prophylaxis: {eculizumabChecklist.penicillinActive ? 'active' : 'not on active medication list'}
            </li>
            <li className={eculizumabChecklist.ppdDone ? undefined : 'value-abnormal'}>
              PPD test: {eculizumabChecklist.ppdDone ? 'checked' : 'not checked'}
            </li>
          </ul>
        </div>
      )}
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
