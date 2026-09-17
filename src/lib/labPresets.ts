// Suggestions only — the Labs form falls back to free text for anything not
// listed here, so an uncommon test can still be entered manually.
export const LAB_CATEGORY_TESTS: Record<string, string[]> = {
  'Renal function': ['Creatinine', 'BUN', 'eGFR', 'Cystatin C'],
  Electrolytes: ['Sodium', 'Potassium', 'Chloride', 'Bicarbonate', 'Calcium', 'Ionized Calcium', 'Phosphorus', 'Magnesium'],
  'Protein/Nutrition': ['Albumin', 'Total Protein'],
  CBC: ['Hemoglobin', 'Hematocrit', 'WBC', 'Platelets', 'ANC', 'Neutrophils', 'Lymphocytes'],
  Inflammatory: ['ESR', 'CRP'],
  Coagulation: ['PT', 'PTT', 'INR', 'Fibrinogen'],
  Urine: [
    'SG',
    'Urinalysis - Protein',
    'Urinalysis - Blood',
    'Urinalysis - Glucose',
    'Urinalysis - Nitrite',
    'Urinalysis - Leukocyte Esterase',
    'Urine RBC',
    'Urine WBC',
    'Urine Bacteria',
    'Urine Casts',
    'Urine Crystals',
    'Urine Protein/Creatinine Ratio',
    'Urine Pro/Cr - First Morning',
    'Urine Pro/Cr - Random',
    'Urine Microalbumin',
    'Urine Sodium',
    'Urine Creatinine',
    'Urine Urea Nitrogen',
    'Urine Dysmorphic RBC',
  ],
  Immunology: ['C3', 'C4', 'ANA', 'ANCA', 'Anti-dsDNA', 'P-ANCA (MPO)', 'C-ANCA (PR3)'],
  'Infectious/Viral': ['CMV PCR (Quantitative)', 'CMV IgG', 'CMV IgM', 'EBV PCR (Quantitative)', 'ASO'],
  Microbiology: ['Blood Culture', 'Urine Culture'],
  'Peritoneal Fluid': ['PD Fluid Cell Count', 'PD Fluid Segments (%)', 'PD Fluid Gram Stain', 'PD Fluid Culture'],
  CSF: ['CSF WBC', 'CSF RBC', 'CSF Segments (%)', 'CSF Lymphocytes (%)', 'CSF Protein', 'CSF Glucose', 'CSF Gram Stain', 'CSF Culture'],
  'Endocrine/Bone': ['PTH', '25-OH Vitamin D', 'Alkaline Phosphatase'],
  Lipids: ['Total Cholesterol', 'Triglycerides'],
  Liver: ['ALT', 'AST'],
  'Iron studies': ['Ferritin', 'Iron', 'TIBC', 'Transferrin Saturation'],
  'Blood Gas': ['VBG - pH', 'VBG - pCO2', 'VBG - pO2', 'VBG - HCO3', 'VBG - Base Excess', 'Lactate'],
}

export const LAB_CATEGORIES = Object.keys(LAB_CATEGORY_TESTS)

export const COMMON_LAB_TESTS = Object.values(LAB_CATEGORY_TESTS).flat()

// Urine dipstick results are semi-quantitative, not numeric — these tests get
// a Negative/Trace/+1.."+4" picker instead of a number input.
export const DIPSTICK_TESTS = new Set([
  'Urinalysis - Protein',
  'Urinalysis - Blood',
  'Urinalysis - Glucose',
  'Urinalysis - Nitrite',
  'Urinalysis - Leukocyte Esterase',
])

export const DIPSTICK_OPTIONS = ['Negative', 'Trace', '+1', '+2', '+3', '+4']

// Serologies reported as qualitative results rather than a number.
export const QUALITATIVE_TESTS = new Set(['ANA', 'Anti-dsDNA', 'ANCA', 'P-ANCA (MPO)', 'C-ANCA (PR3)'])

export const QUALITATIVE_OPTIONS = ['Negative', 'Positive']

// Any test whose Value field should be a text picker (dipstick grade or
// qualitative result) rather than a number input.
export function textValueOptions(test: string): string[] | null {
  if (DIPSTICK_TESTS.has(test)) return DIPSTICK_OPTIONS
  if (QUALITATIVE_TESTS.has(test)) return QUALITATIVE_OPTIONS
  return null
}

// Culture tests get a structured organism/colony-count/susceptibility form
// instead of a plain value field.
export const CULTURE_TESTS = new Set(['Blood Culture', 'Urine Culture', 'PD Fluid Culture', 'CSF Culture'])

export const COLLECTION_METHODS = [
  'Clean catch',
  'Catheter',
  'Suprapubic',
  'Midstream',
  'Peripheral venipuncture',
  'Central line',
  'Other',
]

export const SUSCEPTIBILITY_RESULTS: Array<'S' | 'I' | 'R'> = ['S', 'I', 'R']

export function isPositiveCulture(organism: string): boolean {
  return !/no growth|negative|no organism/i.test(organism)
}
