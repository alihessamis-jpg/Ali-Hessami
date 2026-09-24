export interface VaccineReferenceEntry {
  name: string
  isLive: boolean
}

// Common pediatric vaccines (including Iran's national schedule), classified
// by whether they're live-attenuated -- the distinction that matters for
// transplant timing: live vaccines must be completed before transplant and
// are generally contraindicated afterward, on immunosuppression.
export const STANDARD_VACCINES: VaccineReferenceEntry[] = [
  { name: 'BCG', isLive: true },
  { name: 'Hepatitis B', isLive: false },
  { name: 'DTaP (Diphtheria-Tetanus-Pertussis)', isLive: false },
  { name: 'Tdap', isLive: false },
  { name: 'IPV (Inactivated Polio)', isLive: false },
  { name: 'OPV (Oral Polio)', isLive: true },
  { name: 'Hib (Haemophilus influenzae type b)', isLive: false },
  { name: 'PCV (Pneumococcal conjugate)', isLive: false },
  { name: 'PPSV23 (Pneumococcal polysaccharide)', isLive: false },
  { name: 'Rotavirus', isLive: true },
  { name: 'MMR (Measles-Mumps-Rubella)', isLive: true },
  { name: 'Varicella (Chickenpox)', isLive: true },
  { name: 'MMRV', isLive: true },
  { name: 'Hepatitis A', isLive: false },
  { name: 'Influenza (injectable, IIV)', isLive: false },
  { name: 'Influenza (nasal spray, LAIV)', isLive: true },
  { name: 'HPV', isLive: false },
  { name: 'Meningococcal (MenACWY)', isLive: false },
  { name: 'Meningococcal B', isLive: false },
  { name: 'Typhoid (injectable, Vi)', isLive: false },
  { name: 'Typhoid (oral, Ty21a)', isLive: true },
  { name: 'Rabies', isLive: false },
  { name: 'COVID-19 (mRNA/inactivated)', isLive: false },
]

export function knownVaccineIsLive(name: string): boolean | null {
  const entry = STANDARD_VACCINES.find((v) => v.name === name)
  return entry ? entry.isLive : null
}
