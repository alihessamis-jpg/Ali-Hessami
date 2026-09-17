import { useState } from 'react'
import {
  bmiCalc,
  bsaMosteller,
  correctedCalcium,
  feNa,
  feUrea,
  kdigoStage,
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
  const [baselineCr, setBaselineCr] = useState('')
  const [currentCr, setCurrentCr] = useState('')
  const [onRRT, setOnRRT] = useState(false)
  const [uNa, setUNa] = useState('')
  const [pNa, setPNa] = useState('')
  const [uCr, setUCr] = useState('')
  const [pCr, setPCr] = useState('')
  const [uUrea, setUUrea] = useState('')
  const [pUrea, setPUrea] = useState('')

  const h = Number(height)
  const w = Number(weight)
  const c = Number(cr)
  const dose = Number(mgPerKg)
  const ca = Number(calcium)
  const alb = Number(albumin)
  const fe = Number(iron)
  const tibcVal = Number(tibc)
  const tsat = fe && tibcVal ? transferrinSaturation(fe, tibcVal) : null
  const baseCrVal = Number(baselineCr)
  const currCrVal = Number(currentCr)
  const stage = baseCrVal && currCrVal ? kdigoStage(baseCrVal, currCrVal, onRRT) : null
  const uNaVal = Number(uNa)
  const pNaVal = Number(pNa)
  const uCrVal = Number(uCr)
  const pCrVal = Number(pCr)
  const feNaVal = uNaVal && pNaVal && uCrVal && pCrVal ? feNa(uNaVal, pCrVal, pNaVal, uCrVal) : null
  const uUreaVal = Number(uUrea)
  const pUreaVal = Number(pUrea)
  const feUreaVal = uUreaVal && pUreaVal && uCrVal && pCrVal ? feUrea(uUreaVal, pCrVal, pUreaVal, uCrVal) : null

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
          <h2 className="calc-card-title">AKI stage (KDIGO)</h2>
          <label>
            Baseline creatinine (mg/dL)
            <input type="number" value={baselineCr} onChange={(e) => setBaselineCr(e.target.value)} />
          </label>
          <label>
            Current creatinine (mg/dL)
            <input type="number" value={currentCr} onChange={(e) => setCurrentCr(e.target.value)} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={onRRT} onChange={(e) => setOnRRT(e.target.checked)} />
            On dialysis/RRT
          </label>
          <div className={`calc-result-tile ${stage ? 'calc-result-tile--warning' : ''}`}>
            <span className="calc-result-value">{stage ? `Stage ${stage}` : baseCrVal && currCrVal ? 'No AKI' : '—'}</span>
            <span className="calc-result-unit">by creatinine criteria (no urine-output data)</span>
          </div>
        </div>

        <div className="calc-card">
          <h2 className="calc-card-title">FeNa</h2>
          <label>
            Urine sodium (mEq/L)
            <input type="number" value={uNa} onChange={(e) => setUNa(e.target.value)} />
          </label>
          <label>
            Plasma sodium (mEq/L)
            <input type="number" value={pNa} onChange={(e) => setPNa(e.target.value)} />
          </label>
          <label>
            Urine creatinine (mg/dL)
            <input type="number" value={uCr} onChange={(e) => setUCr(e.target.value)} />
          </label>
          <label>
            Plasma creatinine (mg/dL)
            <input type="number" value={pCr} onChange={(e) => setPCr(e.target.value)} />
          </label>
          <div className={`calc-result-tile ${feNaVal != null && feNaVal > 2 ? 'calc-result-tile--warning' : ''}`}>
            <span className="calc-result-value">{feNaVal != null ? feNaVal.toFixed(2) : '—'}</span>
            <span className="calc-result-unit">% ({feNaVal != null ? (feNaVal < 1 ? 'suggests prerenal' : feNaVal > 2 ? 'suggests intrinsic (ATN)' : 'indeterminate') : '<1% prerenal, >2% intrinsic'})</span>
          </div>
        </div>

        <div className="calc-card">
          <h2 className="calc-card-title">FeUrea</h2>
          <label>
            Urine urea nitrogen (mg/dL)
            <input type="number" value={uUrea} onChange={(e) => setUUrea(e.target.value)} />
          </label>
          <label>
            Plasma urea nitrogen / BUN (mg/dL)
            <input type="number" value={pUrea} onChange={(e) => setPUrea(e.target.value)} />
          </label>
          <label>
            Urine creatinine (mg/dL)
            <input type="number" value={uCr} onChange={(e) => setUCr(e.target.value)} />
          </label>
          <label>
            Plasma creatinine (mg/dL)
            <input type="number" value={pCr} onChange={(e) => setPCr(e.target.value)} />
          </label>
          <div className={`calc-result-tile ${feUreaVal != null && feUreaVal > 50 ? 'calc-result-tile--warning' : ''}`}>
            <span className="calc-result-value">{feUreaVal != null ? feUreaVal.toFixed(1) : '—'}</span>
            <span className="calc-result-unit">
              % ({feUreaVal != null ? (feUreaVal < 35 ? 'suggests prerenal' : feUreaVal > 50 ? 'suggests intrinsic' : 'indeterminate') : 'useful when on diuretics'})
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
