import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addResearchProject, listResearchProjects } from '../lib/api/research'
import { ResearchIcon } from '../components/icons'
import type { ResearchProject } from '../types/domain'

export function ResearchProjectsPage() {
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    listResearchProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const project = await addResearchProject({
        name: name.trim(),
        createdDate: new Date().toISOString().slice(0, 10),
        overview: null,
        researchQuestion: null,
        objectives: null,
        studyDesign: null,
        inclusion: null,
        exclusion: null,
        notes: null,
        literature: null,
        progress: null,
      })
      navigate(`/research/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          <span className="page-title-icon">
            <ResearchIcon />
          </span>
          Research & Thesis Center
        </h1>
        <button onClick={() => setShowForm((v) => !v)}>{showForm ? 'Cancel' : 'New project'}</button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={(e) => void handleCreate(e)}>
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <button type="submit">Create</button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">No research projects yet.</p>
      ) : (
        <ul className="patient-list">
          {projects.map((p) => (
            <li key={p.id}>
              <Link to={`/research/${p.id}`}>
                <span className="patient-name">{p.name}</span>
                <span className="patient-meta">{p.researchQuestion || 'No research question yet'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
