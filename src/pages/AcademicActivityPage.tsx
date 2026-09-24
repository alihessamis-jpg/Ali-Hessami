import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addAcademicActivity, deleteAcademicActivity, listAcademicActivities } from '../lib/api/academicActivities'
import {
  ACADEMIC_ACTIVITY_CATEGORIES,
  ACADEMIC_ACTIVITY_ROLES,
  ACADEMIC_ACTIVITY_STATUSES,
  MANUSCRIPT_IN_PROGRESS_STATUSES,
} from '../lib/academicActivityPresets'
import { toShamsi } from '../lib/shamsi'
import { MilestoneIcon } from '../components/icons'
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

export function AcademicActivityPage() {
  const [activities, setActivities] = useState<AcademicActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [submitting, setSubmitting] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')

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

  const visibleActivities = activeCategory === 'All' ? activities : activities.filter((a) => a.category === activeCategory)

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <MilestoneIcon />
        </span>
        Academic Activity
      </h1>
      <p className="empty-state">
        Track conferences, journal club, presentations/posters, and manuscripts — a personal record for fellowship
        milestone and portfolio review.
      </p>

      <div className="calc-strip">
        <div>
          <span className="calc-label">Total activities</span>
          <span className="calc-value">{activities.length}</span>
        </div>
        <div>
          <span className="calc-label">Conferences</span>
          <span className="calc-value">{conferenceCount}</span>
        </div>
        <div>
          <span className="calc-label">Manuscripts in progress</span>
          <span className="calc-value">{manuscriptsInProgress}</span>
        </div>
        <div>
          <span className="calc-label">Published</span>
          <span className="calc-value">{publishedCount}</span>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Activity by category</h2>
        </div>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={categoryCounts} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="category" width={160} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [value, 'Activities']} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {categoryCounts.map((c) => (
                  <Cell key={c.category} fill={c.count === 0 ? 'var(--border)' : 'var(--accent)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <form className="lab-form" onSubmit={(e) => void handleAdd(e)}>
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value || new Date().toISOString().slice(0, 10) })}
          required
        />
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
          {ACADEMIC_ACTIVITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
        <select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })}>
          <option value="">Role</option>
          {ACADEMIC_ACTIVITY_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input placeholder="Venue / journal" value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} />
        <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
          <option value="">Status</option>
          {ACADEMIC_ACTIVITY_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        <button type="submit" disabled={submitting}>
          Add
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : activities.length === 0 ? (
        <p className="empty-state">No academic activity logged yet.</p>
      ) : (
        <>
          <div className="category-pills">
            <button
              type="button"
              className={`category-pill ${activeCategory === 'All' ? 'active' : ''}`}
              onClick={() => setActiveCategory('All')}
            >
              All ({activities.length})
            </button>
            {ACADEMIC_ACTIVITY_CATEGORIES.filter((c) => activities.some((a) => a.category === c)).map((c) => (
              <button
                key={c}
                type="button"
                className={`category-pill ${activeCategory === c ? 'active' : ''}`}
                onClick={() => setActiveCategory(c)}
              >
                {c} ({activities.filter((a) => a.category === c).length})
              </button>
            ))}
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Title</th>
                <th>Role</th>
                <th>Venue</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleActivities.map((a) => (
                <tr key={a.id}>
                  <td>{toShamsi(a.date)}</td>
                  <td>{a.category}</td>
                  <td>{a.title}</td>
                  <td>{roleLabel(a.role)}</td>
                  <td>{a.venue}</td>
                  <td>{statusLabel(a.status)}</td>
                  <td>{a.notes}</td>
                  <td>
                    <button className="link-button" onClick={() => void handleDelete(a.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
