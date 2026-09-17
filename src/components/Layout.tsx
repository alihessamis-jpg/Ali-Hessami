import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  AcademyIcon,
  CalculatorIcon,
  CaseLogIcon,
  ChecklistIcon,
  DashboardIcon,
  DownloadIcon,
  FormBuilderIcon,
  PatientsIcon,
  ReferenceIcon,
  ResearchIcon,
  StudyHubIcon,
} from './icons'

const NAV_LINKS: Array<{ to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/patients', label: 'Patients', icon: PatientsIcon },
  { to: '/case-log', label: 'Case Log', icon: CaseLogIcon },
  { to: '/reference', label: 'Reference', icon: ReferenceIcon },
  { to: '/calculators', label: 'Calculators', icon: CalculatorIcon },
  { to: '/checklists', label: 'Checklists', icon: ChecklistIcon },
  { to: '/academy', label: 'Academy', icon: AcademyIcon },
  { to: '/study', label: 'Study Hub', icon: StudyHubIcon },
  { to: '/research', label: 'Research', icon: ResearchIcon },
  { to: '/thesis-form', label: 'Thesis Form', icon: FormBuilderIcon },
  { to: '/export', label: 'Export', icon: DownloadIcon },
]

export function Layout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          <img src="/kidneys-logo.png" alt="" />
          Nephron
        </Link>
        {session && (
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
