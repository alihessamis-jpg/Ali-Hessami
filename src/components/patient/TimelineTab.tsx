import { useEffect, useMemo, useState } from 'react'
import type { ComponentType, SVGProps } from 'react'
import { listGrowthEntries } from '../../lib/api/growth'
import { listLabEntries } from '../../lib/api/labs'
import { listMedications } from '../../lib/api/medications'
import { listProgressNotes } from '../../lib/api/notes'
import { listImagingEntries } from '../../lib/api/imaging'
import { listUrineOutputEntries } from '../../lib/api/urineOutput'
import { listHdSessions } from '../../lib/api/hdSessions'
import { listPdPrescriptions } from '../../lib/api/pdPrescriptions'
import { listPdPeritonitisEpisodes } from '../../lib/api/pdPeritonitis'
import { listVaccinations } from '../../lib/api/vaccinations'
import { listNephroticEvents } from '../../lib/api/nephroticEvents'
import { listFollowUpItems } from '../../lib/api/followUps'
import { listLusStudySessionsForPatient } from '../../lib/api/lusStudy'
import { toShamsi } from '../../lib/shamsi'
import {
  DialysisIcon,
  DropletIcon,
  FollowUpIcon,
  GrowthIcon,
  ImagingIcon,
  KidneyIcon,
  LabsIcon,
  MedicationsIcon,
  NotesIcon,
  UltrasoundIcon,
  VaccineIcon,
} from '../icons'
import type {
  FollowUpItem,
  GrowthEntry,
  HdSession,
  ImagingEntry,
  LabEntry,
  Medication,
  NephroticEvent,
  PdPeritonitisEpisode,
  PdPrescription,
  ProgressNote,
  UrineOutputEntry,
  Vaccination,
} from '../../types/domain'
import type { LusStudySessionWithPatient } from '../../lib/api/lusStudy'

interface Props {
  patientId: string
}

type TimelineCategory =
  | 'lab'
  | 'note'
  | 'medication'
  | 'imaging'
  | 'growth'
  | 'urineOutput'
  | 'dialysis'
  | 'vaccination'
  | 'nephrotic'
  | 'followUp'
  | 'lusStudy'

interface TimelineEvent {
  id: string
  date: string
  category: TimelineCategory
  title: string
  detail?: string
}

const CATEGORY_META: Record<TimelineCategory, { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  lab: { label: 'Labs', icon: LabsIcon },
  note: { label: 'Progress notes', icon: NotesIcon },
  medication: { label: 'Medications', icon: MedicationsIcon },
  imaging: { label: 'Imaging', icon: ImagingIcon },
  growth: { label: 'Growth & vitals', icon: GrowthIcon },
  urineOutput: { label: 'Urine output', icon: DropletIcon },
  dialysis: { label: 'Dialysis', icon: DialysisIcon },
  vaccination: { label: 'Vaccinations', icon: VaccineIcon },
  nephrotic: { label: 'Nephrotic syndrome', icon: KidneyIcon },
  followUp: { label: 'Follow-up', icon: FollowUpIcon },
  lusStudy: { label: 'LUS study', icon: UltrasoundIcon },
}

const NEPHROTIC_EVENT_LABEL: Record<NephroticEvent['eventType'], string> = {
  diagnosis: 'Nephrotic syndrome diagnosed',
  relapse: 'Nephrotic syndrome relapse',
  remission: 'Nephrotic syndrome remission',
  no_response_4wk: 'No response at 4 weeks',
}

function buildLabEvents(entries: LabEntry[]): TimelineEvent[] {
  const byDate = new Map<string, LabEntry[]>()
  for (const e of entries) {
    if (!e.date) continue
    const list = byDate.get(e.date) ?? []
    list.push(e)
    byDate.set(e.date, list)
  }
  return Array.from(byDate.entries()).map(([date, rows]) => {
    const names = rows.map((r) => r.test)
    const shown = names.slice(0, 6).join(', ')
    const more = names.length > 6 ? ` +${names.length - 6} more` : ''
    return {
      id: `lab-${date}`,
      date,
      category: 'lab',
      title: `Labs (${rows.length})`,
      detail: `${shown}${more}`,
    }
  })
}

function buildNoteEvents(notes: ProgressNote[]): TimelineEvent[] {
  return notes.map((n) => ({
    id: `note-${n.id}`,
    date: n.date,
    category: 'note',
    title: 'Progress note',
    detail: n.A || n.P || n.S || n.O || undefined,
  }))
}

function buildMedicationEvents(meds: Medication[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  for (const m of meds) {
    const strength = [m.dose, m.route, m.freq].filter(Boolean).join(' · ')
    if (m.start) {
      events.push({
        id: `med-start-${m.id}`,
        date: m.start,
        category: 'medication',
        title: `Started ${m.name}`,
        detail: strength || undefined,
      })
    }
    if (m.stop && m.stop !== m.start) {
      events.push({
        id: `med-stop-${m.id}`,
        date: m.stop,
        category: 'medication',
        title: `Stopped ${m.name}`,
      })
    }
  }
  return events
}

function buildImagingEvents(entries: ImagingEntry[]): TimelineEvent[] {
  return entries
    .filter((e): e is ImagingEntry & { date: string } => !!e.date)
    .map((e) => ({
      id: `imaging-${e.id}`,
      date: e.date,
      category: 'imaging',
      title: e.category ? `${e.category} imaging` : 'Imaging',
      detail: e.impression || e.notes || undefined,
    }))
}

function buildGrowthEvents(entries: GrowthEntry[]): TimelineEvent[] {
  return entries.map((e) => {
    const parts: string[] = []
    if (e.heightCm != null) parts.push(`Ht ${e.heightCm}cm`)
    if (e.weightKg != null) parts.push(`Wt ${e.weightKg}kg`)
    if (e.headCircCm != null) parts.push(`HC ${e.headCircCm}cm`)
    if (e.bpSystolic != null && e.bpDiastolic != null) parts.push(`BP ${e.bpSystolic}/${e.bpDiastolic}`)
    return {
      id: `growth-${e.id}`,
      date: e.date,
      category: 'growth',
      title: 'Growth & vitals check',
      detail: parts.join(' · ') || undefined,
    }
  })
}

function buildUrineOutputEvents(entries: UrineOutputEntry[]): TimelineEvent[] {
  return entries.map((e) => ({
    id: `uo-${e.id}`,
    date: e.recordedAt.slice(0, 10),
    category: 'urineOutput',
    title: 'Urine output',
    detail: `${e.volumeMl} mL / ${e.durationHours}h`,
  }))
}

function buildHdEvents(sessions: HdSession[]): TimelineEvent[] {
  return sessions.map((s) => {
    const parts: string[] = []
    if (s.preWeightKg != null) parts.push(`Pre ${s.preWeightKg}kg`)
    if (s.postWeightKg != null) parts.push(`Post ${s.postWeightKg}kg`)
    if (s.ufAchievedMl != null) parts.push(`UF ${s.ufAchievedMl}mL`)
    return {
      id: `hd-${s.id}`,
      date: s.date,
      category: 'dialysis',
      title: 'Hemodialysis session',
      detail: parts.join(' · ') || undefined,
    }
  })
}

function buildPdPrescriptionEvents(rows: PdPrescription[]): TimelineEvent[] {
  return rows.map((p) => {
    const parts: string[] = []
    if (p.modality) parts.push(p.modality)
    if (p.fillVolumeMl != null) parts.push(`Fill ${p.fillVolumeMl}mL`)
    if (p.exchangesPerDay != null) parts.push(`${p.exchangesPerDay}x/day`)
    return {
      id: `pdrx-${p.id}`,
      date: p.date,
      category: 'dialysis',
      title: 'PD prescription',
      detail: parts.join(' · ') || undefined,
    }
  })
}

function buildPdPeritonitisEvents(episodes: PdPeritonitisEpisode[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  for (const ep of episodes) {
    events.push({
      id: `pdperi-onset-${ep.id}`,
      date: ep.onsetDate,
      category: 'dialysis',
      title: 'PD peritonitis (onset)',
      detail: ep.organism || undefined,
    })
    if (ep.resolutionDate) {
      events.push({
        id: `pdperi-resolved-${ep.id}`,
        date: ep.resolutionDate,
        category: 'dialysis',
        title: 'PD peritonitis resolved',
        detail: ep.outcome || undefined,
      })
    }
  }
  return events
}

function buildVaccinationEvents(rows: Vaccination[]): TimelineEvent[] {
  return rows.map((v) => ({
    id: `vax-${v.id}`,
    date: v.dateGiven,
    category: 'vaccination',
    title: `Vaccination: ${v.vaccineName}`,
    detail: v.doseNumber ? `Dose ${v.doseNumber}` : undefined,
  }))
}

function buildNephroticEvents(rows: NephroticEvent[]): TimelineEvent[] {
  return rows.map((e) => ({
    id: `nephrotic-${e.id}`,
    date: e.date,
    category: 'nephrotic',
    title: NEPHROTIC_EVENT_LABEL[e.eventType],
    detail: e.duringTaper ? 'During steroid taper' : undefined,
  }))
}

function buildFollowUpEvents(rows: FollowUpItem[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  for (const f of rows) {
    events.push({
      id: `followup-ordered-${f.id}`,
      date: f.orderedDate,
      category: 'followUp',
      title: `Follow-up ordered: ${f.description}`,
    })
    if (f.resolved && f.resolvedDate) {
      events.push({
        id: `followup-resolved-${f.id}`,
        date: f.resolvedDate,
        category: 'followUp',
        title: `Follow-up resolved: ${f.description}`,
      })
    }
  }
  return events
}

function buildLusStudyEvents(sessions: LusStudySessionWithPatient[]): TimelineEvent[] {
  return sessions.map((s) => {
    const parts: string[] = []
    if (s.preLusTotal != null) parts.push(`Pre-LUS ${s.preLusTotal}`)
    if (s.postLusTotal != null) parts.push(`Post-LUS ${s.postLusTotal}`)
    return {
      id: `lus-${s.id}`,
      date: s.sessionDate,
      category: 'lusStudy',
      title: 'LUS study session',
      detail: parts.join(' → ') || undefined,
    }
  })
}

export function TimelineTab({ patientId }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<TimelineCategory | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      listLabEntries(patientId),
      listProgressNotes(patientId),
      listMedications(patientId),
      listImagingEntries(patientId),
      listGrowthEntries(patientId),
      listUrineOutputEntries(patientId),
      listHdSessions(patientId),
      listPdPrescriptions(patientId),
      listPdPeritonitisEpisodes(patientId),
      listVaccinations(patientId),
      listNephroticEvents(patientId),
      listFollowUpItems(patientId),
      listLusStudySessionsForPatient(patientId),
    ])
      .then(([labs, notes, meds, imaging, growth, urineOutput, hd, pdRx, pdPeritonitis, vaccinations, nephrotic, followUps, lus]) => {
        setEvents(
          [
            ...buildLabEvents(labs),
            ...buildNoteEvents(notes),
            ...buildMedicationEvents(meds),
            ...buildImagingEvents(imaging),
            ...buildGrowthEvents(growth),
            ...buildUrineOutputEvents(urineOutput),
            ...buildHdEvents(hd),
            ...buildPdPrescriptionEvents(pdRx),
            ...buildPdPeritonitisEvents(pdPeritonitis),
            ...buildVaccinationEvents(vaccinations),
            ...buildNephroticEvents(nephrotic),
            ...buildFollowUpEvents(followUps),
            ...buildLusStudyEvents(lus),
          ].filter((e) => !!e.date)
        )
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load timeline'))
      .finally(() => setLoading(false))
  }, [patientId])

  const sorted = useMemo(() => [...events].sort((a, b) => b.date.localeCompare(a.date)), [events])

  const counts = useMemo(() => {
    const map = new Map<TimelineCategory, number>()
    for (const e of events) map.set(e.category, (map.get(e.category) ?? 0) + 1)
    return map
  }, [events])

  const visible = useMemo(
    () => (activeCategory ? sorted.filter((e) => e.category === activeCategory) : sorted),
    [sorted, activeCategory]
  )

  if (loading) return <p>Loading…</p>
  if (error) return <p className="form-error">{error}</p>

  return (
    <div>
      {events.length === 0 ? (
        <p className="empty-state">No recorded events yet for this patient.</p>
      ) : (
        <>
          <div className="category-pills">
            <button
              className={activeCategory === null ? 'category-pill active' : 'category-pill'}
              onClick={() => setActiveCategory(null)}
            >
              All ({events.length})
            </button>
            {(Object.keys(CATEGORY_META) as TimelineCategory[])
              .filter((cat) => (counts.get(cat) ?? 0) > 0)
              .map((cat) => (
                <button
                  key={cat}
                  className={activeCategory === cat ? 'category-pill active' : 'category-pill'}
                  onClick={() => setActiveCategory(cat)}
                >
                  {CATEGORY_META[cat].label} ({counts.get(cat)})
                </button>
              ))}
          </div>

          <ul className="timeline-list">
            {visible.map((e) => {
              const meta = CATEGORY_META[e.category]
              const EventIcon = meta.icon
              return (
                <li key={e.id} className="timeline-item">
                  <span className="timeline-icon">
                    <EventIcon />
                  </span>
                  <div className="timeline-content">
                    <div className="timeline-item-header">
                      <span className="timeline-title">{e.title}</span>
                      <span className="timeline-date">{toShamsi(e.date)}</span>
                    </div>
                    {e.detail && <p className="timeline-detail">{e.detail}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
