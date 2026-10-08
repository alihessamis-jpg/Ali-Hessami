import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addResearchProject, listResearchProjects } from '../lib/api/research'
import { listLusStudyEnrollments } from '../lib/api/lusStudy'
import { matchesSearch } from '../lib/textFilter'
import { ResearchIcon } from '../components/icons'
import type { ResearchProject } from '../types/domain'

const STAGES = [
  { label: 'Proposal', detail: 'Question, design, sample size' },
  { label: 'Ethics', detail: 'Approval code and consent forms' },
  { label: 'Data collection', detail: 'Enroll patients and log sessions' },
  { label: 'Analysis', detail: 'Export to Excel / SPSS' },
  { label: 'Writing', detail: 'Manuscript and submission' },
]

export function ResearchProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ResearchProject[]>([])
  const [enrolledCount, setEnrolledCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([listResearchProjects(), listLusStudyEnrollments()])
      .then(([p, enrollments]) => {
        setProjects(p)
        setEnrolledCount(enrollments.length)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(
    () => projects.filter((p) => matchesSearch([p.name, p.researchQuestion, p.overview, p.studyDesign], search)),
    [projects, search],
  )

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
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow cyan" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Research &amp; Thesis Center</h1>
            <p className="np-sub">Track every project from idea to publication.</p>
          </div>
          <svg className="np-art" width="90" height="90" viewBox="0 0 90 90" fill="none" aria-hidden="true">
            <g className="rsc-spin">
              <ellipse cx="45" cy="45" rx="38" ry="14" stroke="#4F86E8" strokeWidth={2} />
              <ellipse cx="45" cy="45" rx="38" ry="14" stroke="#4F86E8" strokeWidth={2} transform="rotate(60 45 45)" />
              <ellipse cx="45" cy="45" rx="38" ry="14" stroke="#4F86E8" strokeWidth={2} transform="rotate(120 45 45)" />
              <circle cx="83" cy="45" r="4" fill="#7FD4FF" />
              <circle cx="26" cy="12" r="4" fill="#FFC46B" />
            </g>
            <circle cx="45" cy="45" r="8" fill="#9CC2FF" />
          </svg>
        </div>
      </section>

      <div className="np-toolbar np-fade" style={{ animationDelay: '.08s' }}>
        <div className="np-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label className="np-sr" htmlFor="rsc-search">
            Search projects
          </label>
          <input id="rsc-search" placeholder="Search projects" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="np-btn" onClick={() => setShowForm((v) => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {showForm ? 'Cancel' : 'New project'}
        </button>
      </div>

      {showForm && (
        <form className="np-card np-fade" onSubmit={(e) => void handleCreate(e)}>
          <div className="np-field">
            <label htmlFor="rsc-name">Project name</label>
            <input id="rsc-name" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <button type="submit" className="np-btn">
            Create
          </button>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="np-grid2">
        {loading ? (
          <p>Loading…</p>
        ) : filtered.length === 0 ? (
          <section
            className="np-card np-fade"
            style={{ animationDelay: '.14s', alignItems: 'center', textAlign: 'center', padding: '28px 20px' }}
          >
            <svg width="150" height="150" viewBox="0 0 150 150" fill="none" aria-hidden="true">
              <circle cx="75" cy="80" r="62" fill="#EEF4FD" />
              <defs>
                <clipPath id="rsc-flask">
                  <path d="M62 30v30L36 112a8 8 0 0 0 7 12h64a8 8 0 0 0 7-12L88 60V30z" />
                </clipPath>
              </defs>
              <g clipPath="url(#rsc-flask)">
                <g className="rsc-slosh">
                  <path d="M20 92c14-6 28 6 42 0s28-6 42 0 28 6 42 0v60H20z" fill="#7FB2FF" />
                </g>
                <circle cx="66" cy="118" r="4" fill="#fff" className="rsc-bubble" />
                <circle cx="80" cy="120" r="3" fill="#fff" className="rsc-bubble" style={{ animationDelay: '.9s' }} />
                <circle cx="90" cy="116" r="2.5" fill="#fff" className="rsc-bubble" style={{ animationDelay: '1.6s' }} />
              </g>
              <path
                d="M62 30v30L36 112a8 8 0 0 0 7 12h64a8 8 0 0 0 7-12L88 60V30"
                stroke="#12357A"
                strokeWidth={3}
                strokeLinejoin="round"
              />
              <path d="M56 30h38" stroke="#12357A" strokeWidth={3} strokeLinecap="round" />
            </svg>
            <h2 style={{ fontSize: 18 }}>{search ? 'No projects match' : 'No research projects yet'}</h2>
            <span className="np-small" style={{ maxWidth: 340, lineHeight: 1.5 }}>
              Create a project to track it through proposal, ethics, data collection, analysis and writing.
            </span>
            {!search && (
              <button type="button" className="np-btn" style={{ marginTop: 6 }} onClick={() => setShowForm(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New project
              </button>
            )}
          </section>
        ) : (
          <section className="np-card np-fade" style={{ animationDelay: '.14s' }}>
            <div className="np-head-l">
              <h2>Projects</h2>
              <span className="np-small">{filtered.length}</span>
            </div>
            <div className="np-stack" style={{ gap: 10 }}>
              {filtered.map((p) => (
                <Link key={p.id} to={`/research/${p.id}`} className="rsc-link">
                  <span className="np-ic">
                    <ResearchIcon />
                  </span>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <b style={{ fontSize: 14 }}>{p.name}</b>
                    <span className="np-small">{p.researchQuestion || 'No research question yet'}</span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7A90" strokeWidth={2} strokeLinecap="round">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="np-stack">
          <Link to="/thesis-form" className="rsc-link np-fade" style={{ animationDelay: '.2s' }}>
            <span className="np-ic" style={{ width: 42, height: 42 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
                <circle cx="16" cy="6" r="2" />
                <circle cx="10" cy="12" r="2" />
                <circle cx="18" cy="18" r="2" />
              </svg>
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <b style={{ fontSize: 14 }}>Thesis data collection</b>
              <span className="np-small">LUS Volume-Assessment Study · {enrolledCount} enrolled</span>
            </span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7A90" strokeWidth={2} strokeLinecap="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>

          <section className="np-card np-fade" style={{ animationDelay: '.26s' }}>
            <h2>Project stages</h2>
            <div className="rsc-steps">
              {STAGES.map((s, i) => (
                <div key={s.label} className="rsc-step">
                  <span className="rsc-dot">{i + 1}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <b style={{ fontSize: 14 }}>{s.label}</b>
                    <span className="np-small">{s.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
