import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { addLabEntry, deleteLabEntry, listLabEntries } from '../../lib/api/labs'
import { isAbnormal } from '../../lib/labRange'
import { COMMON_LAB_TESTS, LAB_CATEGORIES, LAB_CATEGORY_TESTS } from '../../lib/labPresets'
import { toShamsi } from '../../lib/shamsi'
import type { LabEntry } from '../../types/domain'

interface Props {
  patientId: string
}

const CUSTOM_TEST = '__custom__'

const emptyDraft = { date: new Date().toISOString().slice(0, 10), category: '', test: '', value: '', unit: '', ref: '', comment: '' }

export function LabsTab({ patientId }: Props) {
  const [entries, setEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
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

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.test.trim() || !draft.date) return
    setSubmitting(true)
    setError(null)
    try {
      const entry = await addLabEntry({
        patientId,
        date: draft.date,
        category: draft.category || null,
        test: draft.test.trim(),
        value: draft.value === '' ? null : Number(draft.value),
        unit: draft.unit || null,
        ref: draft.ref || null,
        comment: draft.comment || null,
      })
      setEntries((prev) => [entry, ...prev])
      setDraft({ ...emptyDraft, date: draft.date, category: draft.category })
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

  const visibleEntries = useMemo(() => {
    if (activeCategory === 'All') return entries
    if (activeCategory === 'Other') return entries.filter((e) => !e.category)
    return entries.filter((e) => e.category === activeCategory)
  }, [entries, activeCategory])

  const testsForCategory = draft.category ? LAB_CATEGORY_TESTS[draft.category] ?? [] : []

  return (
    <div>
      <datalist id="lab-test-options">
        {COMMON_LAB_TESTS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
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
        <input placeholder="Value" type="number" step="any" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
        <input placeholder="Unit" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
        <input placeholder="Reference range" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} />
        <input placeholder="Comment" value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
        <button type="submit" disabled={submitting}>
          Add
        </button>
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
                const abnormal = isAbnormal(e.value, e.ref)
                return (
                  <tr key={e.id} className={abnormal ? 'row-abnormal' : ''}>
                    <td>{toShamsi(e.date)}</td>
                    <td>{e.category}</td>
                    <td>{e.test}</td>
                    <td className={abnormal ? 'value-abnormal' : ''}>{e.value ?? ''}</td>
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
