import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CaseLogIcon, DashboardIcon, MoreIcon, PatientsIcon, TodayIcon } from './icons'
import { MoreSheet } from './MoreSheet'

const PRIMARY_TABS = [
  { to: '/', label: 'Home', icon: DashboardIcon },
  { to: '/today', label: 'Today', icon: TodayIcon },
  { to: '/patients', label: 'Patients', icon: PatientsIcon },
  { to: '/case-log', label: 'Case Log', icon: CaseLogIcon },
]

export function MobileTabBar({ currentPath }: { currentPath: string }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = !PRIMARY_TABS.some((tab) => tab.to === currentPath)

  return (
    <>
      <nav className="mobile-tab-bar" aria-label="Primary">
        {PRIMARY_TABS.map((tab) => {
          const TabIcon = tab.icon
          const active = currentPath === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={active ? 'mobile-tab-bar-item active' : 'mobile-tab-bar-item'}
            >
              {active && (
                <motion.span
                  layoutId="mobile-tab-pill"
                  className="mobile-tab-bar-pill"
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                />
              )}
              <TabIcon />
              <span>{tab.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          className={moreActive && moreOpen ? 'mobile-tab-bar-item active' : 'mobile-tab-bar-item'}
          onClick={() => setMoreOpen(true)}
        >
          {moreOpen && (
            <motion.span
              layoutId="mobile-tab-pill"
              className="mobile-tab-bar-pill"
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            />
          )}
          <MoreIcon />
          <span>More</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
