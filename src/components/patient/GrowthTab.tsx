import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addGrowthEntry, deleteGrowthEntry, listGrowthEntries } from '../../lib/api/growth'
import {
  ageInMonths,
  ageInYears,
  assessBloodPressure,
  detectGrowthFaltering,
  headCircumferenceForAgePercentile,
  heightForAgePercentile,
  normalizeSex,
  percentileLabel,
  weightForAgePercentile,
  type BpAssessment,
} from '../../lib/growth'
import { toShamsi } from '../../lib/shamsi'
import type { GrowthEntry, Patient } from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
}

function emptyDraft() {
  return {
    date: new Date().toISOString().slice(0, 10),
    heightCm: '',
    weightKg: '',
    headCircCm: '',
    bpSystolic: '',
    bpDiastolic: '',
  }
}

interface RowComputed {
  ageMonths: number | null
  heightPct: number | null
  weightPct: number | null
  hcPct: number | null
  bp: BpAssessment | null
}

export function GrowthTab({ patientId, patient }: Props) {
  const [entries, setEntries] = useState<GrowthEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listGrowthEntries(patientId)
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load growth entries'))
      .finally(() => setLoading(false))
  }

  const sex = normalizeSex(patient.sex)
  const dob = patient.dob

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (
      draft.heightCm === '' &&
      draft.weightKg === '' &&
      draft.headCircCm === '' &&
      draft.bpSystolic === '' &&
      draft.bpDiastolic === ''
    ) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const entry = await addGrowthEntry({
        patientId,
        date: draft.date,
        heightCm: draft.heightCm === '' ? null : Number(draft.heightCm),
        weightKg: draft.weightKg === '' ? null : Number(draft.weightKg),
        headCircCm: draft.headCircCm === '' ? null : Number(draft.headCircCm),
        bpSystolic: draft.bpSystolic === '' ? null : Number(draft.bpSystolic),
        bpDiastolic: draft.bpDiastolic === '' ? null : Number(draft.bpDiastolic),
      })
      setEntries((prev) => [...prev, entry].sort((a, b) => a.date.localeCompare(b.date)))
      setDraft(emptyDraft())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGrowthEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const computed = useMemo<Map<string, RowComputed>>(() => {
    const map = new Map<string, RowComputed>()
    if (!dob || !sex) return map
    for (const e of entries) {
      const ageMonths = ageInMonths(dob, e.date)
      const ageYears = ageInYears(dob, e.date)
      if (ageMonths == null || ageYears == null) {
        map.set(e.id, { ageMonths: null, heightPct: null, weightPct: null, hcPct: null, bp: null })
        continue
      }
      const heightPct = e.heightCm != null ? heightForAgePercentile(e.heightCm, ageMonths, sex) : null
      const weightPct = e.weightKg != null ? weightForAgePercentile(e.weightKg, ageMonths, sex) : null
      const hcPct = e.headCircCm != null ? headCircumferenceForAgePercentile(e.headCircCm, ageMonths, sex) : null
      const bp =
        e.bpSystolic != null && e.bpDiastolic != null
          ? assessBloodPressure(e.bpSystolic, e.bpDiastolic, ageYears, sex, heightPct)
          : null
      map.set(e.id, { ageMonths, heightPct, weightPct, hcPct, bp })
    }
    return map
  }, [entries, dob, sex])

  const falteringFlags = useMemo(() => {
    if (!dob || !sex) return []
    const points = entries
      .filter((e) => e.weightKg != null)
      .map((e) => ({ date: e.date, weightKg: e.weightKg as number, ageMonths: ageInMonths(dob, e.date) }))
      .filter((p): p is { date: string; weightKg: number; ageMonths: number } => p.ageMonths != null)
    return detectGrowthFaltering(points, sex)
  }, [entries, dob, sex])

  const latest = entries.length > 0 ? entries[entries.length - 1] : null
  const latestComputed = latest ? computed.get(latest.id) : undefined
  const latestBpFlag = latestComputed?.bp && latestComputed.bp.category !== 'normal' && latestComputed.bp.category !== 'indeterminate'

  return (
    <div>
      {(!dob || !sex) && (
        <p className="empty-state">
          Add the patient's date of birth and sex in Assessment to calculate growth and blood pressure percentiles.
        </p>
      )}

      {latestComputed && (latestComputed.heightPct != null || latestComputed.weightPct != null || latestComputed.hcPct != null) && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Latest percentiles ({toShamsi(latest!.date)})</h2>
          </div>
          <ul className="study-link-list">
            {latestComputed.weightPct != null && (
              <li>Weight-for-age: {percentileLabel(latestComputed.weightPct)}</li>
            )}
            {latestComputed.heightPct != null && (
              <li>Height/length-for-age: {percentileLabel(latestComputed.heightPct)}</li>
            )}
            {latestComputed.hcPct != null && (
              <li>Head circumference-for-age: {percentileLabel(latestComputed.hcPct)}</li>
            )}
          </ul>
        </div>
      )}

      {falteringFlags.map((f) => (
        <div key={f.reason} className="aki-banner aki-banner--warning">
          <strong>Growth faltering watch</strong>
          <span className="patient-meta">{f.message}</span>
        </div>
      ))}

      {latestComputed?.bp && (
        <div className={`aki-banner ${latestBpFlag ? 'aki-banner--warning' : ''}`}>
          <strong>{latestComputed.bp.label}</strong>
          <span className="patient-meta">{latestComputed.bp.note}</span>
        </div>
      )}

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value || new Date().toISOString().slice(0, 10) })}
          required
        />
        <input
          placeholder="Height/length (cm)"
          type="number"
          step="any"
          value={draft.heightCm}
          onChange={(e) => setDraft({ ...draft, heightCm: e.target.value })}
        />
        <input
          placeholder="Weight (kg)"
          type="number"
          step="any"
          value={draft.weightKg}
          onChange={(e) => setDraft({ ...draft, weightKg: e.target.value })}
        />
        <input
          placeholder="Head circumference (cm)"
          type="number"
          step="any"
          value={draft.headCircCm}
          onChange={(e) => setDraft({ ...draft, headCircCm: e.target.value })}
        />
        <input
          placeholder="BP systolic"
          type="number"
          step="any"
          value={draft.bpSystolic}
          onChange={(e) => setDraft({ ...draft, bpSystolic: e.target.value })}
        />
        <input
          placeholder="BP diastolic"
          type="number"
          step="any"
          value={draft.bpDiastolic}
          onChange={(e) => setDraft({ ...draft, bpDiastolic: e.target.value })}
        />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No growth measurements recorded yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Height</th>
              <th>Weight</th>
              <th>Head circ.</th>
              <th>BP</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...entries].reverse().map((e) => {
              const c = computed.get(e.id)
              const bpAbnormal = c?.bp && c.bp.category !== 'normal' && c.bp.category !== 'indeterminate'
              return (
                <tr key={e.id}>
                  <td>{toShamsi(e.date)}</td>
                  <td className={c?.heightPct != null && (c.heightPct < 3 || c.heightPct > 97) ? 'value-abnormal' : ''}>
                    {e.heightCm != null ? `${e.heightCm} cm` : '—'}
                    {c?.heightPct != null ? ` (${percentileLabel(c.heightPct)})` : ''}
                  </td>
                  <td className={c?.weightPct != null && (c.weightPct < 3 || c.weightPct > 97) ? 'value-abnormal' : ''}>
                    {e.weightKg != null ? `${e.weightKg} kg` : '—'}
                    {c?.weightPct != null ? ` (${percentileLabel(c.weightPct)})` : ''}
                  </td>
                  <td className={c?.hcPct != null && (c.hcPct < 3 || c.hcPct > 97) ? 'value-abnormal' : ''}>
                    {e.headCircCm != null ? `${e.headCircCm} cm` : '—'}
                    {c?.hcPct != null ? ` (${percentileLabel(c.hcPct)})` : ''}
                  </td>
                  <td className={bpAbnormal ? 'value-abnormal' : ''}>
                    {e.bpSystolic != null && e.bpDiastolic != null ? `${e.bpSystolic}/${e.bpDiastolic}` : '—'}
                    {c?.bp && c.bp.category !== 'indeterminate' ? ` (${c.bp.label})` : ''}
                  </td>
                  <td>
                    <button className="link-button" onClick={() => void handleDelete(e.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
