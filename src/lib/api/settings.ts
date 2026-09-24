import { supabase } from '../supabaseClient'
import type { UserSettings } from '../../types/domain'

export const DEFAULT_USER_SETTINGS: UserSettings = {
  anemiaHbThreshold: 8,
  acidosisPhThreshold: 7.35,
  acidosisHco3Threshold: 15,
}

interface UserSettingsRow {
  anemia_hb_threshold: number
  acidosis_ph_threshold: number
  acidosis_hco3_threshold: number
}

function toDomain(row: UserSettingsRow): UserSettings {
  return {
    anemiaHbThreshold: row.anemia_hb_threshold,
    acidosisPhThreshold: row.acidosis_ph_threshold,
    acidosisHco3Threshold: row.acidosis_hco3_threshold,
  }
}

export async function getUserSettings(): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('*').maybeSingle()
  if (error) throw error
  return data ? toDomain(data as UserSettingsRow) : DEFAULT_USER_SETTINGS
}

export async function updateUserSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const current = await getUserSettings()
  const next = { ...current, ...patch }
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        owner_id: user.id,
        anemia_hb_threshold: next.anemiaHbThreshold,
        acidosis_ph_threshold: next.acidosisPhThreshold,
        acidosis_hco3_threshold: next.acidosisHco3Threshold,
      },
      { onConflict: 'owner_id' }
    )
    .select()
    .single()
  if (error) throw error
  return toDomain(data as UserSettingsRow)
}
