import { useEffect, useMemo, useState } from 'react'
import { listGrowthEntries } from '../../lib/api/growth'
import { listLabEntries } from '../../lib/api/labs'
import { listMedications } from '../../lib/api/medications'
import { listProgressNotes } from '../../lib/api/notes'
import { listImagingEntries } from '../../lib/api/imaging'
import { listPatientDocuments } from '../../lib/api/patientDocuments'
import { listNephroticEvents } from '../../lib/api/nephroticEvents'
import { listRemindersForPatient } from '../../lib/api/reminders'
import { listFollowUpItems } from '../../lib/api/followUps'
import { DEFAULT_USER_SETTINGS, getUserSettings } from '../../lib/api/settings'
import { getImagingSignedUrl, getPatientDocumentSignedUrl } from '../../lib/storage'
import {
  ageInMonths,
  ageInYears,
  assessBloodPressure,
  heightForAgePercentile,
  normalizeSex,
  percentileLabel,
  weightForAgePercentile,
} from '../../lib/growth'
import { classifyNephroticSyndrome, NEPHROTIC_CLASSIFICATION_LABEL } from '../../lib/nephroticSyndrome'
import { computePatientAlerts, type AlertTab } from '../../lib/patientAlerts'
import { toShamsi } from '../../lib/shamsi'
import type {
  FollowUpItem,
  GrowthEntry,
  ImagingEntry,
  LabEntry,
  Medication,
  NephroticEvent,
  PatientDocument,
  PatientReminder,
  ProgressNote,
  Patient,
} from '../../types/domain'

interface Props {
  patientId: string
  patient: Patient
  onNavigate?: (tab: AlertTab) => void
}

function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(path)
}

export function OverviewTab({ patientId, patient, onNavigate }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [growthEntries, setGrowthEntries] = useState<GrowthEntry[]>([])
  const [labEntries, setLabEntries] = useState<LabEntry[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [notes, setNotes] = useState<ProgressNote[]>([])
  const [imagingEntries, setImagingEntries] = useState<ImagingEntry[]>([])
  const [documents, setDocuments] = useState<PatientDocument[]>([])
  const [nephroticEvents, setNephroticEvents] = useState<NephroticEvent[]>([])
  const [reminders, setReminders] = useState<PatientReminder[]>([])
  const [followUpItems, setFollowUpItems] = useState<FollowUpItem[]>([])
  const [settings, setSettings] = useState(DEFAULT_USER_SETTINGS)
  const [imagingUrls, setImagingUrls] = useState<Record<string, string>>({})
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listGrowthEntries(patientId),
      listLabEntries(patientId),
      listMedications(patientId),
      listProgressNotes(patientId),
      listImagingEntries(patientId),
      listPatientDocuments(patientId),
      listNephroticEvents(patientId),
      listRemindersForPatient(patientId),
      listFollowUpItems(patientId),
    ])
      .then(([growth, labs, meds, notesRows, imaging, docs, nephrotic, reminderRows, followUps]) => {
        setGrowthEntries(growth)
        setLabEntries(labs)
        setMedications(meds)
        setNotes(notesRows)
        setImagingEntries(imaging)
        setDocuments(docs)
        setNephroticEvents(nephrotic)
        setReminders(reminderRows)
        setFollowUpItems(followUps)
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

  const sex = normalizeSex(patient.sex)
  const dob = patient.dob

  const latestGrowth = growthEntries.length > 0 ? growthEntries[growthEntries.length - 1] : null
  const growthComputed = useMemo(() => {
    if (!latestGrowth || !dob || !sex) return null
    const months = ageInMonths(dob, latestGrowth.date)
    const years = ageInYears(dob, latestGrowth.date)
    if (months == null || years == null) return null
    const heightPct = latestGrowth.heightCm != null ? heightForAgePercentile(latestGrowth.heightCm, months, sex) : null
    const weightPct = latestGrowth.weightKg != null ? weightForAgePercentile(latestGrowth.weightKg, months, sex) : null
    const bp =
      latestGrowth.bpSystolic != null && latestGrowth.bpDiastolic != null
        ? assessBloodPressure(latestGrowth.bpSystolic, latestGrowth.bpDiastolic, years, sex, heightPct)
        : null
    return { heightPct, weightPct, bp }
  }, [latestGrowth, dob, sex])

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
  const nephroticClass = nephroticEvents.length > 0 ? classifyNephroticSyndrome(nephroticEvents) : null

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
      }),
    [patient, labEntries, activeMeds, settings, followUpItems, imagingEntries, reminders]
  )

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  return (
    <div>
      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Alerts & follow-ups</h2>
        </div>
        {alerts.length === 0 ? (
          <p className="empty-state">Nothing needs attention right now.</p>
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
      </div>

      <div className="calc-strip">
        <div>
          <span className="calc-label">Diagnosis</span>
          <span className="calc-value">{patient.diagnosis || '—'}</span>
        </div>
        <div>
          <span className="calc-label">Underlying disease</span>
          <span className="calc-value">{patient.underlyingDisease || '—'}</span>
        </div>
        <div>
          <span className="calc-label">Status</span>
          <span className="calc-value">
            {[patient.dialysisStatus, patient.transplantStatus].filter(Boolean).join(' · ') || '—'}
          </span>
        </div>
        <div>
          <span className="calc-label">Baseline Cr / eGFR</span>
          <span className="calc-value">
            {[patient.baselineCr, patient.baselineEGFR].filter((v) => v != null).join(' / ') || '—'}
          </span>
        </div>
      </div>

      {latestGrowth && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Latest growth & vitals</h2>
            <span className="patient-meta">{toShamsi(latestGrowth.date)}</span>
          </div>
          <ul className="study-link-list">
            {latestGrowth.heightCm != null && (
              <li>
                Height: {latestGrowth.heightCm} cm
                {growthComputed?.heightPct != null ? ` (${percentileLabel(growthComputed.heightPct)})` : ''}
              </li>
            )}
            {latestGrowth.weightKg != null && (
              <li>
                Weight: {latestGrowth.weightKg} kg
                {growthComputed?.weightPct != null ? ` (${percentileLabel(growthComputed.weightPct)})` : ''}
              </li>
            )}
            {latestGrowth.headCircCm != null && <li>Head circumference: {latestGrowth.headCircCm} cm</li>}
            {latestGrowth.bpSystolic != null && latestGrowth.bpDiastolic != null && (
              <li className={growthComputed?.bp && growthComputed.bp.category !== 'normal' ? 'value-abnormal' : ''}>
                BP: {latestGrowth.bpSystolic}/{latestGrowth.bpDiastolic}
                {growthComputed?.bp ? ` (${growthComputed.bp.label})` : ''}
              </li>
            )}
          </ul>
        </div>
      )}

      {nephroticClass && (
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Nephrotic syndrome</h2>
          </div>
          <p className="patient-meta">{NEPHROTIC_CLASSIFICATION_LABEL[nephroticClass]}</p>
        </div>
      )}

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Active medications</h2>
        </div>
        {activeMeds.length === 0 ? (
          <p className="empty-state">No active medications.</p>
        ) : (
          <ul className="study-link-list">
            {activeMeds.map((m) => (
              <li key={m.id}>
                {m.name} {[m.dose, m.freq].filter(Boolean).join(' · ')}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Recent labs</h2>
          <span className="patient-meta">Latest value per test</span>
        </div>
        {latestLabPerTest.length === 0 ? (
          <p className="empty-state">No labs recorded yet.</p>
        ) : (
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
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Recent progress notes</h2>
        </div>
        {recentNotes.length === 0 ? (
          <p className="empty-state">No progress notes yet.</p>
        ) : (
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
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Imaging</h2>
        </div>
        {imagingEntries.length === 0 ? (
          <p className="empty-state">No imaging recorded yet.</p>
        ) : (
          <ul className="study-link-list">
            {imagingEntries.map((img) => (
              <li key={img.id}>
                <div>
                  <strong>{img.category || 'Imaging'}</strong>
                  <span className="patient-meta"> {img.date ? toShamsi(img.date) : ''}</span>
                  {img.date && patient.doa && img.date < patient.doa && (
                    <span className="patient-meta"> (prior to this admission)</span>
                  )}
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
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Documents & photos</h2>
        </div>
        {documents.length === 0 ? (
          <p className="empty-state">No documents uploaded yet.</p>
        ) : (
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
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h2 className="dash-card-title">Upcoming reminders</h2>
        </div>
        {upcomingReminders.length === 0 ? (
          <p className="empty-state">No pending reminders.</p>
        ) : (
          <ul className="study-link-list">
            {upcomingReminders.map((r) => (
              <li key={r.id}>
                {r.title} — {toShamsi(r.eventDate)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="empty-state">This is a read-only summary. Use the tabs above to add or edit information.</p>
    </div>
  )
}
