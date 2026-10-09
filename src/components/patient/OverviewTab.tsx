import { useEffect, useMemo, useState } from 'react'
import { listMedications } from '../../lib/api/medications'
import { listProgressNotes } from '../../lib/api/notes'
import { listImagingEntries } from '../../lib/api/imaging'
import { listPatientDocuments } from '../../lib/api/patientDocuments'
import { listRemindersForPatient } from '../../lib/api/reminders'
import { listFollowUpItems } from '../../lib/api/followUps'
import { listVaccinations } from '../../lib/api/vaccinations'
import { DEFAULT_USER_SETTINGS, getUserSettings } from '../../lib/api/settings'
import { getImagingSignedUrl, getPatientDocumentSignedUrl } from '../../lib/storage'
import { computePatientAlerts } from '../../lib/patientAlerts'
import { toShamsi } from '../../lib/shamsi'
import { KidneyFunctionTrend } from './KidneyFunctionTrend'
import { LinkedTopicsWidget } from './LinkedTopicsWidget'
import { LabsIcon, NotesIcon, MedicationsIcon, ImagingIcon, DocumentIcon, RemindersIcon } from '../icons'
import type { Tab } from '../../pages/PatientDetailPage'
import type {
  FollowUpItem,
  ImagingEntry,
  LabEntry,
  Medication,
  PatientDocument,
  PatientReminder,
  ProgressNote,
  Patient,
  Vaccination,
} from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
  labEntries: LabEntry[]
  onNavigate?: (tab: Tab) => void
}

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(path)
}

export function OverviewTab({ patientId, patient, labEntries, onNavigate }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [notes, setNotes] = useState<ProgressNote[]>([])
  const [imagingEntries, setImagingEntries] = useState<ImagingEntry[]>([])
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [reminders, setReminders] = useState<PatientReminder[]>([])
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([])
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [settings, setSettings] = useState(DEFAULT_USER_SETTINGS)
  const [imagingUrls, setImagingUrls] = useState<Record<string, string>>({})
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listMedications(patientId),
      listProgressNotes(patientId),
      listImagingEntries(patientId),
      listPatientDocuments(patientId),
      listRemindersForPatient(patientId),
      listFollowUpItems(patientId),
      listVaccinations(patientId),
    ])
      .then(([meds, notesRows, imaging, docs, reminderRows, followUps, vaccinationRows]) => {
        setMedications(meds)
        setNotes(notesRows)
        setImagingEntries(imaging)
        setDocuments(docs)
        setReminders(reminderRows)
        setFollowUpItems(followUps)
        setVaccinations(vaccinationRows)
        imaging.forEach((img) => {
          if (!img.storagePath) return
          getImagingSignedUrl(img.storagePath)
            .then((url) => setImagingUrls((prev) => ({ ...prev, [img.id]: url })))
            .catch(() => undefined)
        })
        docs.forEach((doc) => {
          getPatientDocumentSignedUrl(doc.storagePath)
            .then((url) => setDocumentUrls((prev) => ({ ...prev, [doc.id]: url })))
            .catch(() => undefined)
        })
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load overview'))
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    getUserSettings()
      .then(setSettings)
      .catch(() => undefined)
  }, [])

  const latestLabPerTest = useMemo(() => {
    const map = new Map<string, LabEntry>()
    for (const e of labEntries) {
      const existing = map.get(e.test)
      if (!existing || e.date > existing.date) map.set(e.test, e)
    }
    return Array.from(map.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 12)
  }, [labEntries])

  const activeMeds = medications.filter((m) => m.active)
  const recentNotes = [...notes].reverse().slice(0, 3)
  const upcomingReminders = reminders
    .filter((r) => !r.done)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, 5)

  const alerts = useMemo(
    () =>
      computePatientAlerts({
        patient,
        labEntries,
        activeMedNames: activeMeds.map((m) => m.name.toLowerCase()),
        settings,
        followUpItems,
        imagingEntries,
        reminders,
        vaccinations,
      }),
    [patient, labEntries, activeMeds, settings, followUpItems, imagingEntries, reminders, vaccinations]
  )

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  const sections = [
    { key: 'labs', empty: latestLabPerTest.length === 0, icon: LabsIcon, label: 'Labs', emptyText: 'No labs yet', tab: 'labs' as Tab },
    { key: 'notes', empty: recentNotes.length === 0, icon: NotesIcon, label: 'Progress note', emptyText: 'No notes yet', tab: 'notes' as Tab },
    {
      key: 'medications',
      empty: activeMeds.length === 0,
      icon: MedicationsIcon,
      label: 'Medication',
      emptyText: 'None active',
      tab: 'medications' as Tab,
    },
    {
      key: 'imaging',
      empty: imagingEntries.length === 0,
      icon: ImagingIcon,
      label: 'Imaging',
      emptyText: 'None recorded',
      tab: 'imaging' as Tab,
    },
    {
      key: 'documents',
      empty: documents.length === 0,
      icon: DocumentIcon,
      label: 'Document / photo',
      emptyText: 'None uploaded',
      tab: 'document' as Tab,
    },
    {
      key: 'reminders',
      empty: reminders.length === 0,
      icon: RemindersIcon,
      label: 'Reminder',
      emptyText: 'None pending',
      tab: 'reminders' as Tab,
    },
  ]
  const emptySections = sections.filter((s) => s.empty)

  return (
    <div className="np-grid2">
      <section className="np-card np-fade" style={{ animationDelay: '.14s' }}>
        <h2>Alerts &amp; follow-ups</h2>
        {alerts.length === 0 ? (
          <div className="pc-topicr" style={{ borderStyle: 'solid', background: '#E9F7EF', borderColor: '#B6E2C7', color: '#17663A', cursor: 'default' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="4" width="14" height="18" rx="2" />
              <path d="M9 2h6v4H9zM9 14l2 2 4-4" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Nothing needs attention right now.</span>
          </div>
        ) : (
          <ul className="study-link-list">
            {alerts.map((a) => (
              <li key={a.id} className={a.severity === 'warning' ? 'value-abnormal' : undefined}>
                <span>
                  {a.severity === 'warning' ? '⚠ ' : ''}
                  {a.text}
                </span>
                {onNavigate && (
                  <button type="button" className="link-button" onClick={() => onNavigate(a.tab)}>
                    Open
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="np-card np-fade" style={{ animationDelay: '.18s' }}>
        <h2>Diagnosis</h2>
        <div className="pc-dx">
          <div>
            <span>DIAGNOSIS</span>
            <b>{patient.diagnosis || '—'}</b>
          </div>
          <div>
            <span>UNDERLYING DISEASE</span>
            <b>{patient.underlyingDisease || '—'}</b>
          </div>
          <div>
            <span>STATUS</span>
            <b style={!patient.dialysisStatus && !patient.transplantStatus ? { color: '#A3AEBF' } : undefined}>
              {[patient.dialysisStatus, patient.transplantStatus].filter(Boolean).join(' · ') || '—'}
            </b>
            {onNavigate && (
              <button type="button" className="pc-linkb" onClick={() => onNavigate('assessment')}>
                Set status
              </button>
            )}
          </div>
          <div>
            <span>BASELINE CR / EGFR</span>
            <b style={patient.baselineCr == null && patient.baselineEGFR == null ? { color: '#A3AEBF' } : undefined}>
              {[patient.baselineCr, patient.baselineEGFR].filter((v) => v != null).join(' / ') || '—'}
            </b>
            {onNavigate && (
              <button type="button" className="pc-linkb" onClick={() => onNavigate('assessment')}>
                Set baseline
              </button>
            )}
          </div>
        </div>
      </section>

      <KidneyFunctionTrend labEntries={labEntries} patient={patient} />

      {emptySections.length > 0 && (
        <section className="np-card np-fade pc-wide" style={{ animationDelay: '.26s' }}>
          <div className="np-head">
            <h2>Add to this chart</h2>
            <span className="np-small">Nothing recorded yet in these sections</span>
          </div>
          <div className="pc-qa">
            {emptySections.map((s) => {
              const SIcon = s.icon
              return (
                <button key={s.key} type="button" className="pc-qai" onClick={() => onNavigate?.(s.tab)}>
                  <span className="np-ic">
                    <SIcon />
                  </span>
                  <span>
                    {s.label}
                    <span className="np-small">{s.emptyText}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {latestLabPerTest.length > 0 && (
        <section className="np-card np-fade" style={{ animationDelay: '.3s' }}>
          <div className="np-head">
            <h2>Recent labs</h2>
            <span className="np-small">Latest value per test</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Value</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {latestLabPerTest.map((e) => (
                  <tr key={e.id}>
                    <td>{e.test}</td>
                    <td>
                      {e.valueText ?? e.value ?? '—'} {e.unit ?? ''}
                    </td>
                    <td>{toShamsi(e.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {recentNotes.length > 0 && (
        <section className="np-card np-fade" style={{ animationDelay: '.3s' }}>
          <h2>Recent progress notes</h2>
          <ul className="note-timeline">
            {recentNotes.map((n) => (
              <li key={n.id}>
                <div className="note-header">
                  <strong>{toShamsi(n.date)}</strong>
                  <span>{[n.weight != null ? `${n.weight} kg` : null, n.bp, n.uo].filter(Boolean).join(' · ')}</span>
                </div>
                <dl className="soap-grid">
                  <dt>A</dt>
                  <dd>{n.A || '—'}</dd>
                  <dt>P</dt>
                  <dd>{n.P || '—'}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeMeds.length > 0 && (
        <section className="np-card np-fade" style={{ animationDelay: '.3s' }}>
          <h2>Active medications</h2>
          <ul className="study-link-list">
            {activeMeds.map((m) => (
              <li key={m.id}>
                {m.name} {[m.dose, m.freq].filter(Boolean).join(' · ')}
              </li>
            ))}
          </ul>
        </section>
      )}

      {imagingEntries.length > 0 && (
        <section className="np-card np-fade" style={{ animationDelay: '.3s' }}>
          <h2>Imaging</h2>
          <ul className="study-link-list">
            {imagingEntries.map((img) => (
              <li key={img.id}>
                <div>
                  <strong>{img.category || 'Imaging'}</strong>
                  <span className="patient-meta"> {img.date ? toShamsi(img.date) : ''}</span>
                  {img.date && patient.doa && img.date < patient.doa && <span className="patient-meta"> (prior to this admission)</span>}
                  {img.impression && <p className="patient-meta">{img.impression}</p>}
                </div>
                {imagingUrls[img.id] && (
                  <a href={imagingUrls[img.id]} target="_blank" rel="noreferrer" className="study-link">
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {documents.length > 0 && (
        <section className="np-card np-fade" style={{ animationDelay: '.3s' }}>
          <h2>Documents &amp; photos</h2>
          <ul className="document-grid">
            {documents.map((doc) => (
              <li key={doc.id} className="document-card">
                <div className="document-card-preview">
                  {documentUrls[doc.id] ? (
                    isImagePath(doc.storagePath) ? (
                      <a href={documentUrls[doc.id]} target="_blank" rel="noreferrer">
                        <img src={documentUrls[doc.id]} alt={doc.filename ?? 'Document'} />
                      </a>
                    ) : (
                      <a href={documentUrls[doc.id]} target="_blank" rel="noreferrer" className="document-card-pdf">
                        Open PDF
                      </a>
                    )
                  ) : (
                    <span className="empty-state">Loading…</span>
                  )}
                </div>
                <span className="patient-meta">{toShamsi(doc.createdAt.slice(0, 10))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <LinkedTopicsWidget patientId={patientId} />

      <section className="np-card np-fade" style={{ animationDelay: '.34s' }}>
        <h2>Upcoming reminders</h2>
        {upcomingReminders.length === 0 ? (
          <>
            <span className="np-small">No pending reminders.</span>
            <button type="button" className="pc-topicr" onClick={() => onNavigate?.('reminders')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              Add reminder
            </button>
          </>
        ) : (
          <ul className="study-link-list">
            {upcomingReminders.map((r) => (
              <li key={r.id}>
                {r.title} — {toShamsi(r.eventDate)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
