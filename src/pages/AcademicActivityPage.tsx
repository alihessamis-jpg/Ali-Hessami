import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toJalaali } from 'jalaali-js'
import { addAcademicActivity, deleteAcademicActivity, listAcademicActivities } from '../lib/api/academicActivities'
import {
  ACADEMIC_ACTIVITY_CATEGORIES,
  ACADEMIC_ACTIVITY_ROLES,
  ACADEMIC_ACTIVITY_STATUSES,
  MANUSCRIPT_IN_PROGRESS_STATUSES,
} from '../lib/academicActivityPresets'
import { SHAMSI_MONTHS, toPersianDigits } from '../lib/shamsi'
import { matchesSearch } from '../lib/textFilter'
import type { AcademicActivity, AcademicActivityStatus } from '../types/domain'

const emptyDraft = {
  date: new Date().toISOString().slice(0, 10),
  category: ACADEMIC_ACTIVITY_CATEGORIES[0],
  title: '',
  role: '',
  venue: '',
  status: '',
  notes: '',
}

function statusLabel(status?: AcademicActivityStatus | null): string {
  return ACADEMIC_ACTIVITY_STATUSES.find((s) => s.value === status)?.label ?? status ?? ''
}

function roleLabel(role?: string | null): string {
  return ACADEMIC_ACTIVITY_ROLES.find((r) => r.value === role)?.label ?? role ?? ''
}

const STATUS_TAG_COLOR: Record<string, { color: string; background: string }> = {
  planned: { color: '#93590B', background: '#FDF0DC' },
  completed: { color: '#1546A8', background: '#E3EDFD' },
  submitted: { color: '#1546A8', background: '#E3EDFD' },
  under_review: { color: '#93590B', background: '#FDF0DC' },
  revision_requested: { color: '#B42318', background: '#FBE7E6' },
  accepted: { color: '#1A7F4E', background: '#E3F6EC' },
  published: { color: '#1A7F4E', background: '#E3F6EC' },
  rejected: { color: '#B42318', background: '#FBE7E6' },
}

function dateBadge(iso: string): { day: string; month: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return { day: '—', month: '' }
  const { jm, jd } = toJalaali(Number(m[1]), Number(m[2]), Number(m[3]))
  return { day: toPersianDigits(jd), month: SHAMSI_MONTHS[jm - 1] }
}

export function AcademicActivityPage() {
  const navigate = useNavigate()
  const [activities, setActivities] = useState<AcademicActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    listAcademicActivities()
      .then(setActivities)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load academic activity'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!draft.title.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const activity = await addAcademicActivity({
        date: draft.date,
        category: draft.category,
        title: draft.title.trim(),
        role: draft.role || null,
        venue: draft.venue || null,
        status: (draft.status || null) as AcademicActivityStatus | null,
        notes: draft.notes || null,
      })
      setActivities((prev) => [activity, ...prev])
      setDraft({ ...emptyDraft, date: draft.date, category: draft.category })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add activity')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAcademicActivity(id)
      setActivities((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const categoryCounts = useMemo(() => {
    const counts = new Map(ACADEMIC_ACTIVITY_CATEGORIES.map((c) => [c, 0]))
    for (const a of activities) {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.count - b.count)
  }, [activities])

  const manuscriptsInProgress = activities.filter(
    (a) => a.category === 'Manuscript' && MANUSCRIPT_IN_PROGRESS_STATUSES.includes(a.status ?? '')
  ).length
  const publishedCount = activities.filter((a) => a.status === 'published').length
  const conferenceCount = activities.filter((a) => a.category === 'Conference').length

  const visibleActivities = activities
    .filter((a) => activeCategory === 'All' || a.category === activeCategory)
    .filter((a) => matchesSearch([a.title, a.venue, a.notes, roleLabel(a.role), statusLabel(a.status)], search))

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
            <h1>Academic Activity</h1>
            <p className="np-sub">
              Conferences, journal club, presentations, posters and manuscripts — your record for portfolio review.
            </p>
          </div>
          <svg className="np-art" width="70" height="70" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M16 58V8" stroke="#9CC2FF" strokeWidth={3} strokeLinecap="round" />
            <path d="M16 10h32l-7 9 7 9H16z" fill="#FFC46B" className="ac-flag" />
          </svg>
        </div>
        <div className="np-hstats" style={{ '--n': 4 } as CSSProperties}>
          <div>
            <b>{activities.length}</b>
            <span>Total</span>
          </div>
          <div>
            <b>{conferenceCount}</b>
            <span>Conferences</span>
          </div>
          <div>
            <b>{manuscriptsInProgress}</b>
            <span>In progress</span>
          </div>
          <div>
            <b>{publishedCount}</b>
            <span>Published</span>
          </div>
        </div>
      </section>

      <div className="np-grid2">
        <section className="np-card np-fade" style={{ animationDelay: '.1s', gap: 10 }}>
          <h2 style={{ marginBottom: 4 }}>Activity by category</h2>
          {categoryCounts.map((c, i) => {
            const max = Math.max(1, ...categoryCounts.map((x) => x.count))
            return (
              <div key={c.category} className="ac-bar">
                <span>{c.category}</span>
                <div className="ac-track">
                  <i style={{ width: `${(c.count / max) * 100}%`, animationDelay: `${0.3 + i * 0.05}s` }} />
                </div>
                <b>{c.count}</b>
              </div>
            )
          })}
        </section>

        <form className="np-card np-fade" style={{ animationDelay: '.16s' }} onSubmit={(e) => void handleAdd(e)}>
          <h2>Add activity</h2>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="ac-date">Date</label>
              <input
                id="ac-date"
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value || new Date().toISOString().slice(0, 10) })}
                required
              />
            </div>
            <div className="np-field">
              <label htmlFor="ac-cat">Category</label>
              <select id="ac-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {ACADEMIC_ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="ac-title">Title</label>
            <input
              id="ac-title"
              placeholder="Talk or paper title"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              required
            />
          </div>
          <div className="np-f2">
            <div className="np-field">
              <label htmlFor="ac-role">Role</label>
              <select id="ac-role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
                <option value="">Role</option>
                {ACADEMIC_ACTIVITY_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="np-field">
              <label htmlFor="ac-status">Status</label>
              <select id="ac-status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                <option value="">Status</option>
                {ACADEMIC_ACTIVITY_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="np-field">
            <label htmlFor="ac-venue">Venue / journal</label>
            <input
              id="ac-venue"
              placeholder="Optional"
              value={draft.venue}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
            />
          </div>
          <div className="np-field">
            <label htmlFor="ac-notes">Notes</label>
            <input
              id="ac-notes"
              placeholder="Optional"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="np-btn" disabled={submitting}>
            Add
          </button>
        </form>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : activities.length === 0 ? (
        <section className="np-empty np-fade">
          <b style={{ fontSize: 15 }}>No academic activity yet</b>
          <span className="np-small">Conferences, journal club and manuscripts will appear here.</span>
        </section>
      ) : (
        <>
          <div className="np-toolbar np-fade" style={{ animationDelay: '.2s' }}>
            <div className="np-chips">
              <button type="button" className={activeCategory === 'All' ? 'np-chip on' : 'np-chip'} onClick={() => setActiveCategory('All')}>
                All · {activities.length}
              </button>
              {ACADEMIC_ACTIVITY_CATEGORIES.filter((c) => activities.some((a) => a.category === c)).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={activeCategory === c ? 'np-chip on' : 'np-chip'}
                  onClick={() => setActiveCategory(c)}
                >
                  {c} · {activities.filter((a) => a.category === c).length}
                </button>
              ))}
            </div>
            <div className="np-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <label className="np-sr" htmlFor="ac-search">
                Search activities
              </label>
              <input id="ac-search" placeholder="Search activities" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="np-stack" style={{ gap: 10 }}>
            {visibleActivities.map((a) => {
              const badge = dateBadge(a.date)
              const tagColor = STATUS_TAG_COLOR[a.status ?? ''] ?? { color: '#52627A', background: '#F1F4F9' }
              return (
                <article key={a.id} className="np-item np-fade">
                  <div className="np-date">
                    <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{badge.day}</span>
                    <span style={{ fontSize: 11 }}>{badge.month}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="np-head">
                      <b style={{ fontSize: 16 }}>{a.title}</b>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {a.status && (
                          <span className="np-tag" style={tagColor}>
                            {statusLabel(a.status)}
                          </span>
                        )}
                        <button type="button" className="link-button" onClick={() => void handleDelete(a.id)}>
                          Delete
                        </button>
                      </div>
                    </div>
                    <span className="np-small">
                      {a.category}
                      {a.role ? ` · ${roleLabel(a.role)}` : ''}
                      {a.venue ? ` · ${a.venue}` : ''}
                    </span>
                    {a.notes && <span className="np-small">{a.notes}</span>}
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
