import { supabase } from './supabaseClient'

const IMAGING_BUCKET = 'imaging'

export async function uploadImagingFile(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const { error } = await supabase.storage.from(IMAGING_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

export async function getImagingSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(IMAGING_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

// Reuses the same bucket/RLS policy as imaging (both are userId-prefixed
// object keys), just under a separate path segment.
export async function uploadPatientDocumentFile(userId: string, patientId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/patient-docs/${patientId}-${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const { error } = await supabase.storage.from(IMAGING_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

export async function getPatientDocumentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(IMAGING_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deletePatientDocumentFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(IMAGING_BUCKET).remove([path])
  if (error) throw error
}
