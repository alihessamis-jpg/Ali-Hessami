import type { CSSProperties } from 'react'
import type { BookTheme } from '../../lib/bookCovers'

interface BookBackdropProps {
  theme: BookTheme
}

const PETAL_ANGLES = [0, 60, 120, 180, 240, 300]
const RING_RADII = [40, 60, 80]
const DOTS: Array<[number, number, number]> = [
  [40, 50, 2.2],
  [160, 60, 1.6],
  [70, 150, 1.8],
  [150, 140, 2.4],
  [100, 30, 1.4],
  [30, 120, 1.6],
  [170, 100, 2],
]

// Per-book themed backdrop for the Library header card (replaces the
// WebGL HeroScene mount there -- SVG/CSS only per spec, so this stays
// smooth without a three.js render loop, and recolors per book without a
// custom shader). Pediatric Nephrology's navy look comes from its own
// fallback theme in bookCovers.ts, not from special-casing here.
export function BookBackdrop({ theme }: BookBackdropProps) {
  const style = {
    '--card-accent': theme.accent,
    '--card-dot': theme.dot,
  } as CSSProperties

  return (
    <div className="bsw-backdrop" style={style} aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <g className="bsw-petals">
          {PETAL_ANGLES.map((deg) => (
            <ellipse key={deg} cx="100" cy="60" rx="14" ry="38" transform={`rotate(${deg} 100 100)`} />
          ))}
        </g>
        <g className="bsw-rings">
          {RING_RADII.map((r) => (
            <circle key={r} cx="100" cy="100" r={r} />
          ))}
        </g>
        <g className="bsw-dots">
          {DOTS.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      </svg>
    </div>
  )
}
