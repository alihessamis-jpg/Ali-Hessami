import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { OverflowDebugPanel } from './components/OverflowDebugPanel'
import { OfflineFileViewer } from './components/OfflineFileViewer'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { TodayPage } from './pages/TodayPage'
import { VersesPage } from './pages/VersesPage'
import { DailyCasePage } from './pages/DailyCasePage'
import { DailyCaseArchivePage } from './pages/DailyCaseArchivePage'
import { PatientsListPage } from './pages/PatientsListPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { HistoryWizardPage } from './pages/HistoryWizardPage'
import { QuickAkiEntryPage } from './pages/QuickAkiEntryPage'
import { CaseLogPage } from './pages/CaseLogPage'
import { AcademicActivityPage } from './pages/AcademicActivityPage'
import { ReferencePage } from './pages/ReferencePage'
import { CalculatorsPage } from './pages/CalculatorsPage'
import { ChecklistsPage } from './pages/ChecklistsPage'
import { AcademyTopicPage } from './pages/AcademyTopicPage'
import { LibraryPage } from './pages/LibraryPage'
import { ReaderPage } from './pages/ReaderPage'
import { ReviewPage } from './pages/ReviewPage'
import { PracticePage } from './pages/PracticePage'
import { MistakesPage } from './pages/MistakesPage'
import { ChapterStatsPage } from './pages/ChapterStatsPage'
import { ExamPlanPage } from './pages/ExamPlanPage'
import { HighYieldPage } from './pages/HighYieldPage'
import { StudyHubPage } from './pages/StudyHubPage'
import { BoardReadinessPage } from './pages/BoardReadinessPage'
import { NewPersonalCasePage } from './pages/NewPersonalCasePage'
import { ResearchProjectsPage } from './pages/ResearchProjectsPage'
import { ResearchProjectPage } from './pages/ResearchProjectPage'
import { ThesisFormPage } from './pages/ThesisFormPage'
import { ExportPage } from './pages/ExportPage'
import { CvPage } from './pages/CvPage'
import { SettingsPage } from './pages/SettingsPage'
import { AssistantPage } from './pages/AssistantPage'

function protect(element: ReactElement) {
  return <RequireAuth>{element}</RequireAuth>
}

export function App() {
  return (
    <AuthProvider>
      <OverflowDebugPanel />
      <OfflineFileViewer />
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={protect(<DashboardPage />)} />
          <Route path="/today" element={protect(<TodayPage />)} />
          <Route path="/verses" element={protect(<VersesPage />)} />
          <Route path="/daily-case" element={protect(<DailyCaseArchivePage />)} />
          <Route path="/daily-case/:id" element={protect(<DailyCasePage />)} />
          <Route path="/patients" element={protect(<PatientsListPage />)} />
          <Route path="/patients/quick-aki" element={protect(<QuickAkiEntryPage />)} />
          <Route path="/patients/:id/history" element={protect(<HistoryWizardPage />)} />
          <Route path="/patients/:id" element={protect(<PatientDetailPage />)} />
          <Route path="/case-log" element={protect(<CaseLogPage />)} />
          <Route path="/academic-activity" element={protect(<AcademicActivityPage />)} />
          <Route path="/reference" element={protect(<ReferencePage />)} />
          <Route path="/calculators" element={protect(<CalculatorsPage />)} />
          <Route path="/checklists" element={protect(<ChecklistsPage />)} />
          <Route path="/academy" element={protect(<LibraryPage />)} />
          {/* the old topic list is now the Topic Hub tab of the Library */}
          <Route path="/academy/topics" element={<Navigate to="/academy?tab=topics" replace />} />
          <Route path="/academy/reader/:id" element={protect(<ReaderPage />)} />
          <Route path="/academy/review" element={protect(<ReviewPage />)} />
          <Route path="/academy/practice" element={protect(<PracticePage />)} />
          <Route path="/academy/mistakes" element={protect(<MistakesPage />)} />
          <Route path="/academy/stats" element={protect(<ChapterStatsPage />)} />
          <Route path="/academy/exam-plan" element={protect(<ExamPlanPage />)} />
          <Route path="/academy/:id" element={protect(<AcademyTopicPage />)} />
          <Route path="/high-yield" element={protect(<HighYieldPage />)} />
          <Route path="/study" element={protect(<StudyHubPage />)} />
          <Route path="/board-readiness" element={protect(<BoardReadinessPage />)} />
          <Route path="/study/personal-cases/new" element={protect(<NewPersonalCasePage />)} />
          <Route path="/research" element={protect(<ResearchProjectsPage />)} />
          <Route path="/research/:id" element={protect(<ResearchProjectPage />)} />
          <Route path="/thesis-form" element={protect(<ThesisFormPage />)} />
          <Route path="/export" element={protect(<ExportPage />)} />
          <Route path="/cv" element={protect(<CvPage />)} />
          <Route path="/settings" element={protect(<SettingsPage />)} />
          <Route path="/assistant" element={protect(<AssistantPage />)} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
