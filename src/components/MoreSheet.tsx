import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { StorageUsageIndicator } from './StorageUsageIndicator'
import { SettingsIcon } from './icons'
import { GROUPS, findLink } from './Sidebar'

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, signOut } = useAuth()
  const initial = session?.user.email?.[0]?.toUpperCase() ?? '?'

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

            <div className="more-sheet-acct">
              <span className="more-sheet-avatar">{initial}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <b style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {session?.user.email}
                </b>
                <StorageUsageIndicator />
              </span>
              <button type="button" className="more-sheet-signout" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>

            {GROUPS.map((group) => (
              <div key={group.label}>
                <h2 className="more-sheet-group-heading">{group.label}</h2>
                <div className="more-sheet-tiles">
                  {group.paths.map((path) => {
                    const link = findLink(path)
                    const LinkIcon = link.icon
                    return (
                      <Link key={path} to={path} className="more-sheet-tile" onClick={onClose}>
                        <LinkIcon />
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}

            <Link to="/settings" className="more-sheet-tile more-sheet-tile--wide" onClick={onClose}>
              <SettingsIcon />
              <span>Settings</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7A90" strokeWidth={2} strokeLinecap="round">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </Link>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
