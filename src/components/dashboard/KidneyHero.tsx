import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatShamsiWeekdayLong } from '../../lib/shamsi'
import { KidneyStage, type KidneyMode } from './KidneyStage'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const QUICK_LINKS = [
  { to: '/today', label: 'Today' },
  { to: '/patients', label: 'Patients' },
  { to: '/academy', label: 'Academy' },
  { to: '/board-readiness', label: 'Board' },
  { to: '/research', label: 'Research' },
]

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function KidneyHero({ followUpCount, dueCount }: { followUpCount: number; dueCount: number }) {
  const [mode, setMode] = useState<KidneyMode>('clinical')
  const now = new Date()

  const modes: Array<{ id: KidneyMode; title: string; meta: string; img: string; alt: string }> = [
    {
      id: 'clinical',
      title: 'Clinical',
      meta: plural(followUpCount, 'follow-up', 'follow-ups'),
      img: '/hero/kidney-section.webp',
      alt: 'Sectioned kidney',
    },
    {
      id: 'academy',
      title: 'Academy',
      meta: plural(dueCount, 'review due', 'reviews due'),
      img: '/hero/kidney-whole.webp',
      alt: 'Kidney with renal vessels and ureter',
    },
  ]
  const other = mode === 'clinical' ? 'academy' : 'clinical'

  return (
    <section className={`kh kh-${mode}`} aria-label="Nephron home">
      <div className="kh-bg kh-bg-clinical" />
      <div className="kh-bg kh-bg-academy" />
      <KidneyStage mode={mode} className="kh-stage" />

      <div className="kh-top">
        <span className="kh-date" dir="rtl">
          {formatShamsiWeekdayLong(now)}
        </span>
        <nav className="kh-pill" aria-label="Quick links">
          {QUICK_LINKS.map((l) => (
            <Link key={l.to} to={l.to}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="kh-left">
        <h1 className="kh-title">Nephro</h1>
        <p className="kh-desc">
          {greeting(now.getHours())}.{' '}
          {mode === 'clinical'
            ? followUpCount === 0
              ? 'No patients need follow-up today.'
              : `${plural(followUpCount, 'patient needs', 'patients need')} follow-up today.`
            : dueCount === 0
              ? 'Nothing is due for review today.'
              : `${plural(dueCount, 'item is', 'items are')} due for review today.`}
        </p>
        <Link className="kh-cta" to={mode === 'clinical' ? '/patients' : '/today'}>
          {mode === 'clinical' ? 'Open patients' : "Start today's review"}
          <span className="kh-plus" aria-hidden="true">
            +
          </span>
        </Link>
        <Link className="kh-badge" to="/board-readiness">
          <span className="kh-badge-ic" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 15L15 18L19 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="kh-badge-text">
            <span>PEDIATRIC NEPHROLOGY</span>
            <b>Board readiness</b>
          </span>
        </Link>
      </div>

      <div className="kh-right">
        <div className="kh-carousel">
          <div className="kh-cards" role="tablist" aria-label="Focus">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={mode === m.id}
                className={mode === m.id ? 'kh-card active' : 'kh-card'}
                onClick={() => setMode(m.id)}
              >
                <img src={m.img} alt={m.alt} width={120} height={170} />
                <span className="kh-card-info">
                  <b>{m.title}</b>
                  <span>{m.meta}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="kh-arrows">
            <button type="button" aria-label="Previous focus" onClick={() => setMode(other)}>
              ←
            </button>
            <button type="button" aria-label="Next focus" onClick={() => setMode(other)}>
              →
            </button>
          </div>
        </div>
        <h2 className="kh-side">
          Pediatric
          <br />
          Nephrology
        </h2>
      </div>
    </section>
  )
}
