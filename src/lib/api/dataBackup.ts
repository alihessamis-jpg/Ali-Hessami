import { supabase } from '../supabaseClient'

// Every table in the schema, in an order that's safe to restore in
// top-to-bottom: a table only appears after every table it has a foreign
// key into (patients before its lab_entries, checklist_templates before
// checklist_items, etc.). The one exception is academy_topics' own
// self-reference (parent_topic_id) -- handled with a deferred second pass
// in restoreFromBackup rather than by ordering.
//
// ownerColumn is the column restoreFromBackup stamps to the current user
// before writing, so a restored row always satisfies this account's RLS
// policies regardless of whose account the backup was taken from. Tables
// scoped only through a patient_id (no ownerColumn) rely on their parent
// patient row already carrying the current owner_id by the time they're
// restored.
interface TableSpec {
  name: string
  ownerColumn: 'owner_id' | 'user_id' | null
  conflictKey: string
  deferColumns?: string[]
}

const BACKUP_TABLES: TableSpec[] = [
  { name: 'patients', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'lab_entries', ownerColumn: null, conflictKey: 'id' },
  { name: 'progress_notes', ownerColumn: null, conflictKey: 'id' },
  { name: 'medications', ownerColumn: null, conflictKey: 'id' },
  { name: 'imaging_entries', ownerColumn: null, conflictKey: 'id' },
  { name: 'patient_documents', ownerColumn: null, conflictKey: 'id' },
  { name: 'urine_output_entries', ownerColumn: null, conflictKey: 'id' },
  { name: 'nephrotic_events', ownerColumn: null, conflictKey: 'id' },
  { name: 'growth_entries', ownerColumn: null, conflictKey: 'id' },
  { name: 'hd_sessions', ownerColumn: null, conflictKey: 'id' },
  { name: 'pd_prescriptions', ownerColumn: null, conflictKey: 'id' },
  { name: 'pd_peritonitis_episodes', ownerColumn: null, conflictKey: 'id' },
  { name: 'vaccinations', ownerColumn: null, conflictKey: 'id' },
  { name: 'lus_study_enrollments', ownerColumn: null, conflictKey: 'id' },
  { name: 'lus_study_sessions', ownerColumn: null, conflictKey: 'id' },
  { name: 'patient_reminders', ownerColumn: null, conflictKey: 'id' },
  { name: 'follow_up_items', ownerColumn: null, conflictKey: 'id' },
  { name: 'drug_reference', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'reference_attachments', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'dialysis_reference', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'checklist_templates', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'checklist_items', ownerColumn: null, conflictKey: 'id' },
  { name: 'checklist_completions', ownerColumn: 'user_id', conflictKey: 'user_id,item_id' },
  { name: 'academy_topics', ownerColumn: 'owner_id', conflictKey: 'id', deferColumns: ['parent_topic_id'] },
  { name: 'academy_progress', ownerColumn: 'user_id', conflictKey: 'user_id,topic_id' },
  { name: 'academy_topic_attachments', ownerColumn: null, conflictKey: 'id' },
  { name: 'academy_topic_patients', ownerColumn: null, conflictKey: 'id' },
  { name: 'study_notes', ownerColumn: 'user_id', conflictKey: 'id' },
  { name: 'flashcards', ownerColumn: 'user_id', conflictKey: 'id' },
  { name: 'reading_items', ownerColumn: 'user_id', conflictKey: 'id' },
  { name: 'reasoning_cases', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'lab_challenges', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'imaging_challenges', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'board_questions', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'board_question_attempts', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'academic_activities', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'knowledge_gaps', ownerColumn: 'user_id', conflictKey: 'id' },
  { name: 'case_log_entries', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'personal_cases', ownerColumn: 'user_id', conflictKey: 'id' },
  { name: 'attending_consults', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'research_projects', ownerColumn: 'owner_id', conflictKey: 'id' },
  { name: 'research_fields', ownerColumn: null, conflictKey: 'id' },
  { name: 'research_records', ownerColumn: null, conflictKey: 'id' },
  { name: 'user_settings', ownerColumn: 'owner_id', conflictKey: 'owner_id' },
]

export const BACKUP_FORMAT_VERSION = 1

export interface BackupBundle {
  version: number
  exportedAt: string
  tables: Record<string, Record<string, unknown>[]>
}

const PAGE_SIZE = 1000

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`)
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return rows
}

// Reads every table this account owns (RLS already scopes every query to the
// signed-in user) into one JSON-serializable bundle. Note: this captures
// database rows only -- files in Supabase Storage (uploaded images/PDFs
// referenced by storage_path columns) are not included.
export async function buildFullBackup(): Promise<BackupBundle> {
  const tables: Record<string, Record<string, unknown>[]> = {}
  for (const spec of BACKUP_TABLES) {
    tables[spec.name] = await fetchAllRows(spec.name)
  }
  return { version: BACKUP_FORMAT_VERSION, exportedAt: new Date().toISOString(), tables }
}

export interface RestoreResult {
  table: string
  count: number
  error?: string
}

// Upserts every row back in, in dependency order, after stamping each row's
// owner/user column to the currently signed-in account so the restore always
// satisfies RLS -- regardless of which account originally produced the
// backup file. Existing rows that share an id with the backup are
// overwritten with the backup's values; rows created since the backup was
// taken are left alone (nothing is deleted).
export async function restoreFromBackup(bundle: BackupBundle): Promise<RestoreResult[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const results: RestoreResult[] = []

  for (const spec of BACKUP_TABLES) {
    const rows = bundle.tables[spec.name]
    if (!rows || rows.length === 0) {
      results.push({ table: spec.name, count: 0 })
      continue
    }
    try {
      const stamped = rows.map((row) => {
        const next = { ...row }
        if (spec.ownerColumn) next[spec.ownerColumn] = user.id
        for (const col of spec.deferColumns ?? []) next[col] = null
        return next
      })
      const { error } = await supabase.from(spec.name).upsert(stamped, { onConflict: spec.conflictKey })
      if (error) throw error
      results.push({ table: spec.name, count: stamped.length })
    } catch (err) {
      results.push({ table: spec.name, count: 0, error: err instanceof Error ? err.message : 'Failed to restore' })
    }
  }

  // Second pass: patch back deferred self-referencing columns now that every
  // row they could point to exists.
  for (const spec of BACKUP_TABLES) {
    if (!spec.deferColumns || spec.deferColumns.length === 0) continue
    const rows = bundle.tables[spec.name]
    if (!rows) continue
    for (const row of rows) {
      const patch: Record<string, unknown> = {}
      let hasPatch = false
      for (const col of spec.deferColumns) {
        if (row[col] != null) {
          patch[col] = row[col]
          hasPatch = true
        }
      }
      if (!hasPatch) continue
      await supabase.from(spec.name).update(patch).eq('id', row.id)
    }
  }

  return results
}
