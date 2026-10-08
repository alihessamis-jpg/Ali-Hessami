import type { ComponentType, SVGProps } from 'react'
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
} from '../components/icons'

export interface NavLink {
  to: string
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

// Shared by the desktop header nav (Layout.tsx) and the mobile bottom
// tab bar + "More" sheet (MobileTabBar.tsx / MoreSheet.tsx), so both
// surfaces always list the same set of sections.
export const NAV_LINKS: NavLink[] = [
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

// The 4 sections that get their own slot in the mobile bottom tab bar;
// everything else in NAV_LINKS (including Settings) lives in the "More" sheet.
export const MOBILE_PRIMARY_PATHS = ['/', '/today', '/patients', '/case-log']
