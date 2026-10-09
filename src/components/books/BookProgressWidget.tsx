import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllSectionsForUser } from '../../lib/api/books'
import { getUserSettings, updateUserSettings } from '../../lib/api/settings'
import { BookIcon } from '../icons'
import { EmptyState } from '../illustrations/EmptyState'
import type { BookSection } from '../../types/domain'

export function BookProgressWidget() {
  const [sections, setSections] = useState<BookSection[]>([])
  const [goal, setGoal] = useState(1)
  const [goalInput, setGoalInput] = useState('1')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listAllSectionsForUser(), getUserSettings()])
      .then(([sectionRows, settings]) => {
        setSections(sectionRows)
        setGoal(settings.readingDailyGoal)
        setGoalInput(String(settings.readingDailyGoal))
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  async function saveGoal() {
    const n = Math.max(1, Number(goalInput) || 1)
    setGoal(n)
    setGoalInput(String(n))
    try {
      await updateUserSettings({ readingDailyGoal: n })
    } catch {
      // non-critical — the goal just won't persist across reloads this time
    }
  }

  if (loading) return null

  const today = new Date().toISOString().slice(0, 10)
  const totalSections = sections.length
  const completedSections = sections.filter((s) => s.status !== 'unread').length
  const overallPct = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0
  const todayCount = sections.filter((s) => s.readAt && s.readAt.slice(0, 10) === today).length
  const goalPct = Math.min(100, Math.round((todayCount / goal) * 100))

  return (
    <section className="np-card np-fade">
      <div className="np-head">
        <div className="np-head-l">
          <span className="np-ic">
            <BookIcon />
          </span>
          <h2>Reading progress</h2>
        </div>
        <Link to="/books" style={{ fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Open Books
        </Link>
      </div>
      {totalSections === 0 ? (
        <EmptyState>No book sections tracked yet — add a book to start a reading goal.</EmptyState>
      ) : (
        <>
          <span className="np-small">
            {completedSections} / {totalSections} sections overall ({overallPct}%)
          </span>
          <div style={{ height: 8, borderRadius: 4, background: '#EEF2F8', overflow: 'hidden', margin: '6px 0 10px' }}>
            <div style={{ width: `${overallPct}%`, height: '100%', background: '#1E5BD8' }} />
          </div>
          <span className="np-small">
            Today's goal: {todayCount} / {goal} sections
          </span>
          <div style={{ height: 8, borderRadius: 4, background: '#EEF2F8', overflow: 'hidden', margin: '6px 0 10px' }}>
            <div style={{ width: `${goalPct}%`, height: '100%', background: '#2E9E6B' }} />
          </div>
        </>
      )}
      <div className="form-actions" style={{ marginTop: totalSections === 0 ? 10 : 0 }}>
        <label className="patient-meta" htmlFor="reading-daily-goal">
          Daily goal (sections)
        </label>
        <input
          id="reading-daily-goal"
          type="number"
          min={1}
          style={{ width: 60 }}
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          onBlur={() => void saveGoal()}
        />
      </div>
    </section>
  )
}
