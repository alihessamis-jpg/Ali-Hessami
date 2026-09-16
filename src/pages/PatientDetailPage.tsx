import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPatient } from '../lib/api/patients'
import { AssessmentTab } from '../components/patient/AssessmentTab'
import { LabsTab } from '../components/patient/LabsTab'
import { TrendsTab } from '../components/patient/TrendsTab'
import { NotesTab } from '../components/patient/NotesTab'
import { MedicationsTab } from '../components/patient/MedicationsTab'
import { ImagingTab } from '../components/patient/ImagingTab'
import { RemindersTab } from '../components/patient/RemindersTab'
import {
  AssessmentIcon,
  ImagingIcon,
  LabsIcon,
  MedicationsIcon,
  NotesIcon,
  RemindersIcon,
  TrendsIcon,
} from '../components/icons'
import type { Patient } from '../types/domain'
import type { ComponentType, SVGProps } from 'react'

type Tab = 'assessment' | 'labs' | 'trends' | 'notes' | 'medications' | 'imaging' | 'reminders'

const TABS: Array<{ id: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { id: 'assessment', label: 'Assessment', icon: AssessmentIcon },
  { id: 'labs', label: 'Labs', icon: LabsIcon },
  { id: 'trends', label: 'Trends', icon: TrendsIcon },
  { id: 'notes', label: 'Progress notes', icon: NotesIcon },
  { id: 'medications', label: 'Medications', icon: MedicationsIcon },
  { id: 'imaging', label: 'Imaging', icon: ImagingIcon },
  { id: 'reminders', label: 'Reminders', icon: RemindersIcon },
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
          <Link to="/patients" className="back-link">
            ← Patients
          </Link>
          <h1>{patient.name}</h1>
        </div>
        <Link to={`/study/personal-cases/new?patientId=${id}`} className="button-link">
          Build teaching case from this patient
        </Link>
      </div>

      <nav className="tab-bar">
        {TABS.map((t) => {
          const TabIcon = t.icon
          return (
            <button
              key={t.id}
              className={t.id === tab ? 'tab active' : 'tab'}
              onClick={() => setTab(t.id)}
            >
              <TabIcon />
              {t.label}
            </button>
          )
        })}
      </nav>

      <div className="tab-panel">
        {tab === 'assessment' && <AssessmentTab patient={patient} onUpdated={setPatient} />}
        {tab === 'labs' && <LabsTab patientId={id} />}
        {tab === 'trends' && <TrendsTab patientId={id} />}
        {tab === 'notes' && <NotesTab patientId={id} />}
        {tab === 'medications' && <MedicationsTab patientId={id} />}
        {tab === 'imaging' && <ImagingTab patientId={id} />}
        {tab === 'reminders' && <RemindersTab patientId={id} />}
      </div>
    </div>
  )
}
