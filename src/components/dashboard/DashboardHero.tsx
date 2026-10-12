import { formatShamsiWeekdayLong } from '../../lib/shamsi'
import { HeroScene } from '../hero/HeroScene'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardHero({ followUpCount }: { followUpCount: number }) {
  const now = new Date()
  return (
    <section className="dh-hero np-fade">
      <HeroScene scene="nephron" page="home" className="hero-scene" />
      <div className="hero-scrim" />
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
    </section>
  )
}
