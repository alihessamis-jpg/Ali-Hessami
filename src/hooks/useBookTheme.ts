import { useEffect, useState } from 'react'
import { extractCoverTheme } from '../lib/coverTheme'
import type { BookTheme } from '../lib/bookCovers'

// Starts from the manual fallback theme (instant, no flash of default
// colors) and swaps to the live-extracted one once it resolves -- resolves
// synchronously from cache after the first visit to a given cover.
export function useBookTheme(coverSrc: string | null, fallback: BookTheme): BookTheme {
  const [theme, setTheme] = useState(fallback)

  useEffect(() => {
    setTheme(fallback)
    if (!coverSrc) return
    let cancelled = false
    extractCoverTheme(coverSrc, fallback).then((resolved) => {
      if (!cancelled) setTheme(resolved)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverSrc])

  return theme
}
