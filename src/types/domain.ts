// Domain shapes match the prototype's TS interfaces (see NEPHRON_HANDOFF.md)
// so existing formulas/logic (e.g. scheduleReview, schwartzEGFR) can be
// reused as-is against these types.

export interface Patient {
  id: string
  name: string
  code?: string | null
  age?: number | null
  sex?: string | null
  dob?: string | null
  doa?: string | null
  bed?: string | null
  diagnosis?: string | null
  underlyingDisease?: string | null
  height?: number | null
  weight?: number | null
  heightPct?: number | null
  weightPct?: number | null
  bmiPct?: number | null
  baselineCr?: number | null
  baselineEGFR?: number | null
  dialysisStatus?: string | null
  dialysisModality?: string | null
  transplantStatus?: string | null

  // Assessment: history
  chiefComplaint?: string | null
  hpi?: string | null
  keyPoints?: string | null
  familyHx?: string | null
  pmh?: string | null
  medHx?: string | null
  allergyHx?: string | null
  dialysisHx?: string | null
  transplantHx?: string | null

  // Assessment: vitals
  vsTemp?: number | null
  vsHR?: number | null
  vsRR?: number | null
  vsBP?: string | null
  vsSpo2?: number | null

  // Assessment: exam
  exGeneral?: string | null
  exHeent?: string | null
  exCVS?: string | null
  exResp?: string | null
  exAbd?: string | null
  exGU?: string | null
  exExtrem?: string | null
  exSkin?: string | null
  exNeuro?: string | null
  exEdema?: string | null
  exHydration?: string | null
}

export type PatientDraft = Omit<Patient, 'id'>

export interface LabEntry {
  id: string
  patientId: string
  date: string
  category?: string | null
  test: string
  value?: number | null
  unit?: string | null
  ref?: string | null
  comment?: string | null
}

export type LabEntryDraft = Omit<LabEntry, 'id'>

export interface ProgressNote {
  id: string
  patientId: string
  date: string
  weight?: number | null
  bp?: string | null
  uo?: string | null
  S?: string | null
  O?: string | null
  A?: string | null
  P?: string | null
}

export type ProgressNoteDraft = Omit<ProgressNote, 'id'>

export interface Medication {
  id: string
  patientId: string
  name: string
  dose?: string | null
  doseKg?: number | null
  route?: string | null
  freq?: string | null
  start?: string | null
  stop?: string | null
  indication?: string | null
  renalAdj?: string | null
  notes?: string | null
  active: boolean
}

export type MedicationDraft = Omit<Medication, 'id'>
