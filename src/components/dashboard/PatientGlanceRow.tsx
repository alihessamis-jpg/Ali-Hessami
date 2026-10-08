import { Link } from 'react-router-dom'
import { useCountUp } from '../../hooks/useCountUp'
import { formatAge } from '../../lib/patientAge'
import { KidneyIcon } from '../icons'
import type { PatientGlance } from '../../lib/api/dashboard'

export function PatientGlanceRow({
  patient,
  severity,
}: {
  patient: PatientGlance
  severity: 'critical' | 'warning' | undefined
}) {
  const creatinine = useCountUp(patient.latestCreatinine?.value)
  const egfr = useCountUp(patient.latestEGFR)

  return (
    <Link to={`/patients/${patient.id}`} className="glance-row">
      <span className={`glance-avatar glance-avatar--icon glance-avatar--${severity ?? 'neutral'}`}>
        <KidneyIcon />
      </span>
      <span className="glance-body">
        <span className="glance-name">
          {patient.name}
          {severity && (
            <span className={`status-badge status-badge--renal-${severity === 'critical' ? 'yes' : 'review'}`}>
              {severity === 'critical' ? 'Critical' : 'Follow-up'}
            </span>
          )}
        </span>
        <span className="glance-meta">
          {[formatAge(patient.age), patient.bed, patient.diagnosis].filter(Boolean).join(' · ') || 'No details yet'}
        </span>
      </span>
      {(patient.latestCreatinine || patient.latestEGFR != null) && (
        <span className="glance-stats">
          {creatinine != null && <strong>Cr {creatinine.toFixed(2)}</strong>}
          {egfr != null && <span>eGFR {egfr.toFixed(1)}</span>}
        </span>
      )}
    </Link>
  )
}
