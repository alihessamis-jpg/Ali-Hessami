import { supabase } from '../supabaseClient'
import { getAuthUser } from './authUser'
import type { DrugRefEntry, DrugRefEntryDraft, RenalAdjustment } from '../../types/domain'

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
  source_key?: string | null
  source?: string | null
  source_chapter?: string | null
  source_pages?: string | null
  trade_names?: string | null
  drug_class?: string | null
  pregnancy_category?: string | null
  breastfeeding_category?: string | null
  renal_caution?: boolean | null
  hepatic_caution?: boolean | null
  pharmacogenomic?: boolean | null
  see_also?: string | null
  renal_adjustment?: RenalAdjustment[] | null
  neonatal_dose?: string | null
  meningitis_dose?: string | null
  how_supplied?: string | null
  interactions?: string | null
  renal_notes?: string | null
  monograph?: string | null
}

// The list view leaves out the heavy monograph text (~1 MB for the whole
// Harriet Lane formulary); an entry's full text is fetched when it's opened.
// These columns come from harriet_lane_reference_migration.sql.
const LIST_COLUMNS = [
  'id', 'medication', 'indication', 'normal_dose', 'pediatric_dose', 'dose_kg', 'max_dose', 'egfr_range',
  'adjusted_dose', 'frequency', 'notes', 'source_key', 'source', 'source_chapter', 'source_pages', 'trade_names',
  'drug_class', 'pregnancy_category', 'breastfeeding_category', 'renal_caution', 'hepatic_caution', 'pharmacogenomic',
  'see_also', 'renal_adjustment', 'neonatal_dose', 'meningitis_dose',
].join(',')
const LEGACY_COLUMNS = 'id,medication,indication,normal_dose,pediatric_dose,dose_kg,max_dose,egfr_range,adjusted_dose,frequency,notes'

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
    sourceKey: row.source_key ?? null,
    source: row.source ?? null,
    sourceChapter: row.source_chapter ?? null,
    sourcePages: row.source_pages ?? null,
    tradeNames: row.trade_names ?? null,
    drugClass: row.drug_class ?? null,
    pregnancyCategory: row.pregnancy_category ?? null,
    breastfeedingCategory: row.breastfeeding_category ?? null,
    renalCaution: row.renal_caution ?? null,
    hepaticCaution: row.hepatic_caution ?? null,
    pharmacogenomic: row.pharmacogenomic ?? null,
    seeAlso: row.see_also ?? null,
    renalAdjustment: row.renal_adjustment ?? null,
    neonatalDose: row.neonatal_dose ?? null,
    meningitisDose: row.meningitis_dose ?? null,
    howSupplied: row.how_supplied,
    interactions: row.interactions,
    renalNotes: row.renal_notes,
    monograph: row.monograph,
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
  let res = await supabase.from('drug_reference').select(LIST_COLUMNS).order('medication')
  // Before the Harriet Lane migration has been run the new columns don't
  // exist yet -- fall back to the original column set so the page still works.
  if (res.error && /column/i.test(res.error.message)) {
    res = await supabase.from('drug_reference').select(LEGACY_COLUMNS).order('medication')
  }
  if (res.error) throw res.error
  return (res.data as unknown as DrugRefRow[]).map(toDomain)
}

/** The full row, including the monograph text. */
export async function getDrugReference(id: string): Promise<DrugRefEntry> {
  const { data, error } = await supabase.from('drug_reference').select('*').eq('id', id).single()
  if (error) throw error
  return toDomain(data as DrugRefRow)
}

export interface FormularyHit {
  id: string
  medication: string
  source: string | null
  sourceChapter: string | null
  sourcePages: string | null
  drugClass: string | null
  excerpt: string
  matchedAll: boolean
}

/** Searches inside every monograph (indication, interaction, neonatal dosing…). */
export async function searchFormulary(q: string, k = 20): Promise<FormularyHit[]> {
  const { data, error } = await supabase.rpc('search_formulary', { q, k })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    medication: String(r.medication),
    source: (r.source as string) ?? null,
    sourceChapter: (r.source_chapter as string) ?? null,
    sourcePages: (r.source_pages as string) ?? null,
    drugClass: (r.drug_class as string) ?? null,
    excerpt: String(r.excerpt ?? ''),
    matchedAll: Boolean(r.matched_all),
  }))
}

export async function addDrugReference(draft: DrugRefEntryDraft): Promise<DrugRefEntry> {
  const {
    data: { user },
  } = await getAuthUser()
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
