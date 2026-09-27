import type { ResearchField } from '../types/domain'

// Formulas reference other fields by label, e.g. "{Pre weight} - {Post weight}"
// -- the same {Field Name} convention Jotform's calculation widget uses, so a
// formula copied from an existing Jotform form mostly just works as-is.
export function evaluateResearchFormula(
  formula: string,
  fields: ResearchField[],
  valuesByFieldId: Record<string, string>
): number | null {
  if (!formula.trim()) return null
  let expr = formula
  for (const f of fields) {
    const token = `{${f.label}}`
    if (!expr.includes(token)) continue
    const raw = valuesByFieldId[f.id]
    const num = raw === undefined || raw === '' ? NaN : Number(raw)
    expr = expr.split(token).join(Number.isFinite(num) ? String(num) : '0')
  }
  // Whitelist: only digits, decimal points, whitespace, and + - * / ( ) may
  // remain once every {Field} token has been substituted -- anything else
  // (an unmatched {token}, stray letters) means the formula can't be safely
  // evaluated, so bail out rather than risk running arbitrary code.
  if (!/^[-+*/().\s\d]+$/.test(expr)) return null
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)()
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

// Resolves every Calculated Field in order, letting a formula reference an
// earlier calculated field as well as a raw one -- so a multi-step formula
// (e.g. "UF rate" built from an earlier "Total UF" calculated field) works
// without the author having to inline everything into one expression.
export function computeResearchValues(fields: ResearchField[], draft: Record<string, string>): Record<string, string> {
  const values = { ...draft }
  for (const f of fields) {
    if (f.type === 'Calculated Field') {
      const result = evaluateResearchFormula(f.formula ?? '', fields, values)
      values[f.id] = result != null ? String(result) : ''
    }
  }
  return values
}
