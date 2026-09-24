import { useEffect, useState, type FormEvent } from 'react'
import { DEFAULT_USER_SETTINGS, getUserSettings, updateUserSettings } from '../lib/api/settings'
import { SettingsIcon } from '../components/icons'

export function SettingsPage() {
  const [anemiaHbThreshold, setAnemiaHbThreshold] = useState(String(DEFAULT_USER_SETTINGS.anemiaHbThreshold))
  const [acidosisPhThreshold, setAcidosisPhThreshold] = useState(String(DEFAULT_USER_SETTINGS.acidosisPhThreshold))
  const [acidosisHco3Threshold, setAcidosisHco3Threshold] = useState(
    String(DEFAULT_USER_SETTINGS.acidosisHco3Threshold)
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getUserSettings()
      .then((s) => {
        setAnemiaHbThreshold(String(s.anemiaHbThreshold))
        setAcidosisPhThreshold(String(s.acidosisPhThreshold))
        setAcidosisHco3Threshold(String(s.acidosisHco3Threshold))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const hb = Number(anemiaHbThreshold)
    const ph = Number(acidosisPhThreshold)
    const hco3 = Number(acidosisHco3Threshold)
    if ([hb, ph, hco3].some((v) => Number.isNaN(v) || v <= 0)) {
      setError('Enter valid numbers above 0')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateUserSettings({
        anemiaHbThreshold: hb,
        acidosisPhThreshold: ph,
        acidosisHco3Threshold: hco3,
      })
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
            <label>
              Severe anemia alert — Hemoglobin below (g/dL)
              <input
                type="number"
                step="0.1"
                min="0"
                value={anemiaHbThreshold}
                onChange={(e) => {
                  setAnemiaHbThreshold(e.target.value)
                  setSaved(false)
                }}
                style={{ maxWidth: 160 }}
              />
            </label>
            <p className="patient-meta">
              Triggers the warning banner in each patient's Labs tab and the alert badge in the patient list whenever
              their latest Hemoglobin reading is below this value.
            </p>

            <label>
              Severe acidosis alert — pH below
              <input
                type="number"
                step="0.01"
                min="0"
                value={acidosisPhThreshold}
                onChange={(e) => {
                  setAcidosisPhThreshold(e.target.value)
                  setSaved(false)
                }}
                style={{ maxWidth: 160 }}
              />
            </label>
            <label>
              Severe acidosis alert — HCO3 below (mEq/L)
              <input
                type="number"
                step="0.5"
                min="0"
                value={acidosisHco3Threshold}
                onChange={(e) => {
                  setAcidosisHco3Threshold(e.target.value)
                  setSaved(false)
                }}
                style={{ maxWidth: 160 }}
              />
            </label>
            <p className="patient-meta">
              For any AKI or CKD patient (recorded baseline creatinine or eGFR), when both the latest VBG pH and HCO3
              are below these values, the Labs tab shows a warning to start sodium bicarbonate (IV or oral).
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
