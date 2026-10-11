import { useId, type ReactElement } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { getAnimationsEnabled } from '../../lib/animationsPreference'

// Shared pieces for the page-hero motion graphics. They all share the
// dashboard's urine-formation look: glassy tubes, red vessels, and small
// coloured solute particles on the navy hero.

export const C = {
  glassEdge: 'rgba(190,225,255,0.5)',
  glassLumen: 'rgba(140,200,255,0.16)',
  hero: 'rgba(10,35,82,0.78)',
  line: '#4F86E8',
  soft: '#9CC2FF',
  blood: '#a8322b',
  bloodHi: '#ff8a80',
  rbc: '#ff5a5a',
  protein: '#3d7bff',
  water: '#7fd4ff',
  glucose: '#ffd166',
  sodium: '#c792ff',
  amino: '#6ee7a8',
  urine: '#f3e08a',
  label: 'rgba(201,218,248,0.7)',
}

// Bean-shaped kidney (hilum on the right) in a 120×150 box.
export const KIDNEY = 'M60 8C30 8 12 36 12 74S30 142 62 142C82 142 92 128 88 112C85 100 76 94 76 80S86 58 88 44C92 22 80 8 60 8Z'

// True when decorative motion may run: no OS reduced-motion request and the
// Settings → Animations switch is on. CSS animations are silenced by
// index.css either way; this gates SVG <animateMotion>, which CSS can't reach.
export function useMotionAllowed(): boolean {
  const reduced = usePrefersReducedMotion()
  return !reduced && getAnimationsEnabled()
}

// Unique, colon-free ids for <defs> so several graphics can share a page.
export function useIds(prefix: string) {
  const uid = useId().replace(/:/g, '')
  return (name: string) => `${prefix}-${name}-${uid}`
}

// A shape that rides `href` from 0 to `until` of its length, fading in and
// out. opacity="0" keeps it hidden at the SVG origin until its first lap.
export function Rider({
  href,
  dur,
  begin,
  until = 1,
  rotate,
  children,
}: {
  href: string
  dur: number
  begin: number
  until?: number
  rotate?: boolean
  children: ReactElement
}) {
  const timing = { dur: `${dur}s`, begin: `${begin}s`, repeatCount: 'indefinite' }
  return (
    <g opacity="0">
      {children}
      <animateMotion {...timing} keyPoints={`0;${until}`} keyTimes="0;1" calcMode="linear" rotate={rotate ? 'auto' : undefined}>
        <mpath href={href} />
      </animateMotion>
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" {...timing} />
    </g>
  )
}

// Glassy tube: bright walls (wide light stroke) with a translucent lumen on top.
export function Glass({ d, width = 15 }: { d: string; width?: number }) {
  const common = { d, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <>
      <path {...common} stroke={C.glassEdge} strokeWidth={width} />
      <path {...common} stroke={C.hero} strokeWidth={width - 4} />
      <path {...common} stroke={C.glassLumen} strokeWidth={width - 4} />
    </>
  )
}

export function Vessel({ d, width = 6 }: { d: string; width?: number }) {
  const common = { d, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <>
      <path {...common} stroke={C.blood} strokeWidth={width} />
      <path {...common} stroke={C.bloodHi} strokeWidth={width * 0.32} opacity="0.55" />
    </>
  )
}

export function Rbc() {
  return <ellipse rx="4" ry="2.4" fill={C.rbc} stroke="#ffb3ad" strokeWidth="0.6" />
}

export function Dot({ r = 2.4, fill }: { r?: number; fill: string }) {
  return <circle r={r} fill={fill} />
}
