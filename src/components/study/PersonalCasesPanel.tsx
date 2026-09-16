import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deletePersonalCase, listPersonalCases } from '../../lib/api/personalCases'
import type { PersonalCase } from '../../types/domain'

export function PersonalCasesPanel() {
  const [cases, setCases] = useState<PersonalCase[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  function refresh() {
    setLoading(true)
    listPersonalCases()
      .then(setCases)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cases'))
      .finally(() => setLoading(false))
  }

  async function handleDelete(id: string) {
    try {
      await deletePersonalCase(id)
      setCases((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <div>
      <div className="form-actions" style={{ marginBottom: 16 }}>
        <Link to="/study/personal-cases/new" className="button-link">
          New case
        </Link>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : cases.length === 0 ? (
        <p className="empty-state">
          No teaching cases yet. Build one from a patient's page ("Build teaching case from this patient")
          or start a blank one above.
        </p>
      ) : (
        <ul className="note-timeline">
          {cases.map((c) => (
            <li key={c.id}>
              <div className="note-header">
                <strong onClick={() => setOpenId(openId === c.id ? null : c.id)} style={{ cursor: 'pointer' }}>
                  {c.title}
                </strong>
                <span>{c.createdDate}</span>
                <button className="link-button" onClick={() => void handleDelete(c.id)}>
                  Delete
                </button>
              </div>
              {openId === c.id && (
                <div>
                  {c.presentation && <p><strong>Presentation:</strong> {c.presentation}</p>}
                  {c.labPattern && <p><strong>Lab pattern:</strong> {c.labPattern}</p>}
                  {c.workingDx && <p><strong>Working diagnosis:</strong> {c.workingDx}</p>}
                  {c.pearls && <p><strong>Pearls:</strong> {c.pearls}</p>}
                  {c.whatLearned && <p><strong>What I learned:</strong> {c.whatLearned}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
