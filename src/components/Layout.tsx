import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_LINKS = [
  { to: '/', label: 'Patients' },
  { to: '/reference', label: 'Reference' },
  { to: '/calculators', label: 'Calculators' },
  { to: '/checklists', label: 'Checklists' },
  { to: '/academy', label: 'Academy' },
  { to: '/study', label: 'Study Hub' },
  { to: '/research', label: 'Research' },
]

export function Layout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Nephron
        </Link>
        {session && (
          <nav className="main-nav">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={location.pathname === link.to ? 'nav-link active' : 'nav-link'}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        {session && (
          <div className="header-actions">
            <span className="header-email">{session.user.email}</span>
            <button onClick={() => void signOut()}>Sign out</button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
