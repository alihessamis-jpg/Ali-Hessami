import { useState, type FormEvent } from 'react'
import { updatePatient } from '../../lib/api/patients'
import { bmiCalc, bsaMosteller, schwartzEGFR } from '../../lib/formulas'
import type { Patient } from '../../types/domain'

interface Props {
  patient: Patient
  onUpdated: (patient: Patient) => void
}

const FIELD_GROUPS: Array<{ title: string; fields: Array<{ key: keyof Patient; label: string }> }> = [
  {
    title: 'Demographics',
    fields: [
      { key: 'code', label: 'Code / MRN' },
      { key: 'age', label: 'Age' },
      { key: 'sex', label: 'Sex' },
      { key: 'dob', label: 'Date of birth' },
      { key: 'doa', label: 'Date of admission' },
      { key: 'bed', label: 'Bed' },
    ],
  },
  {
    title: 'Diagnosis & status',
    fields: [
      { key: 'diagnosis', label: 'Diagnosis' },
      { key: 'underlyingDisease', label: 'Underlying disease' },
      { key: 'height', label: 'Height (cm)' },
      { key: 'weight', label: 'Weight (kg)' },
      { key: 'baselineCr', label: 'Baseline creatinine (mg/dL)' },
      { key: 'dialysisStatus', label: 'Dialysis status' },
      { key: 'dialysisModality', label: 'Dialysis modality' },
      { key: 'transplantStatus', label: 'Transplant status' },
    ],
  },
  {
    title: 'History',
    fields: [
      { key: 'chiefComplaint', label: 'Chief complaint' },
      { key: 'hpi', label: 'History of present illness' },
      { key: 'keyPoints', label: 'Key points' },
      { key: 'familyHx', label: 'Family history' },
      { key: 'pmh', label: 'Past medical history' },
      { key: 'medHx', label: 'Medication history' },
      { key: 'allergyHx', label: 'Allergy history' },
      { key: 'dialysisHx', label: 'Dialysis history' },
      { key: 'transplantHx', label: 'Transplant history' },
    ],
  },
  {
    title: 'Vitals',
    fields: [
      { key: 'vsTemp', label: 'Temp (°C)' },
      { key: 'vsHR', label: 'HR (bpm)' },
      { key: 'vsRR', label: 'RR (/min)' },
      { key: 'vsBP', label: 'BP' },
      { key: 'vsSpo2', label: 'SpO2 (%)' },
    ],
  },
  {
    title: 'Exam',
    fields: [
      { key: 'exGeneral', label: 'General' },
      { key: 'exHeent', label: 'HEENT' },
      { key: 'exCVS', label: 'CVS' },
      { key: 'exResp', label: 'Respiratory' },
      { key: 'exAbd', label: 'Abdomen' },
      { key: 'exGU', label: 'GU' },
      { key: 'exExtrem', label: 'Extremities' },
      { key: 'exSkin', label: 'Skin' },
      { key: 'exNeuro', label: 'Neuro' },
      { key: 'exEdema', label: 'Edema' },
      { key: 'exHydration', label: 'Hydration' },
    ],
  },
]

const NUMERIC_FIELDS = new Set<keyof Patient>([
  'age',
  'height',
  'weight',
  'baselineCr',
  'baselineEGFR',
  'vsTemp',
  'vsHR',
  'vsRR',
  'vsSpo2',
])

export function AssessmentTab({ patient, onUpdated }: Props) {
  const [form, setForm] = useState<Patient>(patient)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  function setField(key: keyof Patient, raw: string) {
    const value = NUMERIC_FIELDS.has(key) ? (raw === '' ? null : Number(raw)) : raw
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const updated = await updatePatient(patient.id, form)
      onUpdated(updated)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const egfr =
    form.height && form.baselineCr ? schwartzEGFR(form.height, form.baselineCr).toFixed(1) : null
  const bsa = form.height && form.weight ? bsaMosteller(form.height, form.weight).toFixed(2) : null
  const bmi = form.height && form.weight ? bmiCalc(form.height, form.weight).toFixed(1) : null

  return (
    <form className="assessment-form" onSubmit={(e) => void handleSave(e)}>
      <div className="calc-strip">
        <div>
          <span className="calc-label">Schwartz eGFR</span>
          <span className="calc-value">{egfr ?? '—'}</span>
        </div>
        <div>
          <span className="calc-label">BSA (Mosteller)</span>
          <span className="calc-value">{bsa ?? '—'}</span>
        </div>
        <div>
          <span className="calc-label">BMI</span>
          <span className="calc-value">{bmi ?? '—'}</span>
        </div>
      </div>

      {FIELD_GROUPS.map((group) => (
        <fieldset key={group.title}>
          <legend>{group.title}</legend>
          <div className="field-grid">
            {group.fields.map(({ key, label }) => (
              <label key={String(key)}>
                {label}
                <input
                  value={form[key] ?? ''}
                  onChange={(e) => setField(key, e.target.value)}
                  type={NUMERIC_FIELDS.has(key) ? 'number' : 'text'}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save assessment'}
        </button>
        {savedAt && <span className="saved-hint">Saved</span>}
      </div>
    </form>
  )
}
