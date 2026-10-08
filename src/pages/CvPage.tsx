import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listAcademicActivities } from '../lib/api/academicActivities'
import { listCaseLogEntries } from '../lib/api/caseLog'
import { listResearchProjects } from '../lib/api/research'
import { groupAcademicActivities, summarizeCaseLog } from '../lib/cvBuilder'
import { toShamsi } from '../lib/shamsi'
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
  const navigate = useNavigate()
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
    <div className="np-page">
      <button type="button" className="np-backlink" onClick={() => navigate(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="m15 6-6 6 6 6" />
        </svg>
        Back
      </button>

      <section className="np-hero np-fade">
        <div className="np-glow blue" />
        <div className="np-hrow">
          <div className="np-txt">
            <h1>Academic CV</h1>
            <p className="np-sub">
              A live summary built from your activity log, case log and research — print it whenever you need an
              up-to-date portfolio.
            </p>
          </div>
          <svg className="np-art cv-paper" width="70" height="80" viewBox="0 0 70 80" fill="none" aria-hidden="true">
            <rect x="8" y="6" width="54" height="68" rx="8" fill="#FFFFFF" />
            <circle cx="24" cy="24" r="8" fill="#9CC2FF" />
            <path d="M38 20h16M38 28h10M18 44h34M18 52h34M18 60h22" stroke="#C9DAF5" strokeWidth={3.5} strokeLinecap="round" />
          </svg>
        </div>
        <button type="button" className="np-btn white" onClick={() => window.print()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Print / Save as PDF
        </button>
      </section>

      {error && <p className="form-error">{error}</p>}

      <div className="np-grid2">
        <section className="np-card np-fade" style={{ animationDelay: '.1s' }}>
          <h2>Publications, presentations &amp; activity</h2>
          {activityGroups.length === 0 ? (
            <span className="np-small">
              Nothing logged yet — add manuscripts, conference talks, posters, and journal clubs on the Academic
              Activity page.
            </span>
          ) : (
            activityGroups.map((group) => (
              <div key={group.category} className="cv-tl">
                <span className="cv-pin" />
                <span className="np-small" style={{ fontWeight: 700, letterSpacing: '.06em' }}>
                  {group.category.toUpperCase()} · {group.items.length}
                </span>
                {group.items.map((a) => (
                  <div key={a.id} className="cv-ent">
                    <div className="np-head">
                      <b style={{ fontSize: 15 }}>{a.title}</b>
                      {a.status && (
                        <span className="np-tag" style={{ color: '#1546A8', background: '#E3EDFD' }}>
                          {STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      )}
                    </div>
                    <span className="np-small">
                      <span className="fa">{toShamsi(a.date)}</span>
                      {a.role ? ` · ${a.role}` : ''}
                      {a.venue ? ` · ${a.venue}` : ''}
                    </span>
                    {a.notes && <span className="np-small">{a.notes}</span>}
                  </div>
                ))}
              </div>
            ))
          )}
        </section>

        <div className="np-stack">
          <section className="np-card cv-sum np-fade" style={{ animationDelay: '.16s', flexDirection: 'row' }}>
            <span className="np-ic" style={{ width: 42, height: 42, background: '#F1F4F9', color: '#6B7A90' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="4" width="14" height="18" rx="2" />
                <path d="M9 2h6v4H9zM9 11h6M9 15h6" />
              </svg>
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <h2 style={{ fontSize: 15 }}>Clinical experience</h2>
              <span className="np-small">
                {caseLogSummary.totalCases === 0
                  ? 'Fills in from your Case Log'
                  : `${caseLogSummary.totalCases} case${caseLogSummary.totalCases === 1 ? '' : 's'} · ${caseLogSummary.distinctDiagnoses} diagnos${caseLogSummary.distinctDiagnoses === 1 ? 'is' : 'es'}`}
              </span>
            </span>
          </section>

          {caseLogSummary.totalCases > 0 && (
            <section className="np-card np-fade" style={{ animationDelay: '.2s' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: 13 }}>By role</h2>
                  <div className="np-stack" style={{ gap: 2 }}>
                    {caseLogSummary.byRole.map((r) => (
                      <span className="np-small" key={r.label}>
                        {ROLE_LABEL[r.label] ?? r.label}: {r.count}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h2 style={{ fontSize: 13 }}>By category</h2>
                  <div className="np-stack" style={{ gap: 2 }}>
                    {caseLogSummary.byCategory.map((c) => (
                      <span className="np-small" key={c.label}>
                        {c.label}: {c.count}
                      </span>
                    ))}
                  </div>
                </div>
                {caseLogSummary.procedures.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: 13 }}>Procedures</h2>
                    <div className="np-stack" style={{ gap: 2 }}>
                      {caseLogSummary.procedures.map((p) => (
                        <span className="np-small" key={p.label}>
                          {p.label}: {p.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="np-card cv-sum np-fade" style={{ animationDelay: '.22s', flexDirection: 'row' }}>
            <span className="np-ic" style={{ width: 42, height: 42, background: '#F1F4F9', color: '#6B7A90' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 3h6M10 3v6L4 20h16L14 9V3M7 15h10" />
              </svg>
            </span>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <h2 style={{ fontSize: 15 }}>Research projects · {projects.length}</h2>
              <span className="np-small">Fills in from Research</span>
            </span>
          </section>

          {projects.length > 0 && (
            <section className="np-card np-fade" style={{ animationDelay: '.28s' }}>
              <div className="np-stack" style={{ gap: 10 }}>
                {projects.map((p) => (
                  <div key={p.id} className="cv-ent">
                    <b style={{ fontSize: 14 }}>{p.name}</b>
                    <span className="np-small">
                      <span className="fa">{toShamsi(p.createdDate)}</span>
                      {p.studyDesign ? ` · ${p.studyDesign}` : ''}
                      {p.progress ? ` · ${p.progress}` : ''}
                    </span>
                    {p.researchQuestion && <span className="np-small">{p.researchQuestion}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
