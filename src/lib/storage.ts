import { supabase } from './supabaseClient'

const IMAGING_BUCKET = 'imaging'

// Supabase's free tier caps total project storage at 1 GiB; used as the
// denominator for the usage indicator until the project is on a paid plan.
export const FREE_TIER_STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024

// Walks every folder under `path` in the bucket (storage.list() is not
// recursive, and folders are just entries with a null id/metadata) and sums
// up the real file sizes it finds.
async function listAllFileSizes(bucket: string, path: string): Promise<number[]> {
  const { data, error } = await supabase.storage.from(bucket).list(path, { limit: 1000 })
  if (error) throw error
  const sizes: number[] = []
  for (const entry of data ?? []) {
    const fullPath = path ? `${path}/${entry.name}` : entry.name
    if (entry.id === null) {
      sizes.push(...(await listAllFileSizes(bucket, fullPath)))
    } else {
      sizes.push(entry.metadata?.size ?? 0)
    }
  }
  return sizes
}

export async function getStorageUsageBytes(userId: string): Promise<number> {
  const sizes = await listAllFileSizes(IMAGING_BUCKET, userId)
  return sizes.reduce((sum, size) => sum + size, 0)
}

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

// Same bucket again, under an academy-attachments path segment (PDF
// summaries, podcast-style audio, self-made test files for a study topic).
export async function uploadAcademyAttachmentFile(userId: string, topicId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/academy-attachments/${topicId}-${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const { error } = await supabase.storage.from(IMAGING_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

export async function getAcademyAttachmentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(IMAGING_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteAcademyAttachmentFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(IMAGING_BUCKET).remove([path])
  if (error) throw error
}

// Same bucket again, under a reference-attachments path segment (photos/PDFs
// of dosing tables and other reference material kept alongside the Drug/
// Dialysis reference lists).
export async function uploadReferenceAttachmentFile(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/reference-attachments/${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const { error } = await supabase.storage.from(IMAGING_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

export async function getReferenceAttachmentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(IMAGING_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteReferenceAttachmentFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(IMAGING_BUCKET).remove([path])
  if (error) throw error
}

// Same bucket again, under a followup-attachments path segment (pathology
// reports and other result documents attached to a Follow-up item).
export async function uploadFollowUpAttachmentFile(userId: string, followUpId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/followup-attachments/${followUpId}-${crypto.randomUUID()}${ext ? `.${ext}` : ''}`
  const { error } = await supabase.storage.from(IMAGING_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

export async function getFollowUpAttachmentSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(IMAGING_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteFollowUpAttachmentFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(IMAGING_BUCKET).remove([path])
  if (error) throw error
}
