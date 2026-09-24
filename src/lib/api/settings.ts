import { supabase } from '../supabaseClient'
import type { UserSettings } from '../../types/domain'

export const DEFAULT_USER_SETTINGS: UserSettings = {
  anemiaHbThreshold: 8,
}

interface UserSettingsRow {
  anemia_hb_threshold: number
}

function toDomain(row: UserSettingsRow): UserSettings {
  return {
    anemiaHbThreshold: row.anemia_hb_threshold,
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
    .upsert({ owner_id: user.id, anemia_hb_threshold: next.anemiaHbThreshold }, { onConflict: 'owner_id' })
    .select()
    .single()
  if (error) throw error
  return toDomain(data as UserSettingsRow)
}
