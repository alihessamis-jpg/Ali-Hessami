import type { ComponentType, ReactNode, SVGProps } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { StorageUsageIndicator } from './StorageUsageIndicator'
import {
  AcademyIcon,
  AnalyticsIcon,
  CalculatorIcon,
  CaseLogIcon,
  ChecklistIcon,
  DashboardIcon,
  DocumentIcon,
  DownloadIcon,
  FormBuilderIcon,
  MilestoneIcon,
  NotesIcon,
  PatientsIcon,
  ReferenceIcon,
  ResearchIcon,
  SettingsIcon,
  StudyHubIcon,
  TodayIcon,
} from './icons'

const NAV_LINKS: Array<{ to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon },
  { to: '/today', label: 'Today', icon: TodayIcon },
  { to: '/patients', label: 'Patients', icon: PatientsIcon },
  { to: '/case-log', label: 'Case Log', icon: CaseLogIcon },
  { to: '/academic-activity', label: 'Academic Activity', icon: MilestoneIcon },
  { to: '/reference', label: 'Reference', icon: ReferenceIcon },
  { to: '/calculators', label: 'Calculators', icon: CalculatorIcon },
  { to: '/checklists', label: 'Checklists', icon: ChecklistIcon },
  { to: '/academy', label: 'Academy', icon: AcademyIcon },
  { to: '/high-yield', label: 'High-Yield', icon: NotesIcon },
  { to: '/study', label: 'Study Hub', icon: StudyHubIcon },
  { to: '/board-readiness', label: 'Board Readiness', icon: AnalyticsIcon },
  { to: '/research', label: 'Research', icon: ResearchIcon },
  { to: '/thesis-form', label: 'Thesis Form', icon: FormBuilderIcon },
  { to: '/export', label: 'Export', icon: DownloadIcon },
  { to: '/cv', label: 'Academic CV', icon: DocumentIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
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
            <StorageUsageIndicator />
            <span className="header-email">{session.user.email}</span>
            <button onClick={() => void signOut()}>Sign out</button>
          </div>
        )}
      </header>
      <main className="app-main">{children}</main>
    </div>
  )
}
