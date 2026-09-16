import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listRecentAbnormalLabs, type AbnormalLab } from '../lib/api/dashboard'
import { listActiveReminders, type ActiveReminder } from '../lib/api/reminders'
import { listAcademyProgress, listAcademyTopics } from '../lib/api/academy'
import { listFlashcards } from '../lib/api/flashcards'
import { useAuth } from '../context/AuthContext'
import { AcademyIcon, DashboardIcon, LabsIcon, RemindersIcon } from '../components/icons'
import type { AcademyTopic, Flashcard } from '../types/domain'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function reminderStatus(reminder: ActiveReminder, today: string, tomorrow: string): string | null {
  if (reminder.type === 'surgery') {
    if (reminder.eventDate < today) return `Surgery date passed (${reminder.eventDate}) — check status`
    if (reminder.eventDate === today) return 'Surgery today'
    if (reminder.eventDate === tomorrow) return 'Surgery tomorrow — pre-op labs/coordination needed today'
    return null
  }
  if (reminder.eventDate < today) return `Overdue since ${reminder.eventDate}`
  if (reminder.eventDate === today) return 'Due today'
  return null
}

export function DashboardPage() {
  const { session } = useAuth()
  const [labs, setLabs] = useState<AbnormalLab[]>([])
  const [reminders, setReminders] = useState<ActiveReminder[]>([])
  const [topics, setTopics] = useState<AcademyTopic[]>([])
  const [topicProgress, setTopicProgress] = useState<Record<string, string | null>>({})
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
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
    ])
      .then(([labRows, reminderRows, topicRows, progressRows, flashcardRows]) => {
        setLabs(labRows)
        setReminders(reminderRows)
        setTopics(topicRows)
        setTopicProgress(Object.fromEntries(progressRows.map((p) => [p.topicId, p.nextReview])))
        setFlashcards(flashcardRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [session])

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = addDays(today, 1)

  const careAlerts = reminders
    .map((r) => ({ reminder: r, status: reminderStatus(r, today, tomorrow) }))
    .filter((x): x is { reminder: ActiveReminder; status: string } => x.status !== null)

  const dueTopics = topics.filter((t) => {
    const next = topicProgress[t.id]
    return !next || next <= today
  })
  const dueFlashcards = flashcards.filter((c) => !c.nextReview || c.nextReview <= today)

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <DashboardIcon />
        </span>
        Dashboard
      </h1>

      <section style={{ marginBottom: 28 }}>
        <h2 className="section-title">
          <RemindersIcon />
          Care alerts
        </h2>
        {careAlerts.length === 0 ? (
          <p className="empty-state">Nothing needs attention today.</p>
        ) : (
          <ul className="note-timeline">
            {careAlerts.map(({ reminder, status }) => (
              <li key={reminder.id}>
                <div className="note-header">
                  <strong>{reminder.patientName}</strong>
                  <span>{status}</span>
                </div>
                <p>
                  {reminder.title}
                  {reminder.note ? ` — ${reminder.note}` : ''}
                </p>
                <Link to={`/patients/${reminder.patientId}`} className="link-button">
                  Open patient
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginBottom: 28 }}>
        <h2 className="section-title">
          <LabsIcon />
          Abnormal labs (last 14 days)
        </h2>
        {labs.length === 0 ? (
          <p className="empty-state">No abnormal labs in the last 14 days.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Date</th>
                <th>Test</th>
                <th>Value</th>
                <th>Ref range</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {labs.map((lab) => (
                <tr key={lab.id}>
                  <td>{lab.patientName}</td>
                  <td>{lab.date}</td>
                  <td>{lab.test}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    {lab.value} {lab.unit}
                  </td>
                  <td>{lab.ref}</td>
                  <td>
                    <Link to={`/patients/${lab.patientId}`} className="link-button">
                      Open patient
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="section-title">
          <AcademyIcon />
          Study reviews due today
        </h2>
        {dueTopics.length === 0 && dueFlashcards.length === 0 ? (
          <p className="empty-state">Nothing due for review today.</p>
        ) : (
          <div className="calc-strip">
            <div>
              <span className="calc-label">Academy topics due</span>
              <span className="calc-value">{dueTopics.length}</span>
            </div>
            <div>
              <span className="calc-label">Flashcards due</span>
              <span className="calc-value">{dueFlashcards.length}</span>
            </div>
          </div>
        )}
        {(dueTopics.length > 0 || dueFlashcards.length > 0) && (
          <div className="form-actions">
            {dueTopics.length > 0 && (
              <Link to="/academy" className="button-link">
                Review Academy topics
              </Link>
            )}
            {dueFlashcards.length > 0 && (
              <Link to="/study" className="button-link">
                Review flashcards
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
