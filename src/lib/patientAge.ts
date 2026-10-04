// Patient.age is stored as a single decimal-year number, but it's entered
// and displayed as separate years/months — these are the shared
// compose/decompose/format helpers so every entry form and every display
// site agree on the same conversion.

export interface AgeYearsMonths {
  years: number
  months: number
}

export function ageToYearsMonths(age: number | null | undefined): AgeYearsMonths | null {
  if (age == null) return null
  let years = Math.floor(age)
  let months = Math.round((age - years) * 12)
  if (months === 12) {
    years += 1
    months = 0
  }
  return { years, months }
}

export function yearsMonthsToAge(years: number, months: number): number {
  return Math.round((years + months / 12) * 1000) / 1000
}

// e.g. "2y 4mo" for 2.33, "6mo" for 0.5, "3y" for 3 — never shows "0y".
export function formatAge(age: number | null | undefined): string | null {
  const ym = ageToYearsMonths(age)
  if (!ym) return null
  const { years, months } = ym
  if (years === 0) return `${months}mo`
  if (months === 0) return `${years}y`
  return `${years}y ${months}mo`
}
