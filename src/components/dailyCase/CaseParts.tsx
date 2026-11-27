import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { cleanPassage, renderAnswer } from '../../lib/assistantMarkdown'
import { getChapterFigureSignedUrl } from '../../lib/storage'
import { sourceHref } from '../../lib/dailyCase'
import type { CaseLab, CaseSource } from '../../types/dailyCase'

/**
 * Markdown with [S#] citation chips. Tapping a chip opens that source
 * (book · chapter · pages · excerpt, with a link to the reader) under the text.
 */
export function CaseText({
  text,
  sources,
  className,
  dir = 'rtl',
}: {
  text: string
  sources: Record<string, CaseSource>
  className?: string
  dir?: 'rtl' | 'auto'
}) {
  const html = useMemo(() => renderAnswer(text, (id) => id in sources), [text, sources])
  const [open, setOpen] = useState<string | null>(null)
  function onClick(e: MouseEvent<HTMLDivElement>) {
    const el = (e.target as HTMLElement).closest('button.cite') as HTMLElement | null
    const id = el?.dataset.s
    if (id && sources[id]) setOpen((cur) => (cur === id ? null : id))
  }
  const s = open ? sources[open] : null
  return (
    <div className={`as-ans dc-text ${className ?? ''}`} dir={dir}>
      <div onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      {s && <SourceCard s={s} onClose={() => setOpen(null)} />}
    </div>
  )
}

export function SourceCard({ s, onClose }: { s: CaseSource; onClose?: () => void }) {
  const href = sourceHref(s)
  return (
    <div className="dc-src" dir="rtl">
      <div className="dc-src-head">
        <span className="dc-src-id">{s.id}</span>
        <b dir="auto">{s.label}</b>
        {onClose && (
          <button type="button" className="dc-x" onClick={onClose} aria-label="بستن">
            ×
          </button>
        )}
      </div>
      {s.heading && <div className="np-small" dir="auto">{s.heading}</div>}
      {s.excerpt && <p className="dc-src-ex" dir="auto">{cleanPassage(s.excerpt).replace(/^#{1,6}\s+/gm, '').slice(0, 420)}…</p>}
      {href && (
        <Link to={href} className="dc-link">
          {s.kind === 'drug' ? 'Harriet Lane در Reference ←' : 'باز کردن در کتابخانه ←'}
        </Link>
      )}
    </div>
  )
}

const FLAG_LABEL: Record<CaseLab['flag'], string> = { H: 'H', L: 'L', N: '', C: '!!' }

/** Initial labs grouped by panel, abnormal values highlighted, age-specific reference range beside each. */
export function LabTable({ labs }: { labs: CaseLab[] }) {
  const panels = useMemo(() => {
    const m = new Map<string, CaseLab[]>()
    for (const l of labs) {
      const k = l.panel || 'Labs'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(l)
    }
    return [...m.entries()]
  }, [labs])
  return (
    <div className="dc-labs" dir="ltr">
      {panels.map(([panel, rows]) => (
        <table key={panel} className="dc-lab-table">
          <caption>{panel}</caption>
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Ref (for age)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => (
              <tr key={i} className={`dc-flag-${l.flag}`}>
                <td>{l.test}</td>
                <td className="dc-val">
                  <b>{l.value}</b> {l.unit}
                  {FLAG_LABEL[l.flag] && <span className="dc-flag">{FLAG_LABEL[l.flag]}</span>}
                </td>
                <td className="dc-ref">{l.ref_range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}

/** A figure from the user's own library (atlas / chapter figures) — never AI-generated. */
export function CaseFigure({ s }: { s: CaseSource }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!s.storagePath) return
    let cancelled = false
    getChapterFigureSignedUrl(s.storagePath)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [s.storagePath])
  const href = sourceHref(s)
  return (
    <figure className="dc-fig">
      {url ? <img src={url} alt={s.caption ?? ''} loading="lazy" /> : <div className="dc-fig-ph">{failed ? 'تصویر بارگذاری نشد' : '…'}</div>}
      <figcaption dir="auto">
        {s.caption}
        <span className="np-small"> — {s.book}</span>
        {href && (
          <>
            {' '}
            <Link to={href} className="dc-link">
              فصل در کتابخانه
            </Link>
          </>
        )}
      </figcaption>
    </figure>
  )
}

export function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const color = score >= 85 ? '#0f8b5f' : score >= 70 ? '#1e5bd8' : score >= 50 ? '#c27a0e' : '#c0392b'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`score ${score}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e3edfd" strokeWidth="8" fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="54%" textAnchor="middle" fontSize={size / 4} fontWeight="800" fill={color} dominantBaseline="middle">
        {score}
      </text>
    </svg>
  )
}

export function DifficultyPill({ d }: { d: string }) {
  const map: Record<string, [string, string, string]> = {
    moderate: ['Moderate', '#0b6670', '#dff4f3'],
    hard: ['Hard', '#93590b', '#fdf0dc'],
    'board-killer': ['Board-killer', '#a3222f', '#fde4e6'],
  }
  const [label, color, bg] = map[d] ?? [d, '#3b4a60', '#eef2f8']
  return (
    <span className="np-pill" style={{ color, background: bg }}>
      {label}
    </span>
  )
}
