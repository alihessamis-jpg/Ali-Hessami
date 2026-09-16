import { supabase } from '../supabaseClient'
import type {
  ResearchField,
  ResearchFieldDraft,
  ResearchProject,
  ResearchProjectDraft,
  ResearchRecord,
  ResearchRecordDraft,
} from '../../types/domain'

interface ProjectRow {
  id: string
  name: string
  created_date: string
  overview: string | null
  research_question: string | null
  objectives: string | null
  study_design: string | null
  inclusion: string | null
  exclusion: string | null
  notes: string | null
  literature: string | null
  progress: string | null
}

interface FieldRow {
  id: string
  project_id: string
  label: string
  type: ResearchField['type']
  required: boolean
  options: string[] | null
  formula: string | null
  order_index: number
}

interface RecordRow {
  id: string
  project_id: string
  date: string
  values: Record<string, unknown>
}

function projectToDomain(row: ProjectRow): ResearchProject {
  return {
    id: row.id,
    name: row.name,
    createdDate: row.created_date,
    overview: row.overview,
    researchQuestion: row.research_question,
    objectives: row.objectives,
    studyDesign: row.study_design,
    inclusion: row.inclusion,
    exclusion: row.exclusion,
    notes: row.notes,
    literature: row.literature,
    progress: row.progress,
  }
}

function projectToRow(draft: Partial<ResearchProject>) {
  return {
    name: draft.name,
    overview: draft.overview,
    research_question: draft.researchQuestion,
    objectives: draft.objectives,
    study_design: draft.studyDesign,
    inclusion: draft.inclusion,
    exclusion: draft.exclusion,
    notes: draft.notes,
    literature: draft.literature,
    progress: draft.progress,
  }
}

function fieldToDomain(row: FieldRow): ResearchField {
  return {
    id: row.id,
    projectId: row.project_id,
    label: row.label,
    type: row.type,
    required: row.required,
    options: row.options,
    formula: row.formula,
    orderIndex: row.order_index,
  }
}

function recordToDomain(row: RecordRow): ResearchRecord {
  return { id: row.id, projectId: row.project_id, date: row.date, values: row.values ?? {} }
}

export async function listResearchProjects(): Promise<ResearchProject[]> {
  const { data, error } = await supabase
    .from('research_projects')
    .select('*')
    .order('created_date', { ascending: false })
  if (error) throw error
  return (data as ProjectRow[]).map(projectToDomain)
}

export async function getResearchProject(id: string): Promise<ResearchProject> {
  const { data, error } = await supabase.from('research_projects').select('*').eq('id', id).single()
  if (error) throw error
  return projectToDomain(data as ProjectRow)
}

export async function addResearchProject(draft: ResearchProjectDraft): Promise<ResearchProject> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('research_projects')
    .insert({ ...projectToRow(draft), owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return projectToDomain(data as ProjectRow)
}

export async function updateResearchProject(id: string, patch: Partial<ResearchProject>): Promise<ResearchProject> {
  const { data, error } = await supabase
    .from('research_projects')
    .update(projectToRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return projectToDomain(data as ProjectRow)
}

export async function deleteResearchProject(id: string): Promise<void> {
  const { error } = await supabase.from('research_projects').delete().eq('id', id)
  if (error) throw error
}

export async function listResearchFields(projectId: string): Promise<ResearchField[]> {
  const { data, error } = await supabase
    .from('research_fields')
    .select('*')
    .eq('project_id', projectId)
    .order('order_index')
  if (error) throw error
  return (data as FieldRow[]).map(fieldToDomain)
}

export async function addResearchField(draft: ResearchFieldDraft): Promise<ResearchField> {
  const { data, error } = await supabase
    .from('research_fields')
    .insert({
      project_id: draft.projectId,
      label: draft.label,
      type: draft.type,
      required: draft.required,
      options: draft.options,
      formula: draft.formula,
      order_index: draft.orderIndex,
    })
    .select()
    .single()
  if (error) throw error
  return fieldToDomain(data as FieldRow)
}

export async function deleteResearchField(id: string): Promise<void> {
  const { error } = await supabase.from('research_fields').delete().eq('id', id)
  if (error) throw error
}

export async function listResearchRecords(projectId: string): Promise<ResearchRecord[]> {
  const { data, error } = await supabase
    .from('research_records')
    .select('*')
    .eq('project_id', projectId)
    .order('date', { ascending: false })
  if (error) throw error
  return (data as RecordRow[]).map(recordToDomain)
}

export async function addResearchRecord(draft: ResearchRecordDraft): Promise<ResearchRecord> {
  const { data, error } = await supabase
    .from('research_records')
    .insert({ project_id: draft.projectId, date: draft.date, values: draft.values })
    .select()
    .single()
  if (error) throw error
  return recordToDomain(data as RecordRow)
}

export async function updateResearchRecord(id: string, values: Record<string, unknown>): Promise<ResearchRecord> {
  const { data, error } = await supabase
    .from('research_records')
    .update({ values })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return recordToDomain(data as RecordRow)
}

export async function deleteResearchRecord(id: string): Promise<void> {
  const { error } = await supabase.from('research_records').delete().eq('id', id)
  if (error) throw error
}
