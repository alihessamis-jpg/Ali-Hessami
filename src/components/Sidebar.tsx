import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { StorageUsageIndicator } from './StorageUsageIndicator'
import { SettingsIcon } from './icons'
import { NAV_LINKS } from '../lib/navLinks'

const PRIMARY_PATHS = ['/', '/today', '/patients', '/case-log']

const GROUPS: Array<{ label: string; paths: string[] }> = [
  { label: 'Clinical', paths: ['/academic-activity', '/reference', '/calculators', '/checklists'] },
  { label: 'Study', paths: ['/academy', '/high-yield', '/study', '/board-readiness'] },
  { label: 'Research & portfolio', paths: ['/research', '/thesis-form', '/cv', '/export'] },
]

function findLink(path: string) {
  const link = NAV_LINKS.find((l) => l.to === path)
  if (!link) throw new Error(`Sidebar: no NAV_LINKS entry for "${path}"`)
  return link
}

function SidebarItem({ path, active }: { path: string; active: boolean }) {
  const link = findLink(path)
  const LinkIcon = link.icon
  return (
    <Link to={path} className={active ? 'sitem on' : 'sitem'} title={link.label}>
      <LinkIcon />
      <span>{link.label}</span>
    </Link>
  )
}

export function Sidebar() {
  const location = useLocation()
  const { session, signOut } = useAuth()

  return (
    <aside className="side" aria-label="Main">
      <Link to="/" className="slogo">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E5BD8" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 3C5 3 3 7 3 11s2 9 6 9c2.5 0 3-2.5 2-4.5-.6-1.4-.6-2.8 0-4 1-2 2.5-3 2.5-5S12 3 9 3z" />
        </svg>
        <span>Nephron</span>
      </Link>
      <nav className="snav">
        {PRIMARY_PATHS.map((path) => (
          <SidebarItem key={path} path={path} active={location.pathname === path} />
        ))}
        {GROUPS.map((group) => (
          <div className="sgroup" key={group.label}>
            <span className="slabel">{group.label}</span>
            {group.paths.map((path) => (
              <SidebarItem key={path} path={path} active={location.pathname === path} />
            ))}
          </div>
        ))}
        <Link to="/settings" className={location.pathname === '/settings' ? 'sitem on' : 'sitem'} title="Settings">
          <SettingsIcon />
          <span>Settings</span>
        </Link>
      </nav>
      <div className="sfoot">
        <StorageUsageIndicator />
        <span className="semail">{session?.user.email}</span>
        <button type="button" className="sout" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </aside>
  )
}
