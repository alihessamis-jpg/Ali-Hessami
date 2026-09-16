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

      <div className="calc-grid">
        <div className="calc-card">
          <h2 className="calc-card-title">Bedside Schwartz eGFR</h2>
          <label>
            Height (cm)
            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label>
            Serum creatinine (mg/dL)
            <input type="number" value={cr} onChange={(e) => setCr(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-value">{h && c ? schwartzEGFR(h, c).toFixed(1) : '—'}</span>
            <span className="calc-result-unit">mL/min/1.73 m²</span>
          </div>
        </div>

        <div className="calc-card">
          <h2 className="calc-card-title">Body surface area</h2>
          <label>
            Height (cm)
            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label>
            Weight (kg)
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-value">{h && w ? bsaMosteller(h, w).toFixed(2) : '—'}</span>
            <span className="calc-result-unit">m²</span>
          </div>
        </div>

        <div className="calc-card">
          <h2 className="calc-card-title">BMI</h2>
          <label>
            Height (cm)
            <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label>
            Weight (kg)
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-value">{h && w ? bmiCalc(h, w).toFixed(1) : '—'}</span>
            <span className="calc-result-unit">kg/m²</span>
          </div>
        </div>

        <div className="calc-card">
          <h2 className="calc-card-title">Maintenance fluid (Holliday-Segar)</h2>
          <label>
            Weight (kg)
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-value">{w ? maintenanceFluidPerDay(w).toFixed(0) : '—'}</span>
            <span className="calc-result-unit">
              mL/day {w ? `(${(maintenanceFluidPerDay(w) / 24).toFixed(1)} mL/hr)` : ''}
            </span>
          </div>
        </div>

        <div className="calc-card">
          <h2 className="calc-card-title">Total dose</h2>
          <label>
            Weight (kg)
            <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label>
            Dose (mg/kg)
            <input type="number" value={mgPerKg} onChange={(e) => setMgPerKg(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-value">{w && dose ? totalDose(w, dose).toFixed(1) : '—'}</span>
            <span className="calc-result-unit">mg</span>
          </div>
        </div>
      </div>
    </div>
  )
}
