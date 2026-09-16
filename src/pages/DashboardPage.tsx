import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ShamsiCalendarWidget } from '../components/ShamsiCalendarWidget'
import { toShamsi } from '../lib/shamsi'
import {
  listEGFRTrend,
  listPatientsOverview,
  listRecentAbnormalLabs,
  type AbnormalLab,
  type EGFRTrendPoint,
  type PatientGlance,
} from '../lib/api/dashboard'
import { listActiveReminders, type ActiveReminder } from '../lib/api/reminders'
import { listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { listFlashcards } from '../lib/api/flashcards'
import { listKnowledgeGaps } from '../lib/api/knowledgeGaps'
import { listResearchProjects } from '../lib/api/research'
import { useAuth } from '../context/AuthContext'
import {
  AcademyIcon,
  DashboardIcon,
  FlashcardsIcon,
  KnowledgeGapIcon,
  PatientsIcon,
  ResearchIcon,
  TrendsIcon,
  WarningIcon,
} from '../components/icons'
import type { AcademyTopic, Flashcard, KnowledgeGap, ResearchProject } from '../types/domain'

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

function labToAlert(lab: AbnormalLab): AlertItem {
  return {
    id: lab.id,
    severity: 'critical',
    title: `${lab.test} abnormal — ${lab.patientName}`,
    detail: `${lab.value ?? ''} ${lab.unit ?? ''} (ref ${lab.ref ?? '—'}) · ${toShamsi(lab.date)}`,
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
  const [knowledgeGaps, setKnowledgeGaps] = useState<KnowledgeGap[]>([])
  const [researchProjects, setResearchProjects] = useState<ResearchProject[]>([])
  const [egfrTrend, setEgfrTrend] = useState<EGFRTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    setLoading(true)
    Promise.all([
      listPatientsOverview(),
      listRecentAbnormalLabs(),
      listActiveReminders(),
      listAcademyTopics(),
      listAcademyProgress(session.user.id),
      listFlashcards(),
      listKnowledgeGaps(),
      listResearchProjects(),
      listEGFRTrend(),
    ])
      .then(
        ([
          patientRows,
          labRows,
          reminderRows,
          topicRows,
          progressRows,
          flashcardRows,
          gapRows,
          projectRows,
          trendRows,
        ]) => {
          setPatients(patientRows)
          setLabs(labRows)
          setReminders(reminderRows)
          setTopics(topicRows)
          setTopicProgress(Object.fromEntries(progressRows.map((p) => [p.topicId, p.nextReview])))
          setFlashcards(flashcardRows)
          setKnowledgeGaps(gapRows)
          setResearchProjects(projectRows)
          setEgfrTrend(trendRows)
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

  const studyAlerts: AlertItem[] = []
  if (dueTopics.length > 0) {
    studyAlerts.push({
      id: 'study-academy',
      severity: 'info',
      title: `${dueTopics.length} Academy topic${dueTopics.length === 1 ? '' : 's'} due for review`,
      detail: 'Spaced-repetition schedule',
      to: '/academy',
    })
  }
  if (dueFlashcards.length > 0) {
    studyAlerts.push({
      id: 'study-flashcards',
      severity: 'info',
      title: `${dueFlashcards.length} flashcard${dueFlashcards.length === 1 ? '' : 's'} due for review`,
      detail: 'Spaced-repetition schedule',
      to: '/study',
    })
  }

  const critical = [...labAlerts, ...reminderAlerts.filter((a) => a.severity === 'critical')]
  const warning = reminderAlerts.filter((a) => a.severity === 'warning')
  const alerts = [...critical, ...warning, ...studyAlerts]

  const openGaps = knowledgeGaps.filter((g) => g.status !== 'resolved')

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <DashboardIcon />
        </span>
        Dashboard
      </h1>

      <div className="dash-row">
        <div className="dash-card dash-row-main">
          <div className="dash-card-header">
            <h2 className="dash-card-title">
              <span className="icon-chip">
                <PatientsIcon />
              </span>
              Current patients
            </h2>
            <Link to="/patients" className="link-button">
              View all
            </Link>
          </div>
          {patients.length === 0 ? (
            <p className="empty-state">No patients yet.</p>
          ) : (
            <ul className="glance-list">
              {patients.map((p) => (
                <li key={p.id}>
                  <Link to={`/patients/${p.id}`} className="glance-row">
                    <span className="glance-avatar">{p.name.charAt(0).toUpperCase()}</span>
                    <span className="glance-body">
                      <span className="glance-name">{p.name}</span>
                      <span className="glance-meta">
                        {[p.age != null ? `${p.age}y` : null, p.bed, p.diagnosis].filter(Boolean).join(' · ') ||
                          'No details yet'}
                      </span>
                    </span>
                    {(p.latestCreatinine || p.latestEGFR) && (
                      <span className="glance-stats">
                        {p.latestCreatinine && <strong>Cr {p.latestCreatinine.value}</strong>}
                        {p.latestEGFR != null && <span>eGFR {p.latestEGFR.toFixed(1)}</span>}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dash-row-side">
          <ShamsiCalendarWidget />
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">
            <span className="icon-chip">
              <TrendsIcon />
            </span>
            Renal function snapshot
          </h2>
        </div>
        {egfrTrend.length < 2 ? (
          <p className="empty-state">Add creatinine + height for patients to see an eGFR trend here.</p>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={egfrTrend}>
                <defs>
                  <linearGradient id="egfrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value: string) => toShamsi(value)} />
                <YAxis tick={{ fontSize: 11 }} width={36} />
                <Tooltip
                  formatter={(value: number) => [value.toFixed(1), 'Avg eGFR']}
                  labelFormatter={(label: string) => toShamsi(label)}
                />
                <Area type="monotone" dataKey="avgEGFR" stroke="var(--accent)" strokeWidth={2} fill="url(#egfrFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">
            <span className="icon-chip">
              <WarningIcon />
            </span>
            Needs attention
          </h2>
        </div>
        {alerts.length === 0 ? (
          <p className="empty-state">Nothing needs attention right now.</p>
        ) : (
          <ul className="alert-feed">
            {alerts.map((a) => (
              <li key={a.id}>
                <Link to={a.to} className={`alert-row alert-row--${a.severity}`}>
                  <WarningIcon />
                  <span>
                    <span className="alert-title">{a.title}</span>
                    <span className="alert-detail">{a.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">
            <span className="icon-chip">
              <AcademyIcon />
            </span>
            Learning &amp; research
          </h2>
        </div>
        <ul className="checklist-widget">
          <li>
            <Link to="/academy" className="checklist-row">
              <span className={`checklist-dot ${dueTopics.length > 0 ? 'checklist-dot--due' : 'checklist-dot--done'}`}>
                <AcademyIcon />
              </span>
              <span className="checklist-label">Academy topics due for review</span>
              <span className="checklist-count">{dueTopics.length}</span>
            </Link>
          </li>
          <li>
            <Link to="/study" className="checklist-row">
              <span className={`checklist-dot ${dueFlashcards.length > 0 ? 'checklist-dot--due' : 'checklist-dot--done'}`}>
                <FlashcardsIcon />
              </span>
              <span className="checklist-label">Flashcards due for review</span>
              <span className="checklist-count">{dueFlashcards.length}</span>
            </Link>
          </li>
          <li>
            <Link to="/study" className="checklist-row">
              <span className={`checklist-dot ${openGaps.length > 0 ? 'checklist-dot--due' : 'checklist-dot--done'}`}>
                <KnowledgeGapIcon />
              </span>
              <span className="checklist-label">Open knowledge gaps</span>
              <span className="checklist-count">{openGaps.length}</span>
            </Link>
          </li>
          <li>
            <Link to="/research" className="checklist-row">
              <span className={`checklist-dot ${researchProjects.length > 0 ? 'checklist-dot--done' : ''}`}>
                <ResearchIcon />
              </span>
              <span className="checklist-label">Active research projects</span>
              <span className="checklist-count">{researchProjects.length}</span>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
