import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarWidget } from '../components/dashboard/CalendarWidget'
import { DashboardHero } from '../components/dashboard/DashboardHero'
import { PatientGlanceRow } from '../components/dashboard/PatientGlanceRow'
import { QuickTools } from '../components/dashboard/QuickTools'
import { EmptyState } from '../components/illustrations/EmptyState'
import { toShamsi } from '../lib/shamsi'
import {
  listAkiAlerts,
  listObstructiveUropathyWatches,
  listPatientsByIds,
  listRecentAbnormalLabs,
  type AbnormalLab,
  type AkiAlert,
  type PatientGlance,
  type UropathyWatch,
} from '../lib/api/dashboard'
import { POLYURIA_THRESHOLD_ML_KG_HR } from '../lib/formulas'
import { listActiveReminders, type ActiveReminder } from '../lib/api/reminders'
import { listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { listFlashcards } from '../lib/api/flashcards'
import { listBoardQuestions } from '../lib/api/boardQuestions'
import { listBoardQuestionAttempts } from '../lib/api/boardQuestionAttempts'
import { computeTopicReadiness } from '../lib/examReadiness'
import { listKnowledgeGaps } from '../lib/api/knowledgeGaps'
import { listResearchProjects } from '../lib/api/research'
import { listCaseLogEntries, type CaseLogEntryWithPatient } from '../lib/api/caseLog'
import { listReadingItems } from '../lib/api/readingItems'
import { listDueCheckpoints, listDueLeitnerItems } from '../lib/readingReview'
import { getUserSettings } from '../lib/api/settings'
import { useAuth } from '../context/AuthContext'
import {
  AcademyIcon,
  AnalyticsIcon,
  CalendarIcon,
  CaseLogIcon,
  FlashcardsIcon,
  KnowledgeGapIcon,
  PatientsIcon,
  ResearchIcon,
  WarningIcon,
  ZapIcon,
} from '../components/icons'
import type { AcademyTopic, Flashcard, KnowledgeGap, ReadingItem, ResearchProject } from '../types/domain'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

type Severity = 'critical' | 'warning' | 'info'

interface AlertItem {
  id: string
  severity: Severity
  title: string
  detail: string
  to: string
}

function reminderToAlert(reminder: ActiveReminder, today: string, tomorrow: string): AlertItem | null {
  const detailSuffix = reminder.note ? ` — ${reminder.note}` : ''
  if (reminder.type === 'surgery') {
    if (reminder.eventDate < today) {
      return {
        id: reminder.id,
        severity: 'critical',
        title: `Surgery date passed — ${reminder.patientName}`,
        detail: `${toShamsi(reminder.eventDate)} · ${reminder.title}${detailSuffix}`,
        to: `/patients/${reminder.patientId}`,
      }
    }
    if (reminder.eventDate === today) {
      return {
        id: reminder.id,
        severity: 'critical',
        title: `Surgery today — ${reminder.patientName}`,
        detail: `${reminder.title}${detailSuffix}`,
        to: `/patients/${reminder.patientId}`,
      }
    }
    if (reminder.eventDate === tomorrow) {
      return {
        id: reminder.id,
        severity: 'warning',
        title: `Surgery tomorrow — ${reminder.patientName}`,
        detail: `Pre-op labs/coordination needed today · ${reminder.title}${detailSuffix}`,
        to: `/patients/${reminder.patientId}`,
      }
    }
    return null
  }
  if (reminder.eventDate < today) {
    return {
      id: reminder.id,
      severity: 'critical',
      title: `Overdue — ${reminder.patientName}`,
      detail: `Since ${toShamsi(reminder.eventDate)} · ${reminder.title}${detailSuffix}`,
      to: `/patients/${reminder.patientId}`,
    }
  }
  if (reminder.eventDate === today) {
    return {
      id: reminder.id,
      severity: 'warning',
      title: `Due today — ${reminder.patientName}`,
      detail: `${reminder.title}${detailSuffix}`,
      to: `/patients/${reminder.patientId}`,
    }
  }
  return null
}

function uropathyWatchToAlert(watch: UropathyWatch): AlertItem {
  return {
    id: `uropathy-${watch.patientId}-${watch.surgeryDate}`,
    severity: 'warning',
    title: `Post-obstructive diuresis watch — ${watch.patientName}`,
    detail: `Surgery ${toShamsi(watch.surgeryDate)} — watch urine output; switch to replacement fluids if polyuria (>${POLYURIA_THRESHOLD_ML_KG_HR} mL/kg/hr)`,
    to: `/patients/${watch.patientId}`,
  }
}

function akiToAlert(aki: AkiAlert): AlertItem {
  return {
    id: `aki-${aki.patientId}`,
    severity: aki.stage === 3 ? 'critical' : 'warning',
    title: `AKI Stage ${aki.stage} (KDIGO) — ${aki.patientName}`,
    detail: 'Current creatinine vs. this patient\'s baseline',
    to: `/patients/${aki.patientId}`,
  }
}

function labToAlert(lab: AbnormalLab): AlertItem {
  const result = lab.organism ?? lab.valueText ?? `${lab.value ?? ''} ${lab.unit ?? ''} (ref ${lab.ref ?? '—'})`
  return {
    id: lab.id,
    severity: 'critical',
    title: `${lab.test} abnormal — ${lab.patientName}`,
    detail: `${result} · ${toShamsi(lab.date)}`,
    to: `/patients/${lab.patientId}`,
  }
}

export function DashboardPage() {
  const { session } = useAuth()
  const [patients, setPatients] = useState<PatientGlance[]>([])
  const [labs, setLabs] = useState<AbnormalLab[]>([])
  const [reminders, setReminders] = useState<ActiveReminder[]>([])
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [topicProgress, setTopicProgress] = useState<Record<string, string | null>>({})
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [weakTopicCount, setWeakTopicCount] = useState(0)
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([])
  const [researchProjects, setResearchProjects] = useState<ResearchProject[]>([])
  const [caseLogEntries, setCaseLogEntries] = useState<CaseLogEntryWithPatient[]>([])
  const [uropathyWatches, setUropathyWatches] = useState<UropathyWatch[]>([])
  const [akiAlerts, setAkiAlerts] = useState<AkiAlert[]>([])
  const [readingItems, setReadingItems] = useState<ReadingItem[]>([])
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([
      listRecentAbnormalLabs(),
      listActiveReminders(),
      listAcademyTopics(),
      listAcademyProgress(session.user.id),
      listFlashcards(),
      listBoardQuestions(),
      listBoardQuestionAttempts(),
      listKnowledgeGaps(),
      listResearchProjects(),
      listCaseLogEntries(),
      listObstructiveUropathyWatches(),
      listReadingItems(),
      getUserSettings(),
      listAkiAlerts(),
    ])
      .then(
        async ([
          labRows,
          reminderRows,
          topicRows,
          progressRows,
          flashcardRows,
          boardQuestionRows,
          boardQuestionAttemptRows,
          gapRows,
          projectRows,
          caseLogRows,
          watchRows,
          readingRows,
          settings,
          akiRows,
        ]) => {
          setLabs(labRows)
          setReminders(reminderRows)
          setTopics(topicRows)
          setTopicProgress(Object.fromEntries(progressRows.map((p) => [p.topicId, p.nextReview])))
          setFlashcards(flashcardRows)
          const readiness = computeTopicReadiness(boardQuestionRows, boardQuestionAttemptRows, flashcardRows, topicRows)
          setWeakTopicCount(readiness.filter((r) => r.status === 'weak').length)
          setKnowledgeGaps(gapRows)
          setResearchProjects(projectRows)
          setCaseLogEntries(caseLogRows)
          setUropathyWatches(watchRows)
          setReadingItems(readingRows)
          setLastBackupAt(settings.lastBackupAt ?? null)
          setAkiAlerts(akiRows)

          const today = new Date().toISOString().slice(0, 10)
          const tomorrow = addDays(today, 1)
          const activeReminders = reminderRows.filter((r) => reminderToAlert(r, today, tomorrow) !== null)
          const attentionIds = Array.from(
            new Set([
              ...labRows.map((l) => l.patientId),
              ...activeReminders.map((r) => r.patientId),
              ...watchRows.map((w) => w.patientId),
              ...akiRows.map((a) => a.patientId),
            ])
          )
          const patientRows = await listPatientsByIds(attentionIds)
          setPatients(patientRows)
        }
      )
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [session])

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = addDays(today, 1)

  const reminderAlerts = reminders
    .map((r) => reminderToAlert(r, today, tomorrow))
    .filter((a): a is AlertItem => a !== null)
  const labAlerts = labs.map(labToAlert)

  const dueTopics = topics.filter((t) => {
    const next = topicProgress[t.id]
    return !next || next <= today
  })
  const dueFlashcards = flashcards.filter((c) => !c.nextReview || c.nextReview <= today)
  const dueReadingCheckpoints = listDueCheckpoints(readingItems, today)
  const dueLeitnerItems = listDueLeitnerItems(readingItems, today)
  const dueReadingCount = dueReadingCheckpoints.length + dueLeitnerItems.length

  const studyAlerts: AlertItem[] = []
  if (dueTopics.length > 0) {
    studyAlerts.push({
      id: 'study-academy',
      severity: 'info',
      title: `${dueTopics.length} Academy topic${dueTopics.length === 1 ? '' : 's'} due for review`,
      detail: 'Spaced-repetition schedule',
      to: '/today',
    })
  }
  if (dueFlashcards.length > 0) {
    studyAlerts.push({
      id: 'study-flashcards',
      severity: 'info',
      title: `${dueFlashcards.length} flashcard${dueFlashcards.length === 1 ? '' : 's'} due for review`,
      detail: 'Spaced-repetition schedule',
      to: '/today',
    })
  }
  if (dueReadingCount > 0) {
    studyAlerts.push({
      id: 'study-reading',
      severity: 'info',
      title: `${dueReadingCount} reading review${dueReadingCount === 1 ? '' : 's'} due`,
      detail:
        dueLeitnerItems.length > 0 && dueReadingCheckpoints.length > 0
          ? 'Fixed schedule + Leitner-box saved questions'
          : dueLeitnerItems.length > 0
            ? 'Leitner-box saved questions'
            : 'Fixed 3d/1wk/14d/1mo/3mo schedule',
      to: '/today',
    })
  }

  const uropathyAlerts = uropathyWatches.map(uropathyWatchToAlert)

  const daysSinceBackup = lastBackupAt ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60 * 24)) : null
  const backupAlerts: AlertItem[] =
    daysSinceBackup == null || daysSinceBackup >= 7
      ? [
          {
            id: 'backup-overdue',
            severity: 'warning',
            title: daysSinceBackup == null ? 'No backup on record' : `No backup in ${daysSinceBackup} days`,
            detail: 'Download a full backup from the Export page',
            to: '/export',
          },
        ]
      : []

  const akiAlertItems = akiAlerts.map(akiToAlert)

  const critical = [
    ...labAlerts,
    ...reminderAlerts.filter((a) => a.severity === 'critical'),
    ...akiAlertItems.filter((a) => a.severity === 'critical'),
  ]
  const warning = [
    ...reminderAlerts.filter((a) => a.severity === 'warning'),
    ...akiAlertItems.filter((a) => a.severity === 'warning'),
    ...uropathyAlerts,
    ...backupAlerts,
  ]
  const alerts = [...critical, ...warning, ...studyAlerts]

  const openGaps = knowledgeGaps.filter((g) => g.status !== 'resolved')
  const currentMonth = today.slice(0, 7)
  const caseLogThisMonth = caseLogEntries.filter((e) => e.date.slice(0, 7) === currentMonth).length

  const patientSeverity = new Map<string, 'critical' | 'warning'>()
  for (const l of labs) patientSeverity.set(l.patientId, 'critical')
  for (const r of reminders) {
    const alert = reminderToAlert(r, today, tomorrow)
    if (!alert || alert.severity === 'info') continue
    if (patientSeverity.get(r.patientId) !== 'critical') {
      patientSeverity.set(r.patientId, alert.severity)
    }
  }
  for (const w of uropathyWatches) {
    if (!patientSeverity.has(w.patientId)) patientSeverity.set(w.patientId, 'warning')
  }
  for (const a of akiAlerts) {
    const severity = a.stage === 3 ? 'critical' : 'warning'
    if (patientSeverity.get(a.patientId) !== 'critical') {
      patientSeverity.set(a.patientId, severity)
    }
  }
  const sortedPatients = [...patients].sort((a, b) => {
    const rank = { critical: 0, warning: 1 } as const
    const sa = rank[patientSeverity.get(a.id) ?? 'warning']
    const sb = rank[patientSeverity.get(b.id) ?? 'warning']
    return sa !== sb ? sa - sb : a.name.localeCompare(b.name)
  })

  const topicOfTheDay = dueTopics[0] ?? topics[0] ?? null

  return (
    <div className="np-page">
      <DashboardHero followUpCount={sortedPatients.length} />

      <div className="dh-grid">
        <section className="np-card np-fade" style={{ animationDelay: '.08s' }}>
          <div className="np-head">
            <div className="np-head-l">
              <span className="np-ic">
                <PatientsIcon />
              </span>
              <h2>Patients needing follow-up</h2>
            </div>
            <Link to="/patients" style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              View all
            </Link>
          </div>
          {sortedPatients.length === 0 ? (
            <EmptyState>No patients currently need follow-up.</EmptyState>
          ) : (
            sortedPatients.map((p) => <PatientGlanceRow key={p.id} patient={p} severity={patientSeverity.get(p.id)} />)
          )}
        </section>

        <CalendarWidget />

        {topicOfTheDay && (
          <section className="np-card np-fade" style={{ animationDelay: '.2s', flexDirection: 'row', alignItems: 'center' }}>
            <span className="np-ic" style={{ width: 56, height: 56, borderRadius: '50%' }}>
              <ZapIcon />
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: '#1E5BD8' }}>
                HIGH-YIELD OF THE DAY
              </span>
              <b className="np-fa" dir="rtl" style={{ textAlign: 'left', fontSize: 16 }}>
                {topicOfTheDay.name}
              </b>
            </span>
            <Link to={`/academy/${topicOfTheDay.id}`} style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
              Start reading →
            </Link>
          </section>
        )}

        <QuickTools />

        <section className="np-card np-fade" style={{ animationDelay: '.32s', gap: 10 }}>
          <div className="np-head-l">
            <span className="np-ic">
              <WarningIcon />
            </span>
            <h2>Needs attention</h2>
          </div>
          {alerts.length === 0 ? (
            <EmptyState>Nothing needs attention right now.</EmptyState>
          ) : (
            alerts.map((a) => {
              const colors =
                a.severity === 'critical'
                  ? { background: '#FDECEB', color: '#8E1C13', detail: '#9B3A31' }
                  : a.severity === 'warning'
                    ? { background: '#FDF0DC', color: '#6B4108', detail: '#7A5418' }
                    : { background: '#E8F0FD', color: '#12357A', detail: '#3B5A93' }
              return (
                <Link key={a.id} to={a.to} className="dh-att" style={{ background: colors.background, color: colors.color }}>
                  <WarningIcon />
                  <span>
                    <b>{a.title}</b>
                    <span style={{ color: colors.detail }}>{a.detail}</span>
                  </span>
                </Link>
              )
            })
          )}
        </section>

        <section className="np-card np-fade" style={{ animationDelay: '.38s', gap: 4 }}>
          <div className="np-head-l" style={{ marginBottom: 6 }}>
            <span className="np-ic">
              <AcademyIcon />
            </span>
            <h2>Learning &amp; research</h2>
          </div>
          <Link to="/today" className="dh-lr">
            <span className="np-ic" style={{ background: '#FDF0DC', color: '#93590B' }}>
              <AcademyIcon />
            </span>
            Academy topics due
            <b>{dueTopics.length}</b>
          </Link>
          <Link to="/today" className="dh-lr">
            <span className="np-ic" style={{ background: '#FDF0DC', color: '#93590B' }}>
              <FlashcardsIcon />
            </span>
            Flashcards due
            <b>{dueFlashcards.length}</b>
          </Link>
          <Link to="/today" className="dh-lr">
            <span className="np-ic">
              <CalendarIcon />
            </span>
            Reading reviews due
            <b>{dueReadingCount}</b>
          </Link>
          <Link to="/board-readiness" className="dh-lr">
            <span className="np-ic" style={{ background: '#FDE8E7', color: '#B42318' }}>
              <AnalyticsIcon />
            </span>
            Weak topics (Board Readiness)
            <b>{weakTopicCount}</b>
          </Link>
          <Link to="/study" className="dh-lr">
            <span className="np-ic">
              <KnowledgeGapIcon />
            </span>
            Open knowledge gaps
            <b>{openGaps.length}</b>
          </Link>
          <Link to="/research" className="dh-lr">
            <span className="np-ic">
              <ResearchIcon />
            </span>
            Active research projects
            <b>{researchProjects.length}</b>
          </Link>
          <Link to="/case-log" className="dh-lr">
            <span className="np-ic">
              <CaseLogIcon />
            </span>
            Case log entries this month
            <b>{caseLogThisMonth}</b>
          </Link>
        </section>
      </div>
    </div>
  )
}
