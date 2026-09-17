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
    'Urine Microalbumin',
  ],
  Immunology: ['C3', 'C4', 'ANA', 'ANCA', 'Anti-dsDNA'],
  'Infectious/Viral': ['CMV PCR (Quantitative)', 'CMV IgG', 'CMV IgM', 'EBV PCR (Quantitative)'],
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
