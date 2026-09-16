import { supabase } from '../supabaseClient'
import type { DrugRefEntry, DrugRefEntryDraft } from '../../types/domain'

interface DrugRefRow {
  id: string
  medication: string
  indication: string | null
  normal_dose: string | null
  pediatric_dose: string | null
  dose_kg: string | null
  max_dose: string | null
  egfr_range: string | null
  adjusted_dose: string | null
  frequency: string | null
  notes: string | null
}

function toDomain(row: DrugRefRow): DrugRefEntry {
  return {
    id: row.id,
    medication: row.medication,
    indication: row.indication,
    normalDose: row.normal_dose,
    pediatricDose: row.pediatric_dose,
    doseKg: row.dose_kg,
    maxDose: row.max_dose,
    egfrRange: row.egfr_range,
    adjustedDose: row.adjusted_dose,
    frequency: row.frequency,
    notes: row.notes,
  }
}

function toRow(draft: Partial<DrugRefEntry>) {
  return {
    medication: draft.medication,
    indication: draft.indication,
    normal_dose: draft.normalDose,
    pediatric_dose: draft.pediatricDose,
    dose_kg: draft.doseKg,
    max_dose: draft.maxDose,
    egfr_range: draft.egfrRange,
    adjusted_dose: draft.adjustedDose,
    frequency: draft.frequency,
    notes: draft.notes,
  }
}

export async function listDrugReference(): Promise<DrugRefEntry[]> {
  const { data, error } = await supabase.from('drug_reference').select('*').order('medication')
  if (error) throw error
  return (data as DrugRefRow[]).map(toDomain)
}

export async function addDrugReference(draft: DrugRefEntryDraft): Promise<DrugRefEntry> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('drug_reference')
    .insert({ ...toRow(draft), owner_id: user.id })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as DrugRefRow)
}

export async function updateDrugReference(id: string, patch: Partial<DrugRefEntry>): Promise<DrugRefEntry> {
  const { data, error } = await supabase
    .from('drug_reference')
    .update(toRow(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return toDomain(data as DrugRefRow)
}

export async function deleteDrugReference(id: string): Promise<void> {
  const { error } = await supabase.from('drug_reference').delete().eq('id', id)
  if (error) throw error
}
