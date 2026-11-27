import { supabase } from './supabaseClient'

export const IMAGING_BUCKET = 'imaging'
const CHAPTER_FIGURES_BUCKET = 'chapter-figures'

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

// v1.3: book figures (`chapter-figures` bucket, its own private bucket so the
// RLS policy stays scoped to figure images). The path is
// userId/bookId/chNN/figureKey.ext -- the bookId segment matters because two
// books can both have a "chapter 3" whose note uses the figure key
// `ch3-fig1-img`; without it the second book's upload overwrites the first's
// image. Rows written before this segment existed keep their old
// userId/chNN/... path and still resolve, since reads use the stored path.
export async function uploadChapterFigureFile(
  userId: string,
  bookId: string,
  chapterNumber: number,
  figureKey: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${bookId}/ch${chapterNumber}/${figureKey}${ext ? `.${ext}` : ''}`
  const { error } = await supabase.storage.from(CHAPTER_FIGURES_BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  return path
}

export async function getChapterFigureSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(CHAPTER_FIGURES_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteChapterFigureFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CHAPTER_FIGURES_BUCKET).remove([path])
  if (error) throw error
}

// Academy → Guidelines: the original guideline PDF, kept beside the
// imported text in the private chapter-figures bucket (same owner-folder
// policy), at userId/guidelines/<bookId>.pdf.
export async function uploadGuidelinePdfFile(userId: string, bookId: string, file: File): Promise<string> {
  // Unique per upload: the service worker caches stored files by path
  // (vite.config.ts), so re-using one path would serve a replaced PDF stale.
  const path = `${userId}/guidelines/${bookId}-${Date.now()}.pdf`
  const { error } = await supabase.storage
    .from(CHAPTER_FIGURES_BUCKET)
    .upload(path, file, { contentType: 'application/pdf' })
  if (error) throw error
  return path
}

export async function getGuidelinePdfSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(CHAPTER_FIGURES_BUCKET).createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}
