import { useEffect, useState, type FormEvent } from 'react'
import {
  addDialysisReference,
  deleteDialysisReference,
  listDialysisReference,
} from '../lib/api/dialysisReference'
import { addDrugReference, deleteDrugReference, listDrugReference } from '../lib/api/drugReference'
import { ReferenceIcon } from '../components/icons'
import type { DialysisRefEntry, DrugRefEntry } from '../types/domain'

type Tab = 'drug' | 'dialysis'

const emptyDrugDraft = {
  medication: '',
  indication: '',
  normalDose: '',
  pediatricDose: '',
  maxDose: '',
  egfrRange: '',
  adjustedDose: '',
  frequency: '',
  notes: '',
}

const emptyDialysisDraft = {
  medication: '',
  indication: '',
  pediatricDose: '',
  route: '',
  frequency: '',
  maxDose: '',
  notes: '',
}

export function ReferencePage() {
  const [tab, setTab] = useState<Tab>('drug')
  const [search, setSearch] = useState('')

  const [drugs, setDrugs] = useState<DrugRefEntry[]>([])
  const [dialysis, setDialysis] = useState<DialysisRefEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drugDraft, setDrugDraft] = useState(emptyDrugDraft)
  const [dialysisDraft, setDialysisDraft] = useState(emptyDialysisDraft)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([listDrugReference(), listDialysisReference()])
      .then(([d, dial]) => {
        setDrugs(d)
        setDialysis(dial)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reference data'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAddDrug(e: FormEvent) {
    e.preventDefault()
    if (!drugDraft.medication.trim()) return
    try {
      const entry = await addDrugReference({
        medication: drugDraft.medication.trim(),
        indication: drugDraft.indication || null,
        normalDose: drugDraft.normalDose || null,
        pediatricDose: drugDraft.pediatricDose || null,
        doseKg: null,
        maxDose: drugDraft.maxDose || null,
        egfrRange: drugDraft.egfrRange || null,
        adjustedDose: drugDraft.adjustedDose || null,
        frequency: drugDraft.frequency || null,
        notes: drugDraft.notes || null,
      })
      setDrugs((prev) => [...prev, entry].sort((a, b) => a.medication.localeCompare(b.medication)))
      setDrugDraft(emptyDrugDraft)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    }
  }

  async function handleAddDialysis(e: FormEvent) {
    e.preventDefault()
    if (!dialysisDraft.medication.trim()) return
    try {
      const entry = await addDialysisReference({
        medication: dialysisDraft.medication.trim(),
        indication: dialysisDraft.indication || null,
        pediatricDose: dialysisDraft.pediatricDose || null,
        route: dialysisDraft.route || null,
        frequency: dialysisDraft.frequency || null,
        maxDose: dialysisDraft.maxDose || null,
        notes: dialysisDraft.notes || null,
      })
      setDialysis((prev) => [...prev, entry].sort((a, b) => a.medication.localeCompare(b.medication)))
      setDialysisDraft(emptyDialysisDraft)
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    }
  }

  const filteredDrugs = drugs.filter((d) => d.medication.toLowerCase().includes(search.toLowerCase()))
  const filteredDialysis = dialysis.filter((d) => d.medication.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <ReferenceIcon />
          </span>
          Reference
        </h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'Add entry'}</button>
      </div>

      <p className="empty-state">
        This is your own personal reference list — nothing is pre-seeded. Add entries you've verified
        yourself; each clinician's list is private to them.
      </p>

      <nav className="tab-bar">
        <button className={tab === 'drug' ? 'tab active' : 'tab'} onClick={() => setTab('drug')}>
          Drug dosing
        </button>
        <button className={tab === 'dialysis' ? 'tab active' : 'tab'} onClick={() => setTab('dialysis')}>
          Dialysis medications
        </button>
      </nav>

      <input
        placeholder="Search medication…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, width: '100%', maxWidth: 320 }}
      />

      {showForm && tab === 'drug' && (
        <form className="soap-form" onSubmit={(e) => void handleAddDrug(e)}>
          <div className="field-grid">
            <label>
              Medication
              <input value={drugDraft.medication} onChange={(e) => setDrugDraft({ ...drugDraft, medication: e.target.value })} required />
            </label>
            <label>
              Indication
              <input value={drugDraft.indication} onChange={(e) => setDrugDraft({ ...drugDraft, indication: e.target.value })} />
            </label>
            <label>
              Normal dose
              <input value={drugDraft.normalDose} onChange={(e) => setDrugDraft({ ...drugDraft, normalDose: e.target.value })} />
            </label>
            <label>
              Pediatric dose
              <input value={drugDraft.pediatricDose} onChange={(e) => setDrugDraft({ ...drugDraft, pediatricDose: e.target.value })} />
            </label>
            <label>
              Max dose
              <input value={drugDraft.maxDose} onChange={(e) => setDrugDraft({ ...drugDraft, maxDose: e.target.value })} />
            </label>
            <label>
              eGFR range
              <input value={drugDraft.egfrRange} onChange={(e) => setDrugDraft({ ...drugDraft, egfrRange: e.target.value })} />
            </label>
            <label>
              Adjusted dose
              <input value={drugDraft.adjustedDose} onChange={(e) => setDrugDraft({ ...drugDraft, adjustedDose: e.target.value })} />
            </label>
            <label>
              Frequency
              <input value={drugDraft.frequency} onChange={(e) => setDrugDraft({ ...drugDraft, frequency: e.target.value })} />
            </label>
          </div>
          <label>
            Notes
            <textarea value={drugDraft.notes} onChange={(e) => setDrugDraft({ ...drugDraft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {showForm && tab === 'dialysis' && (
        <form className="soap-form" onSubmit={(e) => void handleAddDialysis(e)}>
          <div className="field-grid">
            <label>
              Medication
              <input value={dialysisDraft.medication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, medication: e.target.value })} required />
            </label>
            <label>
              Indication
              <input value={dialysisDraft.indication} onChange={(e) => setDialysisDraft({ ...dialysisDraft, indication: e.target.value })} />
            </label>
            <label>
              Pediatric dose
              <input value={dialysisDraft.pediatricDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, pediatricDose: e.target.value })} />
            </label>
            <label>
              Route
              <input value={dialysisDraft.route} onChange={(e) => setDialysisDraft({ ...dialysisDraft, route: e.target.value })} />
            </label>
            <label>
              Frequency
              <input value={dialysisDraft.frequency} onChange={(e) => setDialysisDraft({ ...dialysisDraft, frequency: e.target.value })} />
            </label>
            <label>
              Max dose
              <input value={dialysisDraft.maxDose} onChange={(e) => setDialysisDraft({ ...dialysisDraft, maxDose: e.target.value })} />
            </label>
          </div>
          <label>
            Notes
            <textarea value={dialysisDraft.notes} onChange={(e) => setDialysisDraft({ ...dialysisDraft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Save</button>
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : tab === 'drug' ? (
        filteredDrugs.length === 0 ? (
          <p className="empty-state">No drug reference entries yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Medication</th>
                <th>Indication</th>
                <th>Normal dose</th>
                <th>Pediatric dose</th>
                <th>eGFR range</th>
                <th>Adjusted dose</th>
                <th>Max dose</th>
                <th>Frequency</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDrugs.map((d) => (
                <tr key={d.id}>
                  <td>{d.medication}</td>
                  <td>{d.indication}</td>
                  <td>{d.normalDose}</td>
                  <td>{d.pediatricDose}</td>
                  <td>{d.egfrRange}</td>
                  <td>{d.adjustedDose}</td>
                  <td>{d.maxDose}</td>
                  <td>{d.frequency}</td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() =>
                        void deleteDrugReference(d.id).then(() => setDrugs((prev) => prev.filter((x) => x.id !== d.id)))
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : filteredDialysis.length === 0 ? (
        <p className="empty-state">No dialysis reference entries yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Medication</th>
              <th>Indication</th>
              <th>Pediatric dose</th>
              <th>Route</th>
              <th>Frequency</th>
              <th>Max dose</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredDialysis.map((d) => (
              <tr key={d.id}>
                <td>{d.medication}</td>
                <td>{d.indication}</td>
                <td>{d.pediatricDose}</td>
                <td>{d.route}</td>
                <td>{d.frequency}</td>
                <td>{d.maxDose}</td>
                <td>
                  <button
                    className="link-button"
                    onClick={() =>
                      void deleteDialysisReference(d.id).then(() =>
                        setDialysis((prev) => prev.filter((x) => x.id !== d.id))
                      )
                    }
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
  )
}
