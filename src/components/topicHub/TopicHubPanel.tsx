import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadHub, listAllChapters, linkChapter, type HubChapter, type HubData } from '../../lib/api/topicHub'
import { addAcademyTopic } from '../../lib/api/academy'
import {
  HUB_CATEGORIES,
  categoryFa,
  descendantIds,
  sortCategories,
  statsForTopics,
  topicMatches,
  topicTree,
  type HubSort,
  type TopicNode,
} from '../../lib/topicHub'
import { describeError } from '../../lib/debugError'
import { toPersianDigits } from '../../lib/shamsi'
import { AccuracyBar, TopicBadges } from './TopicBadges'
import type { AcademyTopic } from '../../types/domain'

const SORTS: [HubSort, string][] = [
  ['weakest', 'ضعیف‌ترین'],
  ['alpha', 'الفبایی'],
  ['questions', 'بیشترین سؤال'],
]

function sortPref(): HubSort {
  try {
    const v = localStorage.getItem('topicHub.sort')
    return v === 'alpha' || v === 'questions' ? v : 'weakest'
  } catch {
    return 'weakest'
  }
}

/**
 * Academy → «My topics» as a Topic Hub: one card per board category (accuracy,
 * unanswered questions, my patients), weakest first; a card opens its topic
 * tree. `search` comes from the Library toolbar and matches name + key points.
 */
export function TopicHubPanel({ search }: { search: string }) {
  const [hub, setHub] = useState<HubData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<HubSort>(sortPref)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadHub()
      .then(setHub)
      .catch((e) => setError(describeError(e)))
  }, [])

  function chooseSort(s: HubSort) {
    setSort(s)
    try {
      localStorage.setItem('topicHub.sort', s)
    } catch {
      /* per-device convenience only */
    }
  }

  const rows = useMemo(() => {
    if (!hub) return []
    const known = new Set(HUB_CATEGORIES.map((c) => c.key))
    const cats = [...HUB_CATEGORIES]
    // any category in the data that isn't in the fixed list still gets a card
    for (const t of hub.topics) if (t.category && !known.has(t.category)) {
      known.add(t.category)
      cats.push({ key: t.category, fa: t.category })
    }
    return cats
      .map((cat) => {
        const topics = hub.topics.filter((t) => t.category === cat.key)
        return { cat, topics, stats: statsForTopics(hub.index, topics.map((t) => t.id)) }
      })
      .filter((r) => r.topics.length > 0)
  }, [hub])
  const sorted = useMemo(() => sortCategories(rows, sort), [rows, sort])

  const q = search.trim()
  const matches = useMemo(() => (hub && q ? hub.topics.filter((t) => topicMatches(t, q)) : []), [hub, q])

  if (error) return <p className="form-error">Topic Hub بارگذاری نشد — {error}</p>
  if (!hub) return <p className="np-small">در حال بارگذاری Topic Hub…</p>

  return (
    <div className="th-hub np-fade" dir="rtl">
      <div className="th-toolbar">
        <div className="np-chips" role="radiogroup" aria-label="مرتب‌سازی">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={sort === k} className={`np-chip ${sort === k ? 'on' : ''}`} onClick={() => chooseSort(k)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="np-btn sm" onClick={() => setAdding(true)}>
          + مبحث جدید
        </button>
      </div>

      {adding && <NewTopicForm topics={hub.topics} onClose={() => setAdding(false)} />}

      {q ? (
        <div className="th-search">
          <span className="np-small">
            {toPersianDigits(matches.length)} مبحث برای «<span dir="auto">{q}</span>»
          </span>
          {matches.map((t) => (
            <TopicRow key={t.id} topic={t} hub={hub} depth={0} subtitle={categoryFa(t.category)} />
          ))}
        </div>
      ) : (
        <div className="th-grid">
          {sorted.map(({ cat, topics, stats }) => {
            const open = openCat === cat.key
            return (
              <section key={cat.key} className={`th-cat ${open ? 'open' : ''}`}>
                <button type="button" className="th-cat-head" aria-expanded={open} onClick={() => setOpenCat(open ? null : cat.key)}>
                  <span className="th-cat-title">
                    <b>{cat.fa}</b>
                    <span className="np-small" dir="ltr">
                      {cat.key}
                    </span>
                  </span>
                  <AccuracyBar accuracy={stats.accuracy} attempts={stats.attempts} />
                  <span className="th-cat-meta">
                    <span>{toPersianDigits(topics.length)} مبحث</span>
                    <span>{toPersianDigits(stats.questions)} سؤال</span>
                    <span className={stats.unanswered ? 'th-due' : ''}>{toPersianDigits(stats.unanswered)} جواب‌نداده</span>
                    {stats.patients > 0 && <span>👤 {toPersianDigits(stats.patients)} بیمار</span>}
                  </span>
                </button>
                {open && (
                  <div className="th-tree">
                    {topicTree(topics).map((n) => (
                      <TreeNode key={n.topic.id} node={n} hub={hub} depth={0} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TreeNode({ node, hub, depth }: { node: TopicNode; hub: HubData; depth: number }) {
  return (
    <>
      <TopicRow topic={node.topic} hub={hub} depth={depth} statIds={depth === 0 ? descendantIds(node) : undefined} />
      {node.children.map((c) => (
        <TreeNode key={c.topic.id} node={c} hub={hub} depth={depth + 1} />
      ))}
    </>
  )
}

function TopicRow({ topic, hub, depth, subtitle, statIds }: { topic: AcademyTopic; hub: HubData; depth: number; subtitle?: string; statIds?: string[] }) {
  const s = statsForTopics(hub.index, statIds ?? [topic.id])
  return (
    <Link to={`/academy/${topic.id}`} className={`th-row ${depth === 0 ? 'root' : ''}`} style={{ paddingInlineStart: 12 + depth * 22 }}>
      <span className="th-row-main">
        <b dir="auto">{topic.name}</b>
        <span className="th-row-sub">
          {subtitle && <span className="np-small">{subtitle}</span>}
          <TopicBadges topic={topic} />
        </span>
      </span>
      <span className="th-row-stat">
        <AccuracyBar accuracy={s.accuracy} attempts={s.attempts} />
        <span className="np-small">{toPersianDigits(s.questions)} سؤال</span>
      </span>
    </Link>
  )
}

// ------------------------------------------------------------------ new topic
function treeOptions(nodes: TopicNode[], depth = 0): JSX.Element[] {
  return nodes.flatMap((n) => [
    <option key={n.topic.id} value={n.topic.id}>
      {'— '.repeat(depth)}
      {n.topic.name}
    </option>,
    ...treeOptions(n.children, depth + 1),
  ])
}

function NewTopicForm({ topics, onClose }: { topics: AcademyTopic[]; onClose: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [parentId, setParentId] = useState('')
  const [chapters, setChapters] = useState<HubChapter[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [chq, setChq] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    listAllChapters()
      .then(setChapters)
      .catch((e) => setErr(describeError(e)))
  }, [])

  const parents = useMemo(() => topics.filter((t) => t.category === category), [topics, category])
  const shownChapters = useMemo(() => {
    const n = chq.trim().toLowerCase()
    const list = n ? chapters.filter((c) => `${c.bookTitle} ${c.chapterNumber} ${c.title}`.toLowerCase().includes(n)) : chapters.filter((c) => picked.has(c.id))
    return list.slice(0, 40)
  }, [chapters, chq, picked])

  async function create() {
    if (!name.trim() || !category || !parentId) return
    setBusy(true)
    setErr(null)
    try {
      const t = await addAcademyTopic({
        name: name.trim(),
        category,
        parentTopicId: parentId,
        keyPoints: [],
        studyLinks: [],
        caseQuestions: [],
      })
      for (const ch of picked) await linkChapter(t.id, ch)
      navigate(`/academy/${t.id}`)
    } catch (e) {
      setErr(describeError(e))
      setBusy(false)
    }
  }

  return (
    <div className="np-card th-new">
      <div className="np-head">
        <h2>مبحث جدید</h2>
        <button type="button" className="dc-x" onClick={onClose} aria-label="بستن">
          ×
        </button>
      </div>
      <div className="np-field">
        <label htmlFor="th-name">نام مبحث</label>
        <input id="th-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="np-f2">
        <div className="np-field">
          <label htmlFor="th-cat">دسته (اجباری)</label>
          <select
            id="th-cat"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setParentId('')
            }}
          >
            <option value="">انتخاب…</option>
            {HUB_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.fa} — {c.key}
              </option>
            ))}
          </select>
        </div>
        <div className="np-field">
          <label htmlFor="th-parent">مبحث والد (اجباری)</label>
          <select id="th-parent" value={parentId} onChange={(e) => setParentId(e.target.value)} disabled={!category}>
            <option value="">{category ? 'انتخاب…' : 'اول دسته را انتخاب کن'}</option>
            {treeOptions(topicTree(parents))}
          </select>
        </div>
      </div>
      <div className="np-field">
        <label htmlFor="th-ch">فصل‌های مرتبط ({toPersianDigits(picked.size)})</label>
        <input id="th-ch" dir="auto" value={chq} onChange={(e) => setChq(e.target.value)} placeholder="جستجو در فصل‌ها (مثلاً nephrotic یا 14)…" />
      </div>
      <div className="th-chpick">
        {shownChapters.map((c) => (
          <label key={c.id} className="th-chopt">
            <input
              type="checkbox"
              checked={picked.has(c.id)}
              onChange={() =>
                setPicked((p) => {
                  const n = new Set(p)
                  if (n.has(c.id)) n.delete(c.id)
                  else n.add(c.id)
                  return n
                })
              }
            />
            <span dir="ltr">
              {c.bookTitle} · Ch. {c.chapterNumber} — {c.title}
            </span>
          </label>
        ))}
      </div>
      {err && <p className="form-error">{err}</p>}
      <div className="dc-actions">
        <button type="button" className="np-btn" disabled={busy || !name.trim() || !category || !parentId} onClick={() => void create()}>
          {busy ? '…' : 'ساخت مبحث'}
        </button>
        <button type="button" className="np-btn ghost" onClick={onClose}>
          انصراف
        </button>
      </div>
    </div>
  )
}
