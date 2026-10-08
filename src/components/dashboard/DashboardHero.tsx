import { motion } from 'framer-motion'
import { formatShamsiWeekdayLong } from '../../lib/shamsi'
import { NephronIllustration } from '../illustrations/NephronIllustration'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardHero({ followUpCount }: { followUpCount: number }) {
  const now = new Date()
  return (
    <motion.div
      className="dash-hero"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <NephronIllustration className="dash-hero-illustration" />
      <p className="dash-hero-date">{formatShamsiWeekdayLong(now)}</p>
      <h1 className="dash-hero-greeting">{greeting(now.getHours())}</h1>
      <p className="dash-hero-followup">
        {followUpCount === 0
          ? 'No patients need follow-up today'
          : `${followUpCount} patient${followUpCount === 1 ? '' : 's'} need${followUpCount === 1 ? 's' : ''} follow-up today`}
      </p>
    </motion.div>
  )
}
