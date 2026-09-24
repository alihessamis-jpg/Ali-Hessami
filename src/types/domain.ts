// Domain shapes match the prototype's TS interfaces (see NEPHRON_HANDOFF.md)
// so existing formulas/logic (e.g. scheduleReview, schwartzEGFR) can be
// reused as-is against these types.

export type PatientCareStatus = 'inpatient' | 'discharged'

export interface Patient {
  id: string
  name: string
  code?: string | null
  age?: number | null
  sex?: string | null
  dob?: string | null
  doa?: string | null
  bed?: string | null
  careStatus: PatientCareStatus
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

export type PatientDraft = Omit<Patient, 'id' | 'careStatus'> & { careStatus?: PatientCareStatus }

export interface MicroSusceptibility {
  antibiotic: string
  result: 'S' | 'I' | 'R'
}

export interface MicroDetails {
  organism: string
  colonyCount?: string | null
  collectionMethod?: string | null
  onAntibiotics?: boolean | null
  susceptibilities: MicroSusceptibility[]
}

export interface LabEntry {
  id: string
  patientId: string
  date: string
  category?: string | null
  test: string
  value?: number | null
  valueText?: string | null
  microDetails?: MicroDetails | null
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

export interface ImagingEntry {
  id: string
  patientId: string
  category?: string | null
  date?: string | null
  notes?: string | null
  report?: string | null
  impression?: string | null
  storagePath?: string | null
}

export type ImagingEntryDraft = Omit<ImagingEntry, 'id'>

export type ReminderType = 'follow_up' | 'surgery' | 'custom'

export interface PatientReminder {
  id: string
  patientId: string
  type: ReminderType
  title: string
  note?: string | null
  eventDate: string
  done: boolean
}

export type PatientReminderDraft = Omit<PatientReminder, 'id'>

export interface DrugRefEntry {
  id: string
  medication: string
  indication?: string | null
  normalDose?: string | null
  pediatricDose?: string | null
  doseKg?: string | null
  maxDose?: string | null
  egfrRange?: string | null
  adjustedDose?: string | null
  frequency?: string | null
  notes?: string | null
}

export type DrugRefEntryDraft = Omit<DrugRefEntry, 'id'>

export interface DialysisRefEntry {
  id: string
  medication: string
  indication?: string | null
  pediatricDose?: string | null
  route?: string | null
  frequency?: string | null
  maxDose?: string | null
  notes?: string | null
}

export type DialysisRefEntryDraft = Omit<DialysisRefEntry, 'id'>

export type ReferenceAttachmentCategory = 'drug' | 'dialysis'

export interface ReferenceAttachment {
  id: string
  category: ReferenceAttachmentCategory
  storagePath: string
  filename?: string | null
  createdAt: string
}

export interface ChecklistTemplate {
  id: string
  name: string
  description?: string | null
}

export type ChecklistTemplateDraft = Omit<ChecklistTemplate, 'id'>

export interface ChecklistItem {
  id: string
  templateId: string
  itemIndex: number
  section?: string | null
  label: string
}

export interface ChecklistCompletion {
  itemId: string
  checked: boolean
}

export interface StudyLink {
  label: string
  url: string
}

export interface AcademyTopic {
  id: string
  category?: string | null
  parentTopicId?: string | null
  name: string
  summary?: string | null
  keyPoints: string[]
  studyLinks: StudyLink[]
  presentation?: string | null
  reasoning?: string | null
  tests?: string | null
  interpretation?: string | null
  imaging?: string | null
  treatment?: string | null
  redFlags?: string | null
  pearls?: string | null
  selfTest?: string | null
  caseStem?: string | null
  caseQuestions: string[]
  caseDiscussion?: string | null
}

export type AcademyTopicDraft = Omit<AcademyTopic, 'id'>

export type AcademyAttachmentKind = 'pdf' | 'audio' | 'other'

export interface AcademyAttachment {
  id: string
  topicId: string
  storagePath: string
  filename?: string | null
  kind: AcademyAttachmentKind
  createdAt: string
}

export type AcademyAttachmentDraft = Omit<AcademyAttachment, 'id' | 'createdAt'>

export interface TopicPatientLink {
  topicId: string
  patientId: string
  linkedAt: string
  notes?: string | null
}

export interface ReviewHistoryEntry {
  date: string
  rating: 'easy' | 'moderate' | 'difficult'
}

export interface SrsState {
  intervalIndex: number
  lastReviewed: string | null
  nextReview: string | null
  reviewHistory: ReviewHistoryEntry[]
}

export interface AcademyProgress extends SrsState {
  topicId: string
}

export interface StudyNote {
  id: string
  title?: string | null
  content?: string | null
}

export type StudyNoteDraft = Omit<StudyNote, 'id'>

export interface Flashcard extends SrsState {
  id: string
  front: string
  back: string
  deck?: string | null
}

export type FlashcardDraft = Omit<Flashcard, 'id' | keyof SrsState>

export interface ReasoningCase {
  id: string
  title: string
  age?: number | null
  sex?: string | null
  chief?: string | null
  history?: string | null
  vitals?: string | null
  exam?: string | null
  labs?: string | null
  imaging?: string | null
  questions: string[]
  discussion?: string | null
}

export type ReasoningCaseDraft = Omit<ReasoningCase, 'id'>

export interface LabChallenge {
  id: string
  title: string
  values: Array<[string, string, string]>
  prompt?: string | null
  discussion?: string | null
}

export type LabChallengeDraft = Omit<LabChallenge, 'id'>

export interface ImagingChallenge {
  id: string
  category?: string | null
  context?: string | null
  questions?: string | null
  discussion?: string | null
  storagePath?: string | null
}

export type ImagingChallengeDraft = Omit<ImagingChallenge, 'id'>

export interface KnowledgeGap {
  id: string
  topic: string
  description?: string | null
  date: string
  priority?: string | null
  reviewDate?: string | null
  status?: string | null
}

export type KnowledgeGapDraft = Omit<KnowledgeGap, 'id'>

export interface PersonalCase {
  id: string
  sourcePatientId?: string | null
  title: string
  createdDate: string
  diagnosisContext?: string | null
  presentation?: string | null
  findings?: string | null
  labPattern?: string | null
  imaging?: string | null
  workingDx?: string | null
  pearls?: string | null
  whatLearned?: string | null
  questionsForFurtherStudy?: string | null
}

export type PersonalCaseDraft = Omit<PersonalCase, 'id'>

export type CaseLogRole = 'managed' | 'performed' | 'assisted' | 'observed' | 'consulted'

export interface CaseLogEntry {
  id: string
  patientId?: string | null
  date: string
  category: string
  diagnosis: string
  role: CaseLogRole
  procedure?: string | null
  setting?: string | null
  notes?: string | null
}

export type CaseLogEntryDraft = Omit<CaseLogEntry, 'id'>

export interface PatientDocument {
  id: string
  patientId: string
  storagePath: string
  filename?: string | null
  createdAt: string
}

export interface UrineOutputEntry {
  id: string
  patientId: string
  recordedAt: string
  volumeMl: number
  durationHours: number
  notes?: string | null
}

export type UrineOutputEntryDraft = Omit<UrineOutputEntry, 'id'>

export type NephroticEventType = 'diagnosis' | 'relapse' | 'remission' | 'no_response_4wk'

export interface NephroticEvent {
  id: string
  patientId: string
  date: string
  eventType: NephroticEventType
  duringTaper: boolean
  notes?: string | null
}

export type NephroticEventDraft = Omit<NephroticEvent, 'id'>

export interface GrowthEntry {
  id: string
  patientId: string
  date: string
  heightCm?: number | null
  weightKg?: number | null
  headCircCm?: number | null
  bpSystolic?: number | null
  bpDiastolic?: number | null
}

export type GrowthEntryDraft = Omit<GrowthEntry, 'id'>

export interface ReadingItem {
  id: string
  title: string
  source?: string | null
  dateRead: string
  review3dDone: boolean
  review7dDone: boolean
  review14dDone: boolean
  review30dDone: boolean
  review90dDone: boolean
  topicId?: string | null
}

export type ReadingItemDraft = Omit<ReadingItem, 'id'>

export type ReviewCheckpointKey = 'review3dDone' | 'review7dDone' | 'review14dDone' | 'review30dDone' | 'review90dDone'

export interface ResearchProject {
  id: string
  name: string
  createdDate: string
  overview?: string | null
  researchQuestion?: string | null
  objectives?: string | null
  studyDesign?: string | null
  inclusion?: string | null
  exclusion?: string | null
  notes?: string | null
  literature?: string | null
  progress?: string | null
}

export type ResearchProjectDraft = Omit<ResearchProject, 'id'>

export type ResearchFieldType =
  | 'Text'
  | 'Number'
  | 'Date'
  | 'Checkbox'
  | 'Radio'
  | 'Dropdown'
  | 'Multiple Choice'
  | 'Laboratory'
  | 'Calculated Field'
  | 'Image Upload'
  | 'File Upload'

export interface ResearchField {
  id: string
  projectId: string
  label: string
  type: ResearchFieldType
  required: boolean
  options?: string[] | null
  formula?: string | null
  orderIndex: number
}

export type ResearchFieldDraft = Omit<ResearchField, 'id'>

export interface ResearchRecord {
  id: string
  projectId: string
  date: string
  values: Record<string, unknown>
}

export type ResearchRecordDraft = Omit<ResearchRecord, 'id'>

export interface UserSettings {
  anemiaHbThreshold: number
  acidosisPhThreshold: number
  acidosisHco3Threshold: number
  ckdMbdCaLow: number
  ckdMbdCaHigh: number
  ckdMbdPthHigh: number
  ckdMbdPthLow: number
  ckdMbdVitDDeficient: number
  ckdMbdVitDInsufficient: number
  ckdMbdBicarbLow: number
}
