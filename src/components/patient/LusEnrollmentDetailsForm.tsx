import { useState, type FormEvent } from 'react'
import type {
  DialysisModality,
  LusStudyEnrollment,
  LusStudyEnrollmentDraft,
  LusStudyStatus,
  LusWithdrawalReason,
  VascularAccess,
} from '../../types/domain'
import { LUS_COMORBIDITIES, LUS_EXCLUSION_CRITERIA, LUS_INCLUSION_CRITERIA, WITHDRAWAL_LABELS } from '../../lib/lusStudyEnrollment'

interface Props {
  enrollment: LusStudyEnrollment
  onSaved: (draft: LusStudyEnrollmentDraft) => Promise<void> | void
  onCancel: () => void
}

function toggle(list: string[], item: string): string[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item]
}

export function LusEnrollmentDetailsForm({ enrollment, onSaved, onCancel }: Props) {
  const [consentDate, setConsentDate] = useState(enrollment.consentDate ?? '')
  const [childAssent, setChildAssent] = useState(!!enrollment.childAssent)
  const [randomizationCode, setRandomizationCode] = useState(enrollment.randomizationCode ?? '')
  const [inclusion, setInclusion] = useState<string[]>(enrollment.inclusionCriteria ?? [])
  const [exclusion, setExclusion] = useState<string[]>(enrollment.exclusionCriteriaPresent ?? [])
  const [modality, setModality] = useState<DialysisModality | ''>(enrollment.dialysisModality ?? '')
  const [access, setAccess] = useState<VascularAccess | ''>(enrollment.vascularAccess ?? '')
  const [sessionsPerWeek, setSessionsPerWeek] = useState(String(enrollment.sessionsPerWeek ?? ''))
  const [comorbidities, setComorbidities] = useState<string[]>(enrollment.comorbidities ?? [])
  const [antihtn, setAntihtn] = useState(enrollment.baselineAntihypertensives ?? '')
  const [antihtnCount, setAntihtnCount] = useState(String(enrollment.baselineAntihypertensiveCount ?? ''))
  const [status, setStatus] = useState<LusStudyStatus>(enrollment.studyStatus ?? 'active')
  const [withdrawalDate, setWithdrawalDate] = useState(enrollment.withdrawalDate ?? '')
  const [withdrawalReason, setWithdrawalReason] = useState<LusWithdrawalReason | ''>(enrollment.withdrawalReason ?? '')
  const [notes, setNotes] = useState(enrollment.notes ?? '')
  const [saving, setSaving] = useState(false)

  const eligible = inclusion.length === LUS_INCLUSION_CRITERIA.length && exclusion.length === 0

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSaved({
        patientId: enrollment.patientId,
        studyGroup: enrollment.studyGroup,
        enrollmentDate: enrollment.enrollmentDate,
        notes: notes || null,
        consentDate: consentDate || null,
        childAssent,
        randomizationCode: randomizationCode || null,
        inclusionCriteria: inclusion,
        exclusionCriteriaPresent: exclusion,
        dialysisModality: modality || null,
        vascularAccess: access || null,
        sessionsPerWeek: sessionsPerWeek === '' ? null : Number(sessionsPerWeek),
        comorbidities,
        baselineAntihypertensives: antihtn || null,
        baselineAntihypertensiveCount: antihtnCount === '' ? null : Number(antihtnCount),
        studyStatus: status,
        withdrawalDate: status === 'withdrawn' ? withdrawalDate || null : null,
        withdrawalReason: status === 'withdrawn' ? withdrawalReason || null : null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="soap-form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Consent &amp; randomization</h3>
        </div>
        <div className="field-grid">
          <label>
            Consent date
            <input type="date" value={consentDate} onChange={(e) => setConsentDate(e.target.value)} />
          </label>
          <label>
            Randomization / envelope no.
            <input value={randomizationCode} onChange={(e) => setRandomizationCode(e.target.value)} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={childAssent} onChange={(e) => setChildAssent(e.target.checked)} />
            Child assent obtained (age-appropriate)
          </label>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Eligibility</h3>
        </div>
        <label>Inclusion criteria met</label>
        <div className="field-grid">
          {LUS_INCLUSION_CRITERIA.map((c) => (
            <label key={c} className="checkbox-label">
              <input type="checkbox" checked={inclusion.includes(c)} onChange={() => setInclusion((p) => toggle(p, c))} />
              {c}
            </label>
          ))}
        </div>
        <label>Exclusion criteria present (should be none)</label>
        <div className="field-grid">
          {LUS_EXCLUSION_CRITERIA.map((c) => (
            <label key={c} className="checkbox-label">
              <input type="checkbox" checked={exclusion.includes(c)} onChange={() => setExclusion((p) => toggle(p, c))} />
              {c}
            </label>
          ))}
        </div>
        <p className="patient-meta">
          {eligible ? 'Eligible — all inclusion criteria met, no exclusion criteria.' : 'Not yet confirmed eligible.'}
        </p>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Baseline dialysis &amp; comorbidities</h3>
        </div>
        <div className="field-grid">
          <label>
            Modality
            <select value={modality} onChange={(e) => setModality(e.target.value as DialysisModality)}>
              <option value="">—</option>
              <option value="hd">Hemodialysis</option>
              <option value="hdf">Hemodiafiltration</option>
            </select>
          </label>
          <label>
            Vascular access
            <select value={access} onChange={(e) => setAccess(e.target.value as VascularAccess)}>
              <option value="">—</option>
              <option value="avf">AV fistula</option>
              <option value="avg">AV graft</option>
              <option value="tunneled_cvc">Tunneled CVC (permcath)</option>
              <option value="non_tunneled_cvc">Non-tunneled CVC</option>
            </select>
          </label>
          <label>
            Sessions per week
            <input type="number" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} />
          </label>
          <label>
            No. of antihypertensives at baseline
            <input type="number" value={antihtnCount} onChange={(e) => setAntihtnCount(e.target.value)} />
          </label>
        </div>
        <label>
          Baseline antihypertensive drugs &amp; doses
          <input value={antihtn} onChange={(e) => setAntihtn(e.target.value)} placeholder="e.g. amlodipine 5 mg daily" />
        </label>
        <label>Comorbidities</label>
        <div className="field-grid">
          {LUS_COMORBIDITIES.map((c) => (
            <label key={c} className="checkbox-label">
              <input type="checkbox" checked={comorbidities.includes(c)} onChange={() => setComorbidities((p) => toggle(p, c))} />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-header">
          <h3 className="dash-card-title">Study status (ITT / withdrawal)</h3>
        </div>
        <div className="field-grid">
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as LusStudyStatus)}>
              <option value="active">Active</option>
              <option value="completed">Completed day 60</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </label>
          {status === 'withdrawn' && (
            <>
              <label>
                Withdrawal date
                <input type="date" value={withdrawalDate} onChange={(e) => setWithdrawalDate(e.target.value)} />
              </label>
              <label>
                Reason
                <select value={withdrawalReason} onChange={(e) => setWithdrawalReason(e.target.value as LusWithdrawalReason)}>
                  <option value="">—</option>
                  {Object.entries(WITHDRAWAL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>
        <label>
          Notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save enrollment details'}
        </button>
        <button type="button" className="button-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
