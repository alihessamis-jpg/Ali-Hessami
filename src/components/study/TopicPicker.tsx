import { useEffect, useMemo, useRef, useState } from 'react'
import { matchesSearch } from '../../lib/textFilter'

type TopicGroup = {
  name: string
  items: { topic: string; label: string }[]
}

// Topics are named "<family> / <rest>" (e.g. "CKD / CKD-MBD / Phosphate
// Binders"). Grouping on the first segment keeps a growing family of
// subtopics under one collapsible entry, while a topic with no "/" (a
// future unrelated topic) stays its own flat top-level row instead of
// being interleaved with the family.
function groupTopics(topics: string[]): { flat: string[]; groups: TopicGroup[] } {
  const groupMap = new Map<string, { topic: string; label: string }[]>()
  const flat: string[] = []
  for (const topic of topics) {
    const sep = topic.indexOf(' / ')
    if (sep === -1) {
      flat.push(topic)
      continue
    }
    const name = topic.slice(0, sep)
    const label = topic.slice(sep + 3)
    if (!groupMap.has(name)) groupMap.set(name, [])
    groupMap.get(name)!.push({ topic, label })
  }
  const groups = Array.from(groupMap.entries())
    .map(([name, items]) => ({ name, items: items.sort((a, b) => a.label.localeCompare(b.label)) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return { flat: flat.sort(), groups }
}

type TopicPickerProps = {
  topics: string[]
  value: string
  onChange: (topic: string) => void
  countFor: (topic: string) => number
  totalCount: number
  allLabel?: string
}

export function TopicPicker({ topics, value, onChange, countFor, totalCount, allLabel = 'All topics' }: TopicPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const rootRef = useRef<HTMLDivElement>(null)

  const { flat, groups } = useMemo(() => groupTopics(topics), [topics])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Reveal whichever group holds the current selection when the panel opens.
  useEffect(() => {
    if (!open) return
    const sep = value.indexOf(' / ')
    if (sep === -1) return
    const name = value.slice(0, sep)
    setExpanded((prev) => (prev.has(name) ? prev : new Set(prev).add(name)))
  }, [open, value])

  // Auto-expand groups that have a match while searching.
  useEffect(() => {
    if (!search.trim()) return
    const matching = groups.filter((g) => matchesSearch([g.name], search) || g.items.some((item) => matchesSearch([item.topic], search)))
    setExpanded((prev) => {
      const next = new Set(prev)
      matching.forEach((g) => next.add(g.name))
      return next
    })
  }, [search, groups])

  function toggleGroup(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function select(topic: string) {
    onChange(topic)
    setOpen(false)
    setSearch('')
  }

  const selectedLabel = value === 'All' ? `${allLabel} (${totalCount})` : `${value} (${countFor(value)})`
  const showAll = matchesSearch([allLabel, 'All'], search)
  const visibleFlat = flat.filter((t) => matchesSearch([t], search))
  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter((item) => matchesSearch([item.topic], search) || matchesSearch([g.name], search)) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="topic-picker" ref={rootRef}>
      <button type="button" className="topic-picker-toggle" onClick={() => setOpen((o) => !o)}>
        <span>{selectedLabel}</span>
        <span className={`topic-picker-caret ${open ? 'open' : ''}`}>▸</span>
      </button>
      {open && (
        <div className="topic-picker-panel">
          <input
            autoFocus
            className="topic-picker-search"
            placeholder="Search topics…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="topic-picker-list">
            {showAll && (
              <button type="button" className={`topic-picker-item ${value === 'All' ? 'active' : ''}`} onClick={() => select('All')}>
                {allLabel} ({totalCount})
              </button>
            )}
            {visibleFlat.map((t) => (
              <button key={t} type="button" className={`topic-picker-item ${value === t ? 'active' : ''}`} onClick={() => select(t)}>
                {t} ({countFor(t)})
              </button>
            ))}
            {visibleGroups.map((g) => (
              <div key={g.name} className="topic-picker-group">
                <button type="button" className="topic-picker-group-header" onClick={() => toggleGroup(g.name)}>
                  <span className={`topic-picker-caret ${expanded.has(g.name) ? 'open' : ''}`}>▸</span>
                  {g.name} ({g.items.reduce((sum, item) => sum + countFor(item.topic), 0)})
                </button>
                {expanded.has(g.name) && (
                  <div className="topic-picker-group-items">
                    {g.items.map((item) => (
                      <button
                        key={item.topic}
                        type="button"
                        className={`topic-picker-item ${value === item.topic ? 'active' : ''}`}
                        onClick={() => select(item.topic)}
                      >
                        {item.label} ({countFor(item.topic)})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!showAll && visibleFlat.length === 0 && visibleGroups.length === 0 && (
              <p className="topic-picker-empty">No topics match "{search}".</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
