import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Layout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          Nephron
        </Link>
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
