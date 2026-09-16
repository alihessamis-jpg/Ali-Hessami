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
