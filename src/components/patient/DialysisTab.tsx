import { useEffect, useState, type FormEvent } from 'react'
import { addHdSession, deleteHdSession, listHdSessions } from '../../lib/api/hdSessions'
import { addPdPrescription, deletePdPrescription, listPdPrescriptions } from '../../lib/api/pdPrescriptions'
import {
  addPdPeritonitisEpisode,
  deletePdPeritonitisEpisode,
  listPdPeritonitisEpisodes,
} from '../../lib/api/pdPeritonitis'
import { listLabEntries } from '../../lib/api/labs'
import { classifyPetTransporter, PET_TRANSPORTER_NOTE } from '../../lib/dialysisAdequacy'
import { toShamsi } from '../../lib/shamsi'
import type {
  HdSession,
  HdSessionDraft,
  LabEntry,
  PdModality,
  PdPeritonitisEpisode,
  PdPeritonitisEpisodeDraft,
  PdPrescription,
  PdPrescriptionDraft,
  PeritonitisOutcome,
} from '../../types/domain'

interface Props {
  patientId: string
}

const OUTCOME_LABELS: Record<PeritonitisOutcome, string> = {
  resolved: 'Resolved',
  catheter_removed: 'Catheter removed',
  relapse: 'Relapse',
  ongoing: 'Ongoing',
}

const today = () => new Date().toISOString().slice(0, 10)

const emptyHdDraft = {
  date: today(),
  preWeightKg: '',
  postWeightKg: '',
  ufGoalMl: '',
  ufAchievedMl: '',
  durationHours: '',
  bpPre: '',
  bpPost: '',
  accessType: '',
  complications: '',
  notes: '',
}

const emptyPdRxDraft = {
  date: today(),
  modality: 'CAPD' as PdModality,
  fillVolumeMl: '',
  exchangesPerDay: '',
  dwellHours: '',
  dextrosePct: '',
  notes: '',
}

const emptyPeritonitisDraft = {
  onsetDate: today(),
  organism: '',
  antibioticRegimen: '',
  resolutionDate: '',
  outcome: 'ongoing' as PeritonitisOutcome,
  notes: '',
}

function num(v: string): number | null {
  return v === '' ? null : Number(v)
}

export function DialysisTab({ patientId }: Props) {
  const [labEntries, setLabEntries] = useState<LabEntry[]>([])
  const [hdSessions, setHdSessions] = useState<HdSession[]>([])
  const [pdPrescriptions, setPdPrescriptions] = useState<PdPrescription[]>([])
  const [peritonitisEpisodes, setPeritonitisEpisodes] = useState<PdPeritonitisEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hdDraft, setHdDraft] = useState(emptyHdDraft)
  const [pdRxDraft, setPdRxDraft] = useState(emptyPdRxDraft)
  const [peritonitisDraft, setPeritonitisDraft] = useState(emptyPeritonitisDraft)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    Promise.all([
      listLabEntries(patientId),
      listHdSessions(patientId),
      listPdPrescriptions(patientId),
      listPdPeritonitisEpisodes(patientId),
    ])
      .then(([labs, hd, pdRx, peritonitis]) => {
        setLabEntries(labs)
        setHdSessions(hd)
        setPdPrescriptions(pdRx)
        setPeritonitisEpisodes(peritonitis)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dialysis data'))
      .finally(() => setLoading(false))
  }

  const adequacyEntries = labEntries
    .filter((e) => ['Kt/V (single pool)', 'URR (Urea Reduction Ratio)', 'PET D/P Creatinine Ratio'].includes(e.test) && e.value != null)
    .sort((a, b) => b.date.localeCompare(a.date))

  async function handleAddHd(e: FormEvent) {
    e.preventDefault()
    try {
      const draft: HdSessionDraft = {
        patientId,
        date: hdDraft.date,
        preWeightKg: num(hdDraft.preWeightKg),
        postWeightKg: num(hdDraft.postWeightKg),
        ufGoalMl: num(hdDraft.ufGoalMl),
        ufAchievedMl: num(hdDraft.ufAchievedMl),
        durationHours: num(hdDraft.durationHours),
        bpPre: hdDraft.bpPre || null,
        bpPost: hdDraft.bpPost || null,
        accessType: hdDraft.accessType || null,
        complications: hdDraft.complications || null,
        notes: hdDraft.notes || null,
      }
      const session = await addHdSession(draft)
      setHdSessions((prev) => [session, ...prev])
      setHdDraft({ ...emptyHdDraft, date: hdDraft.date, accessType: hdDraft.accessType })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add HD session')
    }
  }

  async function handleAddPdRx(e: FormEvent) {
    e.preventDefault()
    try {
      const draft: PdPrescriptionDraft = {
        patientId,
        date: pdRxDraft.date,
        modality: pdRxDraft.modality,
        fillVolumeMl: num(pdRxDraft.fillVolumeMl),
        exchangesPerDay: num(pdRxDraft.exchangesPerDay),
        dwellHours: num(pdRxDraft.dwellHours),
        dextrosePct: pdRxDraft.dextrosePct || null,
        notes: pdRxDraft.notes || null,
      }
      const rx = await addPdPrescription(draft)
      setPdPrescriptions((prev) => [rx, ...prev])
      setPdRxDraft({ ...emptyPdRxDraft, date: pdRxDraft.date, modality: pdRxDraft.modality })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add PD prescription')
    }
  }

  async function handleAddPeritonitis(e: FormEvent) {
    e.preventDefault()
    try {
      const draft: PdPeritonitisEpisodeDraft = {
        patientId,
        onsetDate: peritonitisDraft.onsetDate,
        organism: peritonitisDraft.organism || null,
        antibioticRegimen: peritonitisDraft.antibioticRegimen || null,
        resolutionDate: peritonitisDraft.resolutionDate || null,
        outcome: peritonitisDraft.outcome,
        notes: peritonitisDraft.notes || null,
      }
      const episode = await addPdPeritonitisEpisode(draft)
      setPeritonitisEpisodes((prev) => [episode, ...prev])
      setPeritonitisDraft(emptyPeritonitisDraft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add peritonitis episode')
    }
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      {error && <p className="form-error">{error}</p>}

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Dialysis adequacy trend</h2>
        </div>
        <p className="patient-meta">
          Add Kt/V, URR, or PET D/P Creatinine Ratio in the Labs tab (category "Dialysis Adequacy") — they'll show up
          here.
        </p>
        {adequacyEntries.length === 0 ? (
          <p className="empty-state">No adequacy results recorded yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Test</th>
                <th>Value</th>
                <th>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {adequacyEntries.map((e) => {
                const isPet = e.test === 'PET D/P Creatinine Ratio'
                const category = isPet && e.value != null ? classifyPetTransporter(e.value) : null
                return (
                  <tr key={e.id}>
                    <td>{toShamsi(e.date)}</td>
                    <td>{e.test}</td>
                    <td>{e.value}</td>
                    <td>{category ? `${category} transporter — ${PET_TRANSPORTER_NOTE[category]}` : ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">HD sessions</h2>
        </div>
        <form className="soap-form" onSubmit={(e) => void handleAddHd(e)}>
          <div className="field-grid">
            <label>
              Date
              <input
                type="date"
                value={hdDraft.date}
                onChange={(e) => setHdDraft({ ...hdDraft, date: e.target.value || today() })}
                required
              />
            </label>
            <label>
              Pre-weight (kg)
              <input type="number" step="any" value={hdDraft.preWeightKg} onChange={(e) => setHdDraft({ ...hdDraft, preWeightKg: e.target.value })} />
            </label>
            <label>
              Post-weight (kg)
              <input type="number" step="any" value={hdDraft.postWeightKg} onChange={(e) => setHdDraft({ ...hdDraft, postWeightKg: e.target.value })} />
            </label>
            <label>
              UF goal (mL)
              <input type="number" step="any" value={hdDraft.ufGoalMl} onChange={(e) => setHdDraft({ ...hdDraft, ufGoalMl: e.target.value })} />
            </label>
            <label>
              UF achieved (mL)
              <input type="number" step="any" value={hdDraft.ufAchievedMl} onChange={(e) => setHdDraft({ ...hdDraft, ufAchievedMl: e.target.value })} />
            </label>
            <label>
              Duration (hours)
              <input type="number" step="any" value={hdDraft.durationHours} onChange={(e) => setHdDraft({ ...hdDraft, durationHours: e.target.value })} />
            </label>
            <label>
              BP pre
              <input value={hdDraft.bpPre} onChange={(e) => setHdDraft({ ...hdDraft, bpPre: e.target.value })} />
            </label>
            <label>
              BP post
              <input value={hdDraft.bpPost} onChange={(e) => setHdDraft({ ...hdDraft, bpPost: e.target.value })} />
            </label>
            <label>
              Access type
              <input placeholder="AVF / AVG / Catheter" value={hdDraft.accessType} onChange={(e) => setHdDraft({ ...hdDraft, accessType: e.target.value })} />
            </label>
          </div>
          <label>
            Complications
            <input value={hdDraft.complications} onChange={(e) => setHdDraft({ ...hdDraft, complications: e.target.value })} placeholder="e.g. hypotension, cramping" />
          </label>
          <label>
            Notes
            <textarea value={hdDraft.notes} onChange={(e) => setHdDraft({ ...hdDraft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Add session</button>
          </div>
        </form>

        {hdSessions.length === 0 ? (
          <p className="empty-state">No HD sessions logged yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight (pre→post)</th>
                <th>UF (goal/achieved)</th>
                <th>Duration</th>
                <th>BP (pre/post)</th>
                <th>Access</th>
                <th>Complications</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {hdSessions.map((s) => (
                <tr key={s.id}>
                  <td>{toShamsi(s.date)}</td>
                  <td>
                    {s.preWeightKg ?? '—'} → {s.postWeightKg ?? '—'} kg
                  </td>
                  <td>
                    {s.ufGoalMl ?? '—'} / {s.ufAchievedMl ?? '—'} mL
                  </td>
                  <td>{s.durationHours ? `${s.durationHours} h` : '—'}</td>
                  <td>
                    {s.bpPre || '—'} / {s.bpPost || '—'}
                  </td>
                  <td>{s.accessType}</td>
                  <td className={s.complications ? 'value-abnormal' : undefined}>{s.complications}</td>
                  <td>
                    <button className="link-button" onClick={() => void deleteHdSession(s.id).then(() => setHdSessions((prev) => prev.filter((x) => x.id !== s.id)))}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">PD prescription history</h2>
        </div>
        <form className="lab-form" onSubmit={(e) => void handleAddPdRx(e)}>
          <input
            type="date"
            value={pdRxDraft.date}
            onChange={(e) => setPdRxDraft({ ...pdRxDraft, date: e.target.value || today() })}
            required
          />
          <select value={pdRxDraft.modality} onChange={(e) => setPdRxDraft({ ...pdRxDraft, modality: e.target.value as PdModality })}>
            <option value="CAPD">CAPD</option>
            <option value="APD">APD</option>
          </select>
          <input placeholder="Fill volume (mL)" type="number" step="any" value={pdRxDraft.fillVolumeMl} onChange={(e) => setPdRxDraft({ ...pdRxDraft, fillVolumeMl: e.target.value })} />
          <input placeholder="Exchanges/day" type="number" step="any" value={pdRxDraft.exchangesPerDay} onChange={(e) => setPdRxDraft({ ...pdRxDraft, exchangesPerDay: e.target.value })} />
          <input placeholder="Dwell (hours)" type="number" step="any" value={pdRxDraft.dwellHours} onChange={(e) => setPdRxDraft({ ...pdRxDraft, dwellHours: e.target.value })} />
          <input placeholder="Dextrose % (e.g. 1.5/2.5/4.25)" value={pdRxDraft.dextrosePct} onChange={(e) => setPdRxDraft({ ...pdRxDraft, dextrosePct: e.target.value })} />
          <input placeholder="Notes" value={pdRxDraft.notes} onChange={(e) => setPdRxDraft({ ...pdRxDraft, notes: e.target.value })} />
          <button type="submit">Add</button>
        </form>

        {pdPrescriptions.length === 0 ? (
          <p className="empty-state">No PD prescriptions logged yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Modality</th>
                <th>Fill volume</th>
                <th>Exchanges/day</th>
                <th>Dwell</th>
                <th>Dextrose</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pdPrescriptions.map((rx) => (
                <tr key={rx.id}>
                  <td>{toShamsi(rx.date)}</td>
                  <td>{rx.modality}</td>
                  <td>{rx.fillVolumeMl ? `${rx.fillVolumeMl} mL` : '—'}</td>
                  <td>{rx.exchangesPerDay ?? '—'}</td>
                  <td>{rx.dwellHours ? `${rx.dwellHours} h` : '—'}</td>
                  <td>{rx.dextrosePct}</td>
                  <td>{rx.notes}</td>
                  <td>
                    <button className="link-button" onClick={() => void deletePdPrescription(rx.id).then(() => setPdPrescriptions((prev) => prev.filter((x) => x.id !== rx.id)))}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">PD peritonitis episodes</h2>
        </div>
        <form className="soap-form" onSubmit={(e) => void handleAddPeritonitis(e)}>
          <div className="field-grid">
            <label>
              Onset date
              <input
                type="date"
                value={peritonitisDraft.onsetDate}
                onChange={(e) => setPeritonitisDraft({ ...peritonitisDraft, onsetDate: e.target.value || today() })}
                required
              />
            </label>
            <label>
              Organism
              <input
                value={peritonitisDraft.organism}
                onChange={(e) => setPeritonitisDraft({ ...peritonitisDraft, organism: e.target.value })}
                placeholder="e.g. Staph epidermidis, or 'culture negative'"
              />
            </label>
            <label>
              Resolution date
              <input
                type="date"
                value={peritonitisDraft.resolutionDate}
                onChange={(e) => setPeritonitisDraft({ ...peritonitisDraft, resolutionDate: e.target.value })}
              />
            </label>
            <label>
              Outcome
              <select value={peritonitisDraft.outcome} onChange={(e) => setPeritonitisDraft({ ...peritonitisDraft, outcome: e.target.value as PeritonitisOutcome })}>
                {(Object.keys(OUTCOME_LABELS) as PeritonitisOutcome[]).map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABELS[o]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Antibiotic regimen
            <input
              value={peritonitisDraft.antibioticRegimen}
              onChange={(e) => setPeritonitisDraft({ ...peritonitisDraft, antibioticRegimen: e.target.value })}
              placeholder="See Dialysis reference tab for dosing"
            />
          </label>
          <label>
            Notes
            <textarea value={peritonitisDraft.notes} onChange={(e) => setPeritonitisDraft({ ...peritonitisDraft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Add episode</button>
          </div>
        </form>

        {peritonitisEpisodes.length === 0 ? (
          <p className="empty-state">No peritonitis episodes logged.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Onset</th>
                <th>Organism</th>
                <th>Regimen</th>
                <th>Resolution</th>
                <th>Outcome</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {peritonitisEpisodes.map((ep) => (
                <tr key={ep.id} className={ep.outcome === 'ongoing' || ep.outcome === 'relapse' ? 'row-abnormal' : ''}>
                  <td>{toShamsi(ep.onsetDate)}</td>
                  <td>{ep.organism}</td>
                  <td>{ep.antibioticRegimen}</td>
                  <td>{ep.resolutionDate ? toShamsi(ep.resolutionDate) : '—'}</td>
                  <td>{ep.outcome ? OUTCOME_LABELS[ep.outcome] : '—'}</td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() => void deletePdPeritonitisEpisode(ep.id).then(() => setPeritonitisEpisodes((prev) => prev.filter((x) => x.id !== ep.id)))}
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
