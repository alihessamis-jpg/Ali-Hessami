import { supabase } from '../supabaseClient'
import type { PatientDocument } from '../../types/domain'

interface PatientDocumentRow {
  id: string
  patient_id: string
  storage_path: string
  filename: string | null
  created_at: string
}

function toDomain(row: PatientDocumentRow): PatientDocument {
  return {
    id: row.id,
    patientId: row.patient_id,
    storagePath: row.storage_path,
    filename: row.filename,
    createdAt: row.created_at,
  }
}

export async function listPatientDocuments(patientId: string): Promise<PatientDocument[]> {
  const { data, error } = await supabase
    .from('patient_documents')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as PatientDocumentRow[]).map(toDomain)
}

export async function addPatientDocument(
  patientId: string,
  storagePath: string,
  filename: string | null
): Promise<PatientDocument> {
  const { data, error } = await supabase
    .from('patient_documents')
    .insert({ patient_id: patientId, storage_path: storagePath, filename })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as PatientDocumentRow)
}

export async function deletePatientDocument(id: string): Promise<void> {
  const { error } = await supabase.from('patient_documents').delete().eq('id', id)
  if (error) throw error
}
