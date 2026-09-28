import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPatient } from '../lib/api/patients'
import { listLabEntries } from '../lib/api/labs'
import { addPersonalCase, getPersonalCase, updatePersonalCase } from '../lib/api/personalCases'
import { getAttendingConsult, markConsultCaseBuilt } from '../lib/api/attendingConsults'

interface LabSummarySource {
  test: string
  value?: number | null
  unit?: string | null
  date: string
}

function summarizeLabs(entries: LabSummarySource[]): string {
  const latestByTest = new Map<string, LabSummarySource>()
  for (const e of entries) {
    const existing = latestByTest.get(e.test)
    if (!existing || e.date > existing.date) latestByTest.set(e.test, e)
  }
  return Array.from(latestByTest.entries())
    .map(([test, e]) => `${test}: ${e.value ?? '—'} ${e.unit ?? ''}`.trim())
    .join('\n')
}

export function NewPersonalCasePage() {
  const [params] = useSearchParams()
  const patientId = params.get('patientId')
  const consultId = params.get('consultId')
  const editId = params.get('id')
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [diagnosisContext, setDiagnosisContext] = useState('')
  const [presentation, setPresentation] = useState('')
  const [findings, setFindings] = useState('')
  const [labPattern, setLabPattern] = useState('')
  const [workingDx, setWorkingDx] = useState('')
  const [pearls, setPearls] = useState('')
  const [whatLearned, setWhatLearned] = useState('')
  const [createdDate, setCreatedDate] = useState<string | null>(null)
  const [sourcePatientId, setSourcePatientId] = useState<string | null>(patientId)
  const [loading, setLoading] = useState(Boolean(patientId || consultId || editId))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editId) {
      setLoading(true)
      getPersonalCase(editId)
        .then((c) => {
          setSourcePatientId(c.sourcePatientId ?? null)
          setTitle(c.title)
          setCreatedDate(c.createdDate)
          setDiagnosisContext(c.diagnosisContext ?? '')
          setPresentation(c.presentation ?? '')
          setFindings(c.findings ?? '')
          setLabPattern(c.labPattern ?? '')
          setWorkingDx(c.workingDx ?? '')
          setPearls(c.pearls ?? '')
          setWhatLearned(c.whatLearned ?? '')
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load case'))
        .finally(() => setLoading(false))
      return
    }
    if (consultId) {
      setLoading(true)
      getAttendingConsult(consultId)
        .then((consult) => {
          setSourcePatientId(consult.patientId ?? null)
          setDiagnosisContext(consult.diagnosisFinal ?? '')
          setPresentation([consult.chiefComplaint, consult.historySummary].filter(Boolean).join('\n\n'))
          setFindings(consult.examSummary ?? '')
          setLabPattern(consult.labsSummary ?? '')
          setWorkingDx(consult.attendingApproach ?? '')
          setPearls(
            consult.yourAssessment
              ? `Your initial assessment: ${consult.yourAssessment}\n\nAttending's approach: ${consult.attendingApproach ?? ''}`
              : consult.attendingApproach ?? ''
          )
          setTitle(consult.diagnosisFinal ? `Consult: ${consult.diagnosisFinal}` : 'Untitled consult case')
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load consult'))
        .finally(() => setLoading(false))
      return
    }
    if (!patientId) return
    setLoading(true)
    Promise.all([getPatient(patientId), listLabEntries(patientId)])
      .then(([patient, labs]) => {
        setDiagnosisContext(patient.diagnosis ?? '')
        setLabPattern(summarizeLabs(labs))
        setTitle(patient.diagnosis ? `Case: ${patient.diagnosis}` : 'Untitled case')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patient data'))
      .finally(() => setLoading(false))
  }, [patientId, consultId, editId])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const draft = {
        sourcePatientId,
        title: title.trim(),
        createdDate: createdDate ?? new Date().toISOString().slice(0, 10),
        diagnosisContext: diagnosisContext || null,
        presentation: presentation || null,
        findings: findings || null,
        labPattern: labPattern || null,
        imaging: null,
        workingDx: workingDx || null,
        pearls: pearls || null,
        whatLearned: whatLearned || null,
        questionsForFurtherStudy: null,
      }
      const saved = editId ? await updatePersonalCase(editId, draft) : await addPersonalCase(draft)
      if (consultId) await markConsultCaseBuilt(consultId, saved.id)
      navigate('/study')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save case')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>{editId ? 'Edit teaching case' : 'Build teaching case'}</h1>
      {editId ? null : consultId ? (
        <p className="empty-state">
          Pre-filled from this consult, including the attending's approach under "Working diagnosis" and a
          comparison against your own assessment under "Pearls". <strong>No name, MRN, bed, or date of birth
          was copied</strong> — review everything below and remove any other identifying detail before saving.
        </p>
      ) : (
        patientId && (
          <p className="empty-state">
            Pre-filled from the patient's diagnosis and latest labs. <strong>No name, MRN, bed, or date of
            birth was copied</strong> — review everything below and remove any other identifying detail
            before saving.
          </p>
        )
      )}

      {loading ? (
        <p>Loading…</p>
      ) : (
        <form className="soap-form" onSubmit={(e) => void handleSave(e)}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label>
            Diagnosis context
            <textarea value={diagnosisContext} onChange={(e) => setDiagnosisContext(e.target.value)} />
          </label>
          <label>
            Presentation (de-identified)
            <textarea value={presentation} onChange={(e) => setPresentation(e.target.value)} />
          </label>
          <label>
            Exam findings
            <textarea value={findings} onChange={(e) => setFindings(e.target.value)} />
          </label>
          <label>
            Lab pattern
            <textarea value={labPattern} onChange={(e) => setLabPattern(e.target.value)} />
          </label>
          <label>
            Working diagnosis
            <textarea value={workingDx} onChange={(e) => setWorkingDx(e.target.value)} />
          </label>
          <label>
            Pearls
            <textarea value={pearls} onChange={(e) => setPearls(e.target.value)} />
          </label>
          <label>
            What I learned
            <textarea value={whatLearned} onChange={(e) => setWhatLearned(e.target.value)} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {editId ? 'Save changes' : 'Save case'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
