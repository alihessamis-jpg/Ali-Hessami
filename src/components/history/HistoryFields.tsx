// Building blocks of the step-by-step pediatric history wizard: section
// cards with a tinted icon tile, tri-state finding chips, segmented
// pickers and text areas with dictation + full-screen editing.
import { useRef, useState, type ReactNode } from 'react'
import { useDictation } from '../../lib/speech'
import type { Option, Tri, TriMap } from '../../lib/pedsHistory'

export function HxCard({ icon, title, sub, children }: { icon: ReactNode; title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="hx-card">
      <header className="hx-card-head">
        <span className="hx-tile" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

export function HxLabel({ children, en }: { children: ReactNode; en?: string }) {
  return (
    <span className="hx-label">
      {children}
      {en && <small>{en}</small>}
    </span>
  )
}

export function HxInput({
  label,
  en,
  value,
  onChange,
  placeholder,
  numeric,
  type,
  dir,
}: {
  label: string
  en?: string
  value: string | number | null | undefined
  onChange: (v: string) => void
  placeholder?: string
  numeric?: boolean
  type?: string
  dir?: 'ltr' | 'rtl' | 'auto'
}) {
  return (
    <label className="hx-field">
      <HxLabel en={en}>{label}</HxLabel>
      <input
        className="hx-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type ?? 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        dir={dir ?? 'auto'}
      />
    </label>
  )
}

export function HxSegmented<T extends string>({
  label,
  en,
  options,
  value,
  onChange,
}: {
  label?: string
  en?: string
  options: Array<{ id: T; label: string }>
  value: T | null | undefined
  onChange: (v: T | undefined) => void
}) {
  return (
    <div className="hx-field">
      {label && <HxLabel en={en}>{label}</HxLabel>}
      <div className={options.length > 2 ? 'hx-seg grid' : 'hx-seg'} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            className={value === o.id ? 'on' : ''}
            onClick={() => onChange(value === o.id ? undefined : o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TriLegend({ yes = 'دارد', no = 'ندارد' }: { yes?: string; no?: string }) {
  return (
    <div className="hx-legend">
      <span>
        <i className="y" /> یک ضربه: {yes}
      </span>
      <span>
        <i className="n" /> دو ضربه: {no}
      </span>
      <span>
        <i /> سه ضربه: پاک
      </span>
    </div>
  )
}

export function TriChips({
  options,
  value,
  onToggle,
  faded,
  badge,
}: {
  options: Option[]
  value: TriMap | undefined
  onToggle: (id: string) => void
  faded?: (o: Option) => boolean
  badge?: (o: Option, state: Tri | undefined) => ReactNode
}) {
  return (
    <div className="hx-chips">
      {options.map((o) => {
        const st = value?.[o.id]
        const cls = ['hx-tri', st === 'yes' ? 'yes' : st === 'no' ? 'no' : '', faded?.(o) && !st ? 'faded' : '']
          .filter(Boolean)
          .join(' ')
        return (
          <button key={o.id} type="button" className={cls} onClick={() => onToggle(o.id)} aria-pressed={st ? true : false}>
            <span className="dot" aria-hidden="true">
              {st === 'yes' ? '✓' : st === 'no' ? '✕' : ''}
            </span>
            <span className="txt">{o.label}</span>
            {badge?.(o, st)}
          </button>
        )
      })}
    </div>
  )
}

export function HxArea({
  label,
  en,
  value,
  onChange,
  placeholder,
  rows = 3,
  chips,
}: {
  label?: string
  en?: string
  value: string | null | undefined
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  chips?: ReactNode
}) {
  const [full, setFull] = useState(false)
  const baseRef = useRef('')
  const dict = useDictation((finalText, interim) => {
    const joined = [baseRef.current, finalText, interim].filter(Boolean).join(' ')
    onChange(joined)
  })

  function toggleMic() {
    if (dict.listening) {
      dict.stop()
      return
    }
    baseRef.current = (value ?? '').trim()
    dict.start()
  }

  const area = (
    <div className={full ? 'hx-area full' : 'hx-area'}>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={full ? 14 : rows}
        dir="auto"
        autoFocus={full}
      />
      <div className="hx-area-tools">
        <button type="button" onClick={() => setFull((v) => !v)} aria-label={full ? 'بستن' : 'تمام صفحه'}>
          {full ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          )}
        </button>
        {dict.supported && (
          <button type="button" className={dict.listening ? 'rec' : ''} onClick={toggleMic} aria-label={dict.listening ? 'توقف دیکته' : 'دیکته صوتی'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {dict.error && dict.error !== 'no-speech' && <p className="hx-hint err">دیکته در دسترس نیست ({dict.error}).</p>}
    </div>
  )

  return (
    <div className="hx-field">
      {label && <HxLabel en={en}>{label}</HxLabel>}
      {chips}
      {full ? (
        <>
          <div className="hx-area-placeholder">{value || placeholder}</div>
          <div className="hx-full-backdrop" onClick={() => setFull(false)}>
            <div className="hx-full-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="hx-full-title">{label}</div>
              {area}
            </div>
          </div>
        </>
      ) : (
        area
      )}
    </div>
  )
}

/** Small stroke icons for the section tiles. */
export const HxIcon = {
  child: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" />
      <path d="M7 10h10M12 10v5M9 21l3-6 3 6" />
    </svg>
  ),
  family: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <circle cx="12" cy="13" r="2" />
      <path d="M3 20c0-3 2-5 4-5s4 2 4 5M13 20c0-3 2-5 4-5s4 2 4 5" />
    </svg>
  ),
  hospital: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M12 7v6M9 10h6M9 21v-4h6v4" />
    </svg>
  ),
  steth: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v3a5 5 0 0 0 10 0v-2" />
      <circle cx="20" cy="12" r="2" />
    </svg>
  ),
  note: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  mother: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" />
      <path d="M8 21v-6a4 4 0 0 1 8 0v6M12 12a3 3 0 1 0 0 0" />
    </svg>
  ),
  baby: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10h14a3 3 0 0 1-3 6H9a5 5 0 0 1-5-6zM18 10l2-4" />
      <circle cx="8" cy="20" r="1.5" />
      <circle cx="15" cy="20" r="1.5" />
    </svg>
  ),
  nicu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  ),
  bottle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2h4M9 5h6l1 4v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V9z" />
      <path d="M8 13h8M8 17h8" />
    </svg>
  ),
  growth: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4.5" r="2.5" />
      <path d="M12 8v7M8 11l4-2 4 2M9 22l3-7 3 7" />
    </svg>
  ),
  syringe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 2 4 4M17 7l-9 9-3 1 1-3 9-9M14 4l6 6M3 21l3-3" />
    </svg>
  ),
  tube: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v14a2 2 0 0 0 4 0V3M10 11h4" />
    </svg>
  ),
  pill: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="m9 9 6 6" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" />
    </svg>
  ),
  kidney: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3C4 3 3 7 3 11s1 10 6 10c3 0 3-3 2-5s1-3 1-5-2-3-1-5-1-3-3-3zM16 3c4 0 5 4 5 8s-1 10-6 10" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z" />
      <path d="M3 12h5l2-3 3 6 2-3h6" />
    </svg>
  ),
  ruler: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2" />
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" />
    </svg>
  ),
}
