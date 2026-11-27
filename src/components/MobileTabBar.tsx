import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CaseLogIcon, DashboardIcon, MoreIcon, PatientsIcon, SparkleIcon, TodayIcon } from './icons'
import { MoreSheet } from './MoreSheet'

const PRIMARY_TABS = [
  { to: '/', label: 'Home', icon: DashboardIcon },
  { to: '/today', label: 'Today', icon: TodayIcon },
  { to: '/patients', label: 'Patients', icon: PatientsIcon },
  { to: '/case-log', label: 'Case Log', icon: CaseLogIcon },
  { to: '/assistant', label: 'دستیار', icon: SparkleIcon },
]

export function MobileTabBar({ currentPath }: { currentPath: string }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = !PRIMARY_TABS.some((tab) => tab.to === currentPath)
  const navRef = useRef<HTMLElement>(null)
  const onDark = useOnDarkBackground(navRef, currentPath)

  return (
    <>
      <nav ref={navRef} className={onDark ? 'mobile-tab-bar on-dark' : 'mobile-tab-bar'} aria-label="Primary">
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

// Dark hero sections the bar can sit over. Add `data-tabbar="dark"` to any
// other dark surface to get the same treatment.
const DARK_SURFACES = '.np-hero, .pt-hero, .td-hero, .dh-hero, .libhero, [data-tabbar="dark"]'

/** True while the middle of the tab bar sits over a dark hero, so the bar can switch to light-on-dark. */
function useOnDarkBackground(ref: RefObject<HTMLElement>, path: string): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    let frame = 0
    const check = () => {
      frame = 0
      const bar = ref.current
      if (!bar) return
      const r = bar.getBoundingClientRect()
      if (r.height === 0) return
      const y = r.top + r.height / 2
      const over = Array.from(document.querySelectorAll<HTMLElement>(DARK_SURFACES)).some((el) => {
        const b = el.getBoundingClientRect()
        return b.top < y && b.bottom > y && b.left < r.right && b.right > r.left
      })
      setDark(over)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check)
    }
    schedule()
    // page transitions animate in; check again once they've settled
    const t1 = window.setTimeout(schedule, 300)
    const t2 = window.setTimeout(schedule, 900)
    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.removeEventListener('scroll', schedule, { capture: true })
      window.removeEventListener('resize', schedule)
    }
  }, [ref, path])
  return dark
}
