import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPatient } from '../lib/api/patients'
import { addLabEntry } from '../lib/api/labs'
import { addUrineOutputEntry } from '../lib/api/urineOutput'
import { addMedication } from '../lib/api/medications'
import { addProgressNote } from '../lib/api/notes'

const todayIso = () => new Date().toISOString().slice(0, 10)

export function QuickAkiEntryPage() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Patient
  const [name, setName] = useState('')
  const [ageYears, setAgeYears] = useState('')
  const [ageMonths, setAgeMonths] = useState('')
  const [sex, setSex] = useState('')
  const [bed, setBed] = useState('')
  const [underlyingDisease, setUnderlyingDisease] = useState('')
  const [diagnosis, setDiagnosis] = useState('Acute kidney injury')
  const [onVentilator, setOnVentilator] = useState(true)

  // Labs
  const [creatinine, setCreatinine] = useState('')
  const [ph, setPh] = useState('')
  const [bicarbonate, setBicarbonate] = useState('')
  const [potassium, setPotassium] = useState('')

  // Urine output
  const [anuric, setAnuric] = useState(true)
  const [uoVolumeMl, setUoVolumeMl] = useState('0')
  const [uoDurationHours, setUoDurationHours] = useState('96')

  // Medications
  const [furosemideDose1, setFurosemideDose1] = useState('2')
  const [furosemideDose2, setFurosemideDose2] = useState('4')
  const [inotropeName, setInotropeName] = useState('')
  const [inotropeDose, setInotropeDose] = useState('')

  // Dialysis / plan
  const [pdCatheter, setPdCatheter] = useState(true)
  const [plan, setPlan] = useState(
    'Severe oligo-anuric AKI with treatment-resistant metabolic acidosis, unresponsive to high-dose furosemide. Plan: urgent peritoneal dialysis catheter placement and PD initiation.'
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Patient name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const date = todayIso()
      const age =
        ageYears === '' && ageMonths === ''
          ? null
          : Math.round(((ageYears === '' ? 0 : Number(ageYears)) + (ageMonths === '' ? 0 : Number(ageMonths)) / 12) * 1000) / 1000
      const patient = await createPatient({
        name: name.trim(),
        age,
        sex: sex || null,
        bed: bed || null,
        diagnosis: diagnosis || null,
        underlyingDisease: underlyingDisease || null,
        careStatus: 'inpatient',
      })

      const labJobs: Promise<unknown>[] = []
      if (creatinine) {
        labJobs.push(
          addLabEntry({
            patientId: patient.id,
            date,
            category: 'Chemistry',
            test: 'Creatinine',
            value: Number(creatinine),
            unit: 'mg/dL',
          })
        )
      }
      if (ph) {
        labJobs.push(
          addLabEntry({ patientId: patient.id, date, category: 'Blood gas', test: 'pH', value: Number(ph) })
        )
      }
      if (bicarbonate) {
        labJobs.push(
          addLabEntry({
            patientId: patient.id,
            date,
            category: 'Blood gas',
            test: 'Bicarbonate',
            value: Number(bicarbonate),
            unit: 'mEq/L',
          })
        )
      }
      if (potassium) {
        labJobs.push(
          addLabEntry({
            patientId: patient.id,
            date,
            category: 'Chemistry',
            test: 'Potassium',
            value: Number(potassium),
            unit: 'mEq/L',
          })
        )
      }

      labJobs.push(
        addUrineOutputEntry({
          patientId: patient.id,
          recordedAt: new Date().toISOString(),
          volumeMl: anuric ? 0 : Number(uoVolumeMl) || 0,
          durationHours: Number(uoDurationHours) || 0,
          notes: anuric ? 'Anuric' : null,
        })
      )

      if (furosemideDose1) {
        labJobs.push(
          addMedication({
            patientId: patient.id,
            name: 'Furosemide',
            dose: null,
            doseKg: Number(furosemideDose1),
            route: 'IV',
            freq: null,
            start: date,
            stop: null,
            indication: 'AKI / anuria',
            renalAdj: null,
            notes: 'Initial dose',
            active: true,
          })
        )
      }
      if (furosemideDose2) {
        labJobs.push(
          addMedication({
            patientId: patient.id,
            name: 'Furosemide',
            dose: null,
            doseKg: Number(furosemideDose2),
            route: 'IV',
            freq: null,
            start: date,
            stop: null,
            indication: 'AKI / anuria, no response to initial dose',
            renalAdj: null,
            notes: 'Escalated dose',
            active: true,
          })
        )
      }
      if (inotropeName.trim()) {
        labJobs.push(
          addMedication({
            patientId: patient.id,
            name: inotropeName.trim(),
            dose: inotropeDose || null,
            doseKg: null,
            route: 'IV infusion',
            freq: null,
            start: date,
            stop: null,
            indication: 'Hemodynamic support',
            renalAdj: null,
            notes: null,
            active: true,
          })
        )
      }

      const objectiveParts = [
        onVentilator ? 'On mechanical ventilation.' : null,
        creatinine ? `Creatinine ${creatinine} mg/dL.` : null,
        ph ? `Arterial pH ${ph}.` : null,
        bicarbonate ? `Bicarbonate ${bicarbonate} mEq/L.` : null,
        anuric ? `Anuric for ${uoDurationHours} hours despite furosemide.` : null,
        inotropeName.trim() ? `On ${inotropeName.trim()}${inotropeDose ? ` (${inotropeDose})` : ''}.` : null,
      ].filter(Boolean)

      labJobs.push(
        addProgressNote({
          patientId: patient.id,
          date,
          weight: null,
          bp: null,
          uo: anuric ? 'Anuric' : `${uoVolumeMl} mL / ${uoDurationHours} h`,
          S: null,
          O: objectiveParts.join(' '),
          A: 'Severe AKI with treatment-resistant metabolic acidosis, diuretic-unresponsive.',
          P: pdCatheter ? plan : plan.replace(/Plan:.*/i, '').trim() || null,
        })
      )

      await Promise.all(labJobs)
      navigate(`/patients/${patient.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">Quick AKI Entry</h1>
      <p className="empty-state" style={{ margin: 0 }}>
        One form to log a new acute-AKI patient: demographics, key labs, urine output, diuretic/inotrope doses, and
        a dialysis plan — all in a single save.
      </p>

      <form className="assessment-form" onSubmit={(e) => void handleSubmit(e)} style={{ marginTop: 16 }}>
        <fieldset>
          <legend>Patient</legend>
          <div className="field-grid">
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </label>
            <label>
              Age
              <div className="form-actions" style={{ gap: 8 }}>
                <input
                  type="number"
                  min={0}
                  step="1"
                  placeholder="Years"
                  value={ageYears}
                  onChange={(e) => setAgeYears(e.target.value)}
                  style={{ width: 90 }}
                />
                <span className="patient-meta">yr</span>
                <input
                  type="number"
                  min={0}
                  max={11}
                  step="1"
                  placeholder="Months"
                  value={ageMonths}
                  onChange={(e) => setAgeMonths(e.target.value)}
                  style={{ width: 90 }}
                />
                <span className="patient-meta">mo</span>
              </div>
            </label>
            <label>
              Sex
              <select value={sex} onChange={(e) => setSex(e.target.value)}>
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>
            <label>
              Bed
              <input value={bed} onChange={(e) => setBed(e.target.value)} />
            </label>
            <label>
              Diagnosis
              <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </label>
            <label>
              Underlying disease
              <input
                value={underlyingDisease}
                onChange={(e) => setUnderlyingDisease(e.target.value)}
                placeholder="e.g. Ataxia-telangiectasia"
              />
            </label>
          </div>
          <label className="checkbox-field">
            <input type="checkbox" checked={onVentilator} onChange={(e) => setOnVentilator(e.target.checked)} />
            On mechanical ventilation
          </label>
        </fieldset>

        <fieldset>
          <legend>Key labs (today)</legend>
          <div className="field-grid">
            <label>
              Creatinine (mg/dL)
              <input type="number" step="0.1" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} />
            </label>
            <label>
              Arterial pH
              <input type="number" step="0.01" value={ph} onChange={(e) => setPh(e.target.value)} />
            </label>
            <label>
              Bicarbonate (mEq/L)
              <input type="number" step="0.1" value={bicarbonate} onChange={(e) => setBicarbonate(e.target.value)} />
            </label>
            <label>
              Potassium (mEq/L)
              <input type="number" step="0.1" value={potassium} onChange={(e) => setPotassium(e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Urine output</legend>
          <label className="checkbox-field">
            <input type="checkbox" checked={anuric} onChange={(e) => setAnuric(e.target.checked)} />
            Anuric
          </label>
          <div className="field-grid">
            <label>
              Duration (hours)
              <input type="number" value={uoDurationHours} onChange={(e) => setUoDurationHours(e.target.value)} />
            </label>
            {!anuric && (
              <label>
                Volume (mL)
                <input type="number" value={uoVolumeMl} onChange={(e) => setUoVolumeMl(e.target.value)} />
              </label>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Medications given</legend>
          <div className="field-grid">
            <label>
              Furosemide — dose 1 (mg/kg)
              <input
                type="number"
                step="0.1"
                value={furosemideDose1}
                onChange={(e) => setFurosemideDose1(e.target.value)}
              />
            </label>
            <label>
              Furosemide — dose 2 (mg/kg)
              <input
                type="number"
                step="0.1"
                value={furosemideDose2}
                onChange={(e) => setFurosemideDose2(e.target.value)}
              />
            </label>
            <label>
              Inotrope
              <input
                value={inotropeName}
                onChange={(e) => setInotropeName(e.target.value)}
                placeholder="e.g. Dopamine"
              />
            </label>
            <label>
              Inotrope dose
              <input
                value={inotropeDose}
                onChange={(e) => setInotropeDose(e.target.value)}
                placeholder="e.g. 10 mcg/kg/min"
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Dialysis / plan</legend>
          <label className="checkbox-field">
            <input type="checkbox" checked={pdCatheter} onChange={(e) => setPdCatheter(e.target.checked)} />
            Peritoneal dialysis catheter planned / placed today
          </label>
          <label>
            Assessment &amp; plan
            <textarea rows={3} value={plan} onChange={(e) => setPlan(e.target.value)} style={{ width: '100%' }} />
          </label>
        </fieldset>

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save patient'}
          </button>
        </div>
      </form>
    </div>
  )
}
