import { useEffect, useState, type FormEvent } from 'react'
import { DEFAULT_USER_SETTINGS, getUserSettings, updateUserSettings } from '../lib/api/settings'
import { SettingsIcon } from '../components/icons'
import type { UserSettings } from '../types/domain'

type FormState = Record<keyof UserSettings, string>

function toFormState(s: UserSettings): FormState {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as FormState
}

interface FieldConfig {
  key: keyof UserSettings
  label: string
  step: string
}

const ANEMIA_FIELDS: FieldConfig[] = [{ key: 'anemiaHbThreshold', label: 'Severe anemia alert — Hemoglobin below (g/dL)', step: '0.1' }]

const ACIDOSIS_FIELDS: FieldConfig[] = [
  { key: 'acidosisPhThreshold', label: 'Severe acidosis alert — pH below', step: '0.01' },
  { key: 'acidosisHco3Threshold', label: 'Severe acidosis alert — HCO3 below (mEq/L)', step: '0.5' },
]

const CKD_MBD_FIELDS: FieldConfig[] = [
  { key: 'ckdMbdCaLow', label: 'Calcium low (corrected, mg/dL)', step: '0.1' },
  { key: 'ckdMbdCaHigh', label: 'Calcium high (corrected, mg/dL)', step: '0.1' },
  { key: 'ckdMbdPthHigh', label: 'PTH high (pg/mL)', step: '1' },
  { key: 'ckdMbdPthLow', label: 'PTH low (pg/mL)', step: '1' },
  { key: 'ckdMbdVitDDeficient', label: '25-OH Vitamin D deficient below (ng/mL)', step: '1' },
  { key: 'ckdMbdVitDInsufficient', label: '25-OH Vitamin D insufficient below (ng/mL)', step: '1' },
  { key: 'ckdMbdBicarbLow', label: 'Bicarbonate low (mEq/L)', step: '0.5' },
]

const PHOSPHATE_FIELDS: FieldConfig[] = [
  { key: 'phosphateUnder1y', label: 'Phosphorus upper limit — under 1 year (mg/dL)', step: '0.1' },
  { key: 'phosphateAge1to3', label: 'Phosphorus upper limit — 1 to 3 years (mg/dL)', step: '0.1' },
  { key: 'phosphateAge3to10', label: 'Phosphorus upper limit — 3 to 10 years (mg/dL)', step: '0.1' },
  { key: 'phosphateAge10to17', label: 'Phosphorus upper limit — 10 to 17 years (mg/dL)', step: '0.1' },
  { key: 'phosphateAdult', label: 'Phosphorus upper limit — 17 years and up (mg/dL)', step: '0.1' },
]

const ALL_FIELDS = [...ANEMIA_FIELDS, ...ACIDOSIS_FIELDS, ...CKD_MBD_FIELDS, ...PHOSPHATE_FIELDS]

export function SettingsPage() {
  const [form, setForm] = useState<FormState>(toFormState(DEFAULT_USER_SETTINGS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getUserSettings()
      .then((s) => setForm(toFormState(s)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  function setField(key: keyof UserSettings, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function renderField({ key, label, step }: FieldConfig) {
    return (
      <label key={key}>
        {label}
        <input
          type="number"
          step={step}
          min="0"
          value={form[key]}
          onChange={(e) => setField(key, e.target.value)}
          style={{ maxWidth: 160 }}
        />
      </label>
    )
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const parsed = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, Number(form[f.key])])) as unknown as UserSettings
    if (Object.values(parsed).some((v) => Number.isNaN(v) || v <= 0)) {
      setError('Enter valid numbers above 0')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateUserSettings(parsed)
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <SettingsIcon />
          </span>
          Settings
        </h1>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Lab alert thresholds</h2>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : (
          <form className="soap-form" onSubmit={(e) => void handleSave(e)}>
            {ANEMIA_FIELDS.map(renderField)}
            <p className="patient-meta">
              Triggers the warning banner in each patient's Labs tab and the alert badge in the patient list whenever
              their latest Hemoglobin reading is below this value.
            </p>

            {ACIDOSIS_FIELDS.map(renderField)}
            <p className="patient-meta">
              For any AKI or CKD patient (recorded baseline creatinine or eGFR), when both the latest VBG pH and HCO3
              are below these values, the Labs tab shows a warning to start sodium bicarbonate (IV or oral).
            </p>

            {CKD_MBD_FIELDS.map(renderField)}
            <p className="patient-meta">
              Used by the CKD-MBD banner's flags (phosphate binder, calcium, PTH/vitamin D, and acidosis
              recommendations) in the Labs tab for CKD patients.
            </p>

            {PHOSPHATE_FIELDS.map(renderField)}
            <p className="patient-meta">
              Phosphorus is age-dependent in children — these age-band upper limits decide when the phosphate binder
              flag above triggers, instead of one fixed adult number.
            </p>

            {error && <p className="form-error">{error}</p>}
            {saved && <p className="patient-meta">Saved.</p>}
            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
