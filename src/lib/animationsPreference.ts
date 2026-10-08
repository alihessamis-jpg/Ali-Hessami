// User-level override for the Settings → Animations switch. Independent of
// the OS-level prefers-reduced-motion media query (which index.css already
// honors everywhere) — this lets someone disable motion without changing
// their system setting. Persisted in localStorage and applied as a class on
// <html> (`.force-reduced-motion`), since a stored preference can't be
// expressed as a media feature; see the matching CSS block in index.css.
const STORAGE_KEY = 'nephron:animations-enabled'

export function getAnimationsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(STORAGE_KEY) !== 'false'
}

export function applyAnimationsPreference(enabled: boolean = getAnimationsEnabled()): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('force-reduced-motion', !enabled)
}

export function setAnimationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, String(enabled))
  applyAnimationsPreference(enabled)
}
