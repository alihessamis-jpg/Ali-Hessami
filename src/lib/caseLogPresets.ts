// Pediatric nephrology fellowship curriculum domains — used to group case
// log entries so a fellow can see which categories are under-exposed.
export const CASE_LOG_CATEGORIES = [
  'Glomerular disease',
  'AKI',
  'CKD / ESRD',
  'Hemodialysis',
  'Peritoneal dialysis',
  'Kidney transplant',
  'Hypertension',
  'Electrolyte / acid-base',
  'Tubulopathy',
  'Cystic / genetic kidney disease',
  'CAKUT / urologic',
  'Nephrolithiasis',
  'Procedure',
]

export const CASE_LOG_ROLES: Array<{ value: string; label: string }> = [
  { value: 'managed', label: 'Managed (primary)' },
  { value: 'performed', label: 'Performed' },
  { value: 'assisted', label: 'Assisted' },
  { value: 'observed', label: 'Observed' },
  { value: 'consulted', label: 'Consulted' },
]

export const CASE_LOG_SETTINGS = ['Inpatient', 'Outpatient', 'Consult', 'ICU']
