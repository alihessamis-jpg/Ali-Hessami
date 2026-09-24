import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addLabEntry, deleteLabEntry, listLabEntries } from '../../lib/api/labs'
import { correctedCalcium, feNa, feUrea, kdigoStage, transferrinSaturation } from '../../lib/formulas'
import { isAbnormal } from '../../lib/labRange'
import {
  COLLECTION_METHODS,
  COMMON_LAB_TESTS,
  CULTURE_TESTS,
  isPositiveCulture,
  LAB_CATEGORIES,
  LAB_CATEGORY_TESTS,
  SUSCEPTIBILITY_RESULTS,
  textValueOptions,
} from '../../lib/labPresets'
import { toShamsi } from '../../lib/shamsi'
import { classifyUpcRatio, PROTEINURIA_CLASS_LABEL, type ProteinuriaClass } from '../../lib/proteinuria'
import { assessNephriticWorkup } from '../../lib/nephriticWorkup'
import { assessCkdMbd } from '../../lib/ckdMbd'
import { ageInYears } from '../../lib/growth'
import { listMedications } from '../../lib/api/medications'
import { DEFAULT_USER_SETTINGS, getUserSettings } from '../../lib/api/settings'
import type { LabEntry, MicroSusceptibility, Patient } from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
}

function mapByDate(entries: LabEntry[], testName: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries) {
    if (e.test === testName && e.value != null) map.set(e.date, e.value)
  }
  return map
}

const CUSTOM_TEST = '__custom__'

const emptyDraft = {
  date: new Date().toISOString().slice(0, 10),
  category: '',
  test: '',
  value: '',
  valueText: '',
  unit: '',
  ref: '',
  comment: '',
}

const emptyMicro = {
  organism: '',
  colonyCount: '',
  collectionMethod: '',
  onAntibiotics: false,
  susceptibilities: [{ antibiotic: '', result: 'S' as const }] as MicroSusceptibility[],
}

export function LabsTab({ patientId, patient }: Props) {
  const [entries, setEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [micro, setMicro] = useState(emptyMicro)
  const [customTest, setCustomTest] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [activeMedNames, setActiveMedNames] = useState<string[]>([])
  const [anemiaHbThreshold, setAnemiaHbThreshold] = useState(DEFAULT_USER_SETTINGS.anemiaHbThreshold)

  useEffect(() => {
    refresh()
  }, [patientId])

  useEffect(() => {
    getUserSettings()
      .then((s) => setAnemiaHbThreshold(s.anemiaHbThreshold))
      .catch(() => undefined)
  }, [])

  function refresh() {
    setLoading(true)
    listLabEntries(patientId)
      .then((rows) => setEntries(rows.slice().reverse()))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load labs'))
      .finally(() => setLoading(false))
    listMedications(patientId)
      .then((meds) => setActiveMedNames(meds.filter((m) => m.active).map((m) => m.name.toLowerCase())))
      .catch(() => undefined)
  }

  function updateSusceptibility(index: number, patch: Partial<MicroSusceptibility>) {
    setMicro((m) => ({
      ...m,
      susceptibilities: m.susceptibilities.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }))
  }

  function addSusceptibilityRow() {
    setMicro((m) => ({ ...m, susceptibilities: [...m.susceptibilities, { antibiotic: '', result: 'S' }] }))
  }

  function removeSusceptibilityRow(index: number) {
    setMicro((m) => ({ ...m, susceptibilities: m.susceptibilities.filter((_, i) => i !== index) }))
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.test.trim() || !draft.date) return
    const isTextValue = textValueOptions(draft.test) != null
    const isCulture = CULTURE_TESTS.has(draft.test)
    if (isCulture && !micro.organism.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const entry = await addLabEntry({
        patientId,
        date: draft.date,
        category: draft.category || null,
        test: draft.test.trim(),
        value: isTextValue || isCulture || draft.value === '' ? null : Number(draft.value),
        valueText: isTextValue ? draft.valueText || null : null,
        microDetails: isCulture
          ? {
              organism: micro.organism.trim(),
              colonyCount: micro.colonyCount || null,
              collectionMethod: micro.collectionMethod || null,
              onAntibiotics: micro.onAntibiotics,
              susceptibilities: micro.susceptibilities
                .filter((s) => s.antibiotic.trim())
                .map((s) => ({ antibiotic: s.antibiotic.trim(), result: s.result })),
            }
          : null,
        unit: draft.unit || null,
        ref: draft.ref || null,
        comment: draft.comment || null,
      })
      setEntries((prev) => [entry, ...prev])
      setDraft({ ...emptyDraft, date: draft.date, category: draft.category })
      setMicro(emptyMicro)
      setCustomTest(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add lab entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLabEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const presentCategories = useMemo(() => {
    const set = new Set(entries.map((e) => e.category).filter((c): c is string => !!c))
    return LAB_CATEGORIES.filter((c) => set.has(c))
  }, [entries])

  const uncategorizedCount = useMemo(() => entries.some((e) => !e.category), [entries])

  const anemiaAlert = useMemo(() => {
    const hbEntries = entries.filter((e) => e.test === 'Hemoglobin' && e.value != null)
    if (hbEntries.length === 0) return null
    const latest = hbEntries.reduce((a, b) => (b.date > a.date ? b : a))
    if (latest.value == null || latest.value >= anemiaHbThreshold) return null
    return latest
  }, [entries, anemiaHbThreshold])

  const albuminByDate = useMemo(() => mapByDate(entries, 'Albumin'), [entries])
  const tibcByDate = useMemo(() => mapByDate(entries, 'TIBC'), [entries])
  const sodiumByDate = useMemo(() => mapByDate(entries, 'Sodium'), [entries])
  const creatinineByDate = useMemo(() => mapByDate(entries, 'Creatinine'), [entries])
  const urineCreatinineByDate = useMemo(() => mapByDate(entries, 'Urine Creatinine'), [entries])
  const bunByDate = useMemo(() => mapByDate(entries, 'BUN'), [entries])

  const latestCreatinine = useMemo(() => {
    const crEntries = entries.filter((e) => e.test === 'Creatinine' && e.value != null)
    if (crEntries.length === 0) return null
    return crEntries.reduce((latest, e) => (e.date > latest.date ? e : latest))
  }, [entries])

  const akiStage = useMemo(() => {
    if (!patient.baselineCr || latestCreatinine?.value == null) return null
    return kdigoStage(patient.baselineCr, latestCreatinine.value, !!patient.dialysisStatus)
  }, [patient.baselineCr, patient.dialysisStatus, latestCreatinine])

  const firstMorningUpcByDate = useMemo(() => mapByDate(entries, 'Urine Pro/Cr - First Morning'), [entries])

  const proteinuriaStatus = useMemo(() => {
    const upcEntries = entries.filter((e) => e.test === 'Urine Protein/Creatinine Ratio' && e.value != null)
    if (upcEntries.length === 0) return null
    const sorted = [...upcEntries].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const latestClass = classifyUpcRatio(latest.value!)
    if (latestClass === 'nephrotic-range') {
      return { label: 'Nephrotic-range proteinuria', cls: latestClass as ProteinuriaClass }
    }
    const nonNormalDates = sorted.filter((e) => classifyUpcRatio(e.value!) !== 'normal').map((e) => e.date)
    if (nonNormalDates.length >= 2) {
      const spanDays =
        (new Date(nonNormalDates[nonNormalDates.length - 1]).getTime() - new Date(nonNormalDates[0]).getTime()) /
        (1000 * 60 * 60 * 24)
      if (spanDays >= 7) return { label: 'Persistent proteinuria', cls: 'abnormal' as ProteinuriaClass }
    }
    if (latestClass === 'abnormal') {
      return { label: 'Isolated abnormal proteinuria — recheck to confirm persistence', cls: latestClass }
    }
    return { label: 'Proteinuria: normal', cls: 'normal' as ProteinuriaClass }
  }, [entries])

  const nephriticWorkup = useMemo(() => assessNephriticWorkup(entries), [entries])

  const ckdMbd = useMemo(() => {
    if (!patient.baselineCr && !patient.baselineEGFR) return null
    const ageYears = patient.dob ? ageInYears(patient.dob, new Date().toISOString().slice(0, 10)) : null
    return assessCkdMbd(entries, ageYears, activeMedNames)
  }, [entries, patient.baselineCr, patient.baselineEGFR, patient.dob, activeMedNames])

  const visibleEntries = useMemo(() => {
    if (activeCategory === 'All') return entries
    if (activeCategory === 'Other') return entries.filter((e) => !e.category)
    return entries.filter((e) => e.category === activeCategory)
  }, [entries, activeCategory])

  const testsForCategory = draft.category ? LAB_CATEGORY_TESTS[draft.category] ?? [] : []
  const isCulture = CULTURE_TESTS.has(draft.test)
  const draftTextOptions = textValueOptions(draft.test)

  return (
    <div>
      {anemiaAlert && (
        <div className="aki-banner aki-banner--warning">
          <strong>⚠ Severe anemia — Hb {anemiaAlert.value} {anemiaAlert.unit || 'g/dL'}</strong>
          <span className="patient-meta">
            Recorded {toShamsi(anemiaAlert.date)} — below your {anemiaHbThreshold} g/dL alert threshold. Consider
            transfusion and evaluate cause.
          </span>
        </div>
      )}
      {patient.baselineCr && latestCreatinine?.value != null && (
        <div className={`aki-banner ${akiStage ? 'aki-banner--warning' : ''}`}>
          <strong>{akiStage ? `AKI Stage ${akiStage} (KDIGO)` : 'No AKI by creatinine criteria'}</strong>
          <span className="patient-meta">
            Baseline {patient.baselineCr} → {latestCreatinine.value} mg/dL ({toShamsi(latestCreatinine.date)})
          </span>
        </div>
      )}
      {proteinuriaStatus && (
        <div className={`aki-banner ${proteinuriaStatus.cls !== 'normal' ? 'aki-banner--warning' : ''}`}>
          <strong>{proteinuriaStatus.label}</strong>
          <span className="patient-meta">Based on Urine Protein/Creatinine Ratio entries</span>
        </div>
      )}
      {nephriticWorkup && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Nephritic syndrome workup</h2>
          </div>
          <p className="patient-meta">
            Hematuria detected ({nephriticWorkup.hematuriaSource}: {nephriticWorkup.hematuriaDisplay}). Nephritic
            syndrome is defined by hematuria + hypertension — confirm BP
            {patient.vsBP ? ` (recorded: ${patient.vsBP})` : ''} is elevated for age.
          </p>
          <ul className="study-link-list">
            <li>
              {nephriticWorkup.dysmorphicRbc
                ? `Dysmorphic RBC checked: ${nephriticWorkup.dysmorphicRbc.valueText ?? nephriticWorkup.dysmorphicRbc.value}`
                : 'Confirm glomerular origin — check urine dysmorphic RBC / RBC casts'}
            </li>
            <li className={nephriticWorkup.psgnLikely ? 'value-abnormal' : undefined}>
              {nephriticWorkup.aso || nephriticWorkup.c3
                ? `ASO ${nephriticWorkup.aso?.value ?? '—'}, C3 ${nephriticWorkup.c3?.value ?? '—'}${
                    nephriticWorkup.psgnLikely ? ' — pattern consistent with PSGN' : ''
                  }`
                : 'Suspect PSGN? Check ASO + C3 — low C3 with high ASO is diagnostic'}
            </li>
            <li className={nephriticWorkup.lupusLikely ? 'value-abnormal' : undefined}>
              {nephriticWorkup.ana || nephriticWorkup.antiDsDna || nephriticWorkup.c4
                ? `ANA ${nephriticWorkup.ana?.valueText ?? '—'}, Anti-dsDNA ${nephriticWorkup.antiDsDna?.valueText ?? '—'}, C4 ${
                    nephriticWorkup.c4?.value ?? '—'
                  }${nephriticWorkup.lupusLikely ? ' — consider lupus nephritis' : ''}`
                : 'If complement stays low beyond 8 weeks, or lupus features: check complement (C3/C4), ANA, Anti-dsDNA'}
            </li>
            <li>
              {nephriticWorkup.pAnca || nephriticWorkup.cAnca
                ? `P-ANCA ${nephriticWorkup.pAnca?.valueText ?? '—'}, C-ANCA ${nephriticWorkup.cAnca?.valueText ?? '—'}`
                : 'If complement is normal, or systemic/vasculitic features: check P-ANCA, C-ANCA'}
            </li>
          </ul>
        </div>
      )}
      {ckdMbd && (
        <div className={`aki-banner ${ckdMbd.flags.length > 0 ? 'aki-banner--warning' : ''}`}>
          <strong>CKD-MBD: {ckdMbd.flags.length > 0 ? `${ckdMbd.flags.length} item${ckdMbd.flags.length === 1 ? '' : 's'} to address` : 'No action flagged'}</strong>
          <span className="patient-meta">
            {[
              ckdMbd.correctedCa != null ? `Ca ${ckdMbd.correctedCa.toFixed(1)}` : null,
              ckdMbd.phosphate?.value != null ? `Phos ${ckdMbd.phosphate.value}` : null,
              ckdMbd.pth?.value != null ? `PTH ${ckdMbd.pth.value}` : null,
              ckdMbd.vitD?.value != null ? `25-OH Vit D ${ckdMbd.vitD.value}` : null,
              ckdMbd.alkPhos?.value != null ? `Alk Phos ${ckdMbd.alkPhos.value}` : null,
              ckdMbd.bicarb?.value != null ? `HCO3 ${ckdMbd.bicarb.value}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {ckdMbd.flags.length > 0 && (
            <ul className="study-link-list" style={{ marginTop: 8 }}>
              {ckdMbd.flags.map((f) => (
                <li key={f.key} className="value-abnormal">
                  {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <datalist id="lab-test-options">
        {COMMON_LAB_TESTS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <form onSubmit={(e) => void handleAdd(e)}>
        <div className="lab-form">
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
          <select
            value={draft.category}
            onChange={(e) => {
              setDraft({ ...draft, category: e.target.value, test: '' })
              setCustomTest(false)
            }}
          >
            <option value="">All categories</option>
            {LAB_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {draft.category && !customTest ? (
            <select
              value={draft.test}
              onChange={(e) => {
                if (e.target.value === CUSTOM_TEST) {
                  setCustomTest(true)
                  setDraft({ ...draft, test: '' })
                } else {
                  setDraft({ ...draft, test: e.target.value })
                }
              }}
              required
            >
              <option value="">Select test</option>
              {testsForCategory.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={CUSTOM_TEST}>Other (type manually)…</option>
            </select>
          ) : (
            <input
              placeholder="Test"
              list="lab-test-options"
              value={draft.test}
              onChange={(e) => setDraft({ ...draft, test: e.target.value })}
              required
            />
          )}
          {!isCulture &&
            (draftTextOptions ? (
              <select value={draft.valueText} onChange={(e) => setDraft({ ...draft, valueText: e.target.value })}>
                <option value="">Value</option>
                {draftTextOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                placeholder="Value"
                type="number"
                step="any"
                value={draft.value}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
            ))}
          {!isCulture && (
            <input placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
          )}
          {!isCulture && (
            <input placeholder="Reference range" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} />
          )}
          <input placeholder="Comment" value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
          {!isCulture && (
            <button type="submit" disabled={submitting}>
              Add
            </button>
          )}
        </div>

        {isCulture && (
          <fieldset className="micro-fieldset">
            <legend>Culture result</legend>
            <div className="field-grid">
              <label>
                Organism
                <input
                  value={micro.organism}
                  onChange={(e) => setMicro({ ...micro, organism: e.target.value })}
                  placeholder="e.g. E. coli, or 'No growth'"
                  required
                />
              </label>
              <label>
                Colony count
                <input
                  value={micro.colonyCount}
                  onChange={(e) => setMicro({ ...micro, colonyCount: e.target.value })}
                  placeholder="e.g. >100,000 CFU/mL"
                />
              </label>
              <label>
                Collection method
                <select value={micro.collectionMethod} onChange={(e) => setMicro({ ...micro, collectionMethod: e.target.value })}>
                  <option value="">—</option>
                  {COLLECTION_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={micro.onAntibiotics}
                onChange={(e) => setMicro({ ...micro, onAntibiotics: e.target.checked })}
              />
              On antibiotics at time of collection
            </label>

            <div className="susceptibility-list">
              <span className="calc-label">Antibiotic susceptibilities</span>
              {micro.susceptibilities.map((s, i) => (
                <div key={i} className="susceptibility-row">
                  <input
                    placeholder="Antibiotic"
                    value={s.antibiotic}
                    onChange={(e) => updateSusceptibility(i, { antibiotic: e.target.value })}
                  />
                  <select value={s.result} onChange={(e) => updateSusceptibility(i, { result: e.target.value as MicroSusceptibility['result'] })}>
                    {SUSCEPTIBILITY_RESULTS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="link-button" onClick={() => removeSusceptibilityRow(i)}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="button-secondary" onClick={addSusceptibilityRow}>
                + Add antibiotic
              </button>
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitting}>
                Add culture result
              </button>
            </div>
          </fieldset>
        )}
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">No labs recorded yet.</p>
      ) : (
        <>
          <div className="category-pills">
            <button
              type="button"
              className={`category-pill ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => setActiveCategory('All')}
            >
              All ({entries.length})
            </button>
            {presentCategories.map((c) => (
              <button
                key={c}
                type="button"
                className={`category-pill ${activeCategory === c ? 'active' : ''}`}
                onClick={() => setActiveCategory(c)}
              >
                {c} ({entries.filter((e) => e.category === c).length})
              </button>
            ))}
            {uncategorizedCount && (
              <button
                type="button"
                className={`category-pill ${activeCategory === 'Other' ? 'active' : ''}`}
                onClick={() => setActiveCategory('Other')}
              >
                Other
              </button>
            )}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Test</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Ref range</th>
                <th>Comment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => {
                const tsat =
                  e.test === 'Iron' && e.value != null && tibcByDate.has(e.date)
                    ? transferrinSaturation(e.value, tibcByDate.get(e.date)!)
                    : null
                const feNaVal =
                  e.test === 'Urine Sodium' &&
                  e.value != null &&
                  sodiumByDate.has(e.date) &&
                  creatinineByDate.has(e.date) &&
                  urineCreatinineByDate.has(e.date)
                    ? feNa(e.value, creatinineByDate.get(e.date)!, sodiumByDate.get(e.date)!, urineCreatinineByDate.get(e.date)!)
                    : null
                const feUreaVal =
                  e.test === 'Urine Urea Nitrogen' &&
                  e.value != null &&
                  bunByDate.has(e.date) &&
                  creatinineByDate.has(e.date) &&
                  urineCreatinineByDate.has(e.date)
                    ? feUrea(e.value, creatinineByDate.get(e.date)!, bunByDate.get(e.date)!, urineCreatinineByDate.get(e.date)!)
                    : null
                const upcClass =
                  e.test === 'Urine Protein/Creatinine Ratio' && e.value != null ? classifyUpcRatio(e.value) : null
                const orthostatic =
                  e.test === 'Urine Pro/Cr - Random' && e.value != null && firstMorningUpcByDate.has(e.date)
                    ? firstMorningUpcByDate.get(e.date)! < 0.2 && e.value >= 0.2
                    : null
                const abnormal =
                  isAbnormal(e.value, e.ref) ||
                  (!!e.valueText && e.valueText !== 'Negative') ||
                  (!!e.microDetails?.organism && isPositiveCulture(e.microDetails.organism)) ||
                  (tsat != null && tsat < 20) ||
                  (upcClass != null && upcClass !== 'normal') ||
                  (e.test === 'Hemoglobin' && e.value != null && e.value < anemiaHbThreshold)
                return (
                  <tr key={e.id} className={abnormal ? 'row-abnormal' : ''}>
                    <td>{toShamsi(e.date)}</td>
                    <td>{e.category}</td>
                    <td>{e.test}</td>
                    <td className={abnormal ? 'value-abnormal' : ''}>
                      {e.microDetails ? (
                        <div className="micro-summary">
                          <strong>{e.microDetails.organism}</strong>
                          {e.microDetails.colonyCount && <div className="patient-meta">{e.microDetails.colonyCount}</div>}
                          {e.microDetails.collectionMethod && (
                            <div className="patient-meta">{e.microDetails.collectionMethod}</div>
                          )}
                          {e.microDetails.onAntibiotics && <div className="patient-meta">On antibiotics at collection</div>}
                          {e.microDetails.susceptibilities.length > 0 && (
                            <div className="micro-susceptibilities">
                              {e.microDetails.susceptibilities.map((s, i) => (
                                <span
                                  key={i}
                                  className={`status-badge status-badge--renal-${
                                    s.result === 'S' ? 'no' : s.result === 'I' ? 'review' : 'yes'
                                  }`}
                                >
                                  {s.antibiotic} {s.result}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          {e.valueText ?? e.value ?? ''}
                          {e.test === 'Calcium' &&
                            e.value != null &&
                            albuminByDate.has(e.date) && (
                              <div className="patient-meta">
                                Corrected: {correctedCalcium(e.value, albuminByDate.get(e.date)!).toFixed(2)} mg/dL
                              </div>
                            )}
                          {tsat != null && (
                            <div className={tsat < 20 ? 'value-abnormal' : 'patient-meta'}>
                              TSAT: {tsat.toFixed(1)}%{tsat < 20 ? ' — consider iron' : ''}
                            </div>
                          )}
                          {feNaVal != null && (
                            <div className="patient-meta">
                              FeNa: {feNaVal.toFixed(2)}% ({feNaVal < 1 ? 'prerenal' : feNaVal > 2 ? 'intrinsic' : 'indeterminate'})
                            </div>
                          )}
                          {feUreaVal != null && (
                            <div className="patient-meta">
                              FeUrea: {feUreaVal.toFixed(1)}% (
                              {feUreaVal < 35 ? 'prerenal' : feUreaVal > 50 ? 'intrinsic' : 'indeterminate'})
                            </div>
                          )}
                          {upcClass != null && (
                            <div className={upcClass !== 'normal' ? 'value-abnormal' : 'patient-meta'}>
                              {PROTEINURIA_CLASS_LABEL[upcClass]}
                            </div>
                          )}
                          {orthostatic != null && (
                            <div className="patient-meta">
                              {orthostatic
                                ? 'First-morning normal, random elevated — orthostatic pattern'
                                : 'First-morning also elevated — not orthostatic'}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>{e.unit}</td>
                    <td>{e.ref}</td>
                    <td>{e.comment}</td>
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
        </>
      )}
    </div>
  )
}
