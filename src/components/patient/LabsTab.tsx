import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addLabEntry, deleteLabEntry, listLabEntries } from '../../lib/api/labs'
import { correctedCalcium, transferrinSaturation } from '../../lib/formulas'
import { isAbnormal } from '../../lib/labRange'
import {
  COLLECTION_METHODS,
  COMMON_LAB_TESTS,
  CULTURE_TESTS,
  DIPSTICK_OPTIONS,
  DIPSTICK_TESTS,
  isPositiveCulture,
  LAB_CATEGORIES,
  LAB_CATEGORY_TESTS,
  SUSCEPTIBILITY_RESULTS,
} from '../../lib/labPresets'
import { toShamsi } from '../../lib/shamsi'
import type { LabEntry, MicroSusceptibility } from '../../types/domain'

interface Props {
  patientId: string
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

export function LabsTab({ patientId }: Props) {
  const [entries, setEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [micro, setMicro] = useState(emptyMicro)
  const [customTest, setCustomTest] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('All')

  useEffect(() => {
    refresh()
  }, [patientId])

  function refresh() {
    setLoading(true)
    listLabEntries(patientId)
      .then((rows) => setEntries(rows.slice().reverse()))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load labs'))
      .finally(() => setLoading(false))
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
    const isDipstick = DIPSTICK_TESTS.has(draft.test)
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
        value: isDipstick || isCulture || draft.value === '' ? null : Number(draft.value),
        valueText: isDipstick ? draft.valueText || null : null,
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

  const albuminByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (e.test === 'Albumin' && e.value != null) map.set(e.date, e.value)
    }
    return map
  }, [entries])

  const tibcByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      if (e.test === 'TIBC' && e.value != null) map.set(e.date, e.value)
    }
    return map
  }, [entries])

  const visibleEntries = useMemo(() => {
    if (activeCategory === 'All') return entries
    if (activeCategory === 'Other') return entries.filter((e) => !e.category)
    return entries.filter((e) => e.category === activeCategory)
  }, [entries, activeCategory])

  const testsForCategory = draft.category ? LAB_CATEGORY_TESTS[draft.category] ?? [] : []
  const isCulture = CULTURE_TESTS.has(draft.test)

  return (
    <div>
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
            (DIPSTICK_TESTS.has(draft.test) ? (
              <select value={draft.valueText} onChange={(e) => setDraft({ ...draft, valueText: e.target.value })}>
                <option value="">Value</option>
                {DIPSTICK_OPTIONS.map((o) => (
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
                const abnormal =
                  isAbnormal(e.value, e.ref) ||
                  (!!e.valueText && e.valueText !== 'Negative') ||
                  (!!e.microDetails?.organism && isPositiveCulture(e.microDetails.organism)) ||
                  (tsat != null && tsat < 20)
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
