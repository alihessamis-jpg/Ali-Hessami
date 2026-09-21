import { supabase } from '../supabaseClient'
import type { ReferenceAttachment, ReferenceAttachmentCategory } from '../../types/domain'

interface ReferenceAttachmentRow {
  id: string
  category: ReferenceAttachmentCategory
  storage_path: string
  filename: string | null
  created_at: string
}

function toDomain(row: ReferenceAttachmentRow): ReferenceAttachment {
  return {
    id: row.id,
    category: row.category,
    storagePath: row.storage_path,
    filename: row.filename,
    createdAt: row.created_at,
  }
}

export async function listReferenceAttachments(category: ReferenceAttachmentCategory): Promise<ReferenceAttachment[]> {
  const { data, error } = await supabase
    .from('reference_attachments')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as ReferenceAttachmentRow[]).map(toDomain)
}

export async function addReferenceAttachment(
  category: ReferenceAttachmentCategory,
  storagePath: string,
  filename: string | null
): Promise<ReferenceAttachment> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('reference_attachments')
    .insert({ category, storage_path: storagePath, filename, owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as ReferenceAttachmentRow)
}

export async function deleteReferenceAttachment(id: string): Promise<void> {
  const { error } = await supabase.from('reference_attachments').delete().eq('id', id)
  if (error) throw error
}
