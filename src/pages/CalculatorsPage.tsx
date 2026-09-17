import { useState } from 'react'
import {
  bmiCalc,
  bsaMosteller,
  correctedCalcium,
  maintenanceFluidPerDay,
  schwartzEGFR,
  totalDose,
  transferrinSaturation,
} from '../lib/formulas'
import { CalculatorIcon } from '../components/icons'

export function CalculatorsPage() {
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [cr, setCr] = useState('')
  const [mgPerKg, setMgPerKg] = useState('')
  const [calcium, setCalcium] = useState('')
  const [albumin, setAlbumin] = useState('')
  const [iron, setIron] = useState('')
  const [tibc, setTibc] = useState('')

  const h = Number(height)
  const w = Number(weight)
  const c = Number(cr)
  const dose = Number(mgPerKg)
  const ca = Number(calcium)
  const alb = Number(albumin)
  const fe = Number(iron)
  const tibcVal = Number(tibc)
  const tsat = fe && tibcVal ? transferrinSaturation(fe, tibcVal) : null

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
          <h2 className="calc-card-title">Corrected calcium (Payne)</h2>
          <label>
            Measured calcium (mg/dL)
            <input type="number" value={calcium} onChange={(e) => setCalcium(e.target.value)} />
          </label>
          <label>
            Albumin (g/dL)
            <input type="number" value={albumin} onChange={(e) => setAlbumin(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-value">{ca && alb ? correctedCalcium(ca, alb).toFixed(2) : '—'}</span>
            <span className="calc-result-unit">mg/dL (ref albumin 4.0 g/dL)</span>
          </div>
        </div>

        <div className="calc-card">
          <h2 className="calc-card-title">Transferrin saturation (TSAT)</h2>
          <label>
            Serum iron (µg/dL)
            <input type="number" value={iron} onChange={(e) => setIron(e.target.value)} />
          </label>
          <label>
            TIBC (µg/dL)
            <input type="number" value={tibc} onChange={(e) => setTibc(e.target.value)} />
          </label>
          <div className={`calc-result-tile ${tsat != null && tsat < 20 ? 'calc-result-tile--warning' : ''}`}>
            <span className="calc-result-value">{tsat != null ? tsat.toFixed(1) : '—'}</span>
            <span className="calc-result-unit">
              % {tsat != null && tsat < 20 ? '— below 20%: consider iron repletion' : ''}
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
