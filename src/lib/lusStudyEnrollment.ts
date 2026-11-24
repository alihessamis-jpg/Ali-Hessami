import type { LusWithdrawalReason } from '../types/domain'

// Eligibility items exactly as listed in the approved proposal (SUMS
// research questionnaire, section 12-b), so the CONSORT flow and the
// thesis "methods" table can be built straight from the stored checklists.
export const LUS_INCLUSION_CRITERIA = [
  'Age < 18 years',
  'CKD stage 5 (eGFR < 15) / ESKD',
  'Maintenance HD for ≥ 1 month',
  '≥ 3 HD sessions per week',
  'Written informed consent from parent / legal guardian',
]

export const LUS_EXCLUSION_CRITERIA = [
  'Interstitial lung disease',
  'Pneumonia in the last 4 weeks',
  'History of lung surgery',
  'Active malignancy',
  'Active infection / severe concurrent illness',
  'Known severe psychiatric disorder',
  'Pregnancy',
  'Drug or alcohol misuse',
  'Inadequate LUS image quality (obesity, chest deformity, non-cooperation)',
]

export const LUS_COMORBIDITIES = [
  'Hypertension',
  'Cardiomyopathy / heart failure',
  'Congenital heart disease',
  'Diabetes',
  'Chronic lung disease',
  'Neurological impairment',
  'Previous kidney transplant',
]

export const WITHDRAWAL_LABELS: Record<LusWithdrawalReason, string> = {
  transplant: 'Kidney transplant',
  transfer: 'Transfer to another dialysis center',
  death: 'Death',
  switch_to_pd: 'Switch to peritoneal dialysis',
  non_cooperation: 'Repeated non-cooperation with ultrasound',
  consent_withdrawn: 'Consent withdrawn',
  other: 'Other',
}

