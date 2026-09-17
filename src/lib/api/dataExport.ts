import { supabase } from '../supabaseClient'
import { listPatients } from './patients'
import { kdigoStage, schwartzEGFR } from '../formulas'
import { classifyNephroticSyndrome, NEPHROTIC_CLASSIFICATION_LABEL } from '../nephroticSyndrome'
import type { MicroDetails, NephroticEvent } from '../../types/domain'

interface LabExportRow {
  patient_id: string
  date: string
  test: string
  value: number | null
  value_text: string | null
  micro_details: MicroDetails | null
}

interface NephroticExportRow {
  patient_id: string
  date: string
  event_type: NephroticEvent['eventType']
  during_taper: boolean
}

interface CaseLogCountRow {
  patient_id: string
}

interface LatestTestValue {
  date: string
  value: number | null
  display: string
}

export interface WideExport {
  headers: string[]
  rows: Array<Array<string | number>>
}

// One row per patient, with the latest value of every distinct test the
// clinician has ever recorded across all patients as its own pair of
// columns -- a wide, SPSS/Excel-ready dataset rather than a fixed panel of
// hardcoded labs.
export async function buildPatientWideExport(): Promise<WideExport> {
  const patients = await listPatients()
  if (patients.length === 0) return { headers: [], rows: [] }
  const patientIds = patients.map((p) => p.id)

  const [labResult, nsResult, caseLogResult] = await Promise.all([
    supabase.from('lab_entries').select('patient_id, date, test, value, value_text, micro_details').in('patient_id', patientIds),
    supabase.from('nephrotic_events').select('patient_id, date, event_type, during_taper').in('patient_id', patientIds),
    supabase.from('case_log_entries').select('patient_id').in('patient_id', patientIds),
  ])
  if (labResult.error) throw labResult.error
  if (nsResult.error) throw nsResult.error
  if (caseLogResult.error) throw caseLogResult.error

  const labRows = labResult.data as unknown as LabExportRow[]
  const nsRows = nsResult.data as unknown as NephroticExportRow[]
  const caseLogRows = caseLogResult.data as unknown as CaseLogCountRow[]

  const latestByPatientTest = new Map<string, Map<string, LatestTestValue>>()
  for (const row of labRows) {
    let byTest = latestByPatientTest.get(row.patient_id)
    if (!byTest) {
      byTest = new Map()
      latestByPatientTest.set(row.patient_id, byTest)
    }
    const existing = byTest.get(row.test)
    if (!existing || row.date > existing.date) {
      const display = row.value_text ?? (row.value != null ? String(row.value) : row.micro_details?.organism ?? '')
      byTest.set(row.test, { date: row.date, value: row.value, display })
    }
  }

  const allTestNames = Array.from(new Set(labRows.map((r) => r.test))).sort()

  const nsByPatient = new Map<string, NephroticEvent[]>()
  for (const row of nsRows) {
    const list = nsByPatient.get(row.patient_id) ?? []
    list.push({
      id: '',
      patientId: row.patient_id,
      date: row.date,
      eventType: row.event_type,
      duringTaper: row.during_taper,
    })
    nsByPatient.set(row.patient_id, list)
  }

  const caseLogCountByPatient = new Map<string, number>()
  for (const row of caseLogRows) {
    caseLogCountByPatient.set(row.patient_id, (caseLogCountByPatient.get(row.patient_id) ?? 0) + 1)
  }

  const headers = [
    'Patient ID',
    'Name',
    'Code',
    'Age',
    'Sex',
    'DOB',
    'DOA',
    'Bed',
    'Diagnosis',
    'Underlying disease',
    'Height (cm)',
    'Weight (kg)',
    'Height %ile',
    'Weight %ile',
    'BMI %ile',
    'Baseline Cr',
    'Baseline eGFR',
    'Dialysis status',
    'Dialysis modality',
    'Transplant status',
    'Latest eGFR (computed)',
    'AKI stage (KDIGO)',
    'Nephrotic syndrome classification',
    'Case log entries',
    ...allTestNames.flatMap((t) => [`Latest ${t}`, `Latest ${t} date`]),
  ]

  const rows = patients.map((p) => {
    const byTest = latestByPatientTest.get(p.id)
    const latestCr = byTest?.get('Creatinine')
    const latestEGFR = latestCr?.value != null && p.height ? schwartzEGFR(p.height, latestCr.value).toFixed(1) : ''
    const akiStage =
      p.baselineCr && latestCr?.value != null ? kdigoStage(p.baselineCr, latestCr.value, !!p.dialysisStatus) : null
    const nsEvents = nsByPatient.get(p.id) ?? []
    const nsClass = nsEvents.length > 0 ? NEPHROTIC_CLASSIFICATION_LABEL[classifyNephroticSyndrome(nsEvents)] : ''

    const testCells = allTestNames.flatMap((t) => {
      const entry = byTest?.get(t)
      return [entry?.display ?? '', entry?.date ?? '']
    })

    return [
      p.id,
      p.name,
      p.code ?? '',
      p.age ?? '',
      p.sex ?? '',
      p.dob ?? '',
      p.doa ?? '',
      p.bed ?? '',
      p.diagnosis ?? '',
      p.underlyingDisease ?? '',
      p.height ?? '',
      p.weight ?? '',
      p.heightPct ?? '',
      p.weightPct ?? '',
      p.bmiPct ?? '',
      p.baselineCr ?? '',
      p.baselineEGFR ?? '',
      p.dialysisStatus ?? '',
      p.dialysisModality ?? '',
      p.transplantStatus ?? '',
      latestEGFR,
      akiStage != null ? `Stage ${akiStage}` : '',
      nsClass,
      caseLogCountByPatient.get(p.id) ?? 0,
      ...testCells,
    ]
  })

  return { headers, rows }
}
