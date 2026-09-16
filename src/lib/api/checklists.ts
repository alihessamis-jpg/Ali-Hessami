import { supabase } from '../supabaseClient'
import type { ChecklistItem, ChecklistTemplate, ChecklistTemplateDraft } from '../../types/domain'

interface TemplateRow {
  id: string
  name: string
  description: string | null
}

interface ItemRow {
  id: string
  template_id: string
  item_index: number
  label: string
}

function templateToDomain(row: TemplateRow): ChecklistTemplate {
  return { id: row.id, name: row.name, description: row.description }
}

function itemToDomain(row: ItemRow): ChecklistItem {
  return { id: row.id, templateId: row.template_id, itemIndex: row.item_index, label: row.label }
}

export async function listChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const { data, error } = await supabase.from('checklist_templates').select('*').order('name')
  if (error) throw error
  return (data as TemplateRow[]).map(templateToDomain)
}

export async function addChecklistTemplate(draft: ChecklistTemplateDraft): Promise<ChecklistTemplate> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('checklist_templates')
    .insert({ name: draft.name, description: draft.description, owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return templateToDomain(data as TemplateRow)
}

export async function deleteChecklistTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('checklist_templates').delete().eq('id', id)
  if (error) throw error
}

export async function listChecklistItems(templateId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('template_id', templateId)
    .order('item_index')
  if (error) throw error
  return (data as ItemRow[]).map(itemToDomain)
}

export async function addChecklistItem(templateId: string, label: string, itemIndex: number): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({ template_id: templateId, label, item_index: itemIndex })
    .select()
    .single()
  if (error) throw error
  return itemToDomain(data as ItemRow)
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id)
  if (error) throw error
}

export async function getChecklistCompletions(templateId: string, userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('checklist_completions')
    .select('item_id, checked, checklist_items!inner(template_id)')
    .eq('user_id', userId)
    .eq('checklist_items.template_id', templateId)
  if (error) throw error
  const result: Record<string, boolean> = {}
  for (const row of data as Array<{ item_id: string; checked: boolean }>) {
    result[row.item_id] = row.checked
  }
  return result
}

export async function setChecklistCompletion(itemId: string, userId: string, checked: boolean): Promise<void> {
  const { error } = await supabase
    .from('checklist_completions')
    .upsert({ item_id: itemId, user_id: userId, checked, updated_at: new Date().toISOString() })
  if (error) throw error
}
