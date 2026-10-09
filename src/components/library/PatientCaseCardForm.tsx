import { useState, type FormEvent } from 'react'
import { addLibraryCard } from '../../lib/api/library'
import { listLabEntries } from '../../lib/api/labs'
import { schwartzEGFR } from '../../lib/formulas'
import { formatAge } from '../../lib/patientAge'
import type { LibraryCard, Patient, PatientCaseVignetteStat } from '../../types/domain'

interface Props {
  chapterId: string
  patients: Patient[]
  onCreated: (card: LibraryCard) => void
}

function latestNumeric(entries: Array<{ test: string; value?: number | null; date: string }>, test: string): number | null {
  const matches = entries.filter((e) => e.test === test && e.value != null).sort((a, b) => b.date.localeCompare(a.date))
  return matches[0]?.value ?? null
}

export function PatientCaseCardForm({ chapterId, patients, onCreated }: Props) {
  const [patientId, setPatientId] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const patient = patients.find((p) => p.id === patientId)
    if (!patient || !question.trim() || !answer.trim()) return
    setSaving(true)
    setError(null)
    try {
      const labs = await listLabEntries(patient.id)
      const cr = latestNumeric(labs, 'Creatinine')
      const hb = latestNumeric(labs, 'Hemoglobin')
      const egfr = cr != null && patient.height ? schwartzEGFR(patient.height, cr) : null
      const stats: PatientCaseVignetteStat[] = []
      const ageLabel = formatAge(patient.age)
      if (ageLabel) stats.push({ label: 'AGE', value: ageLabel })
      if (cr != null) stats.push({ label: 'CR', value: `${cr.toFixed(2)} ↑`, flag: 'hi' })
      if (egfr != null) stats.push({ label: 'eGFR', value: `${Math.round(egfr)} ↓`, flag: 'lo' })
      if (hb != null) stats.push({ label: 'HB', value: `${hb.toFixed(1)} ↓`, flag: 'lo' })

      const card = await addLibraryCard({
        chapterId,
        kind: 'patient_case',
        front: question.trim(),
        back: answer.trim(),
        options: { stats },
        sectionNumber: null,
        page: null,
        sourceText: null,
        patientId: patient.id,
      })
      onCreated(card)
      setQuestion('')
      setAnswer('')
      setPatientId('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create patient case card')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="np-card np-fade" style={{ gap: 8 }}>
      <h2>Make a patient case card</h2>
      <span className="np-small">Pulls this patient's latest Cr/eGFR/Hb into the vignette automatically.</span>
      {error && <p className="form-error">{error}</p>}
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Select a patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <textarea placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} dir="rtl" />
        <textarea placeholder="Answer" value={answer} onChange={(e) => setAnswer(e.target.value)} dir="rtl" />
        <button type="submit" disabled={!patientId || !question.trim() || !answer.trim() || saving}>
          {saving ? 'Saving…' : 'Add patient case card'}
        </button>
      </form>
    </section>
  )
}
