import { useEffect, useState } from 'react'
import { listAcademicActivities } from '../lib/api/academicActivities'
import { listCaseLogEntries } from '../lib/api/caseLog'
import { listResearchProjects } from '../lib/api/research'
import { groupAcademicActivities, summarizeCaseLog } from '../lib/cvBuilder'
import { toShamsi } from '../lib/shamsi'
import { DocumentIcon } from '../components/icons'
import type { AcademicActivity, CaseLogEntry, ResearchProject } from '../types/domain'

const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned',
  completed: 'Completed',
  submitted: 'Submitted',
  under_review: 'Under review',
  revision_requested: 'Revision requested',
  accepted: 'Accepted',
  published: 'Published',
  rejected: 'Rejected',
}

const ROLE_LABEL: Record<string, string> = {
  managed: 'Managed',
  performed: 'Performed',
  assisted: 'Assisted',
  observed: 'Observed',
  consulted: 'Consulted',
}

export function CvPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activities, setActivities] = useState<AcademicActivity[]>([])
  const [caseLog, setCaseLog] = useState<CaseLogEntry[]>([])
  const [projects, setProjects] = useState<ResearchProject[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([listAcademicActivities(), listCaseLogEntries(), listResearchProjects()])
      .then(([activityRows, caseLogRows, projectRows]) => {
        setActivities(activityRows)
        setCaseLog(caseLogRows)
        setProjects(projectRows)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load CV data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading…</p>

  const activityGroups = groupAcademicActivities(activities)
  const caseLogSummary = summarizeCaseLog(caseLog)

  return (
    <div>
      <h1 className="page-title">
        <span className="page-title-icon">
          <DocumentIcon />
        </span>
        Academic CV
      </h1>
      <p className="empty-state">
        A live summary built from your Academic Activity log, Case Log, and Research projects — print or save
        as PDF whenever you need an up-to-date portfolio.
      </p>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Publications, presentations &amp; academic activity</h2>
        </div>
        {activityGroups.length === 0 ? (
          <p className="empty-state">
            Nothing logged yet — add manuscripts, conference talks, posters, and journal clubs on the Academic
            Activity page.
          </p>
        ) : (
          activityGroups.map((group) => (
            <div key={group.category} style={{ marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 6px' }}>
                {group.category} ({group.items.length})
              </h3>
              <ul className="note-timeline">
                {group.items.map((a) => (
                  <li key={a.id}>
                    <div className="note-header">
                      <strong>{a.title}</strong>
                      {a.status && <span className="status-badge status-badge--neutral">{STATUS_LABEL[a.status] ?? a.status}</span>}
                    </div>
                    <p className="patient-meta">
                      {toShamsi(a.date)}
                      {a.role ? ` · ${a.role}` : ''}
                      {a.venue ? ` · ${a.venue}` : ''}
                    </p>
                    {a.notes && <p className="patient-meta">{a.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Clinical experience</h2>
        </div>
        {caseLogSummary.totalCases === 0 ? (
          <p className="empty-state">No case log entries yet.</p>
        ) : (
          <>
            <p className="patient-meta">
              {caseLogSummary.totalCases} case{caseLogSummary.totalCases === 1 ? '' : 's'} logged across{' '}
              {caseLogSummary.distinctDiagnoses} distinct diagnos{caseLogSummary.distinctDiagnoses === 1 ? 'is' : 'es'}.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 12 }}>
              <div>
                <h3 style={{ margin: '0 0 6px' }}>By role</h3>
                <ul className="note-timeline">
                  {caseLogSummary.byRole.map((r) => (
                    <li key={r.label}>
                      <p className="patient-meta">
                        {ROLE_LABEL[r.label] ?? r.label}: {r.count}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style={{ margin: '0 0 6px' }}>By category</h3>
                <ul className="note-timeline">
                  {caseLogSummary.byCategory.map((c) => (
                    <li key={c.label}>
                      <p className="patient-meta">
                        {c.label}: {c.count}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              {caseLogSummary.procedures.length > 0 && (
                <div>
                  <h3 style={{ margin: '0 0 6px' }}>Procedures</h3>
                  <ul className="note-timeline">
                    {caseLogSummary.procedures.map((p) => (
                      <li key={p.label}>
                        <p className="patient-meta">
                          {p.label}: {p.count}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Research projects ({projects.length})</h2>
        </div>
        {projects.length === 0 ? (
          <p className="empty-state">No research projects yet.</p>
        ) : (
          <ul className="note-timeline">
            {projects.map((p) => (
              <li key={p.id}>
                <div className="note-header">
                  <strong>{p.name}</strong>
                </div>
                <p className="patient-meta">
                  {toShamsi(p.createdDate)}
                  {p.studyDesign ? ` · ${p.studyDesign}` : ''}
                  {p.progress ? ` · ${p.progress}` : ''}
                </p>
                {p.researchQuestion && <p className="patient-meta">{p.researchQuestion}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
