// Ported from the user's chapter-note calculator for Pediatric Nephrology
// (Emma et al., 2022) Ch. 53 "Autosomal Dominant Tubulointerstitial Kidney
// Disease" — scoring kept numerically identical to that worked reference.

// ---- 1) UMOD-score (Olinger 2020, as presented in the chapter) ----

export interface UmodScoreInput {
  familyHistoryEarlyGout: boolean
  unexplainedCkd: boolean
  histologyConsistent: boolean
  proteinuriaOrHematuria: boolean
  diabetesOrUncontrolledHtn: boolean
  largeKidneyOrCyst: boolean
  /** 0 = no gout, 3 = onset <30y, 1 = onset ≥30y */
  goutOnsetPoints: 0 | 1 | 3
  /** Serum uric acid (mg/dL); leave null if not hyperuricemic. */
  serumUricAcidMgDl: number | null
  urinaryUmodAvailable: boolean
}

export interface UmodScoreResult {
  score: number
  parts: string[]
  recommendation: string
}

export function umodScore(input: UmodScoreInput): UmodScoreResult {
  let score = 0
  const parts: string[] = []
  const add = (condition: boolean, points: number, label: string) => {
    if (!condition) return
    score += points
    parts.push(`${label} (${points > 0 ? '+' : ''}${points})`)
  }

  add(input.familyHistoryEarlyGout, 2, 'family history of early gout')
  add(input.unexplainedCkd, 2, 'unexplained CKD')
  add(input.goutOnsetPoints > 0, input.goutOnsetPoints, 'gout onset age')
  if (input.serumUricAcidMgDl != null) {
    const points = input.serumUricAcidMgDl > 8.41 ? 3 : 1
    add(true, points, `hyperuricemia ${input.serumUricAcidMgDl} mg/dL`)
  }
  add(input.histologyConsistent, 2, 'histology consistent with ADTKD')
  add(input.proteinuriaOrHematuria, -1, 'proteinuria/hematuria')
  add(input.diabetesOrUncontrolledHtn, -1, 'uncontrolled diabetes/HTN')
  add(input.largeKidneyOrCyst, -1, 'large kidney/cyst')

  let recommendation: string
  if (score > 8) {
    recommendation = 'Score >8: proceed directly to UMOD gene sequencing.'
  } else if (score >= 5) {
    recommendation = input.urinaryUmodAvailable
      ? 'Score 5–8: check urinary UMOD first; sequence the UMOD gene if it is low.'
      : 'Urinary UMOD unavailable and score ≥5: sequence the UMOD gene.'
  } else {
    recommendation = 'Score <5: ADTKD-UMOD is unlikely — consider other genes or causes.'
  }

  return { score, parts, recommendation }
}

// ---- 2) FEUrate — fractional excretion of uric acid ----

export function feUrate(urineUricAcidMgDl: number, serumUricAcidMgDl: number, urineCrMgDl: number, serumCrMgDl: number): number {
  return ((urineUricAcidMgDl * serumCrMgDl) / (serumUricAcidMgDl * urineCrMgDl)) * 100
}

// Bedside Schwartz eGFR, restated here only to flag when a low FEUrate is
// unreliable (GFR <80); the app's own schwartzEGFR in formulas.ts is the
// canonical version for the eGFR calculator itself.
export function bedsideSchwartzEgfrForFeUrate(heightCm: number, serumCrMgDl: number): number {
  return (0.413 * heightCm) / serumCrMgDl
}

// ---- 3) ADTKD gene finder (teaching exercise, not a validated tool) ----

export type AdtkdGene = 'UMOD' | 'MUC1' | 'REN' | 'HNF1B' | 'SEC61A1' | 'DNAJB11' | 'NPHP' | 'PAX2' | 'mtDNA'

export interface AdtkdGeneFeature {
  id: string
  label: string
  weights: Partial<Record<AdtkdGene, number>>
}

export const ADTKD_GENE_FEATURES: AdtkdGeneFeature[] = [
  { id: 'gout', label: 'Gout / early hyperuricemia', weights: { UMOD: 3, REN: 1, HNF1B: 1, SEC61A1: 1 } },
  { id: 'enur', label: 'Enuresis / polyuria / concentrating defect', weights: { UMOD: 3, REN: 1, HNF1B: 1 } },
  { id: 'only', label: 'Isolated slow CKD, bland urine, no gout', weights: { MUC1: 4 } },
  { id: 'earlyesrd', label: 'ESKD earlier than family gout onset', weights: { MUC1: 2 } },
  { id: 'anemia', label: 'Early anemia out of proportion to GFR', weights: { REN: 3, SEC61A1: 2 } },
  { id: 'hk', label: 'Disproportionate hyperkalemia', weights: { REN: 3, SEC61A1: 1 } },
  { id: 'lowbp', label: 'Hypotension / AKI with NSAIDs or dehydration', weights: { REN: 3 } },
  { id: 'puberty', label: 'Anemia improves at puberty', weights: { REN: 3 } },
  { id: 'neut', label: 'Neutropenia / skin abscesses', weights: { SEC61A1: 4 } },
  { id: 'cleft', label: 'Cleft palate / polydactyly / IUGR', weights: { SEC61A1: 4 } },
  { id: 'hyperecho', label: 'Fetal hyperechoic kidneys / CAKUT / cysts', weights: { HNF1B: 4 } },
  { id: 'mg', label: 'Hypomagnesemia (± hypokalemia)', weights: { HNF1B: 4 } },
  { id: 'dm', label: 'Early non-autoimmune diabetes (MODY)', weights: { HNF1B: 4 } },
  { id: 'mull', label: 'Müllerian/genital anomaly', weights: { HNF1B: 3 } },
  { id: 'autism', label: 'Autism / ADHD / developmental delay', weights: { HNF1B: 3 } },
  { id: 'lft', label: 'Elevated LFTs / pancreatic cysts', weights: { HNF1B: 3 } },
  { id: 'denovo', label: 'No family history', weights: { HNF1B: 2 } },
  { id: 'ngsneg', label: 'Negative NGS panel despite high suspicion', weights: { MUC1: 3 } },
  { id: 'bigcyst', label: 'Normal-size kidneys, many cysts, 5-gene panel negative', weights: { DNAJB11: 4 } },
  { id: 'recess', label: 'Healthy parents, affected sibling', weights: { NPHP: 4 } },
  { id: 'eye', label: 'Coloboma', weights: { PAX2: 5 } },
  { id: 'mat', label: 'Maternal-only transmission', weights: { mtDNA: 5 } },
]

export const ADTKD_GENE_HINT: Record<AdtkdGene, string> = {
  UMOD: 'UMOD-score, urinary UMOD, commercial gene test',
  MUC1: 'Broad Institute (VNTR analysis), MUC1-fs in urinary cells',
  REN: 'REN gene test; EPO, renin and aldosterone; fludrocortisone, avoid NSAIDs',
  HNF1B: 'Sequencing + MLPA ± microarray (17q12)',
  SEC61A1: 'Direct sequencing; CBC',
  DNAJB11: 'Atypical ADPKD-ADTKD',
  NPHP: 'Nephronophthisis (recessive)',
  PAX2: 'Renal coloboma syndrome',
  mtDNA: 'Mitochondrial disease',
}

export function scoreAdtkdGenes(selectedFeatureIds: string[]): Array<[AdtkdGene, number]> {
  const scores: Partial<Record<AdtkdGene, number>> = {}
  for (const feature of ADTKD_GENE_FEATURES) {
    if (!selectedFeatureIds.includes(feature.id)) continue
    for (const [gene, weight] of Object.entries(feature.weights) as Array<[AdtkdGene, number]>) {
      scores[gene] = (scores[gene] ?? 0) + weight
    }
  }
  return (Object.entries(scores) as Array<[AdtkdGene, number]>).sort((a, b) => b[1] - a[1])
}
