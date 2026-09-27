import { useEffect, useState } from 'react'
import {
  addLusStudySession,
  deleteLusStudySession,
  enrollPatientInLusStudy,
  getLusStudyEnrollment,
  listLusStudySessionsForPatient,
  updateLusStudySession,
} from '../../lib/api/lusStudy'
import { LusStudySessionForm } from './LusStudySessionForm'
import { toShamsi } from '../../lib/shamsi'
import type { LusStudySessionWithPatient } from '../../lib/api/lusStudy'
import type { LusStudyEnrollment, LusStudyGroup, LusStudySessionDraft, Patient } from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
}

const GROUP_LABELS: Record<LusStudyGroup, string> = {
  group1_standard: 'Group 1 — Standard care',
  group2_lus_guided: 'Group 2 — LUS/IVC-guided',
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function LusStudyTab({ patientId, patient }: Props) {
  const [enrollment, setEnrollment] = useState<LusStudyEnrollment | null | undefined>(undefined)
  const [sessions, setSessions] = useState<LusStudySessionWithPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enrollGroup, setEnrollGroup] = useState<LusStudyGroup>('group1_standard')
  const [enrollNotes, setEnrollNotes] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [formMode, setFormMode] = useState<'closed' | 'new' | string>('closed')

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    Promise.all([getLusStudyEnrollment(patientId), listLusStudySessionsForPatient(patientId)])
      .then(([e, s]) => {
        setEnrollment(e)
        setSessions(s)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load LUS study data'))
      .finally(() => setLoading(false))
  }

  async function handleEnroll() {
    setEnrolling(true)
    setError(null)
    try {
      const e = await enrollPatientInLusStudy({
        patientId,
        studyGroup: enrollGroup,
        enrollmentDate: today(),
        notes: enrollNotes || null,
      })
      setEnrollment(e)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enroll patient')
    } finally {
      setEnrolling(false)
    }
  }

  async function handleSaveSession(draft: LusStudySessionDraft) {
    try {
      if (formMode !== 'new' && formMode !== 'closed') {
        const updated = await updateLusStudySession(formMode, draft)
        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      } else {
        const created = await addLusStudySession(draft)
        setSessions((prev) => [created, ...prev])
      }
      setFormMode('closed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLusStudySession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
    }
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      {error && <p className="form-error">{error}</p>}

      {enrollment === null ? (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Enroll in LUS volume-assessment study</h2>
          </div>
          <p className="patient-meta">
            Randomize once per patient. Group 1 records LUS/IVC findings only (dry weight managed by standard of
            care). Group 2 also uses LUS/IVC findings to guide dry weight, with a suggested decision shown for you
            to confirm or override each session.
          </p>
          <label>
            Study group
            <select value={enrollGroup} onChange={(e) => setEnrollGroup(e.target.value as LusStudyGroup)}>
              <option value="group1_standard">{GROUP_LABELS.group1_standard}</option>
              <option value="group2_lus_guided">{GROUP_LABELS.group2_lus_guided}</option>
            </select>
          </label>
          <label>
            Notes
            <textarea value={enrollNotes} onChange={(e) => setEnrollNotes(e.target.value)} placeholder="Consent, randomization reference, etc." />
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => void handleEnroll()} disabled={enrolling}>
              {enrolling ? 'Enrolling…' : 'Enroll patient'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="calc-strip">
            <div>
              <span className="calc-label">Study group</span>
              <span className="calc-value">{GROUP_LABELS[enrollment!.studyGroup]}</span>
            </div>
            <div>
              <span className="calc-label">Enrolled</span>
              <span className="calc-value">{toShamsi(enrollment!.enrollmentDate)}</span>
            </div>
            <div>
              <span className="calc-label">Sessions logged</span>
              <span className="calc-value">{sessions.length}</span>
            </div>
          </div>

          {formMode === 'closed' ? (
            <div className="form-actions" style={{ marginBottom: 16 }}>
              <button type="button" onClick={() => setFormMode('new')}>
                Log new session
              </button>
            </div>
          ) : (
            <LusStudySessionForm
              patientId={patientId}
              studyGroup={enrollment!.studyGroup}
              defaultHeightCm={patient.height}
              defaultWeightKg={patient.weight}
              defaultTargetWeightKg={sessions[0]?.targetWeightKg ?? patient.weight}
              previousPostHdWeightKg={sessions[0]?.postHdWeightKg}
              existing={formMode === 'new' ? null : sessions.find((s) => s.id === formMode) ?? null}
              onSaved={(draft) => void handleSaveSession(draft)}
              onCancel={() => setFormMode('closed')}
            />
          )}

          {sessions.length === 0 ? (
            <p className="empty-state">No sessions logged yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Pre/Post LUS</th>
                  <th>Weight loss</th>
                  <th>Status</th>
                  {enrollment!.studyGroup === 'group2_lus_guided' && <th>Decision</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const complete = s.postHdWeightKg != null
                  return (
                    <tr key={s.id} className={!complete ? 'row-abnormal' : undefined}>
                      <td>{toShamsi(s.sessionDate)}</td>
                      <td>
                        {s.preLusTotal ?? '—'} → {s.postLusTotal ?? '—'}
                      </td>
                      <td>{s.weightLossKg != null ? `${s.weightLossKg.toFixed(2)} kg` : '—'}</td>
                      <td>{complete ? 'Complete' : 'Pending post-HD'}</td>
                      {enrollment!.studyGroup === 'group2_lus_guided' && (
                        <td>{s.lusGuidedDecision ? s.lusGuidedDecision.replace('_', ' ') : '—'}</td>
                      )}
                      <td>
                        <button className="link-button" onClick={() => setFormMode(s.id)}>
                          {complete ? 'Edit' : 'Complete'}
                        </button>
                        <button className="link-button" onClick={() => void handleDelete(s.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
