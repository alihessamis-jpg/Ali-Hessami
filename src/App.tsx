import type { ReactElement } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PatientsListPage } from './pages/PatientsListPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { ReferencePage } from './pages/ReferencePage'
import { CalculatorsPage } from './pages/CalculatorsPage'
import { ChecklistsPage } from './pages/ChecklistsPage'
import { AcademyPage } from './pages/AcademyPage'
import { AcademyTopicPage } from './pages/AcademyTopicPage'
import { StudyHubPage } from './pages/StudyHubPage'
import { NewPersonalCasePage } from './pages/NewPersonalCasePage'
import { ResearchProjectsPage } from './pages/ResearchProjectsPage'
import { ResearchProjectPage } from './pages/ResearchProjectPage'
import { ThesisFormPage } from './pages/ThesisFormPage'

function protect(element: ReactElement) {
  return <RequireAuth>{element}</RequireAuth>
}

export function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={protect(<DashboardPage />)} />
          <Route path="/patients" element={protect(<PatientsListPage />)} />
          <Route path="/patients/:id" element={protect(<PatientDetailPage />)} />
          <Route path="/reference" element={protect(<ReferencePage />)} />
          <Route path="/calculators" element={protect(<CalculatorsPage />)} />
          <Route path="/checklists" element={protect(<ChecklistsPage />)} />
          <Route path="/academy" element={protect(<AcademyPage />)} />
          <Route path="/academy/:id" element={protect(<AcademyTopicPage />)} />
          <Route path="/study" element={protect(<StudyHubPage />)} />
          <Route path="/study/personal-cases/new" element={protect(<NewPersonalCasePage />)} />
          <Route path="/research" element={protect(<ResearchProjectsPage />)} />
          <Route path="/research/:id" element={protect(<ResearchProjectPage />)} />
          <Route path="/thesis-form" element={protect(<ThesisFormPage />)} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
