import { useNavigate } from 'react-router-dom'
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
import { DIPSTICK_OPTIONS } from '../lib/labPresets'
import {
  classifyDipstickProtein,
  classifyProteinRate,
  classifyUpcRatio,
  DIPSTICK_PROTEIN_EQUIVALENTS,
  PROTEINURIA_CLASS_LABEL,
  urineProteinRateMgM2Hr,
  type ProteinuriaClass,
} from '../lib/proteinuria'

const CALCS = [
  { id: 'egfr', label: 'Schwartz eGFR' },
  { id: 'bsa', label: 'BSA' },
  { id: 'bmi', label: 'BMI' },
  { id: 'hs', label: 'Holliday-Segar' },
  { id: 'ca', label: 'Corrected Ca' },
  { id: 'tsat', label: 'TSAT' },
  { id: 'aki', label: 'AKI stage' },
  { id: 'fena', label: 'FeNa' },
  { id: 'feu', label: 'FeUrea' },
  { id: 'protein', label: 'Proteinuria' },
  { id: 'dose', label: 'Total dose' },
] as const

export function CalculatorsPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<(typeof CALCS)[number]['id']>('egfr')
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
  const [proteinuriaMethod, setProteinuriaMethod] = useState<'dipstick' | '24h' | 'upc'>('upc')
  const [dipstickGrade, setDipstickGrade] = useState('')
  const [protein24h, setProtein24h] = useState('')
  const [proteinBsa, setProteinBsa] = useState('')
  const [upcRatio, setUpcRatio] = useState('')

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

  const protein24hVal = Number(protein24h)
  const proteinBsaVal = Number(proteinBsa)
  const proteinRate = protein24hVal && proteinBsaVal ? urineProteinRateMgM2Hr(protein24hVal, proteinBsaVal) : null
  const upcRatioVal = Number(upcRatio)

  let proteinuriaResult: { text: string; cls: ProteinuriaClass | null } = { text: '—', cls: null }
  if (proteinuriaMethod === 'dipstick' && dipstickGrade) {
    proteinuriaResult = { text: DIPSTICK_PROTEIN_EQUIVALENTS[dipstickGrade], cls: classifyDipstickProtein(dipstickGrade) }
  } else if (proteinuriaMethod === '24h' && proteinRate != null) {
    proteinuriaResult = { text: `${proteinRate.toFixed(1)} mg/m²/hr`, cls: classifyProteinRate(proteinRate) }
  } else if (proteinuriaMethod === 'upc' && upcRatioVal) {
    proteinuriaResult = { text: `${upcRatioVal.toFixed(2)} mg/mg`, cls: classifyUpcRatio(upcRatioVal) }
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
            <h1>Calculators</h1>
            <p className="np-sub">Standard pediatric formulas — reference aids, not a substitute for clinical judgement.</p>
          </div>
          <svg className="np-art np-art-float" width="78" height="90" viewBox="0 0 78 90" fill="none" aria-hidden="true">
            <rect x="6" y="4" width="66" height="82" rx="12" fill="rgba(255,255,255,.08)" stroke="#4F86E8" strokeWidth={2} />
            <rect x="14" y="12" width="50" height="22" rx="6" fill="#0A2352" stroke="#9CC2FF" strokeWidth={1.5} />
            <text x="56" y="28" textAnchor="end" fill="#7FD4FF" fontSize="13" fontWeight="700" fontFamily="Plus Jakarta Sans">
              37.3
            </text>
            <rect className="calc-cursor" x="57" y="17" width="2" height="13" fill="#7FD4FF" />
            <g fill="#9CC2FF">
              <circle cx="22" cy="48" r="4" />
              <circle cx="39" cy="48" r="4" />
              <circle cx="56" cy="48" r="4" fill="#FFC46B" />
              <circle cx="22" cy="63" r="4" />
              <circle cx="39" cy="63" r="4" />
              <circle cx="56" cy="63" r="4" />
              <circle cx="22" cy="77" r="4" />
              <circle cx="39" cy="77" r="4" />
              <circle cx="56" cy="77" r="4" />
            </g>
          </svg>
        </div>
      </section>

      <div className="np-chips calc-cchips np-fade" style={{ animationDelay: '.06s' }}>
        {CALCS.map((c) => (
          <button key={c.id} type="button" className={selected === c.id ? 'np-chip on' : 'np-chip'} onClick={() => setSelected(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="calc-grid">
        <section className={selected === 'egfr' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.1s' }}>
          <h2 className="calc-card-title">Bedside Schwartz eGFR</h2>
          <label htmlFor="egfr-h">
            Height (cm)
            <input id="egfr-h" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label htmlFor="egfr-cr">
            Serum creatinine (mg/dL)
            <input id="egfr-cr" type="number" value={cr} onChange={(e) => setCr(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{h && c ? schwartzEGFR(h, c).toFixed(1) : '—'}</span>
            <span className="calc-result-unit">mL/min/1.73 m²</span>
          </div>
          <span className="np-small">0.413 × height (cm) ÷ serum creatinine</span>
        </section>

        <section className={selected === 'bsa' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.14s' }}>
          <h2 className="calc-card-title">Body surface area</h2>
          <label htmlFor="bsa-h">
            Height (cm)
            <input id="bsa-h" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label htmlFor="bsa-w">
            Weight (kg)
            <input id="bsa-w" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{h && w ? bsaMosteller(h, w).toFixed(2) : '—'}</span>
            <span className="calc-result-unit">m²</span>
          </div>
          <span className="np-small">Mosteller: √(height × weight ÷ 3600)</span>
        </section>

        <section className={selected === 'bmi' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.18s' }}>
          <h2 className="calc-card-title">BMI</h2>
          <label htmlFor="bmi-h">
            Height (cm)
            <input id="bmi-h" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          <label htmlFor="bmi-w">
            Weight (kg)
            <input id="bmi-w" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{h && w ? bmiCalc(h, w).toFixed(1) : '—'}</span>
            <span className="calc-result-unit">kg/m²</span>
          </div>
          <span className="np-small">Weight ÷ height² (m)</span>
        </section>

        <section className={selected === 'hs' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.22s' }}>
          <h2 className="calc-card-title">Maintenance fluid (Holliday-Segar)</h2>
          <label htmlFor="hs-w">
            Weight (kg)
            <input id="hs-w" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{w ? maintenanceFluidPerDay(w).toFixed(0) : '—'}</span>
            <span className="calc-result-unit">
              mL/day {w ? `(${(maintenanceFluidPerDay(w) / 24).toFixed(1)} mL/hr)` : ''}
            </span>
          </div>
          <span className="np-small">100 mL/kg first 10 kg, 50 mL/kg next 10, 20 mL/kg after</span>
        </section>

        <section className={selected === 'ca' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.26s' }}>
          <h2 className="calc-card-title">Corrected calcium (Payne)</h2>
          <label htmlFor="ca-ca">
            Measured calcium (mg/dL)
            <input id="ca-ca" type="number" value={calcium} onChange={(e) => setCalcium(e.target.value)} />
          </label>
          <label htmlFor="ca-alb">
            Albumin (g/dL)
            <input id="ca-alb" type="number" value={albumin} onChange={(e) => setAlbumin(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{ca && alb ? correctedCalcium(ca, alb).toFixed(2) : '—'}</span>
            <span className="calc-result-unit">mg/dL (ref albumin 4.0 g/dL)</span>
          </div>
          <span className="np-small">Ca + 0.8 × (4.0 − albumin)</span>
        </section>

        <section className={selected === 'tsat' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.3s' }}>
          <h2 className="calc-card-title">Transferrin saturation (TSAT)</h2>
          <label htmlFor="tsat-fe">
            Serum iron (µg/dL)
            <input id="tsat-fe" type="number" value={iron} onChange={(e) => setIron(e.target.value)} />
          </label>
          <label htmlFor="tsat-tibc">
            TIBC (µg/dL)
            <input id="tsat-tibc" type="number" value={tibc} onChange={(e) => setTibc(e.target.value)} />
          </label>
          <div className={tsat != null && tsat < 20 ? 'calc-result-tile calc-result-tile--warning' : 'calc-result-tile'}>
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{tsat != null ? tsat.toFixed(1) : '—'}</span>
            <span className="calc-result-unit">
              % {tsat != null && tsat < 20 ? '— below 20%: consider iron repletion' : ''}
            </span>
          </div>
          <span className="np-small">Serum iron ÷ TIBC × 100</span>
        </section>

        <section className={selected === 'aki' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.34s' }}>
          <h2 className="calc-card-title">AKI stage (KDIGO)</h2>
          <label htmlFor="aki-b">
            Baseline creatinine (mg/dL)
            <input id="aki-b" type="number" value={baselineCr} onChange={(e) => setBaselineCr(e.target.value)} />
          </label>
          <label htmlFor="aki-c">
            Current creatinine (mg/dL)
            <input id="aki-c" type="number" value={currentCr} onChange={(e) => setCurrentCr(e.target.value)} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={onRRT} onChange={(e) => setOnRRT(e.target.checked)} />
            On dialysis/RRT
          </label>
          <div className={stage ? 'calc-result-tile calc-result-tile--warning' : 'calc-result-tile'}>
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{stage ? `Stage ${stage}` : baseCrVal && currCrVal ? 'No AKI' : '—'}</span>
            <span className="calc-result-unit">by creatinine criteria (no urine-output data)</span>
          </div>
          <span className="np-small">Ratio ≥1.5 stage 1, ≥2 stage 2, ≥3 stage 3</span>
        </section>

        <section className={selected === 'fena' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.38s' }}>
          <h2 className="calc-card-title">FeNa</h2>
          <div className="calc-fields two">
            <label htmlFor="fena-una">
              Urine sodium (mEq/L)
              <input id="fena-una" type="number" value={uNa} onChange={(e) => setUNa(e.target.value)} />
            </label>
            <label htmlFor="fena-pna">
              Plasma sodium (mEq/L)
              <input id="fena-pna" type="number" value={pNa} onChange={(e) => setPNa(e.target.value)} />
            </label>
            <label htmlFor="fena-ucr">
              Urine creatinine (mg/dL)
              <input id="fena-ucr" type="number" value={uCr} onChange={(e) => setUCr(e.target.value)} />
            </label>
            <label htmlFor="fena-pcr">
              Plasma creatinine (mg/dL)
              <input id="fena-pcr" type="number" value={pCr} onChange={(e) => setPCr(e.target.value)} />
            </label>
          </div>
          <div className={feNaVal != null && feNaVal > 2 ? 'calc-result-tile calc-result-tile--warning' : 'calc-result-tile'}>
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{feNaVal != null ? feNaVal.toFixed(2) : '—'}</span>
            <span className="calc-result-unit">
              % ({feNaVal != null ? (feNaVal < 1 ? 'suggests prerenal' : feNaVal > 2 ? 'suggests intrinsic (ATN)' : 'indeterminate') : '<1% prerenal, >2% intrinsic'})
            </span>
          </div>
          <span className="np-small">(Urine Na × plasma Cr) ÷ (plasma Na × urine Cr) × 100</span>
        </section>

        <section className={selected === 'feu' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.42s' }}>
          <h2 className="calc-card-title">FeUrea</h2>
          <div className="calc-fields two">
            <label htmlFor="feu-uun">
              Urine urea nitrogen (mg/dL)
              <input id="feu-uun" type="number" value={uUrea} onChange={(e) => setUUrea(e.target.value)} />
            </label>
            <label htmlFor="feu-bun">
              Plasma urea nitrogen / BUN (mg/dL)
              <input id="feu-bun" type="number" value={pUrea} onChange={(e) => setPUrea(e.target.value)} />
            </label>
            <label htmlFor="feu-ucr2">
              Urine creatinine (mg/dL)
              <input id="feu-ucr2" type="number" value={uCr} onChange={(e) => setUCr(e.target.value)} />
            </label>
            <label htmlFor="feu-pcr2">
              Plasma creatinine (mg/dL)
              <input id="feu-pcr2" type="number" value={pCr} onChange={(e) => setPCr(e.target.value)} />
            </label>
          </div>
          <div className={feUreaVal != null && feUreaVal > 50 ? 'calc-result-tile calc-result-tile--warning' : 'calc-result-tile'}>
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{feUreaVal != null ? feUreaVal.toFixed(1) : '—'}</span>
            <span className="calc-result-unit">
              % ({feUreaVal != null ? (feUreaVal < 35 ? 'suggests prerenal' : feUreaVal > 50 ? 'suggests intrinsic' : 'indeterminate') : 'useful when on diuretics'})
            </span>
          </div>
          <span className="np-small">(Urine urea N × plasma Cr) ÷ (BUN × urine Cr) × 100</span>
        </section>

        <section className={selected === 'protein' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.46s' }}>
          <h2 className="calc-card-title">Proteinuria interpretation</h2>
          <label htmlFor="protein-method">
            Collection method
            <select
              id="protein-method"
              value={proteinuriaMethod}
              onChange={(e) => setProteinuriaMethod(e.target.value as typeof proteinuriaMethod)}
            >
              <option value="upc">Spot urine protein/creatinine ratio</option>
              <option value="24h">24-hour urine collection</option>
              <option value="dipstick">Dipstick (qualitative)</option>
            </select>
          </label>
          {proteinuriaMethod === 'upc' && (
            <label htmlFor="protein-upc">
              UPC ratio (mg/mg)
              <input id="protein-upc" type="number" step="any" value={upcRatio} onChange={(e) => setUpcRatio(e.target.value)} />
            </label>
          )}
          {proteinuriaMethod === '24h' && (
            <div className="calc-fields two">
              <label htmlFor="protein-24h">
                Total protein (mg/24h)
                <input id="protein-24h" type="number" step="any" value={protein24h} onChange={(e) => setProtein24h(e.target.value)} />
              </label>
              <label htmlFor="protein-bsa">
                BSA (m²)
                <input id="protein-bsa" type="number" step="any" value={proteinBsa} onChange={(e) => setProteinBsa(e.target.value)} />
              </label>
            </div>
          )}
          {proteinuriaMethod === 'dipstick' && (
            <label htmlFor="protein-dip">
              Dipstick grade
              <select id="protein-dip" value={dipstickGrade} onChange={(e) => setDipstickGrade(e.target.value)}>
                <option value="">Select</option>
                {DIPSTICK_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div
            className={
              proteinuriaResult.cls && proteinuriaResult.cls !== 'normal'
                ? 'calc-result-tile calc-result-tile--warning'
                : 'calc-result-tile'
            }
          >
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{proteinuriaResult.cls ? PROTEINURIA_CLASS_LABEL[proteinuriaResult.cls] : '—'}</span>
            <span className="calc-result-unit">
              {proteinuriaResult.text}
              {proteinuriaMethod === 'dipstick' ? ' — confirm with a quantitative test' : ''}
            </span>
          </div>
        </section>

        <section className={selected === 'dose' ? 'calc-card sel np-fade' : 'calc-card np-fade'} style={{ animationDelay: '.5s' }}>
          <h2 className="calc-card-title">Total dose</h2>
          <label htmlFor="dose-w">
            Weight (kg)
            <input id="dose-w" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </label>
          <label htmlFor="dose-mgkg">
            Dose (mg/kg)
            <input id="dose-mgkg" type="number" value={mgPerKg} onChange={(e) => setMgPerKg(e.target.value)} />
          </label>
          <div className="calc-result-tile">
            <span className="calc-result-label">RESULT</span>
            <span className="calc-result-value">{w && dose ? totalDose(w, dose).toFixed(1) : '—'}</span>
            <span className="calc-result-unit">mg</span>
          </div>
        </section>
      </div>
    </div>
  )
}
