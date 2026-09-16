import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPatient } from '../lib/api/patients'
import { AssessmentTab } from '../components/patient/AssessmentTab'
import { LabsTab } from '../components/patient/LabsTab'
import { TrendsTab } from '../components/patient/TrendsTab'
import { NotesTab } from '../components/patient/NotesTab'
import type { Patient } from '../types/domain'

type Tab = 'assessment' | 'labs' | 'trends' | 'notes'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'assessment', label: 'Assessment' },
  { id: 'labs', label: 'Labs' },
  { id: 'trends', label: 'Trends' },
  { id: 'notes', label: 'Progress notes' },
]

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('assessment')

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPatient(id)
      .then(setPatient)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patient'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>
  if (!patient || !id) return <p>Patient not found.</p>

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/" className="back-link">
            ← Patients
          </Link>
          <h1>{patient.name}</h1>
        </div>
      </div>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-panel">
        {tab === 'assessment' && <AssessmentTab patient={patient} onUpdated={setPatient} />}
        {tab === 'labs' && <LabsTab patientId={id} />}
        {tab === 'trends' && <TrendsTab patientId={id} />}
        {tab === 'notes' && <NotesTab patientId={id} />}
      </div>
    </div>
  )
}
