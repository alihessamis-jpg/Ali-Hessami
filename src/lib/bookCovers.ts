// Maps a seeded book's title to its cover art and a manual fallback theme
// (used when live color extraction -- src/lib/coverTheme.ts -- fails or
// hasn't resolved yet). Keyed by exact title since LibraryBook has no cover
// column; a book with no entry here just gets no cover thumbnail.

export interface BookTheme {
  bg: string
  accent: string
  dot: string
}

interface BookCoverEntry {
  cover: string
  fallbackTheme: BookTheme
}

const COVERS: Record<string, BookCoverEntry> = {
  'Pediatric Nephrology': {
    cover: '/book-covers/pediatric-nephrology.webp',
    fallbackTheme: { bg: '#0b1f44', accent: '#5b9dff', dot: '#ff6b6b' },
  },
  'Handbook of Kidney Transplantation': {
    cover: '/book-covers/handbook-of-kidney-transplantation.webp',
    fallbackTheme: { bg: '#15264a', accent: '#f5a623', dot: '#f5c876' },
  },
  'Diagnostic Atlas of Renal Pathology': {
    cover: '/book-covers/diagnostic-atlas-of-renal-pathology.webp',
    fallbackTheme: { bg: '#2b1d0f', accent: '#e0b84d', dot: '#f2d98a' },
  },
  'Handbook of Dialysis': {
    cover: '/book-covers/handbook-of-dialysis.webp',
    fallbackTheme: { bg: '#07292b', accent: '#2dd4bf', dot: '#7fe8da' },
  },
  'Nelson Textbook of Pediatrics': {
    cover: '/book-covers/nelson-textbook-of-pediatrics.webp',
    fallbackTheme: { bg: '#0d2e1f', accent: '#4ade80', dot: '#9af0bd' },
  },
}

const DEFAULT_THEME: BookTheme = { bg: '#0b1f44', accent: '#5b9dff', dot: '#ff6b6b' }

export function getBookCover(title: string): string | null {
  return COVERS[title]?.cover ?? null
}

export function getFallbackTheme(title: string): BookTheme {
  return COVERS[title]?.fallbackTheme ?? DEFAULT_THEME
}
