import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { PatientsListPage } from './pages/PatientsListPage'
import { PatientDetailPage } from './pages/PatientDetailPage'

export function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <PatientsListPage />
              </RequireAuth>
            }
          />
          <Route
            path="/patients/:id"
            element={
              <RequireAuth>
                <PatientDetailPage />
              </RequireAuth>
            }
          />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}
