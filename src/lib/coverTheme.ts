import type { BookTheme } from './bookCovers'

const CACHE_PREFIX = 'bsw-cover-theme:'
const memoryCache = new Map<string, BookTheme>()

function readCache(key: string): BookTheme | null {
  if (memoryCache.has(key)) return memoryCache.get(key) ?? null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const theme = JSON.parse(raw) as BookTheme
    memoryCache.set(key, theme)
    return theme
  } catch {
    return null
  }
}

function writeCache(key: string, theme: BookTheme) {
  memoryCache.set(key, theme)
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(theme))
  } catch {
    // best-effort; in-memory cache above still saves the repeat work this session
  }
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v))
}

function toHex(n: number) {
  const s = Math.round(clamp(n)).toString(16)
  return s.length < 2 ? '0' + s : s
}

function shade(r: number, g: number, b: number, factor: number, lighten: boolean) {
  let r2 = r
  let g2 = g
  let b2 = b
  if (lighten) {
    r2 = r + (255 - r) * (factor - 1) * 0.5
    g2 = g + (255 - g) * (factor - 1) * 0.5
    b2 = b + (255 - b) * (factor - 1) * 0.5
  } else {
    r2 = r * factor
    g2 = g * factor
    b2 = b * factor
  }
  return '#' + toHex(r2) + toHex(g2) + toHex(b2)
}

// Samples the cover image's dominant hue via a tiny offscreen canvas,
// skipping near-white/near-black/low-saturation pixels (page margins,
// shadows) so the picked color is an actual hue from the artwork. Derives
// a dark card background, a lightened accent, and a lightened dot color
// from it. Result is cached (in-memory + localStorage) per cover path, so
// extraction runs once per cover rather than on every render/mount.
export function extractCoverTheme(coverSrc: string, fallback: BookTheme): Promise<BookTheme> {
  const cached = readCache(coverSrc)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const w = 24
        const h = 24
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('no 2d context')
        ctx.drawImage(img, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)

        const buckets = new Map<string, { r: number; g: number; b: number; n: number }>()
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (max > 235 && min > 215) continue // near-white
          if (max < 25) continue // near-black
          if (max - min < 18) continue // low saturation
          const key = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4)
          const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 }
          bucket.r += r
          bucket.g += g
          bucket.b += b
          bucket.n += 1
          buckets.set(key, bucket)
        }

        let best: { r: number; g: number; b: number; n: number } | null = null
        for (const bucket of buckets.values()) {
          if (!best || bucket.n > best.n) best = bucket
        }
        if (!best) throw new Error('no dominant color found')

        const r0 = best.r / best.n
        const g0 = best.g / best.n
        const b0 = best.b / best.n
        const theme: BookTheme = {
          bg: shade(r0, g0, b0, 0.34, false),
          accent: shade(r0, g0, b0, 1.25, true),
          dot: shade(r0, g0, b0, 1.5, true),
        }
        writeCache(coverSrc, theme)
        resolve(theme)
      } catch {
        resolve(fallback)
      }
    }
    img.onerror = () => resolve(fallback)
    img.src = coverSrc
  })
}
