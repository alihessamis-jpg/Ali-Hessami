import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_USER_SETTINGS, getUserSettings, updateUserSettings } from '../lib/api/settings'
import { getAnimationsEnabled, setAnimationsEnabled } from '../lib/animationsPreference'
import { useAuth } from '../context/AuthContext'
import { StorageUsageIndicator } from '../components/StorageUsageIndicator'
import type { UserSettings } from '../types/domain'

type FormState = Record<keyof UserSettings, string>

function toFormState(s: UserSettings): FormState {
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])) as FormState
}

interface FieldConfig {
  key: keyof UserSettings
  label: string
  step: string
  unit?: string
}

const ANEMIA_FIELDS: FieldConfig[] = [{ key: 'anemiaHbThreshold', label: 'Hemoglobin below', step: '0.1', unit: 'g/dL' }]

const ACIDOSIS_FIELDS: FieldConfig[] = [
  { key: 'acidosisPhThreshold', label: 'pH below', step: '0.01' },
  { key: 'acidosisHco3Threshold', label: 'HCO3 below', step: '0.5', unit: 'mEq/L' },
  { key: 'ckdMbdBicarbLow', label: 'Bicarbonate low', step: '0.5', unit: 'mEq/L' },
]

const CKD_MBD_FIELDS: FieldConfig[] = [
  { key: 'ckdMbdCaLow', label: 'Calcium low (corrected)', step: '0.1', unit: 'mg/dL' },
  { key: 'ckdMbdCaHigh', label: 'Calcium high (corrected)', step: '0.1', unit: 'mg/dL' },
  { key: 'ckdMbdPthHigh', label: 'PTH high', step: '1', unit: 'pg/mL' },
  { key: 'ckdMbdPthLow', label: 'PTH low', step: '1', unit: 'pg/mL' },
  { key: 'ckdMbdVitDDeficient', label: 'Vit D deficient below', step: '1', unit: 'ng/mL' },
  { key: 'ckdMbdVitDInsufficient', label: 'Vit D insufficient below', step: '1', unit: 'ng/mL' },
]

const PHOSPHATE_FIELDS: FieldConfig[] = [
  { key: 'phosphateUnder1y', label: 'Under 1 year', step: '0.1', unit: 'mg/dL' },
  { key: 'phosphateAge1to3', label: '1 to 3 years', step: '0.1', unit: 'mg/dL' },
  { key: 'phosphateAge3to10', label: '3 to 10 years', step: '0.1', unit: 'mg/dL' },
  { key: 'phosphateAge10to17', label: '10 to 17 years', step: '0.1', unit: 'mg/dL' },
  { key: 'phosphateAdult', label: '17 years and up', step: '0.1', unit: 'mg/dL' },
]

const BIOPSY_FIELDS: FieldConfig[] = [
  { key: 'biopsyPlateletMin', label: 'Platelets must be at least', step: '1', unit: 'x10³/µL' },
  { key: 'biopsyInrMax', label: 'INR must be at most', step: '0.1' },
]

const HUS_FIELDS: FieldConfig[] = [{ key: 'husLdhUpperLimit', label: 'LDH upper limit of normal', step: '1', unit: 'U/L' }]

const ALL_FIELDS = [...ANEMIA_FIELDS, ...ACIDOSIS_FIELDS, ...CKD_MBD_FIELDS, ...PHOSPHATE_FIELDS, ...BIOPSY_FIELDS, ...HUS_FIELDS]

export function SettingsPage() {
  const navigate = useNavigate()
  const { session, signOut } = useAuth()
  const [form, setForm] = useState<FormState>(toFormState(DEFAULT_USER_SETTINGS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [animationsOn, setAnimationsOn] = useState(true)

  useEffect(() => {
    setAnimationsOn(getAnimationsEnabled())
  }, [])

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

  function toggleAnimations() {
    const next = !animationsOn
    setAnimationsOn(next)
    setAnimationsEnabled(next)
  }

  function renderField({ key, label, step, unit }: FieldConfig) {
    return (
      <div className="np-field set-unit" key={key}>
        <label htmlFor={key}>{label}</label>
        <input
          id={key}
          type="number"
          step={step}
          min="0"
          inputMode="decimal"
          value={form[key]}
          onChange={(e) => setField(key, e.target.value)}
        />
        {unit && <span>{unit}</span>}
      </div>
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
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow blue" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Settings</h1>
            <p className="np-sub">Lab alert thresholds drive the warnings across patient charts and the patient list.</p>
          </div>
          <svg className="np-art" width="84" height="84" viewBox="0 0 84 84" fill="none" aria-hidden="true">
            <g className="set-spin">
              <circle cx="32" cy="36" r="16" stroke="#9CC2FF" strokeWidth={6} strokeDasharray="7 5.5" />
              <circle cx="32" cy="36" r="9" stroke="#9CC2FF" strokeWidth={4} />
            </g>
            <g className="set-spin2">
              <circle cx="60" cy="58" r="11" stroke="#FFC46B" strokeWidth={5} strokeDasharray="5 4.4" />
              <circle cx="60" cy="58" r="5" stroke="#FFC46B" strokeWidth={3} />
            </g>
          </svg>
        </div>
      </section>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={(e) => void handleSave(e)}>
          <div className="np-grid2">
            <div className="np-stack">
              <section className="np-card np-fade" style={{ animationDelay: '.1s' }}>
                <div className="np-head-l">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#C9372C' }} />
                  <h2>Anemia</h2>
                </div>
                <div className="set-tf">{ANEMIA_FIELDS.map(renderField)}</div>
                <span className="np-small" style={{ lineHeight: 1.5 }}>
                  Below this, the patient list shows an alert badge and the Labs tab a warning.
                </span>
              </section>

              <section className="np-card np-fade" style={{ animationDelay: '.16s' }}>
                <div className="np-head-l">
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#E0A33A' }} />
                  <h2>Acidosis</h2>
                </div>
                <div className="set-tf">{ACIDOSIS_FIELDS.map(renderField)}</div>
                <span className="np-small" style={{ lineHeight: 1.5 }}>
                  For AKI or CKD patients, when both latest VBG values are below these, the Labs tab suggests sodium
                  bicarbonate.
                </span>
              </section>
            </div>

            <section className="np-card np-fade" style={{ animationDelay: '.22s' }}>
              <div className="np-head-l">
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1E5BD8' }} />
                <h2>Mineral &amp; bone</h2>
              </div>
              <div className="set-tf">{CKD_MBD_FIELDS.map(renderField)}</div>
              <span className="np-small" style={{ lineHeight: 1.5 }}>
                Corrected calcium, PTH and vitamin D ranges used across the Labs tab.
              </span>
            </section>
          </div>

          <div className="np-grid2">
            <section className="np-card np-fade" style={{ animationDelay: '.28s' }}>
              <h2>Phosphorus upper limits by age</h2>
              <div className="set-tf">{PHOSPHATE_FIELDS.map(renderField)}</div>
              <span className="np-small" style={{ lineHeight: 1.5 }}>
                Phosphorus is age-dependent in children — these bands decide when the phosphate binder flag above
                triggers, instead of one fixed adult number.
              </span>
            </section>

            <div className="np-stack">
              <section className="np-card np-fade" style={{ animationDelay: '.32s' }}>
                <h2>Kidney biopsy safety</h2>
                <div className="set-tf">{BIOPSY_FIELDS.map(renderField)}</div>
                <span className="np-small" style={{ lineHeight: 1.5 }}>
                  Used by the Reminders tab: a reminder mentioning "biopsy" checks the patient's latest Platelets and
                  INR against these limits.
                </span>
              </section>

              <section className="np-card np-fade" style={{ animationDelay: '.36s' }}>
                <h2>HUS activity</h2>
                <div className="set-tf">{HUS_FIELDS.map(renderField)}</div>
                <span className="np-small" style={{ lineHeight: 1.5 }}>
                  HUS is considered active (ongoing hemolysis) while the latest LDH is above this value.
                </span>
              </section>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          {saved && <p className="np-small">Saved.</p>}
          <button type="submit" className="np-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      <section className="np-card np-fade" style={{ animationDelay: '.4s', padding: '6px 16px', gap: 0 }}>
        <button type="button" className="set-sw" role="switch" aria-checked={animationsOn} onClick={toggleAnimations}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <b style={{ fontSize: 15 }}>Animations</b>
            <span className="np-small">Motion in heroes, cards and charts</span>
          </span>
          <span className="set-trk">
            <i />
          </span>
        </button>
        <div style={{ height: 1, background: '#EDF1F7' }} />
        <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 15, display: 'block', marginBottom: 6 }}>Storage</b>
            <StorageUsageIndicator />
          </span>
        </div>
        <div style={{ height: 1, background: '#EDF1F7' }} />
        <button
          type="button"
          style={{
            minHeight: 56,
            display: 'flex',
            alignItems: 'center',
            fontSize: 15,
            fontWeight: 700,
            color: '#B42318',
            background: 'none',
            border: 0,
            textAlign: 'left',
            cursor: 'pointer',
            width: '100%',
          }}
          onClick={() => void signOut()}
        >
          Sign out {session ? `(${session.user.email})` : ''}
        </button>
      </section>
    </div>
  )
}
