import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toJalaali } from 'jalaali-js'
import { addCaseLogEntry, deleteCaseLogEntry, listCaseLogEntries, type CaseLogEntryWithPatient } from '../lib/api/caseLog'
import { listPatients } from '../lib/api/patients'
import { CASE_LOG_CATEGORIES, CASE_LOG_ROLES, CASE_LOG_SETTINGS } from '../lib/caseLogPresets'
import { SHAMSI_MONTHS, toPersianDigits } from '../lib/shamsi'
import { matchesSearch } from '../lib/textFilter'
import type { Patient } from '../types/domain'

function dateBadge(iso: string): { day: string; month: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return { day: '—', month: '' }
  const { jm, jd } = toJalaali(Number(m[1]), Number(m[2]), Number(m[3]))
  return { day: toPersianDigits(jd), month: SHAMSI_MONTHS[jm - 1] }
}

const emptyDraft = {
  date: new Date().toISOString().slice(0, 10),
  category: CASE_LOG_CATEGORIES[0],
  diagnosis: '',
  role: CASE_LOG_ROLES[0].value,
  procedure: '',
  setting: '',
  patientId: '',
  notes: '',
}

export function CaseLogPage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<CaseLogEntryWithPatient[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([listCaseLogEntries(), listPatients()])
      .then(([entryRows, patientRows]) => {
        setEntries(entryRows)
        setPatients(patientRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load case log'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.diagnosis.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const entry = await addCaseLogEntry({
        patientId: draft.patientId || null,
        date: draft.date,
        category: draft.category,
        diagnosis: draft.diagnosis.trim(),
        role: draft.role as CaseLogEntryWithPatient['role'],
        procedure: draft.procedure || null,
        setting: draft.setting || null,
        notes: draft.notes || null,
      })
      setEntries((prev) => [entry, ...prev])
      setDraft({ ...emptyDraft, date: draft.date })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add case log entry')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCaseLogEntry(id)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const categoryCounts = useMemo(() => {
    const counts = new Map(CASE_LOG_CATEGORIES.map((c) => [c, 0]))
    for (const e of entries) {
      counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.count - b.count)
  }, [entries])

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of entries) counts.set(e.role, (counts.get(e.role) ?? 0) + 1)
    return CASE_LOG_ROLES.map((r) => ({ ...r, count: counts.get(r.value) ?? 0 }))
  }, [entries])

  const unexposedCount = categoryCounts.filter((c) => c.count === 0).length

  const visibleEntries = entries
    .filter((e) => activeCategory === 'All' || e.category === activeCategory)
    .filter((e) => matchesSearch([e.diagnosis, e.procedure, e.setting, e.notes, e.patientName], search))

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
            <h1>Case Log</h1>
            <p className="np-sub">
              Diagnoses, procedures and your role in each encounter — your clinical exposure for fellowship case-mix
              review.
            </p>
          </div>
          <svg className="np-art np-art-float" width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
            <rect x="20" y="14" width="56" height="70" rx="10" fill="rgba(255,255,255,.08)" stroke="#4F86E8" strokeWidth={2} />
            <rect x="36" y="8" width="24" height="12" rx="4" fill="#0A2352" stroke="#9CC2FF" strokeWidth={2} />
            <path
              d="M32 38l6 6 12-12"
              stroke="#7FD4FF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={40}
              style={{ animation: 'np-draw 1s ease .4s both' }}
            />
            <path
              d="M32 56h32M32 68h22"
              stroke="#4F86E8"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={40}
              style={{ animation: 'np-draw 1s ease .7s both' }}
            />
          </svg>
        </div>
        <div className="np-hstats" style={{ '--n': 5 } as CSSProperties}>
          {roleCounts.map((r) => (
            <div key={r.value}>
              <b>{r.count}</b>
              <span>{r.label.replace(' (primary)', '')}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="np-grid2">
        <form className="np-card np-fade" style={{ animationDelay: '.1s' }} onSubmit={(e) => void handleAdd(e)}>
          <h2>Log an encounter</h2>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="cl-date">Date</label>
              <input
                id="cl-date"
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value || new Date().toISOString().slice(0, 10) })}
                required
              />
            </div>
            <div className="np-field">
              <label htmlFor="cl-cat">Category</label>
              <select id="cl-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {CASE_LOG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="cl-dx">Diagnosis</label>
            <input
              id="cl-dx"
              placeholder="e.g. Nephrotic syndrome"
              value={draft.diagnosis}
              onChange={(e) => setDraft({ ...draft, diagnosis: e.target.value })}
              required
            />
          </div>
          <div className="np-field">
            <span className="np-lbl">Your role</span>
            <div className="cl-roles">
              {CASE_LOG_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={draft.role === r.value ? 'cl-role on' : 'cl-role'}
                  onClick={() => setDraft({ ...draft, role: r.value })}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="cl-proc">Procedure</label>
              <input
                id="cl-proc"
                placeholder="Optional"
                value={draft.procedure}
                onChange={(e) => setDraft({ ...draft, procedure: e.target.value })}
              />
            </div>
            <div className="np-field">
              <label htmlFor="cl-setting">Setting</label>
              <select id="cl-setting" value={draft.setting} onChange={(e) => setDraft({ ...draft, setting: e.target.value })}>
                <option value="">Setting</option>
                {CASE_LOG_SETTINGS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="cl-patient">Link patient</label>
            <select id="cl-patient" value={draft.patientId} onChange={(e) => setDraft({ ...draft, patientId: e.target.value })}>
              <option value="">Optional</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="np-field">
            <label htmlFor="cl-notes">Notes</label>
            <textarea
              id="cl-notes"
              rows={2}
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="np-btn" disabled={submitting}>
            Add to log
          </button>
        </form>

        <div className="np-stack">
          <section className="np-card np-fade" style={{ animationDelay: '.16s' }}>
            <div className="np-head">
              <h2>Exposure map</h2>
              <span className="np-small">
                {categoryCounts.length - unexposedCount} of {categoryCounts.length} seen
              </span>
            </div>
            <div className="cl-cats">
              {categoryCounts.map((c, i) => (
                <span key={c.category} className={c.count > 0 ? 'cl-cat seen' : 'cl-cat'} style={{ animationDelay: `${0.3 + i * 0.04}s` }}>
                  {c.category}
                </span>
              ))}
            </div>
            <span className="np-small">Grey = not seen yet. Each category fills in blue as you log it.</span>
          </section>

          {loading ? (
            <p>Loading…</p>
          ) : entries.length === 0 ? (
            <section className="np-empty np-fade" style={{ animationDelay: '.22s' }}>
              <b style={{ fontSize: 15 }}>No entries yet</b>
              <span className="np-small">Your first encounter will appear here.</span>
            </section>
          ) : (
            <section className="np-card np-fade" style={{ animationDelay: '.22s' }}>
              <div className="np-toolbar">
                <div className="np-chips">
                  <button type="button" className={activeCategory === 'All' ? 'np-chip on' : 'np-chip'} onClick={() => setActiveCategory('All')}>
                    All · {entries.length}
                  </button>
                  {CASE_LOG_CATEGORIES.filter((c) => entries.some((e) => e.category === c)).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={activeCategory === c ? 'np-chip on' : 'np-chip'}
                      onClick={() => setActiveCategory(c)}
                    >
                      {c} · {entries.filter((e) => e.category === c).length}
                    </button>
                  ))}
                </div>
                <div className="np-search">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <label className="np-sr" htmlFor="cl-search">
                    Search entries
                  </label>
                  <input id="cl-search" placeholder="Search entries" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="np-stack" style={{ gap: 10 }}>
                {visibleEntries.map((e) => {
                  const badge = dateBadge(e.date)
                  return (
                    <article key={e.id} className="np-item">
                      <div className="np-date">
                        <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{badge.day}</span>
                        <span style={{ fontSize: 11 }}>{badge.month}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="np-head">
                          <b style={{ fontSize: 16 }}>{e.diagnosis}</b>
                          <button type="button" className="link-button" onClick={() => void handleDelete(e.id)}>
                            Delete
                          </button>
                        </div>
                        <span className="np-small">
                          {e.category} · {CASE_LOG_ROLES.find((r) => r.value === e.role)?.label ?? e.role}
                          {e.setting ? ` · ${e.setting}` : ''}
                          {e.procedure ? ` · ${e.procedure}` : ''}
                        </span>
                        {e.patientId && e.patientName && (
                          <span className="np-small">
                            Patient: <Link to={`/patients/${e.patientId}`}>{e.patientName}</Link>
                          </span>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
