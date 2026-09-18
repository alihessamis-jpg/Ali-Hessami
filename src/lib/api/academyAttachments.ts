import { supabase } from '../supabaseClient'
import type { AcademyAttachment, AcademyAttachmentKind } from '../../types/domain'

interface AcademyAttachmentRow {
  id: string
  topic_id: string
  storage_path: string
  filename: string | null
  kind: AcademyAttachmentKind
  created_at: string
}

function toDomain(row: AcademyAttachmentRow): AcademyAttachment {
  return {
    id: row.id,
    topicId: row.topic_id,
    storagePath: row.storage_path,
    filename: row.filename,
    kind: row.kind,
    createdAt: row.created_at,
  }
}

export async function listAcademyAttachments(topicId: string): Promise<AcademyAttachment[]> {
  const { data, error } = await supabase
    .from('academy_topic_attachments')
    .select('*')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as AcademyAttachmentRow[]).map(toDomain)
}

export async function addAcademyAttachment(
  topicId: string,
  storagePath: string,
  filename: string | null,
  kind: AcademyAttachmentKind
): Promise<AcademyAttachment> {
  const { data, error } = await supabase
    .from('academy_topic_attachments')
    .insert({ topic_id: topicId, storage_path: storagePath, filename, kind })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as AcademyAttachmentRow)
}

export async function deleteAcademyAttachment(id: string): Promise<void> {
  const { error } = await supabase.from('academy_topic_attachments').delete().eq('id', id)
  if (error) throw error
}
