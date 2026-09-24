import { supabase } from '../supabaseClient'
import type { UserSettings } from '../../types/domain'

export const DEFAULT_USER_SETTINGS: UserSettings = {
  anemiaHbThreshold: 8,
  acidosisPhThreshold: 7.35,
  acidosisHco3Threshold: 15,
  ckdMbdCaLow: 8.5,
  ckdMbdCaHigh: 10.5,
  ckdMbdPthHigh: 65,
  ckdMbdPthLow: 10,
  ckdMbdVitDDeficient: 20,
  ckdMbdVitDInsufficient: 30,
  ckdMbdBicarbLow: 22,
}

interface UserSettingsRow {
  anemia_hb_threshold: number
  acidosis_ph_threshold: number
  acidosis_hco3_threshold: number
  ckd_mbd_ca_low: number
  ckd_mbd_ca_high: number
  ckd_mbd_pth_high: number
  ckd_mbd_pth_low: number
  ckd_mbd_vitd_deficient: number
  ckd_mbd_vitd_insufficient: number
  ckd_mbd_bicarb_low: number
}

function toDomain(row: UserSettingsRow): UserSettings {
  return {
    anemiaHbThreshold: row.anemia_hb_threshold,
    acidosisPhThreshold: row.acidosis_ph_threshold,
    acidosisHco3Threshold: row.acidosis_hco3_threshold,
    ckdMbdCaLow: row.ckd_mbd_ca_low,
    ckdMbdCaHigh: row.ckd_mbd_ca_high,
    ckdMbdPthHigh: row.ckd_mbd_pth_high,
    ckdMbdPthLow: row.ckd_mbd_pth_low,
    ckdMbdVitDDeficient: row.ckd_mbd_vitd_deficient,
    ckdMbdVitDInsufficient: row.ckd_mbd_vitd_insufficient,
    ckdMbdBicarbLow: row.ckd_mbd_bicarb_low,
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
        ckd_mbd_ca_low: next.ckdMbdCaLow,
        ckd_mbd_ca_high: next.ckdMbdCaHigh,
        ckd_mbd_pth_high: next.ckdMbdPthHigh,
        ckd_mbd_pth_low: next.ckdMbdPthLow,
        ckd_mbd_vitd_deficient: next.ckdMbdVitDDeficient,
        ckd_mbd_vitd_insufficient: next.ckdMbdVitDInsufficient,
        ckd_mbd_bicarb_low: next.ckdMbdBicarbLow,
      },
      { onConflict: 'owner_id' }
    )
    .select()
    .single()
  if (error) throw error
  return toDomain(data as UserSettingsRow)
}
