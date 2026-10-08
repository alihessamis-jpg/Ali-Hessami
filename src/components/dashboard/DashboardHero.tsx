import { formatShamsiWeekdayLong } from '../../lib/shamsi'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardHero({ followUpCount }: { followUpCount: number }) {
  const now = new Date()
  return (
    <section className="dh-hero np-fade">
      <div className="dh-hero-glow" />
      <div className="dh-hero-glow2" />
      <div className="dh-hero-body">
        <span className="dh-hero-date" dir="rtl">
          {formatShamsiWeekdayLong(now)}
        </span>
        <h1>{greeting(now.getHours())}</h1>
        <p>
          {followUpCount === 0
            ? 'No patients need follow-up today'
            : `${followUpCount} patient${followUpCount === 1 ? '' : 's'} need${followUpCount === 1 ? 's' : ''} follow-up today`}
        </p>
      </div>
      <svg className="dh-neph" viewBox="0 0 330 150" fill="none" aria-hidden="true">
        <path d="M40 76a34 34 0 1 1 46 32" stroke="#4F86E8" strokeWidth="2" strokeLinecap="round" opacity=".7" />
        <g className="dh-neph-beat">
          <circle cx="62" cy="76" r="20" fill="rgba(79,134,232,.18)" />
          <path
            d="M50 70c4-8 12-8 14-2s-8 6-4 12 12 2 12-6M52 84c6 4 16 2 18-6"
            stroke="#9CC2FF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
        <path d="M28 76H42" stroke="#FF8A80" strokeWidth="3" strokeLinecap="round" />
        <path
          d="M88 62C100 40 112 74 124 50S142 30 154 48L180 128Q192 148 204 128L224 50C234 32 248 66 260 46S282 34 300 40"
          stroke="#2F5FB8"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M88 62C100 40 112 74 124 50S142 30 154 48L180 128Q192 148 204 128L224 50C234 32 248 66 260 46S282 34 300 40"
          stroke="#7FD4FF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="6 8"
          className="dh-neph-flow"
        />
        <path d="M310 14V140" stroke="#2F5FB8" strokeWidth="9" strokeLinecap="round" />
        <path d="M310 14V140" stroke="#7FD4FF" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="6 8" className="dh-neph-flow" />
      </svg>
    </section>
  )
}
