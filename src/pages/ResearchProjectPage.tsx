import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getResearchProject } from '../lib/api/research'
import { OverviewTab } from '../components/research/OverviewTab'
import { FormBuilderTab } from '../components/research/FormBuilderTab'
import { DataTab } from '../components/research/DataTab'
import { AnalyticsTab } from '../components/research/AnalyticsTab'
import type { ResearchProject } from '../types/domain'

type Tab = 'overview' | 'form' | 'data' | 'analytics'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'form', label: 'Form Builder' },
  { id: 'data', label: 'Data' },
  { id: 'analytics', label: 'Analytics' },
]

export function ResearchProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = useState<ResearchProject | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getResearchProject(id)
      .then(setProject)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load project'))
  }, [id])

  if (error) return <p className="form-error">{error}</p>
  if (!project || !id) return <p>Loading…</p>

  return (
    <div>
      <div className="page-header">
        <div>
          <Link to="/research" className="back-link">
            ← Research
          </Link>
          <h1>{project.name}</h1>
        </div>
      </div>

      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-panel">
        {tab === 'overview' && <OverviewTab project={project} onUpdated={setProject} />}
        {tab === 'form' && <FormBuilderTab projectId={id} />}
        {tab === 'data' && <DataTab projectId={id} />}
        {tab === 'analytics' && <AnalyticsTab projectId={id} />}
      </div>
    </div>
  )
}
