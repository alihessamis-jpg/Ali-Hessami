import { kdigoStage } from './formulas'
import { assessCkdMbd } from './ckdMbd'
import { assessAcidBase } from './acidBase'
import { assessCkdScreening } from './ckdScreening'
import { assessProteinuriaStatus } from './proteinuria'
import { assessNephriticWorkup } from './nephriticWorkup'
import { ageInYears } from './growth'
import { daysSince } from './dates'
import { procedureStatusesFor } from './procedureChecks'
import { toShamsi } from './shamsi'
import type { FollowUpItem, ImagingEntry, LabEntry, Patient, PatientReminder, UserSettings } from '../types/domain'

export type AlertTab = 'labs' | 'followUp' | 'reminders'

export interface PatientAlert {
  id: string
  severity: 'warning' | 'info'
  text: string
  tab: AlertTab
}

export interface PatientAlertsInput {
  patient: Patient
  labEntries: LabEntry[]
  activeMedNames: string[]
  settings: UserSettings
  followUpItems: FollowUpItem[]
  imagingEntries: ImagingEntry[]
  reminders: PatientReminder[]
}

// Pulls together the same pure detection logic already used by the Labs,
// Follow-up, and Reminders tabs into one compact list, so the Overview tab
// can surface everything that needs attention without re-deriving any of
// the underlying clinical rules itself.
export function computePatientAlerts(input: PatientAlertsInput): PatientAlert[] {
  const { patient, labEntries, activeMedNames, settings, followUpItems, imagingEntries, reminders } = input
  const alerts: PatientAlert[] = []

  const hbEntries = labEntries.filter((e) => e.test === 'Hemoglobin' && e.value != null)
  if (hbEntries.length > 0) {
    const latest = hbEntries.reduce((a, b) => (b.date > a.date ? b : a))
    if (latest.value! < settings.anemiaHbThreshold) {
      alerts.push({
        id: 'anemia',
        severity: 'warning',
        text: `Severe anemia — Hb ${latest.value} ${latest.unit || 'g/dL'} (${toShamsi(latest.date)})`,
        tab: 'labs',
      })
    }
  }

  const crEntries = labEntries.filter((e) => e.test === 'Creatinine' && e.value != null)
  if (patient.baselineCr && crEntries.length > 0) {
    const latestCr = crEntries.reduce((a, b) => (b.date > a.date ? b : a))
    const stage = kdigoStage(patient.baselineCr, latestCr.value!, !!patient.dialysisStatus)
    if (stage) alerts.push({ id: 'aki', severity: 'warning', text: `AKI Stage ${stage} (KDIGO)`, tab: 'labs' })
  }

  const proteinuria = assessProteinuriaStatus(labEntries)
  if (proteinuria && proteinuria.cls !== 'normal') {
    alerts.push({
      id: 'proteinuria',
      severity: proteinuria.cls === 'nephrotic-range' ? 'warning' : 'info',
      text: proteinuria.label,
      tab: 'labs',
    })
  }

  if (assessNephriticWorkup(labEntries)) {
    alerts.push({ id: 'nephritic', severity: 'warning', text: 'Nephritic syndrome workup in progress — hematuria detected', tab: 'labs' })
  }

  const renalFailure = !!patient.baselineCr || !!patient.baselineEGFR
  if (renalFailure) {
    const ageYears = patient.dob ? ageInYears(patient.dob, new Date().toISOString().slice(0, 10)) : null
    const ckdMbd = assessCkdMbd(labEntries, ageYears, activeMedNames, {
      caLowMgDl: settings.ckdMbdCaLow,
      caHighMgDl: settings.ckdMbdCaHigh,
      pthHighPgMl: settings.ckdMbdPthHigh,
      pthLowPgMl: settings.ckdMbdPthLow,
      vitDDeficientNgMl: settings.ckdMbdVitDDeficient,
      vitDInsufficientNgMl: settings.ckdMbdVitDInsufficient,
      bicarbLowMeqL: settings.ckdMbdBicarbLow,
      phosphate: {
        under1yMgDl: settings.phosphateUnder1y,
        age1to3MgDl: settings.phosphateAge1to3,
        age3to10MgDl: settings.phosphateAge3to10,
        age10to17MgDl: settings.phosphateAge10to17,
        adultMgDl: settings.phosphateAdult,
      },
    })
    if (ckdMbd && ckdMbd.flags.length > 0) {
      alerts.push({
        id: 'ckd-mbd',
        severity: 'warning',
        text: `CKD-MBD: ${ckdMbd.flags.length} item${ckdMbd.flags.length === 1 ? '' : 's'} to address`,
        tab: 'labs',
      })
    }

    const acidBase = assessAcidBase(labEntries, settings.acidosisPhThreshold, settings.acidosisHco3Threshold)
    if (acidBase.needsBicarbTherapy) {
      alerts.push({ id: 'acidosis', severity: 'warning', text: 'Severe metabolic acidosis — start bicarbonate therapy', tab: 'labs' })
    } else if (!acidBase.ph && !acidBase.hco3) {
      alerts.push({ id: 'vbg', severity: 'info', text: 'Renal failure — no VBG on file, check pH/HCO3', tab: 'labs' })
    }

    const screening = assessCkdScreening(labEntries)
    if (screening.anemiaMissing.length > 0 || screening.mbdMissing.length > 0) {
      alerts.push({
        id: 'ckd-screening',
        severity: 'info',
        text: `CKD screening incomplete — missing ${[...screening.anemiaMissing, ...screening.mbdMissing].join(', ')}`,
        tab: 'labs',
      })
    }
  }

  const pendingFollowUps = followUpItems.filter((i) => !i.resolved)
  const overdueCultures = pendingFollowUps.filter((i) => i.category === 'culture' && daysSince(i.orderedDate) >= 2)
  for (const item of overdueCultures) {
    alerts.push({
      id: `followup-${item.id}`,
      severity: 'warning',
      text: `Follow up culture — ${item.description} (sent ${daysSince(item.orderedDate)}d ago)`,
      tab: 'followUp',
    })
  }
  const otherPending = pendingFollowUps.length - overdueCultures.length
  if (otherPending > 0) {
    alerts.push({
      id: 'followup-pending',
      severity: 'info',
      text: `${otherPending} follow-up item${otherPending === 1 ? '' : 's'} pending`,
      tab: 'followUp',
    })
  }

  const unreportedImaging = imagingEntries.filter((e) => !e.report && !e.impression)
  if (unreportedImaging.length > 0) {
    alerts.push({
      id: 'imaging-pending',
      severity: 'warning',
      text: `${unreportedImaging.length} imaging stud${unreportedImaging.length === 1 ? 'y' : 'ies'} awaiting report`,
      tab: 'followUp',
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  for (const r of reminders.filter((r) => !r.done)) {
    const overdue = r.eventDate < today
    alerts.push({
      id: `reminder-${r.id}`,
      severity: overdue ? 'warning' : 'info',
      text: `${r.title} — ${overdue ? 'overdue since' : 'due'} ${toShamsi(r.eventDate)}`,
      tab: 'reminders',
    })
    for (const status of procedureStatusesFor(r.title, labEntries, settings)) {
      if (status.cls === 'value-abnormal') {
        alerts.push({ id: `reminder-${r.id}-${status.text}`, severity: 'warning', text: `${r.title}: ${status.text}`, tab: 'reminders' })
      }
    }
  }

  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1))
}
