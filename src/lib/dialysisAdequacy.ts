// Standard PET (Peritoneal Equilibration Test) transporter categories, based
// on the 4-hour dialysate/plasma (D/P) creatinine ratio.
export type PetTransporterCategory = 'High' | 'High-average' | 'Low-average' | 'Low'

export function classifyPetTransporter(dpCreatinineRatio: number): PetTransporterCategory {
  if (dpCreatinineRatio > 0.81) return 'High'
  if (dpCreatinineRatio >= 0.65) return 'High-average'
  if (dpCreatinineRatio >= 0.5) return 'Low-average'
  return 'Low'
}

export const PET_TRANSPORTER_NOTE: Record<PetTransporterCategory, string> = {
  High: 'Fast solute transport — favors short-dwell, low-volume exchanges (e.g. APD); ultrafiltration is harder to sustain over long dwells.',
  'High-average': 'Slightly favors shorter dwells; most patients tolerate standard CAPD or APD schedules.',
  'Low-average': 'Slightly favors longer dwells for adequate solute clearance; ultrafiltration is generally reliable.',
  Low: 'Slow solute transport — needs longer dwells (favors CAPD) to achieve adequate clearance; ultrafiltration is usually excellent.',
}

// KDOQI/ISPD-style pediatric adequacy targets — used only as a rough flag,
// not a substitute for center-specific targets.
export const KTV_PD_TARGET_WEEKLY = 1.7
export const KTV_HD_TARGET_SINGLE_POOL = 1.2
export const URR_HD_TARGET_PCT = 65
