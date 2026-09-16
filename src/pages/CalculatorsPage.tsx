import { useState } from 'react'
import { bmiCalc, bsaMosteller, maintenanceFluidPerDay, schwartzEGFR, totalDose } from '../lib/formulas'
import { CalculatorIcon } from '../components/icons'

export function CalculatorsPage() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [cr, setCr] = useState('')
  const [mgPerKg, setMgPerKg] = useState('')

  const h = Number(height)
  const w = Number(weight)
  const c = Number(cr)
  const dose = Number(mgPerKg)

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <CalculatorIcon />
        </span>
        Calculators
      </h1>
      <p className="empty-state">
        Standard pediatric formulas. Always apply clinical judgement — these are reference aids, not a
        substitute for verifying against current guidelines.
      </p>

      <fieldset>
        <legend>Inputs</legend>
        <div className="field-grid">
          <label>
            Height (cm)
            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label>
            Weight (kg)
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label>
            Creatinine (mg/dL)
            <input type="number" value={cr} onChange={(e) => setCr(e.target.value)} />
          </label>
          <label>
            Dose (mg/kg)
            <input type="number" value={mgPerKg} onChange={(e) => setMgPerKg(e.target.value)} />
          </label>
        </div>
      </fieldset>

      <div className="calc-strip">
        <div>
          <span className="calc-label">Schwartz eGFR</span>
          <span className="calc-value">{h && c ? `${schwartzEGFR(h, c).toFixed(1)} mL/min/1.73m²` : '—'}</span>
        </div>
        <div>
          <span className="calc-label">BSA (Mosteller)</span>
          <span className="calc-value">{h && w ? `${bsaMosteller(h, w).toFixed(2)} m²` : '—'}</span>
        </div>
        <div>
          <span className="calc-label">BMI</span>
          <span className="calc-value">{h && w ? bmiCalc(h, w).toFixed(1) : '—'}</span>
        </div>
      </div>
      <div className="calc-strip">
        <div>
          <span className="calc-label">Maintenance fluid (Holliday-Segar)</span>
          <span className="calc-value">
            {w ? `${maintenanceFluidPerDay(w).toFixed(0)} mL/day (${(maintenanceFluidPerDay(w) / 24).toFixed(1)} mL/hr)` : '—'}
          </span>
        </div>
        <div>
          <span className="calc-label">Total dose</span>
          <span className="calc-value">{w && dose ? `${totalDose(w, dose).toFixed(1)} mg` : '—'}</span>
        </div>
      </div>
    </div>
  )
}
