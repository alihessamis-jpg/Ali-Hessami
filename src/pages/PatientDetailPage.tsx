import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPatient } from '../lib/api/patients'
import { OverviewTab } from '../components/patient/OverviewTab'
import { AssessmentTab } from '../components/patient/AssessmentTab'
import { LabsTab } from '../components/patient/LabsTab'
import { TrendsTab } from '../components/patient/TrendsTab'
import { NotesTab } from '../components/patient/NotesTab'
import { MedicationsTab } from '../components/patient/MedicationsTab'
import { ImagingTab } from '../components/patient/ImagingTab'
import { RemindersTab } from '../components/patient/RemindersTab'
import { DocumentTab } from '../components/patient/DocumentTab'
import { UrineOutputTab } from '../components/patient/UrineOutputTab'
import { NephroticSyndromeTab } from '../components/patient/NephroticSyndromeTab'
import { GrowthTab } from '../components/patient/GrowthTab'
import { FollowUpTab } from '../components/patient/FollowUpTab'
import { LinkedTopicsWidget } from '../components/patient/LinkedTopicsWidget'
import {
  AssessmentIcon,
  DocumentIcon,
  DropletIcon,
  FollowUpIcon,
  GrowthIcon,
  ImagingIcon,
  KidneyIcon,
  LabsIcon,
  MedicationsIcon,
  NotesIcon,
  RemindersIcon,
  TrendsIcon,
} from '../components/icons'
import type { Patient } from '../types/domain'
import type { ComponentType, SVGProps } from 'react'

type Tab =
  | 'overview'
  | 'assessment'
  | 'labs'
  | 'trends'
  | 'notes'
  | 'medications'
  | 'imaging'
  | 'reminders'
  | 'document'
  | 'urineOutput'
  | 'nephroticSyndrome'
  | 'growth'
  | 'followUp'

const TABS: Array<{ id: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { id: 'overview', label: 'Overview', icon: KidneyIcon },
  { id: 'assessment', label: 'Assessment', icon: AssessmentIcon },
  { id: 'labs', label: 'Labs', icon: LabsIcon },
  { id: 'growth', label: 'Growth & BP', icon: GrowthIcon },
  { id: 'trends', label: 'Trends', icon: TrendsIcon },
  { id: 'notes', label: 'Progress notes', icon: NotesIcon },
  { id: 'medications', label: 'Medications', icon: MedicationsIcon },
  { id: 'imaging', label: 'Imaging', icon: ImagingIcon },
  { id: 'urineOutput', label: 'Urine Output', icon: DropletIcon },
  { id: 'nephroticSyndrome', label: 'Nephrotic Syndrome', icon: KidneyIcon },
  { id: 'followUp', label: 'Follow-up', icon: FollowUpIcon },
  { id: 'reminders', label: 'Reminders', icon: RemindersIcon },
  { id: 'document', label: 'Document', icon: DocumentIcon },
]

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

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

  const meta = [
    patient.code,
    patient.age != null ? `${patient.age}y` : null,
    patient.sex,
    patient.bed,
    patient.diagnosis,
  ].filter(Boolean)

  return (
    <div>
      <Link to="/patients" className="back-link">
        ← Patients
      </Link>

      <div className="patient-header-card">
        <div className="patient-header-main">
          <span className="glance-avatar glance-avatar--lg">{patient.name.charAt(0).toUpperCase()}</span>
          <div>
            <h1 className="patient-header-name">{patient.name}</h1>
            {meta.length > 0 && <p className="patient-header-meta">{meta.join(' · ')}</p>}
            {(patient.dialysisStatus || patient.transplantStatus) && (
              <div className="patient-header-badges">
                {patient.dialysisStatus && (
                  <span className="status-badge status-badge--dialysis">{patient.dialysisStatus}</span>
                )}
                {patient.transplantStatus && (
                  <span className="status-badge status-badge--transplant">{patient.transplantStatus}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="patient-header-actions">
          <Link to={`/study/personal-cases/new?patientId=${id}`} className="button-link">
            Build teaching case
          </Link>
          <button type="button" className="button-secondary" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <LinkedTopicsWidget patientId={id} />

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
        {tab === 'overview' && <OverviewTab patientId={id} patient={patient} onNavigate={setTab} />}
        {tab === 'assessment' && <AssessmentTab patient={patient} onUpdated={setPatient} />}
        {tab === 'labs' && <LabsTab patientId={id} patient={patient} />}
        {tab === 'growth' && <GrowthTab patientId={id} patient={patient} onPatientUpdated={setPatient} />}
        {tab === 'trends' && <TrendsTab patientId={id} />}
        {tab === 'notes' && <NotesTab patientId={id} onPatientUpdated={setPatient} />}
        {tab === 'medications' && <MedicationsTab patientId={id} />}
        {tab === 'imaging' && <ImagingTab patientId={id} />}
        {tab === 'urineOutput' && <UrineOutputTab patientId={id} patient={patient} />}
        {tab === 'nephroticSyndrome' && <NephroticSyndromeTab patientId={id} />}
        {tab === 'followUp' && <FollowUpTab patientId={id} patient={patient} />}
        {tab === 'reminders' && <RemindersTab patientId={id} />}
        {tab === 'document' && <DocumentTab patientId={id} />}
      </div>
    </div>
  )
}
