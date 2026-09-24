import { useEffect, useState, type FormEvent } from 'react'
import { DEFAULT_USER_SETTINGS, getUserSettings, updateUserSettings } from '../lib/api/settings'
import { SettingsIcon } from '../components/icons'

export function SettingsPage() {
  const [anemiaHbThreshold, setAnemiaHbThreshold] = useState(String(DEFAULT_USER_SETTINGS.anemiaHbThreshold))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getUserSettings()
      .then((s) => setAnemiaHbThreshold(String(s.anemiaHbThreshold)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    const value = Number(anemiaHbThreshold)
    if (Number.isNaN(value) || value <= 0) {
      setError('Enter a valid number above 0')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await updateUserSettings({ anemiaHbThreshold: value })
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
