import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listAcademyTopics } from '../lib/api/academy'
import { sortSubTopics } from '../lib/sortSubTopics'
import { protectNumberRanges } from '../lib/bidiText'
import { MarkdownSection } from '../components/MarkdownSection'
import type { AcademyTopic } from '../types/domain'

function hasHighYieldContent(t: AcademyTopic): boolean {
  return Boolean(t.summary?.trim() || t.keyPoints.length > 0 || t.redFlags?.trim() || t.pearls?.trim())
}

export function HighYieldPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  const searching = search.trim().length > 0

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = topics.filter((t) => {
      if (!hasHighYieldContent(t)) return false
      if (category !== 'All' && t.category !== category) return false
      if (q) {
        const haystack = [t.name, t.category, t.summary, t.keyPoints.join(' '), t.redFlags, t.pearls]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
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

  function expandAll() {
    setExpandedIds(new Set(groups.flatMap((g) => g.items.map((t) => t.id))))
  }

  function collapseAll() {
    setExpandedIds(new Set())
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
        <div className="np-glow amber" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>High-Yield Summary</h1>
            <p className="np-sub">
              Summary, key points, red flags and pearls for every Academy topic — built for fast pre-exam
              review.
            </p>
          </div>
          <svg className="np-art hy-zap" width="74" height="84" viewBox="0 0 74 84" fill="none" aria-hidden="true">
            <path d="M42 4 8 48h26l-6 32 38-48H40z" fill="#FFC46B" stroke="#FFE2B0" strokeWidth={2} strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="np-toolbar np-fade" style={{ animationDelay: '.08s' }}>
        <div className="np-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label className="np-sr" htmlFor="hy-search">
            Search topic, category or content
          </label>
          <input
            id="hy-search"
            placeholder="Search topic, category or content"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="np-field" style={{ width: 220 }}>
          <label className="np-sr" htmlFor="hy-cat">
            Category
          </label>
          <select id="hy-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="All">All categories ({topics.filter(hasHighYieldContent).length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="np-btn ghost sm" style={{ height: 48 }} onClick={expandAll}>
          Expand all
        </button>
        <button type="button" className="np-btn ghost sm" style={{ height: 48 }} onClick={collapseAll}>
          Collapse all
        </button>
        <button type="button" className="np-btn sm" style={{ height: 48 }} onClick={() => window.print()}>
          Print / PDF
        </button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : totalCount === 0 ? (
        <section className="np-empty np-fade">
          <b style={{ fontSize: 15 }}>No topics match yet.</b>
        </section>
      ) : (
        <div className="np-grid2">
          {groups.map((group, gi) => (
            <section key={group.category} className="np-card hy-grp np-fade" style={{ animationDelay: `${0.14 + gi * 0.07}s` }}>
              <div className="np-head" style={{ padding: '4px 0 8px' }}>
                <h2 style={{ color: '#12357A' }}>{group.category}</h2>
                <span className="np-small">{group.items.length} topics</span>
              </div>
              {group.items.map((t) => {
                const isOpen = searching || expandedIds.has(t.id)
                return (
                  <div key={t.id} className={isOpen ? 'hy-item open' : 'hy-item'}>
                    <button type="button" className="hy-btn" onClick={() => toggleExpanded(t.id)}>
                      <b dir="auto">{t.name}</b>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <div className="hy-body">
                      {t.summary?.trim() && (
                        <div className="hy-block" style={{ background: '#F2F7FF' }}>
                          <span style={{ color: '#1546A8' }}>SUMMARY</span>
                          <MarkdownSection text={t.summary} />
                        </div>
                      )}
                      {t.keyPoints.length > 0 && (
                        <div className="hy-block" style={{ background: '#F2F7FF' }}>
                          <span style={{ color: '#1546A8' }}>KEY POINTS</span>
                          <ul className="study-link-list">
                            {t.keyPoints.map((k, i) => (
                              <li key={i} dir="rtl">
                                {protectNumberRanges(k)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {t.redFlags?.trim() && (
                        <div className="hy-block" style={{ background: '#FDF0EF' }}>
                          <span style={{ color: '#B42318' }}>RED FLAGS</span>
                          <MarkdownSection text={t.redFlags} />
                        </div>
                      )}
                      {t.pearls?.trim() && (
                        <div className="hy-block" style={{ background: '#FDF6E8' }}>
                          <span style={{ color: '#93590B' }}>PEARLS</span>
                          <MarkdownSection text={t.pearls} />
                        </div>
                      )}
                      <span className="np-small" style={{ gridColumn: '1 / -1' }}>
                        <Link to={`/academy/${t.id}`}>Open full topic →</Link>
                      </span>
                    </div>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}

      {skippedCount > 0 && (
        <span className="np-small">
          {skippedCount} topic{skippedCount === 1 ? '' : 's'} with no condensed content yet are hidden.
        </span>
      )}
    </div>
  )
}
