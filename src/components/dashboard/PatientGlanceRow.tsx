import { Link } from 'react-router-dom'
import { useCountUp } from '../../hooks/useCountUp'
import { formatAge } from '../../lib/patientAge'
import { PersonIcon } from '../icons'
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
    <Link to={`/patients/${patient.id}`} className="dh-ptrow">
      <span className="dh-av">
        <PersonIcon />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b className="np-fa" style={{ fontSize: 15 }}>
            {patient.name}
          </b>
          {severity && (
            <span
              className="dh-ptrow-badge"
              style={
                severity === 'critical'
                  ? { background: '#FDE8E7', color: '#B42318' }
                  : { background: '#FDF0DC', color: '#93590B', animation: 'none' }
              }
            >
              {severity === 'critical' ? 'Critical' : 'Follow-up'}
            </span>
          )}
        </span>
        <span className="np-small">
          {[formatAge(patient.age), patient.bed, patient.diagnosis].filter(Boolean).join(' · ') || 'No details yet'}
        </span>
      </span>
      {(patient.latestCreatinine || patient.latestEGFR != null) && (
        <span className="dh-ptrow-stats">
          {creatinine != null && <b>Cr {creatinine.toFixed(2)}</b>}
          {egfr != null && <span className="np-small">eGFR {egfr.toFixed(1)}</span>}
        </span>
      )}
    </Link>
  )
}
