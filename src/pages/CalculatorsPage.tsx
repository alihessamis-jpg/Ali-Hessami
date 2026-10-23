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
import {
  ADTKD_GENE_FEATURES,
  ADTKD_GENE_HINT,
  bedsideSchwartzEgfrForFeUrate,
  feUrate,
  scoreAdtkdGenes,
  umodScore,
} from '../lib/adtkdFormulas'
import {
  bsaGehanGeorge,
  daugirdasSpKtV,
  defaultVolumeL,
  ektvDaugirdasRate,
  ektvLeypoldt,
  ektvTattersall,
  estimatedUreaGeneration,
  goldsteinEktv,
  kruMlMin,
  kruNormalized173,
  kruWeeklyStdKtV,
  npcrBorah,
  npcrUrinaryAddOn,
  PD_CRCL_TARGET_L_WK_173M2,
  pdWeeklyCrCl,
  pdWeeklyKtV,
  pnaPD,
  simpleSpKtV,
  stdKtV,
  tbwMorgenstern,
  tbwMorgensternGirlsOriginalExponent,
  urr,
  type PdModality,
  type Sex,
} from '../lib/dialysisAdequacyFormulas'
import { HeroScene } from '../components/hero/HeroScene'

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
  { id: 'urr', label: 'URR / simple Kt/V' },
  { id: 'daug', label: 'spKt/V (Daugirdas II)' },
  { id: 'ektv', label: 'eKt/V from spKt/V' },
  { id: 'goldstein', label: 'Pediatric eKt/V (Goldstein)' },
  { id: 'stdktv', label: 'stdKt/V + Kru' },
  { id: 'npcr', label: 'nPCR' },
  { id: 'kru', label: 'Kru (residual)' },
  { id: 'tbw', label: 'TBW & BSA (dialysis)' },
  { id: 'pdktv', label: 'PD weekly Kt/V' },
  { id: 'pdcrcl', label: 'PD weekly CrCl' },
  { id: 'pna', label: 'PNA (PD)' },
  { id: 'umod', label: 'UMOD-score' },
  { id: 'feurate', label: 'FEUrate (ADTKD)' },
  { id: 'adtkdgene', label: 'ADTKD gene finder' },
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

  // URR / simple spKt/V
  const [urrC0, setUrrC0] = useState('')
  const [urrC1, setUrrC1] = useState('')

  // spKt/V -- Daugirdas II
  const [dC0, setDC0] = useState('')
  const [dC1, setDC1] = useState('')
  const [dT, setDT] = useState('3.5')
  const [dUF, setDUF] = useState('')
  const [dW, setDW] = useState('')
  const [dV, setDV] = useState('')

  // eKt/V from spKt/V
  const [eSp, setESp] = useState('')
  const [eT, setET] = useState('3.5')

  // Pediatric eKt/V -- Goldstein
  const [gC0, setGC0] = useState('')
  const [g30, setG30] = useState('')
  const [g15, setG15] = useState('')
  const [gT, setGT] = useState('3.5')
  const [gUF, setGUF] = useState('')
  const [gV, setGV] = useState('')

  // stdKt/V (Gotch/Leypoldt) + Kru
  const [sE, setSE] = useState('')
  const [sT, setST] = useState('3.5')
  const [sN, setSN] = useState('3')
  const [sK, setSK] = useState('')
  const [sV, setSV] = useState('')

  // nPCR -- modified Borah
  const [nC1, setNC1] = useState('')
  const [nC2, setNC2] = useState('')
  const [nV1, setNV1] = useState('')
  const [nV2, setNV2] = useState('')
  const [nT, setNT] = useState('44')
  const [nU, setNU] = useState('')
  const [nW, setNW] = useState('')

  // Kru -- residual urea clearance
  const [kUUN, setKUUN] = useState('')
  const [kPlasma, setKPlasma] = useState('')
  const [kVol, setKVol] = useState('')
  const [kTime, setKTime] = useState('')
  const [kBsa, setKBsa] = useState('')

  // TBW (Morgenstern) & BSA (Gehan-George)
  const [tSex, setTSex] = useState<Sex>('m')
  const [tH, setTH] = useState('')
  const [tW, setTW] = useState('')

  // PD weekly Kt/V
  const [pVd, setPVd] = useState('')
  const [pD, setPD] = useState('')
  const [pP, setPP] = useState('')
  const [pVu, setPVu] = useState('')
  const [pU, setPU] = useState('')
  const [pV6, setPV6] = useState('')

  // PD weekly CrCl
  const [cDc, setCDc] = useState('')
  const [cPc, setCPc] = useState('')
  const [cVd, setCVd] = useState('')
  const [cVu, setCVu] = useState('')
  const [cUc, setCUc] = useState('')
  const [cUu, setCUu] = useState('')
  const [cPu, setCPu] = useState('')
  const [cBsa, setCBsa] = useState('')
  const [cModality, setCModality] = useState<PdModality>('CAPD')

  // PNA in PD -- modified Borah
  const [aUun, setAUun] = useState('')
  const [aDun, setADun] = useState('')
  const [aV, setAV] = useState('')
  const [aPl, setAPl] = useState('')
  const [aW, setAW] = useState('')

  // UMOD-score
  const [u1, setU1] = useState(false)
  const [u2, setU2] = useState(false)
  const [u5, setU5] = useState(false)
  const [m1, setM1] = useState(false)
  const [m2, setM2] = useState(false)
  const [m3, setM3] = useState(false)
  const [goutOnset, setGoutOnset] = useState<'0' | '1' | '3'>('0')
  const [uricAcid, setUricAcid] = useState('')
  const [umodAvailable, setUmodAvailable] = useState(true)

  // FEUrate
  const [fUu, setFUu] = useState('')
  const [fSu, setFSu] = useState('')
  const [fUc, setFUc] = useState('')
  const [fSc, setFSc] = useState('')
  const [fH, setFH] = useState('')

  // ADTKD gene finder
  const [geneFeatures, setGeneFeatures] = useState<string[]>([])

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

  // URR / simple spKt/V
  const urrC0Val = Number(urrC0)
  const urrC1Val = Number(urrC1)
  const urrPct = urrC0Val && urrC1Val ? urr(urrC0Val, urrC1Val) : null
  const simpleKtV = urrC0Val && urrC1Val ? simpleSpKtV(urrC0Val, urrC1Val) : null

  // spKt/V -- Daugirdas II
  const dC0Val = Number(dC0)
  const dC1Val = Number(dC1)
  const dTVal = Number(dT)
  const dUFVal = Number(dUF)
  const dWVal = Number(dW)
  const dVVal = dV ? Number(dV) : dWVal ? defaultVolumeL(dWVal) : 0
  const daugResult = dC0Val && dC1Val && dTVal && dVVal ? daugirdasSpKtV(dC0Val, dC1Val, dTVal, dUFVal || 0, dVVal) : null
  const daugUrr = dC0Val && dC1Val ? urr(dC0Val, dC1Val) : null

  // eKt/V from spKt/V
  const eSpVal = Number(eSp)
  const eTVal = Number(eT)
  const ektvDaug = eSpVal && eTVal ? ektvDaugirdasRate(eSpVal, eTVal) : null
  const ektvTat = eSpVal && eTVal ? ektvTattersall(eSpVal, eTVal) : null
  const ektvLey = eSpVal && eTVal ? ektvLeypoldt(eSpVal, eTVal) : null

  // Pediatric eKt/V -- Goldstein
  const gC0Val = Number(gC0)
  const g30Val = Number(g30)
  const g15Val = Number(g15)
  const gTVal = Number(gT)
  const gUFVal = Number(gUF)
  const gVVal = Number(gV)
  const goldsteinResult =
    gC0Val && g30Val && g15Val && gTVal && gVVal ? goldsteinEktv(gC0Val, g30Val, g15Val, gTVal, gUFVal || 0, gVVal) : null

  // stdKt/V (Gotch/Leypoldt) + Kru
  const sEVal = Number(sE)
  const sTVal = Number(sT)
  const sNVal = Number(sN)
  const sKVal = Number(sK) || 0
  const sVVal = Number(sV)
  const stdKtVVal = sEVal && sTVal && sNVal ? stdKtV(sEVal, sTVal, sNVal) : null
  const stdKruWeekly = sKVal && sVVal ? kruWeeklyStdKtV(sKVal, sVVal) : 0

  // nPCR -- modified Borah
  const nC1Val = Number(nC1)
  const nC2Val = Number(nC2)
  const nV1Val = Number(nV1)
  const nV2Val = Number(nV2)
  const nTVal = Number(nT)
  const nUVal = Number(nU) || 0
  const nWVal = Number(nW)
  const nGen = nC1Val && nC2Val && nV1Val && nV2Val && nTVal ? estimatedUreaGeneration(nC1Val, nV1Val, nC2Val, nV2Val, nTVal) : null
  const nPcrBase = nGen != null && nV1Val ? npcrBorah(nGen, nV1Val) : null
  const nPcrAddOn = nUVal && nTVal && nWVal ? npcrUrinaryAddOn(nUVal, nTVal, nWVal) : 0
  const nPcrTotal = nPcrBase != null ? nPcrBase + nPcrAddOn : null

  // Kru -- residual urea clearance
  const kUUNVal = Number(kUUN)
  const kPlasmaVal = Number(kPlasma)
  const kVolVal = Number(kVol)
  const kTimeVal = Number(kTime)
  const kBsaVal = Number(kBsa) || 0
  const kruVal = kUUNVal && kPlasmaVal && kVolVal && kTimeVal ? kruMlMin(kUUNVal, kPlasmaVal, kVolVal, kTimeVal) : null
  const kruNorm = kruVal != null && kBsaVal ? kruNormalized173(kruVal, kBsaVal) : null

  // TBW (Morgenstern) & BSA (Gehan-George)
  const tHVal = Number(tH)
  const tWVal = Number(tW)
  const tbw = tHVal && tWVal ? tbwMorgenstern(tSex, tHVal, tWVal) : null
  const tbwGirlsOriginal = tSex === 'f' && tHVal && tWVal ? tbwMorgensternGirlsOriginalExponent(tHVal, tWVal) : null
  const tbwBsa = tHVal && tWVal ? bsaGehanGeorge(tHVal, tWVal) : null

  // PD weekly Kt/V
  const pVdVal = Number(pVd)
  const pDVal = Number(pD)
  const pPVal = Number(pP)
  const pVuVal = Number(pVu) || 0
  const pUVal = Number(pU) || 0
  const pV6Val = Number(pV6)
  const pdKtVResult = pVdVal && pDVal && pPVal && pV6Val ? pdWeeklyKtV(pVdVal, pDVal, pPVal, pVuVal, pUVal, pV6Val) : null

  // PD weekly CrCl
  const cDcVal = Number(cDc)
  const cPcVal = Number(cPc)
  const cVdVal = Number(cVd)
  const cVuVal = Number(cVu) || 0
  const cUcVal = Number(cUc) || 0
  const cUuVal = Number(cUu) || 0
  const cPuVal = Number(cPu) || 1
  const cBsaVal = Number(cBsa)
  const pdCrClResult =
    cDcVal && cPcVal && cVdVal && cBsaVal ? pdWeeklyCrCl(cDcVal, cPcVal, cVdVal, cVuVal, cUcVal, cUuVal, cPuVal, cBsaVal) : null

  // PNA in PD -- modified Borah
  const aUunVal = Number(aUun)
  const aDunVal = Number(aDun)
  const aVVal = Number(aV)
  const aPlVal = Number(aPl) || 0
  const aWVal = Number(aW)
  const pnaResult = aUunVal && aDunVal && aVVal && aWVal ? pnaPD(aUunVal, aDunVal, aVVal, aPlVal, aWVal) : null

  // UMOD-score
  const goutPoints = Number(goutOnset) as 0 | 1 | 3
  const uricAcidVal = uricAcid ? Number(uricAcid) : null
  const umodResult = umodScore({
    familyHistoryEarlyGout: u1,
    unexplainedCkd: u2,
    histologyConsistent: u5,
    proteinuriaOrHematuria: m1,
    diabetesOrUncontrolledHtn: m2,
    largeKidneyOrCyst: m3,
    goutOnsetPoints: goutPoints,
    serumUricAcidMgDl: uricAcidVal,
    urinaryUmodAvailable: umodAvailable,
  })

  // FEUrate
  const fUuVal = Number(fUu)
  const fSuVal = Number(fSu)
  const fUcVal = Number(fUc)
  const fScVal = Number(fSc)
  const fHVal = Number(fH)
  const feUrateVal = fUuVal && fSuVal && fUcVal && fScVal ? feUrate(fUuVal, fSuVal, fUcVal, fScVal) : null
  const feUrateEgfr = fHVal && fScVal ? bedsideSchwartzEgfrForFeUrate(fHVal, fScVal) : null

  // ADTKD gene finder
  const geneScores = scoreAdtkdGenes(geneFeatures)

  return (
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <HeroScene scene="membrane" page="calculators" className="hero-scene" />
        <div className="hero-scrim" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Calculators</h1>
            <p className="np-sub">Standard pediatric formulas — reference aids, not a substitute for clinical judgement.</p>
          </div>
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

        <section className={selected === 'urr' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">URR &amp; simple spKt/V</h2>
          <div className="calc-fields two">
            <label htmlFor="urr-c0">
              Pre-dialysis BUN
              <input id="urr-c0" type="number" value={urrC0} onChange={(e) => setUrrC0(e.target.value)} />
            </label>
            <label htmlFor="urr-c1">
              Post-dialysis BUN
              <input id="urr-c1" type="number" value={urrC1} onChange={(e) => setUrrC1(e.target.value)} />
            </label>
          </div>
          <div className={urrPct != null && urrPct < 65 ? 'calc-result-rows calc-result-rows--warning' : 'calc-result-rows'}>
            <div className="row">
              <span>URR</span>
              <b>{urrPct != null ? `${urrPct.toFixed(1)} %` : '—'}</b>
            </div>
            <div className="row">
              <span>spKt/V (simple, −ln(C1/C0))</span>
              <b>{simpleKtV != null ? simpleKtV.toFixed(2) : '—'}</b>
            </div>
            <span className="row-note">No UF or urea-generation correction. Target: URR ≥70%, Kt/V ≥1.4.</span>
          </div>
        </section>

        <section className={selected === 'daug' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">spKt/V — Daugirdas II</h2>
          <div className="calc-fields two">
            <label htmlFor="daug-c0">
              Pre-dialysis BUN
              <input id="daug-c0" type="number" value={dC0} onChange={(e) => setDC0(e.target.value)} />
            </label>
            <label htmlFor="daug-c1">
              Post-dialysis BUN
              <input id="daug-c1" type="number" value={dC1} onChange={(e) => setDC1(e.target.value)} />
            </label>
            <label htmlFor="daug-t">
              Session time (hours)
              <input id="daug-t" type="number" value={dT} onChange={(e) => setDT(e.target.value)} />
            </label>
            <label htmlFor="daug-uf">
              Ultrafiltration (L)
              <input id="daug-uf" type="number" value={dUF} onChange={(e) => setDUF(e.target.value)} />
            </label>
            <label htmlFor="daug-w">
              Post weight (kg)
              <input id="daug-w" type="number" value={dW} onChange={(e) => setDW(e.target.value)} />
            </label>
            <label htmlFor="daug-v">
              V (L) — optional, default 0.55×weight
              <input id="daug-v" type="number" placeholder="auto" value={dV} onChange={(e) => setDV(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>V used</span>
              <b>{dVVal ? `${dVVal.toFixed(1)} L` : '—'}</b>
            </div>
            <div className="row">
              <span>spKt/V (Daugirdas II)</span>
              <b>{daugResult != null ? daugResult.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>URR</span>
              <b>{daugUrr != null ? `${daugUrr.toFixed(1)} %` : '—'}</b>
            </div>
            <span className="row-note">KDOQI 3×/week: minimum 1.2, target 1.4.</span>
          </div>
        </section>

        <section className={selected === 'ektv' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">eKt/V from spKt/V</h2>
          <div className="calc-fields two">
            <label htmlFor="ektv-sp">
              spKt/V
              <input id="ektv-sp" type="number" step="0.01" value={eSp} onChange={(e) => setESp(e.target.value)} />
            </label>
            <label htmlFor="ektv-t">
              Session time (hours)
              <input id="ektv-t" type="number" value={eT} onChange={(e) => setET(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>Daugirdas rate (t in hours)</span>
              <b>{ektvDaug != null ? ektvDaug.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>Tattersall (t in minutes)</span>
              <b>{ektvTat != null ? ektvTat.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>Leypoldt (any schedule)</span>
              <b>{ektvLey != null ? ektvLey.toFixed(2) : '—'}</b>
            </div>
            <span className="row-note">
              European minimum eKt/V = 1.2 (Daugirdas): {ektvDaug != null ? (ektvDaug >= 1.2 ? '✅ met' : '❌ not met') : '—'}
            </span>
          </div>
        </section>

        <section className={selected === 'goldstein' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">Pediatric eKt/V — Goldstein</h2>
          <div className="calc-fields two">
            <label htmlFor="gold-c0">
              Pre-dialysis BUN
              <input id="gold-c0" type="number" value={gC0} onChange={(e) => setGC0(e.target.value)} />
            </label>
            <label htmlFor="gold-30">
              BUN at 30 sec post
              <input id="gold-30" type="number" value={g30} onChange={(e) => setG30(e.target.value)} />
            </label>
            <label htmlFor="gold-15">
              BUN at 15 min post
              <input id="gold-15" type="number" value={g15} onChange={(e) => setG15(e.target.value)} />
            </label>
            <label htmlFor="gold-t">
              Session time (hours)
              <input id="gold-t" type="number" value={gT} onChange={(e) => setGT(e.target.value)} />
            </label>
            <label htmlFor="gold-uf">
              Ultrafiltration (L)
              <input id="gold-uf" type="number" value={gUF} onChange={(e) => setGUF(e.target.value)} />
            </label>
            <label htmlFor="gold-v">
              Post V (L)
              <input id="gold-v" type="number" value={gV} onChange={(e) => setGV(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>Estimated (equilibrated) BUN</span>
              <b>{goldsteinResult ? goldsteinResult.estBun.toFixed(1) : '—'}</b>
            </div>
            <div className="row">
              <span>Rebound vs. 30-sec BUN</span>
              <b>{goldsteinResult ? `${goldsteinResult.reboundPct.toFixed(1)} %` : '—'}</b>
            </div>
            <div className="row">
              <span>spKt/V (BUN 30 sec)</span>
              <b>{goldsteinResult ? goldsteinResult.spKtV.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>eKt/V (Goldstein + Daugirdas II)</span>
              <b>{goldsteinResult ? goldsteinResult.ektv.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>sp − e</span>
              <b>{goldsteinResult ? goldsteinResult.spMinusE.toFixed(2) : '—'}</b>
            </div>
            <span className="row-note">estBUN = (BUN15min − BUN30sec) ÷ 0.69 + BUN30sec</span>
          </div>
        </section>

        <section className={selected === 'stdktv' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">stdKt/V (Gotch/Leypoldt) + Kru</h2>
          <div className="calc-fields two">
            <label htmlFor="std-e">
              eKt/V
              <input id="std-e" type="number" step="0.01" value={sE} onChange={(e) => setSE(e.target.value)} />
            </label>
            <label htmlFor="std-t">
              Hours per session
              <input id="std-t" type="number" value={sT} onChange={(e) => setST(e.target.value)} />
            </label>
            <label htmlFor="std-n">
              Sessions per week
              <input id="std-n" type="number" value={sN} onChange={(e) => setSN(e.target.value)} />
            </label>
            <label htmlFor="std-k">
              Kru (mL/min) — optional
              <input id="std-k" type="number" value={sK} onChange={(e) => setSK(e.target.value)} />
            </label>
            <label htmlFor="std-v">
              V (L) for Kru
              <input id="std-v" type="number" value={sV} onChange={(e) => setSV(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>stdKt/V (dialysis)</span>
              <b>{stdKtVVal != null ? `${stdKtVVal.toFixed(2)} /week` : '—'}</b>
            </div>
            <div className="row">
              <span>Kru, weekly stdKt/V equivalent</span>
              <b>{stdKruWeekly.toFixed(2)}</b>
            </div>
            <div className="row">
              <span>Total stdKt/V</span>
              <b>{stdKtVVal != null ? (stdKtVVal + stdKruWeekly).toFixed(2) : '—'}</b>
            </div>
            <span className="row-note">
              KDOQI non-3×/week: minimum 2.1, target 2.3. Peds 3×/week: ≥2.0 ↔ spKt/V≥1.2; ≥2.2 ↔ spKt/V≥1.4.
            </span>
          </div>
        </section>

        <section className={selected === 'npcr' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">nPCR — modified Borah</h2>
          <div className="calc-fields two">
            <label htmlFor="npcr-c1">
              Post-dialysis BUN (mg/dL)
              <input id="npcr-c1" type="number" value={nC1} onChange={(e) => setNC1(e.target.value)} />
            </label>
            <label htmlFor="npcr-c2">
              Next pre-dialysis BUN (mg/dL)
              <input id="npcr-c2" type="number" value={nC2} onChange={(e) => setNC2(e.target.value)} />
            </label>
            <label htmlFor="npcr-v1">
              Post TBW (L)
              <input id="npcr-v1" type="number" value={nV1} onChange={(e) => setNV1(e.target.value)} />
            </label>
            <label htmlFor="npcr-v2">
              Next-pre TBW (L)
              <input id="npcr-v2" type="number" value={nV2} onChange={(e) => setNV2(e.target.value)} />
            </label>
            <label htmlFor="npcr-t">
              Interdialytic interval (hours)
              <input id="npcr-t" type="number" value={nT} onChange={(e) => setNT(e.target.value)} />
            </label>
            <label htmlFor="npcr-u">
              Urine urea nitrogen (g) — optional
              <input id="npcr-u" type="number" value={nU} onChange={(e) => setNU(e.target.value)} />
            </label>
            <label htmlFor="npcr-w">
              Weight (kg)
              <input id="npcr-w" type="number" value={nW} onChange={(e) => setNW(e.target.value)} />
            </label>
          </div>
          <div className={nPcrTotal != null && nPcrTotal < 1 ? 'calc-result-rows calc-result-rows--warning' : 'calc-result-rows'}>
            <div className="row">
              <span>Estimated G</span>
              <b>{nGen != null ? `${nGen.toFixed(1)} mg/min` : '—'}</b>
            </div>
            <div className="row">
              <span>nPCR (Borah)</span>
              <b>{nPcrBase != null ? nPcrBase.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>+ urinary term</span>
              <b>{nPcrAddOn.toFixed(2)}</b>
            </div>
            <div className="row">
              <span>Total nPCR (g/kg/day)</span>
              <b>{nPcrTotal != null ? nPcrTotal.toFixed(2) : '—'}</b>
            </div>
            <span className="row-note">{nPcrTotal != null && nPcrTotal < 1 ? '❌ <1 g/kg/day: risk of weight loss' : '✅ ≥1 g/kg/day'}</span>
          </div>
        </section>

        <section className={selected === 'kru' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">Kru — residual urea clearance</h2>
          <div className="calc-fields two">
            <label htmlFor="kru-uun">
              Urine urea nitrogen (mg/dL)
              <input id="kru-uun" type="number" value={kUUN} onChange={(e) => setKUUN(e.target.value)} />
            </label>
            <label htmlFor="kru-p">
              Plasma BUN (mg/dL)
              <input id="kru-p" type="number" value={kPlasma} onChange={(e) => setKPlasma(e.target.value)} />
            </label>
            <label htmlFor="kru-vol">
              Urine volume (mL)
              <input id="kru-vol" type="number" value={kVol} onChange={(e) => setKVol(e.target.value)} />
            </label>
            <label htmlFor="kru-time">
              Collection time (min)
              <input id="kru-time" type="number" value={kTime} onChange={(e) => setKTime(e.target.value)} />
            </label>
            <label htmlFor="kru-bsa">
              BSA (m²) — optional
              <input id="kru-bsa" type="number" value={kBsa} onChange={(e) => setKBsa(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>Urine flow</span>
              <b>{kUUNVal && kPlasmaVal && kVolVal && kTimeVal ? (kVolVal / kTimeVal).toFixed(3) : '—'} mL/min</b>
            </div>
            <div className="row">
              <span>Kru</span>
              <b>{kruVal != null ? `${kruVal.toFixed(2)} mL/min` : '—'}</b>
            </div>
            {kruNorm != null && (
              <div className="row">
                <span>Kru, normalized to 1.73m²</span>
                <b>{kruNorm.toFixed(2)} mL/min/1.73m²</b>
              </div>
            )}
            <span className="row-note">
              If a 24h collection is drawn before dialysis, plasma BUN ≈ 0.9 × pre-BUN; across the full interdialytic interval, use the
              mean of pre and post.
            </span>
          </div>
        </section>

        <section className={selected === 'tbw' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">TBW (Morgenstern) &amp; BSA (Gehan–George)</h2>
          <div className="calc-fields two">
            <label htmlFor="tbw-sex">
              Sex
              <select id="tbw-sex" value={tSex} onChange={(e) => setTSex(e.target.value as Sex)}>
                <option value="m">Boy</option>
                <option value="f">Girl</option>
              </select>
            </label>
            <label htmlFor="tbw-h">
              Height (cm)
              <input id="tbw-h" type="number" value={tH} onChange={(e) => setTH(e.target.value)} />
            </label>
            <label htmlFor="tbw-w">
              Weight (kg)
              <input id="tbw-w" type="number" value={tW} onChange={(e) => setTW(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>TBW (Morgenstern)</span>
              <b>{tbw != null ? `${tbw.toFixed(1)} L` : '—'}</b>
            </div>
            {tbw != null && tWVal > 0 && (
              <div className="row">
                <span>% body weight</span>
                <b>{((tbw / tWVal) * 100).toFixed(0)} %</b>
              </div>
            )}
            {tbwGirlsOriginal != null && (
              <div className="row">
                <span>Girls, original-paper exponent (0.64)</span>
                <b>{tbwGirlsOriginal.toFixed(1)} L</b>
              </div>
            )}
            <div className="row">
              <span>0.55×weight (common default V)</span>
              <b>{tWVal ? (0.55 * tWVal).toFixed(1) : '—'} L</b>
            </div>
            <div className="row">
              <span>BSA (Gehan–George)</span>
              <b>{tbwBsa != null ? tbwBsa.toFixed(3) : '—'} m²</b>
            </div>
          </div>
        </section>

        <section className={selected === 'pdktv' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">PD weekly Kt/V<sub>urea</sub></h2>
          <div className="calc-fields two">
            <label htmlFor="pdktv-vd">
              Dialysate volume (L/24h)
              <input id="pdktv-vd" type="number" value={pVd} onChange={(e) => setPVd(e.target.value)} />
            </label>
            <label htmlFor="pdktv-d">
              Dialysate urea
              <input id="pdktv-d" type="number" value={pD} onChange={(e) => setPD(e.target.value)} />
            </label>
            <label htmlFor="pdktv-p">
              Plasma urea
              <input id="pdktv-p" type="number" value={pP} onChange={(e) => setPP(e.target.value)} />
            </label>
            <label htmlFor="pdktv-vu">
              Urine volume (L/24h)
              <input id="pdktv-vu" type="number" value={pVu} onChange={(e) => setPVu(e.target.value)} />
            </label>
            <label htmlFor="pdktv-u">
              Urine urea
              <input id="pdktv-u" type="number" value={pU} onChange={(e) => setPU(e.target.value)} />
            </label>
            <label htmlFor="pdktv-tbw">
              TBW (L)
              <input id="pdktv-tbw" type="number" value={pV6} onChange={(e) => setPV6(e.target.value)} />
            </label>
          </div>
          <div
            className={
              pdKtVResult != null && pdKtVResult.total < 1.7 ? 'calc-result-rows calc-result-rows--warning' : 'calc-result-rows'
            }
          >
            <div className="row">
              <span>Kt/V peritoneal</span>
              <b>{pdKtVResult ? pdKtVResult.peritoneal.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>Kt/V renal</span>
              <b>{pdKtVResult ? pdKtVResult.renal.toFixed(2) : '—'}</b>
            </div>
            <div className="row">
              <span>Kt/V total (/week)</span>
              <b>{pdKtVResult ? pdKtVResult.total.toFixed(2) : '—'}</b>
            </div>
            <span className="row-note">
              {pdKtVResult
                ? `${pdKtVResult.total >= 1.7 ? '✅ ≥1.7' : '❌ <1.7'}${pdKtVResult.total > 2.75 ? ' — ⚠️ >2.75: no extra benefit, may lower albumin' : ''}`
                : 'Target ≥1.7/week'}
            </span>
          </div>
        </section>

        <section className={selected === 'pdcrcl' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">PD weekly creatinine clearance</h2>
          <div className="calc-fields two">
            <label htmlFor="pdcrcl-dc">
              Dialysate creatinine
              <input id="pdcrcl-dc" type="number" value={cDc} onChange={(e) => setCDc(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-pc">
              Plasma creatinine
              <input id="pdcrcl-pc" type="number" value={cPc} onChange={(e) => setCPc(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-vd">
              Dialysate volume (L/24h)
              <input id="pdcrcl-vd" type="number" value={cVd} onChange={(e) => setCVd(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-vu">
              Urine volume (L/24h)
              <input id="pdcrcl-vu" type="number" value={cVu} onChange={(e) => setCVu(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-uc">
              Urine creatinine
              <input id="pdcrcl-uc" type="number" value={cUc} onChange={(e) => setCUc(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-uu">
              Urine urea
              <input id="pdcrcl-uu" type="number" value={cUu} onChange={(e) => setCUu(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-pu">
              Plasma urea
              <input id="pdcrcl-pu" type="number" value={cPu} onChange={(e) => setCPu(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-bsa">
              BSA (m²)
              <input id="pdcrcl-bsa" type="number" value={cBsa} onChange={(e) => setCBsa(e.target.value)} />
            </label>
            <label htmlFor="pdcrcl-modality">
              Modality
              <select id="pdcrcl-modality" value={cModality} onChange={(e) => setCModality(e.target.value as PdModality)}>
                <option value="CAPD">CAPD (target 60)</option>
                <option value="CCPD">CCPD (target 63)</option>
                <option value="NIPD">NIPD (target 66)</option>
              </select>
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>CrCl peritoneal</span>
              <b>{pdCrClResult ? `${pdCrClResult.peritoneal.toFixed(1)} L/wk/1.73m²` : '—'}</b>
            </div>
            <div className="row">
              <span>CrCl renal (mean Cr+urea)</span>
              <b>{pdCrClResult ? pdCrClResult.renal.toFixed(1) : '—'}</b>
            </div>
            <div className="row">
              <span>CrCl total</span>
              <b>{pdCrClResult ? pdCrClResult.total.toFixed(1) : '—'}</b>
            </div>
            <span className="row-note">
              Target ({cModality}) {PD_CRCL_TARGET_L_WK_173M2[cModality]} L/wk/1.73m² →{' '}
              {pdCrClResult ? (pdCrClResult.total >= PD_CRCL_TARGET_L_WK_173M2[cModality] ? '✅' : '❌') : '—'}
            </span>
          </div>
        </section>

        <section className={selected === 'pna' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">PNA in PD — modified Borah</h2>
          <div className="calc-fields two">
            <label htmlFor="pna-uun">
              Urine UN (g/24h)
              <input id="pna-uun" type="number" value={aUun} onChange={(e) => setAUun(e.target.value)} />
            </label>
            <label htmlFor="pna-dun">
              Dialysate UN (g/24h)
              <input id="pna-dun" type="number" value={aDun} onChange={(e) => setADun(e.target.value)} />
            </label>
            <label htmlFor="pna-v">
              TBW (L)
              <input id="pna-v" type="number" value={aV} onChange={(e) => setAV(e.target.value)} />
            </label>
            <label htmlFor="pna-pl">
              Protein loss (g/24h)
              <input id="pna-pl" type="number" value={aPl} onChange={(e) => setAPl(e.target.value)} />
            </label>
            <label htmlFor="pna-w">
              Weight (kg)
              <input id="pna-w" type="number" value={aW} onChange={(e) => setAW(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>UNA</span>
              <b>{pnaResult ? `${pnaResult.unaG.toFixed(2)} g/day` : '—'}</b>
            </div>
            <div className="row">
              <span>PNA</span>
              <b>{pnaResult ? `${pnaResult.pna.toFixed(2)} g/kg/day` : '—'}</b>
            </div>
          </div>
        </section>

        <section className={selected === 'umod' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">UMOD-score (Olinger 2020)</h2>
          <div className="calc-checklist">
            <label>
              <input type="checkbox" checked={u1} onChange={(e) => setU1(e.target.checked)} />
              Family history of early gout (&lt;40y), AD inheritance (+2)
            </label>
            <label>
              <input type="checkbox" checked={u2} onChange={(e) => setU2(e.target.checked)} />
              CKD of unknown cause (+2)
            </label>
            <label>
              <input type="checkbox" checked={u5} onChange={(e) => setU5(e.target.checked)} />
              Histology consistent with ADTKD (+2)
            </label>
            <label>
              <input type="checkbox" checked={m1} onChange={(e) => setM1(e.target.checked)} />
              Proteinuria / hematuria (−1)
            </label>
            <label>
              <input type="checkbox" checked={m2} onChange={(e) => setM2(e.target.checked)} />
              Uncontrolled diabetes / HTN (−1)
            </label>
            <label>
              <input type="checkbox" checked={m3} onChange={(e) => setM3(e.target.checked)} />
              Large kidney / cyst (−1)
            </label>
          </div>
          <div className="calc-fields two">
            <label htmlFor="umod-gout">
              Gout onset age
              <select id="umod-gout" value={goutOnset} onChange={(e) => setGoutOnset(e.target.value as '0' | '1' | '3')}>
                <option value="0">No gout</option>
                <option value="3">&lt;30 years (+3)</option>
                <option value="1">≥30 years (+1)</option>
              </select>
            </label>
            <label htmlFor="umod-ua">
              Serum uric acid (mg/dL) — blank = not hyperuricemic
              <input id="umod-ua" type="number" step="0.1" placeholder="e.g. 9.2" value={uricAcid} onChange={(e) => setUricAcid(e.target.value)} />
            </label>
            <label htmlFor="umod-avail">
              Urinary UMOD measurable?
              <select id="umod-avail" value={umodAvailable ? 'y' : 'n'} onChange={(e) => setUmodAvailable(e.target.value === 'y')}>
                <option value="y">Yes</option>
                <option value="n">No</option>
              </select>
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>UMOD-score</span>
              <b>{umodResult.score}</b>
            </div>
            <span className="row-note">{umodResult.parts.join(', ') || 'No findings selected'}</span>
            <span className="row-note">{umodResult.recommendation}</span>
          </div>
        </section>

        <section className={selected === 'feurate' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">FEUrate — fractional excretion of uric acid</h2>
          <div className="calc-fields two">
            <label htmlFor="feu-uu">
              Urine uric acid (mg/dL)
              <input id="feu-uu" type="number" value={fUu} onChange={(e) => setFUu(e.target.value)} />
            </label>
            <label htmlFor="feu-su">
              Serum uric acid (mg/dL)
              <input id="feu-su" type="number" value={fSu} onChange={(e) => setFSu(e.target.value)} />
            </label>
            <label htmlFor="feu-uc">
              Urine creatinine (mg/dL)
              <input id="feu-uc" type="number" value={fUc} onChange={(e) => setFUc(e.target.value)} />
            </label>
            <label htmlFor="feu-sc">
              Serum creatinine (mg/dL)
              <input id="feu-sc" type="number" value={fSc} onChange={(e) => setFSc(e.target.value)} />
            </label>
            <label htmlFor="feu-h">
              Height (cm) — for eGFR check
              <input id="feu-h" type="number" value={fH} onChange={(e) => setFH(e.target.value)} />
            </label>
          </div>
          <div className="calc-result-rows">
            <div className="row">
              <span>FEUrate</span>
              <b>{feUrateVal != null ? `${feUrateVal.toFixed(2)} %` : '—'}</b>
            </div>
            <span className="row-note">
              {feUrateVal != null
                ? feUrateVal < 5
                  ? 'Low (<5%) — fits ADTKD-UMOD/REN/HNF1B'
                  : 'Normal (>5%)'
                : 'FEUrate = (Uurate × SCr) ÷ (Surate × UCr) × 100'}
            </span>
            {feUrateEgfr != null && (
              <>
                <div className="row">
                  <span>eGFR (bedside Schwartz, sanity check)</span>
                  <b>{feUrateEgfr.toFixed(0)}</b>
                </div>
                <span className="row-note">
                  {feUrateEgfr < 80 ? '⚠️ GFR <80: a low FEUrate is not reliable for ADTKD' : 'GFR ≥80: FEUrate is interpretable'}
                </span>
              </>
            )}
          </div>
        </section>

        <section className={selected === 'adtkdgene' ? 'calc-card sel np-fade' : 'calc-card np-fade'}>
          <h2 className="calc-card-title">ADTKD gene finder</h2>
          <span className="np-small">Teaching exercise based on the chapter's tables — not a validated clinical tool.</span>
          <div className="calc-checklist">
            {ADTKD_GENE_FEATURES.map((feature) => (
              <label key={feature.id}>
                <input
                  type="checkbox"
                  checked={geneFeatures.includes(feature.id)}
                  onChange={(e) =>
                    setGeneFeatures((prev) => (e.target.checked ? [...prev, feature.id] : prev.filter((id) => id !== feature.id)))
                  }
                />
                {feature.label}
              </label>
            ))}
          </div>
          <div className="calc-result-rows">
            {geneScores.length === 0 && <span className="row-note">No findings selected.</span>}
            {geneScores.map(([gene, score], i) => (
              <div className="row" key={gene}>
                <span>
                  {i === 0 ? '🥇 ' : '• '}
                  {gene} ({ADTKD_GENE_HINT[gene]})
                </span>
                <b>{score}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
