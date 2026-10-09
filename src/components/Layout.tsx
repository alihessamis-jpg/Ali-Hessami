import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { StorageUsageIndicator } from './StorageUsageIndicator'
import { MobileTabBar } from './MobileTabBar'
import { Sidebar } from './Sidebar'
import { NAV_LINKS } from '../lib/navLinks'

export function Layout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const location = useLocation()

  // Signed-out (sign-in/sign-up page): no app chrome — the page itself is
  // a full-bleed layout and provides its own branding.
  if (!session) return <>{children}</>

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <img src="/kidneys-logo.png" alt="" />
          Nephron
        </Link>
        <nav className="main-nav">
          {NAV_LINKS.map((link) => {
            const LinkIcon = link.icon
            return (
              <Link
                key={link.to}
                to={link.to}
                className={location.pathname === link.to ? 'nav-link active' : 'nav-link'}
              >
                <LinkIcon />
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="header-actions">
          <StorageUsageIndicator />
          <span className="header-email">{session.user.email}</span>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      </header>
      <div className="shell-row">
        <Sidebar />
        <main className="app-main">{children}</main>
      </div>
      {location.pathname !== '/academy/review' && <MobileTabBar currentPath={location.pathname} />}
    </div>
  )
}
