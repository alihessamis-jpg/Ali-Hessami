import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { StorageUsageIndicator } from './StorageUsageIndicator'
import { NAV_LINKS, MOBILE_PRIMARY_PATHS } from '../lib/navLinks'

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, signOut } = useAuth()
  const otherLinks = NAV_LINKS.filter((link) => !MOBILE_PRIMARY_PATHS.includes(link.to))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="more-sheet-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="more-sheet"
            role="dialog"
            aria-label="More sections"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="more-sheet-handle" />
            <div className="more-sheet-grid">
              {otherLinks.map((link) => {
                const LinkIcon = link.icon
                return (
                  <Link key={link.to} to={link.to} className="more-sheet-item" onClick={onClose}>
                    <LinkIcon />
                    {link.label}
                  </Link>
                )
              })}
            </div>
            <div className="more-sheet-footer">
              <StorageUsageIndicator />
              {session && <span className="header-email">{session.user.email}</span>}
              <button className="more-sheet-signout" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
