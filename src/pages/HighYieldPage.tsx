import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAcademyTopics } from '../lib/api/academy'
import { sortSubTopics } from '../lib/sortSubTopics'
import { protectNumberRanges } from '../lib/bidiText'
import { MarkdownSection } from '../components/MarkdownSection'
import { NotesIcon } from '../components/icons'
import type { AcademyTopic } from '../types/domain'

function hasHighYieldContent(t: AcademyTopic): boolean {
  return Boolean(t.summary?.trim() || t.keyPoints.length > 0 || t.redFlags?.trim() || t.pearls?.trim())
}

export function HighYieldPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')

  useEffect(() => {
    setLoading(true)
    listAcademyTopics()
      .then(setTopics)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load topics'))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const t of topics) if (t.category) set.add(t.category)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [topics])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = topics.filter((t) => {
      if (!hasHighYieldContent(t)) return false
      if (category !== 'All' && t.category !== category) return false
      if (q && !t.name.toLowerCase().includes(q) && !(t.category ?? '').toLowerCase().includes(q)) return false
      return true
    })
    const byCategory = new Map<string, AcademyTopic[]>()
    for (const t of filtered) {
      const key = t.category || 'Uncategorized'
      const list = byCategory.get(key) ?? []
      list.push(t)
      byCategory.set(key, list)
    }
    return Array.from(byCategory.entries())
      .map(([cat, items]) => ({ category: cat, items: sortSubTopics(items) }))
      .sort((a, b) => a.category.localeCompare(b.category))
  }, [topics, search, category])

  const totalCount = groups.reduce((sum, g) => sum + g.items.length, 0)
  const skippedCount = topics.length - topics.filter(hasHighYieldContent).length

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <NotesIcon />
        </span>
        High-Yield Summary
      </h1>
      <p className="empty-state">
        Condensed Summary / Key points / Red flags / Pearls for every Academy topic that has them — built for
        fast pre-exam review, not first-time reading.
        {skippedCount > 0 &&
          ` ${skippedCount} topic${skippedCount === 1 ? '' : 's'} with no condensed content yet are hidden — add Summary, Key points, Red flags, or Pearls on the topic page to include them here.`}
      </p>

      {error && <p className="form-error">{error}</p>}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '12px 0' }}>
        <input
          placeholder="Search topic or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px' }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All categories ({topics.filter(hasHighYieldContent).length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      {totalCount === 0 ? (
        <div className="dash-card">
          <p className="empty-state">No topics match yet.</p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.category} className="dash-card">
            <div className="dash-card-header">
              <h2 className="dash-card-title">
                {group.category} ({group.items.length})
              </h2>
            </div>
            {group.items.map((t) => (
              <div key={t.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 6px' }}>
                  <Link to={`/academy/${t.id}`}>{t.name}</Link>
                </h3>
                {t.summary?.trim() && <MarkdownSection text={t.summary} />}
                {t.keyPoints.length > 0 && (
                  <ul className="study-link-list">
                    {t.keyPoints.map((k, i) => (
                      <li key={i} dir="rtl">
                        {protectNumberRanges(k)}
                      </li>
                    ))}
                  </ul>
                )}
                {t.redFlags?.trim() && (
                  <>
                    <p className="patient-meta" style={{ fontWeight: 600, marginBottom: 2 }}>
                      Red flags
                    </p>
                    <MarkdownSection text={t.redFlags} />
                  </>
                )}
                {t.pearls?.trim() && (
                  <>
                    <p className="patient-meta" style={{ fontWeight: 600, marginBottom: 2 }}>
                      Pearls
                    </p>
                    <MarkdownSection text={t.pearls} />
                  </>
                )}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
