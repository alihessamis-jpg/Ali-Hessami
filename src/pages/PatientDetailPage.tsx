import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPatient } from '../lib/api/patients'
import { formatAge } from '../lib/patientAge'
import { getLusStudyEnrollment } from '../lib/api/lusStudy'
import { listGrowthEntries } from '../lib/api/growth'
import { listLabEntries } from '../lib/api/labs'
import { schwartzEGFR } from '../lib/formulas'
import { isUnderlyingDiseaseDuplicate } from '../lib/clinicalFlags'
import { toShamsi } from '../lib/shamsi'
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
import { DialysisTab } from '../components/patient/DialysisTab'
import { VaccinationTab } from '../components/patient/VaccinationTab'
import { LusStudyTab } from '../components/patient/LusStudyTab'
import { TimelineTab } from '../components/patient/TimelineTab'
import { AddToChartSheet } from '../components/patient/AddToChartSheet'
import {
  AssessmentIcon,
  DialysisIcon,
  DocumentIcon,
  DropletIcon,
  FollowUpIcon,
  GrowthIcon,
  ImagingIcon,
  KidneyIcon,
  LabsIcon,
  MedicationsIcon,
  MilestoneIcon,
  NotesIcon,
  RemindersIcon,
  TrendsIcon,
  UltrasoundIcon,
  VaccineIcon,
} from '../components/icons'
import type { GrowthEntry, LabEntry, Patient } from '../types/domain'
import type { ComponentType, SVGProps } from 'react'

export type Tab =
  | 'overview'
  | 'timeline'
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
  | 'dialysis'
  | 'vaccinations'
  | 'lusStudy'

const TABS: Array<{ id: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { id: 'overview', label: 'Overview', icon: KidneyIcon },
  { id: 'timeline', label: 'Timeline', icon: MilestoneIcon },
  { id: 'assessment', label: 'Assessment', icon: AssessmentIcon },
  { id: 'labs', label: 'Labs', icon: LabsIcon },
  { id: 'growth', label: 'Growth & BP', icon: GrowthIcon },
  { id: 'trends', label: 'Trends', icon: TrendsIcon },
  { id: 'notes', label: 'Progress notes', icon: NotesIcon },
  { id: 'medications', label: 'Medications', icon: MedicationsIcon },
  { id: 'imaging', label: 'Imaging', icon: ImagingIcon },
  { id: 'urineOutput', label: 'Urine output', icon: DropletIcon },
  { id: 'dialysis', label: 'Dialysis', icon: DialysisIcon },
  { id: 'vaccinations', label: 'Vaccinations', icon: VaccineIcon },
  { id: 'lusStudy', label: 'LUS Study', icon: UltrasoundIcon },
  { id: 'nephroticSyndrome', label: 'Nephrotic syndrome', icon: KidneyIcon },
  { id: 'followUp', label: 'Follow-up', icon: FollowUpIcon },
  { id: 'reminders', label: 'Reminders', icon: RemindersIcon },
  { id: 'document', label: 'Documents', icon: DocumentIcon },
]

const TAB_GROUPS: Array<{ label: string; ids: Tab[] }> = [
  { label: 'Clinical', ids: ['overview', 'timeline', 'assessment', 'labs', 'growth', 'trends'] },
  { label: 'Care', ids: ['notes', 'medications', 'imaging', 'urineOutput', 'dialysis', 'vaccinations', 'lusStudy', 'nephroticSyndrome'] },
  { label: 'Tasks', ids: ['followUp', 'reminders', 'document'] },
]

function findTab(id: Tab) {
  const t = TABS.find((x) => x.id === id)
  if (!t) throw new Error(`PatientDetailPage: no TABS entry for "${id}"`)
  return t
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [patient, setPatient] = useState<Patient | null>(null)
  const [growthEntries, setGrowthEntries] = useState<GrowthEntry[]>([])
  const [labEntries, setLabEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [lusEnrolled, setLusEnrolled] = useState(false)
  const [wantsLusStudy, setWantsLusStudy] = useState(false)
  const [idShown, setIdShown] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [fabHidden, setFabHidden] = useState(false)

  useEffect(() => {
    let lastY = window.scrollY
    function onScroll() {
      const y = window.scrollY
      const delta = y - lastY
      if (Math.abs(delta) > 4) {
        setFabHidden(delta > 0 && y > 80)
        lastY = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([getPatient(id), listGrowthEntries(id), listLabEntries(id)])
      .then(([p, growth, labs]) => {
        setPatient(p)
        setGrowthEntries(growth)
        setLabEntries(labs)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load patient'))
      .finally(() => setLoading(false))
    getLusStudyEnrollment(id)
      .then((e) => setLusEnrolled(!!e))
      .catch(() => undefined)
  }, [id])

  const showLusStudyTab = lusEnrolled || wantsLusStudy
  const visibleIds = useMemo(
    () => new Set(TABS.filter((t) => t.id !== 'lusStudy' || showLusStudyTab).map((t) => t.id)),
    [showLusStudyTab]
  )

  function navigateTo(next: Tab) {
    setTab(next)
    setAddOpen(false)
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>
  if (!patient || !id) return <p>Patient not found.</p>

  const careStatusLabel = patient.careStatus ? patient.careStatus.charAt(0).toUpperCase() + patient.careStatus.slice(1) : null
  const wardChip = [careStatusLabel, patient.bed].filter(Boolean).join(' ')
  const underlyingDiseaseChip = isUnderlyingDiseaseDuplicate(patient.diagnosis, patient.underlyingDisease)
    ? null
    : patient.underlyingDisease
  const chips = [formatAge(patient.age), patient.sex, wardChip || null, patient.diagnosis, underlyingDiseaseChip].filter(
    (v): v is string => Boolean(v)
  )

  const latestGrowth = growthEntries.length > 0 ? growthEntries[growthEntries.length - 1] : null
  const crEntries = labEntries.filter((e) => e.test === 'Creatinine' && e.value != null).sort((a, b) => a.date.localeCompare(b.date))
  const latestCr = crEntries.length > 0 ? crEntries[crEntries.length - 1] : null
  const latestEGFR = latestCr && patient.height ? schwartzEGFR(patient.height, latestCr.value as number) : null

  return (
    <div className="np-page pc-page">
      <Link to="/patients" className="np-backlink" style={{ display: 'flex' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Patients
      </Link>

      <section className="np-hero np-fade">
        <div className="np-glow blue" />
        <div className="pc-top">
          <span className="pc-avatar">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="pc-name fa" dir="rtl" style={{ textAlign: 'left' }}>
              {patient.name}
            </span>
            {patient.code && (
              <button type="button" className="pc-idbtn" onClick={() => setIdShown((v) => !v)} aria-label="Toggle national ID">
                {idShown ? `ID ${patient.code} · tap to hide` : `ID •••• ${patient.code.slice(-4)} · tap to show`}
              </button>
            )}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="pc-chips">
            {chips.map((c, i) => (
              <span key={i} className="pc-chip">
                {c}
              </span>
            ))}
          </div>
        )}

        <svg className="pc-ecg" viewBox="0 0 700 34" width="100%" height="34" fill="none" preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M0 18H150l8-12 10 24 8-17 6 5H400l8-12 10 24 8-17 6 5H700"
            stroke="rgba(127,212,255,.22)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="pc-ecg-line"
            d="M0 18H150l8-12 10 24 8-17 6 5H400l8-12 10 24 8-17 6 5H700"
            stroke="#7FD4FF"
            strokeWidth={2.4}
            strokeDasharray="120 480"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div className="pc-actions">
          <Link to={`/study/personal-cases/new?patientId=${id}`} className="np-btn white sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5" />
            </svg>
            Build teaching case
          </Link>
          {!showLusStudyTab && (
            <button
              type="button"
              className="np-btn glass sm"
              onClick={() => {
                setWantsLusStudy(true)
                setTab('lusStudy')
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
                <circle cx="16" cy="6" r="2" />
                <circle cx="10" cy="12" r="2" />
                <circle cx="18" cy="18" r="2" />
              </svg>
              Enroll in LUS Study
            </button>
          )}
          <button type="button" className="np-btn glass sm" aria-label="Print" onClick={() => window.print()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Print
          </button>
          <button type="button" className="np-btn sm pc-addhero" style={{ marginLeft: 'auto' }} onClick={() => setAddOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </button>
        </div>
      </section>

      <div className="pc-vitals">
        <div className={latestGrowth?.weightKg != null ? 'pc-vtile' : 'pc-vtile empty'}>
          <span className="np-small">Weight</span>
          {latestGrowth?.weightKg != null ? (
            <>
              <b>
                {latestGrowth.weightKg} <small>kg</small>
              </b>
              <span className="np-small fa">{toShamsi(latestGrowth.date)}</span>
            </>
          ) : (
            <>
              <b>—</b>
              <span className="np-small">Not recorded</span>
            </>
          )}
          <button type="button" className="pc-vtile-add" aria-label="Add weight" onClick={() => navigateTo('growth')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className={latestGrowth?.heightCm != null ? 'pc-vtile' : 'pc-vtile empty'}>
          <span className="np-small">Height / length</span>
          {latestGrowth?.heightCm != null ? (
            <>
              <b>
                {latestGrowth.heightCm} <small>cm</small>
              </b>
              <span className="np-small fa">{toShamsi(latestGrowth.date)}</span>
            </>
          ) : (
            <>
              <b>—</b>
              <span className="np-small">Not recorded</span>
            </>
          )}
          <button type="button" className="pc-vtile-add" aria-label="Add height" onClick={() => navigateTo('growth')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className={latestGrowth?.bpSystolic != null ? 'pc-vtile' : 'pc-vtile empty'}>
          <span className="np-small">Blood pressure</span>
          {latestGrowth?.bpSystolic != null && latestGrowth.bpDiastolic != null ? (
            <>
              <b>
                {latestGrowth.bpSystolic}/{latestGrowth.bpDiastolic}
              </b>
              <span className="np-small fa">{toShamsi(latestGrowth.date)}</span>
            </>
          ) : (
            <>
              <b>—</b>
              <span className="np-small">Not recorded</span>
            </>
          )}
          <button type="button" className="pc-vtile-add" aria-label="Add BP" onClick={() => navigateTo('growth')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className={latestCr ? 'pc-vtile' : 'pc-vtile empty'}>
          <span className="np-small">Latest Cr / eGFR</span>
          {latestCr ? (
            <>
              <b style={{ fontSize: 18 }}>
                {latestCr.value} <small>/ {latestEGFR != null ? Math.round(latestEGFR) : '—'}</small>
              </b>
              <span className="np-small fa">{toShamsi(latestCr.date)}</span>
            </>
          ) : (
            <>
              <b>—</b>
              <span className="np-small">No labs yet</span>
            </>
          )}
          <button type="button" className="pc-vtile-add" aria-label="Add lab" onClick={() => navigateTo('labs')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pc-layout">
        <nav className="pc-tabs np-chips" aria-label="Chart sections">
          {TABS.filter((t) => visibleIds.has(t.id)).map((t) => {
            const TabIcon = t.icon
            return (
              <button key={t.id} type="button" className={t.id === tab ? 'np-chip on' : 'np-chip'} onClick={() => setTab(t.id)}>
                <TabIcon width={15} height={15} />
                {t.label}
              </button>
            )
          })}
        </nav>

        <nav className="pc-vtabs" aria-label="Chart sections">
          {TAB_GROUPS.map((group) => (
            <div key={group.label}>
              <span className="pc-vgroup-label">{group.label}</span>
              {group.ids
                .filter((gid) => visibleIds.has(gid))
                .map((gid) => {
                  const t = findTab(gid)
                  const TabIcon = t.icon
                  return (
                    <button key={gid} type="button" className={gid === tab ? 'pc-vtab on' : 'pc-vtab'} onClick={() => setTab(gid)}>
                      <TabIcon width={17} height={17} />
                      {t.label}
                    </button>
                  )
                })}
            </div>
          ))}
        </nav>

        <div>
          {tab === 'overview' && <OverviewTab patientId={id} patient={patient} labEntries={labEntries} onNavigate={navigateTo} />}
          {tab === 'timeline' && <TimelineTab patientId={id} />}
          {tab === 'assessment' && <AssessmentTab patient={patient} onUpdated={setPatient} />}
          {tab === 'labs' && <LabsTab patientId={id} patient={patient} />}
          {tab === 'growth' && <GrowthTab patientId={id} patient={patient} onPatientUpdated={setPatient} />}
          {tab === 'trends' && <TrendsTab patientId={id} />}
          {tab === 'notes' && <NotesTab patientId={id} onPatientUpdated={setPatient} />}
          {tab === 'medications' && <MedicationsTab patientId={id} />}
          {tab === 'imaging' && <ImagingTab patientId={id} />}
          {tab === 'urineOutput' && <UrineOutputTab patientId={id} patient={patient} />}
          {tab === 'dialysis' && <DialysisTab patientId={id} patient={patient} onPatientUpdated={setPatient} />}
          {tab === 'vaccinations' && <VaccinationTab patientId={id} patient={patient} />}
          {tab === 'lusStudy' && <LusStudyTab patientId={id} patient={patient} />}
          {tab === 'nephroticSyndrome' && <NephroticSyndromeTab patientId={id} />}
          {tab === 'followUp' && <FollowUpTab patientId={id} patient={patient} />}
          {tab === 'reminders' && <RemindersTab patientId={id} />}
          {tab === 'document' && <DocumentTab patientId={id} />}
        </div>
      </div>

      <button type="button" className={fabHidden ? 'pc-fab pc-fab--hidden' : 'pc-fab'} onClick={() => setAddOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add
      </button>

      <AddToChartSheet open={addOpen} patientName={patient.name} onClose={() => setAddOpen(false)} onNavigate={navigateTo} />
    </div>
  )
}
