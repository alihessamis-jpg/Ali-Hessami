import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addAttendingConsult,
  deleteAttendingConsult,
  listAttendingConsults,
} from '../../lib/api/attendingConsults'
import { listPatients } from '../../lib/api/patients'
import { toShamsi } from '../../lib/shamsi'
import { matchesSearch } from '../../lib/textFilter'
import type { AttendingConsult, AttendingConsultDraft, ConsultSetting, Patient } from '../../types/domain'

const today = () => new Date().toISOString().slice(0, 10)

const emptyDraft = {
  patientId: '',
  consultDate: today(),
  setting: 'inpatient' as ConsultSetting,
  chiefComplaint: '',
  historySummary: '',
  examSummary: '',
  labsSummary: '',
  yourAssessment: '',
  attendingName: '',
  attendingApproach: '',
  diagnosisFinal: '',
  notes: '',
}

export function AttendingConsultsPanel() {
  const [consults, setConsults] = useState<AttendingConsult[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    setLoading(true)
    Promise.all([listAttendingConsults(), listPatients()])
      .then(([consultRows, patientRows]) => {
        setConsults(consultRows)
        setPatients(patientRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load consults'))
      .finally(() => setLoading(false))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.chiefComplaint.trim() && !draft.diagnosisFinal.trim()) return
    try {
      const payload: AttendingConsultDraft = {
        patientId: draft.patientId || null,
        consultDate: draft.consultDate,
        setting: draft.setting,
        chiefComplaint: draft.chiefComplaint || null,
        historySummary: draft.historySummary || null,
        examSummary: draft.examSummary || null,
        labsSummary: draft.labsSummary || null,
        yourAssessment: draft.yourAssessment || null,
        attendingName: draft.attendingName || null,
        attendingApproach: draft.attendingApproach || null,
        diagnosisFinal: draft.diagnosisFinal || null,
        notes: draft.notes || null,
        builtCaseId: null,
      }
      const created = await addAttendingConsult(payload)
      setConsults((prev) => [created, ...prev])
      setDraft({ ...emptyDraft, consultDate: draft.consultDate, setting: draft.setting, attendingName: draft.attendingName })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add consult')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAttendingConsult(id)
      setConsults((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const visibleConsults = consults.filter((c) =>
    matchesSearch(
      [
        c.chiefComplaint,
        c.historySummary,
        c.examSummary,
        c.labsSummary,
        c.yourAssessment,
        c.attendingApproach,
        c.attendingName,
        c.diagnosisFinal,
        c.notes,
      ],
      search
    )
  )

  return (
    <div>
      <p className="empty-state">
        Log a consult — what you presented (history, exam, labs, your own assessment) and the approach your
        attending gave back. Each entry can become a teaching case, so you can pull up the same approach next
        time you see a similar patient.
      </p>

      <div className="form-actions" style={{ marginBottom: 16 }}>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New consult'}</button>
      </div>

      {showForm && (
        <form className="soap-form" onSubmit={(e) => void handleAdd(e)}>
          <div className="field-grid">
            <label>
              Date
              <input
                type="date"
                value={draft.consultDate}
                onChange={(e) => setDraft({ ...draft, consultDate: e.target.value || today() })}
                required
              />
            </label>
            <label>
              Setting
              <select value={draft.setting} onChange={(e) => setDraft({ ...draft, setting: e.target.value as ConsultSetting })}>
                <option value="inpatient">Inpatient</option>
                <option value="outpatient">Outpatient</option>
              </select>
            </label>
            <label>
              Patient (optional)
              <select value={draft.patientId} onChange={(e) => setDraft({ ...draft, patientId: e.target.value })}>
                <option value="">No linked patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Attending
              <input value={draft.attendingName} onChange={(e) => setDraft({ ...draft, attendingName: e.target.value })} />
            </label>
          </div>
          <label>
            Chief complaint
            <input value={draft.chiefComplaint} onChange={(e) => setDraft({ ...draft, chiefComplaint: e.target.value })} />
          </label>
          <label>
            History (what you presented)
            <textarea value={draft.historySummary} onChange={(e) => setDraft({ ...draft, historySummary: e.target.value })} />
          </label>
          <label>
            Exam findings
            <textarea value={draft.examSummary} onChange={(e) => setDraft({ ...draft, examSummary: e.target.value })} />
          </label>
          <label>
            Labs / paraclinic
            <textarea value={draft.labsSummary} onChange={(e) => setDraft({ ...draft, labsSummary: e.target.value })} />
          </label>
          <label>
            Your assessment (before the attending weighed in)
            <textarea value={draft.yourAssessment} onChange={(e) => setDraft({ ...draft, yourAssessment: e.target.value })} />
          </label>
          <label>
            Attending's approach (diagnostic/therapeutic plan)
            <textarea
              value={draft.attendingApproach}
              onChange={(e) => setDraft({ ...draft, attendingApproach: e.target.value })}
              placeholder="What the attending recommended — this is the part worth remembering for next time"
            />
          </label>
          <label>
            Final diagnosis
            <input value={draft.diagnosisFinal} onChange={(e) => setDraft({ ...draft, diagnosisFinal: e.target.value })} />
          </label>
          <label>
            Notes
            <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit">Save consult</button>
          </div>
        </form>
      )}

      <input
        placeholder="Search consults…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ margin: '12px 0', width: '100%', maxWidth: 360 }}
      />

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : visibleConsults.length === 0 ? (
        <p className="empty-state">No consults logged yet.</p>
      ) : (
        <ul className="note-timeline">
          {visibleConsults.map((c) => (
            <li key={c.id}>
              <div className="note-header">
                <strong onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  {c.diagnosisFinal || c.chiefComplaint || 'Untitled consult'}
                </strong>
                <span className="patient-meta">
                  {toShamsi(c.consultDate)} · {c.setting}
                  {c.attendingName ? ` · ${c.attendingName}` : ''}
                </span>
                <button className="link-button" onClick={() => void handleDelete(c.id)}>
                  Delete
                </button>
              </div>
              {openId === c.id && (
                <div>
                  {c.chiefComplaint && <p><strong>Chief complaint:</strong> {c.chiefComplaint}</p>}
                  {c.historySummary && <p><strong>History:</strong> {c.historySummary}</p>}
                  {c.examSummary && <p><strong>Exam:</strong> {c.examSummary}</p>}
                  {c.labsSummary && <p><strong>Labs:</strong> {c.labsSummary}</p>}
                  {c.yourAssessment && <p><strong>Your assessment:</strong> {c.yourAssessment}</p>}
                  {c.attendingApproach && (
                    <p className="value-abnormal">
                      <strong>Attending's approach:</strong> {c.attendingApproach}
                    </p>
                  )}
                  {c.notes && <p><strong>Notes:</strong> {c.notes}</p>}
                  <div className="form-actions">
                    {c.builtCaseId ? (
                      <span className="status-badge status-badge--dialysis">Teaching case built ✓</span>
                    ) : (
                      <Link to={`/study/personal-cases/new?consultId=${c.id}`} className="button-link">
                        Build teaching case from this consult
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
