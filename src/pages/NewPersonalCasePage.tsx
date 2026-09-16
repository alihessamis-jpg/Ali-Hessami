import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPatient } from '../lib/api/patients'
import { listLabEntries } from '../lib/api/labs'
import { addPersonalCase } from '../lib/api/personalCases'

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
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [diagnosisContext, setDiagnosisContext] = useState('')
  const [presentation, setPresentation] = useState('')
  const [labPattern, setLabPattern] = useState('')
  const [workingDx, setWorkingDx] = useState('')
  const [pearls, setPearls] = useState('')
  const [whatLearned, setWhatLearned] = useState('')
  const [loading, setLoading] = useState(Boolean(patientId))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
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
  }, [patientId])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addPersonalCase({
        sourcePatientId: patientId,
        title: title.trim(),
        createdDate: new Date().toISOString().slice(0, 10),
        diagnosisContext: diagnosisContext || null,
        presentation: presentation || null,
        findings: null,
        labPattern: labPattern || null,
        imaging: null,
        workingDx: workingDx || null,
        pearls: pearls || null,
        whatLearned: whatLearned || null,
        questionsForFurtherStudy: null,
      })
      navigate('/study')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save case')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>Build teaching case</h1>
      {patientId && (
        <p className="empty-state">
          Pre-filled from the patient's diagnosis and latest labs. <strong>No name, MRN, bed, or date of
          birth was copied</strong> — review everything below and remove any other identifying detail
          before saving.
        </p>
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
              Save case
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
