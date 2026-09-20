import { supabase } from '../supabaseClient'
import type { Patient, PatientCareStatus, PatientDraft } from '../../types/domain'

interface PatientRow {
  id: string
  name: string
  code: string | null
  age: number | null
  sex: string | null
  dob: string | null
  doa: string | null
  bed: string | null
  care_status: PatientCareStatus
  diagnosis: string | null
  underlying_disease: string | null
  height: number | null
  weight: number | null
  height_pct: number | null
  weight_pct: number | null
  bmi_pct: number | null
  baseline_cr: number | null
  baseline_egfr: number | null
  dialysis_status: string | null
  dialysis_modality: string | null
  transplant_status: string | null
  chief_complaint: string | null
  hpi: string | null
  key_points: string | null
  family_hx: string | null
  pmh: string | null
  med_hx: string | null
  allergy_hx: string | null
  dialysis_hx: string | null
  transplant_hx: string | null
  vs_temp: number | null
  vs_hr: number | null
  vs_rr: number | null
  vs_bp: string | null
  vs_spo2: number | null
  ex_general: string | null
  ex_heent: string | null
  ex_cvs: string | null
  ex_resp: string | null
  ex_abd: string | null
  ex_gu: string | null
  ex_extrem: string | null
  ex_skin: string | null
  ex_neuro: string | null
  ex_edema: string | null
  ex_hydration: string | null
}

function toDomain(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    age: row.age,
    sex: row.sex,
    dob: row.dob,
    doa: row.doa,
    bed: row.bed,
    careStatus: row.care_status,
    diagnosis: row.diagnosis,
    underlyingDisease: row.underlying_disease,
    height: row.height,
    weight: row.weight,
    heightPct: row.height_pct,
    weightPct: row.weight_pct,
    bmiPct: row.bmi_pct,
    baselineCr: row.baseline_cr,
    baselineEGFR: row.baseline_egfr,
    dialysisStatus: row.dialysis_status,
    dialysisModality: row.dialysis_modality,
    transplantStatus: row.transplant_status,
    chiefComplaint: row.chief_complaint,
    hpi: row.hpi,
    keyPoints: row.key_points,
    familyHx: row.family_hx,
    pmh: row.pmh,
    medHx: row.med_hx,
    allergyHx: row.allergy_hx,
    dialysisHx: row.dialysis_hx,
    transplantHx: row.transplant_hx,
    vsTemp: row.vs_temp,
    vsHR: row.vs_hr,
    vsRR: row.vs_rr,
    vsBP: row.vs_bp,
    vsSpo2: row.vs_spo2,
    exGeneral: row.ex_general,
    exHeent: row.ex_heent,
    exCVS: row.ex_cvs,
    exResp: row.ex_resp,
    exAbd: row.ex_abd,
    exGU: row.ex_gu,
    exExtrem: row.ex_extrem,
    exSkin: row.ex_skin,
    exNeuro: row.ex_neuro,
    exEdema: row.ex_edema,
    exHydration: row.ex_hydration,
  }
}

function toRow(patient: Partial<Patient>): Partial<Omit<PatientRow, 'id'>> {
  return {
    name: patient.name,
    code: patient.code,
    age: patient.age,
    sex: patient.sex,
    dob: patient.dob,
    doa: patient.doa,
    bed: patient.bed,
    care_status: patient.careStatus,
    diagnosis: patient.diagnosis,
    underlying_disease: patient.underlyingDisease,
    height: patient.height,
    weight: patient.weight,
    height_pct: patient.heightPct,
    weight_pct: patient.weightPct,
    bmi_pct: patient.bmiPct,
    baseline_cr: patient.baselineCr,
    baseline_egfr: patient.baselineEGFR,
    dialysis_status: patient.dialysisStatus,
    dialysis_modality: patient.dialysisModality,
    transplant_status: patient.transplantStatus,
    chief_complaint: patient.chiefComplaint,
    hpi: patient.hpi,
    key_points: patient.keyPoints,
    family_hx: patient.familyHx,
    pmh: patient.pmh,
    med_hx: patient.medHx,
    allergy_hx: patient.allergyHx,
    dialysis_hx: patient.dialysisHx,
    transplant_hx: patient.transplantHx,
    vs_temp: patient.vsTemp,
    vs_hr: patient.vsHR,
    vs_rr: patient.vsRR,
    vs_bp: patient.vsBP,
    vs_spo2: patient.vsSpo2,
    ex_general: patient.exGeneral,
    ex_heent: patient.exHeent,
    ex_cvs: patient.exCVS,
    ex_resp: patient.exResp,
    ex_abd: patient.exAbd,
    ex_gu: patient.exGU,
    ex_extrem: patient.exExtrem,
    ex_skin: patient.exSkin,
    ex_neuro: patient.exNeuro,
    ex_edema: patient.exEdema,
    ex_hydration: patient.exHydration,
  }
}

export async function listPatients(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as PatientRow[]).map(toDomain)
}

export async function getPatient(id: string): Promise<Patient> {
  const { data, error } = await supabase.from('patients').select('*').eq('id', id).single()
  if (error) throw error
  return toDomain(data as PatientRow)
}

export async function createPatient(draft: PatientDraft): Promise<Patient> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('patients')
    .insert({ ...toRow(draft), owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as PatientRow)
}

export async function updatePatient(id: string, patch: Partial<Patient>): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .update(toRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as PatientRow)
}

export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase.from('patients').delete().eq('id', id)
  if (error) throw error
}
