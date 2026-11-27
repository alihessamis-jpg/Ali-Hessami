import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getPatient, markPatientExpired } from '../lib/api/patients'
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
import { SparkleIcon } from '../components/icons'
import { useAssistant } from '../components/assistant/AssistantProvider'
import { PATIENT_CHIPS } from '../components/assistant/AssistantChat'
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
  const { open: openAssistant } = useAssistant()
  // Set by the offline-download crawler (lib/offlinePrep.ts): mount every
  // tab at once, hidden, so all of this patient's data gets saved offline.
  const [searchParams] = useSearchParams()
  const offlinePrep = searchParams.get('offlinePrep') === '1'
  const [patient, setPatient] = useState<Patient | null>(null)
  const [growthEntries, setGrowthEntries] = useState<GrowthEntry[]>([])
  const [labEntries, setLabEntries] = useState<LabEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get('tab') as Tab | null
    return t && TABS.some((x) => x.id === t) ? t : 'overview'
  })
  const [lusEnrolled, setLusEnrolled] = useState(false)
  const [wantsLusStudy, setWantsLusStudy] = useState(false)
  const [idShown, setIdShown] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [fabHidden, setFabHidden] = useState(false)
  const [expireOpen, setExpireOpen] = useState(false)
  const [expireDate, setExpireDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expiring, setExpiring] = useState(false)
  const [expireError, setExpireError] = useState<string | null>(null)

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

  async function handleConfirmExpired() {
    if (!id) return
    setExpiring(true)
    setExpireError(null)
    try {
      const updated = await markPatientExpired(id, expireDate)
      setPatient(updated)
      setExpireOpen(false)
    } catch (err) {
      setExpireError(err instanceof Error ? err.message : 'Failed to mark as expired')
    } finally {
      setExpiring(false)
    }
  }

  function renderTab(t: Tab) {
    const pid = id as string
    const p = patient as Patient
    switch (t) {
      case 'overview':
        return <OverviewTab patientId={pid} patient={p} labEntries={labEntries} onNavigate={navigateTo} />
      case 'timeline':
        return <TimelineTab patientId={pid} />
      case 'assessment':
        return <AssessmentTab patient={p} onUpdated={setPatient} />
      case 'labs':
        return <LabsTab patientId={pid} patient={p} />
      case 'growth':
        return <GrowthTab patientId={pid} patient={p} onPatientUpdated={setPatient} />
      case 'trends':
        return <TrendsTab patientId={pid} />
      case 'notes':
        return <NotesTab patientId={pid} onPatientUpdated={setPatient} />
      case 'medications':
        return <MedicationsTab patientId={pid} />
      case 'imaging':
        return <ImagingTab patientId={pid} />
      case 'urineOutput':
        return <UrineOutputTab patientId={pid} patient={p} />
      case 'dialysis':
        return <DialysisTab patientId={pid} patient={p} onPatientUpdated={setPatient} />
      case 'vaccinations':
        return <VaccinationTab patientId={pid} patient={p} />
      case 'lusStudy':
        return <LusStudyTab patientId={pid} patient={p} />
      case 'nephroticSyndrome':
        return <NephroticSyndromeTab patientId={pid} />
      case 'followUp':
        return <FollowUpTab patientId={pid} patient={p} />
      case 'reminders':
        return <RemindersTab patientId={pid} />
      case 'document':
        return <DocumentTab patientId={pid} />
      default:
        return null
    }
  }

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>
  if (!patient || !id) return <p>Patient not found.</p>

  const careStatusLabel = patient.careStatus ? patient.careStatus.charAt(0).toUpperCase() + patient.careStatus.slice(1) : null
  const wardChip =
    patient.careStatus === 'expired'
      ? ['Expired', patient.deceasedDate ? toShamsi(patient.deceasedDate) : null].filter(Boolean).join(' · ')
      : [careStatusLabel, patient.bed].filter(Boolean).join(' ')
  const underlyingDiseaseChip = isUnderlyingDiseaseDuplicate(patient.diagnosis, patient.underlyingDisease)
    ? null
    : patient.underlyingDisease
  const chips = [formatAge(patient.age), patient.sex, wardChip || null, patient.diagnosis, underlyingDiseaseChip].filter(
    (v): v is string => Boolean(v)
  )

  const sexLower = (patient.sex ?? '').trim().toLowerCase()
  const sexTone = sexLower.startsWith('f') ? 'f' : sexLower.startsWith('m') ? 'm' : ''

  const latestGrowth = growthEntries.length > 0 ? growthEntries[growthEntries.length - 1] : null
  const crEntries = labEntries.filter((e) => e.test === 'Creatinine' && e.value != null).sort((a, b) => a.date.localeCompare(b.date))
  const latestCr = crEntries.length > 0 ? crEntries[crEntries.length - 1] : null
  const latestEGFR = latestCr && patient.height ? schwartzEGFR(patient.height, latestCr.value as number) : null

  return (
    <div className="np-page pc-page hm">
      <header className="pd-top">
        <Link to="/patients" className="pd-round" aria-label="Patients">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Link>
        <div className="pd-top-title">
          <h1>Patient chart</h1>
          <p>{wardChip || 'No ward set'}</p>
        </div>
      </header>

      <section className="pd-card np-fade">
        <div className="pd-id">
          <span className={`pd-avatar ${sexTone}`} aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21a8 8 0 0 1 16 0" />
            </svg>
          </span>
          <div className="pd-id-main">
            <span className="pd-name fa" dir="auto">
              {patient.name}
            </span>
            {patient.code && (
              <button type="button" className="pd-idbtn" onClick={() => setIdShown((v) => !v)} aria-label="Toggle national ID">
                {idShown ? `ID ${patient.code} · tap to hide` : `ID •••• ${patient.code.slice(-4)} · tap to show`}
              </button>
            )}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="pd-chips">
            {chips.map((c, i) => (
              <span key={i} className="pd-chip" dir="auto">
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="pd-actions">
          <Link to={`/patients/${id}/history`} className="pd-btn solid">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6M8 13h8M8 17h5" />
            </svg>
            <span className="fa">شرح حال</span>
          </Link>
          <button type="button" className="pd-btn soft" onClick={() => openAssistant({ mode: 'patient', patientId: id })}>
            <SparkleIcon width={16} height={16} aria-hidden="true" />
            <span className="fa">تحلیل با دستیار</span>
          </button>
        </div>
        <div className="pd-actions sm">
          <Link to={`/study/personal-cases/new?patientId=${id}`} className="pd-btn">
            Build teaching case
          </Link>
          {!showLusStudyTab && (
            <button
              type="button"
              className="pd-btn"
              onClick={() => {
                setWantsLusStudy(true)
                setTab('lusStudy')
              }}
            >
              Enroll in LUS Study
            </button>
          )}
          <button type="button" className="pd-btn" onClick={() => window.print()}>
            Print
          </button>
          {patient.careStatus !== 'expired' && (
            <button type="button" className="pd-btn danger" onClick={() => setExpireOpen(true)}>
              Mark as expired
            </button>
          )}
        </div>
      </section>

      <section className="pd-ai" dir="rtl">
        <span className="pd-ai-label fa">دستیار</span>
        <div className="pd-ai-chips">
          {['تحلیل قدم‌به‌قدم', 'تشخیص‌های افتراقی', 'چک دوز داروها', 'workup بعدی'].map((label, i) => (
            <button
              key={label}
              type="button"
              className="pd-ai-chip"
              onClick={() => openAssistant({ mode: 'patient', patientId: id, prompt: PATIENT_CHIPS[i] })}
            >
              ✨ {label}
            </button>
          ))}
        </div>
      </section>

      <div className="pd-vitals">
        {[
          {
            label: 'Weight',
            value: latestGrowth?.weightKg != null ? `${latestGrowth.weightKg}` : null,
            unit: 'kg',
            date: latestGrowth?.weightKg != null ? latestGrowth.date : null,
            empty: 'Not recorded',
            go: 'growth' as Tab,
          },
          {
            label: 'Height / length',
            value: latestGrowth?.heightCm != null ? `${latestGrowth.heightCm}` : null,
            unit: 'cm',
            date: latestGrowth?.heightCm != null ? latestGrowth.date : null,
            empty: 'Not recorded',
            go: 'growth' as Tab,
          },
          {
            label: 'Blood pressure',
            value: latestGrowth?.bpSystolic != null && latestGrowth.bpDiastolic != null ? `${latestGrowth.bpSystolic}/${latestGrowth.bpDiastolic}` : null,
            unit: 'mmHg',
            date: latestGrowth?.bpSystolic != null ? latestGrowth.date : null,
            empty: 'Not recorded',
            go: 'growth' as Tab,
          },
          {
            label: 'Latest Cr / eGFR',
            value: latestCr ? `${latestCr.value} / ${latestEGFR != null ? Math.round(latestEGFR) : '—'}` : null,
            unit: '',
            date: latestCr ? latestCr.date : null,
            empty: 'No labs yet',
            go: 'labs' as Tab,
          },
        ].map((v) => (
          <button key={v.label} type="button" className={v.value ? 'pd-vtile' : 'pd-vtile empty'} onClick={() => navigateTo(v.go)}>
            <span className="pd-vlabel">{v.label}</span>
            <b>
              {v.value ?? '—'} {v.value && v.unit && <small>{v.unit}</small>}
            </b>
            <span className="pd-vdate fa">{v.date ? toShamsi(v.date) : v.empty}</span>
            <span className="pd-vadd" aria-hidden="true">
              +
            </span>
          </button>
        ))}
      </div>

      <div className="pc-layout">
        <nav className="pc-tabs pd-tabs" aria-label="Chart sections">
          {TABS.filter((t) => visibleIds.has(t.id)).map((t) => {
            const TabIcon = t.icon
            return (
              <button key={t.id} type="button" className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
                <TabIcon width={15} height={15} />
                <span>{t.label}</span>
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

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="pd-content">{renderTab(tab)}</div>
          </motion.div>
        </AnimatePresence>
        {offlinePrep && (
          <div hidden aria-hidden="true">
            {TABS.filter((t) => t.id !== tab).map((t) => (
              <div key={t.id}>{renderTab(t.id)}</div>
            ))}
          </div>
        )}
      </div>

      <button type="button" className={fabHidden ? 'pc-fab pd-fab pc-fab--hidden' : 'pc-fab pd-fab'} onClick={() => setAddOpen(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add
      </button>

      <AddToChartSheet open={addOpen} patientName={patient.name} onClose={() => setAddOpen(false)} onNavigate={navigateTo} />

      {expireOpen && (
        <>
          <div className="pc-sheet-bg" onClick={() => !expiring && setExpireOpen(false)} />
          <div className="pc-sheet" role="dialog" aria-label="Mark as expired">
            <div style={{ width: 40, height: 5, borderRadius: 3, background: '#D5DEEB', alignSelf: 'center' }} />
            <div className="np-head">
              <h2 style={{ fontSize: 17 }}>
                Mark <span className="fa">{patient.name}</span> as expired
              </h2>
              <button
                type="button"
                className="np-btn ghost sm"
                style={{ width: 44, padding: 0 }}
                aria-label="Close"
                onClick={() => setExpireOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="np-small">
              The chart and case log stay exactly as they are. The patient just drops out of Dashboard follow-up/attention alerts.
            </p>
            <label>
              Date of death
              <input
                type="date"
                value={expireDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExpireDate(e.target.value)}
              />
            </label>
            {expireError && <p className="form-error">{expireError}</p>}
            <button type="button" className="np-btn sm" disabled={expiring || !expireDate} onClick={() => void handleConfirmExpired()}>
              {expiring ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
