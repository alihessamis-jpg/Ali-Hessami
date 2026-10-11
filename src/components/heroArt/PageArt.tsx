import type { ReactNode } from 'react'
import { C, Dot, Glass, KIDNEY, Rbc, Rider, Vessel, useIds, useMotionAllowed } from './kit'

// Page-hero motion graphics, one per section, each tied to what the page is
// for. All share a 240×140 canvas and the kit's visual language. Motion is
// SMIL (<animate*>), rendered only when useMotionAllowed() — otherwise each
// graphic shows its static end state.

function Art({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg className="np-art hero-art" viewBox="0 0 240 140" fill="none" aria-hidden="true" data-art={label}>
      {children}
    </svg>
  )
}

const loop = { repeatCount: 'indefinite' } as const

/* ---- Case Log: ultrasound-guided kidney biopsy ---- */
export function BiopsyArt() {
  const motion = useMotionAllowed()
  const id = useIds('bx')
  const NEEDLE = { values: '0 0;-40 -5;-40 -5;0 0;0 0', keyTimes: '0;0.3;0.5;0.75;1' }
  return (
    <Art label="biopsy">
      <defs>
        <radialGradient id={id('cortex')} cx="0.45" cy="0.45" r="0.6">
          <stop offset="0" stopColor="rgba(255,120,120,0.3)" />
          <stop offset="1" stopColor="rgba(255,120,120,0.08)" />
        </radialGradient>
        <path id={id('artery')} d="M206 28C172 32 140 60 108 72" />
      </defs>
      <Vessel d="M206 28C172 32 140 60 108 72" />
      <g transform="translate(36 4) scale(0.88)">
        <path d={KIDNEY} fill={`url(#${id('cortex')})`} stroke={C.glassEdge} strokeWidth="2.4" />
        {/* medullary pyramids */}
        <path d="M44 40L64 58L40 62Z M30 76L56 76L34 96Z M46 112L64 92L40 114Z" fill="rgba(255,138,128,0.22)" />
      </g>
      {/* guide line the needle travels, into the lower pole */}
      <path d="M236 135L70 113" stroke="rgba(255,255,255,0.22)" strokeWidth="1" strokeDasharray="3 5" />
      <g>
        <path d="M130 121L214 132" stroke="#dfe7f5" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="210" y="127" width="22" height="12" rx="3" fill={C.line} transform="rotate(7.7 221 133)" />
        {/* tissue core, visible after the needle withdraws */}
        <path d="M131 121L140 122" stroke="#ff9a9a" strokeWidth="3" strokeLinecap="round" opacity={motion ? 0 : 1}>
          {motion && <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.55;0.62;0.95;1" dur="4s" {...loop} />}
        </path>
        {motion && <animateTransform attributeName="transform" type="translate" dur="4s" calcMode="spline" keySplines="0.2 0.8 0.2 1;0 0 1 1;0.2 0.8 0.2 1;0 0 1 1" {...NEEDLE} {...loop} />}
      </g>
      {motion && (
        <>
          <circle cx="90" cy="116" r="3" stroke="#ffd166" strokeWidth="1.5" opacity="0">
            <animate attributeName="r" values="3;3;12" keyTimes="0;0.3;0.5" dur="4s" {...loop} />
            <animate attributeName="opacity" values="0;0.9;0" keyTimes="0;0.3;0.5" dur="4s" {...loop} />
          </circle>
          {[0, 0.7, 1.4].map((b) => (
            <Rider key={b} href={`#${id('artery')}`} dur={2.1} begin={b} rotate>
              <Rbc />
            </Rider>
          ))}
        </>
      )}
    </Art>
  )
}

/* ---- Academic Activity: presenting renal data to an audience ---- */
export function PresentationArt() {
  const motion = useMotionAllowed()
  const id = useIds('pr')
  const BARS = [30, 44, 36, 56, 68]
  return (
    <Art label="presentation">
      <defs>
        <path id={id('laser')} d="M64 66L82 52L100 60L118 40L136 30L118 40L100 60L82 52Z" />
      </defs>
      <rect x="40" y="6" width="160" height="96" rx="9" fill="rgba(255,255,255,0.06)" stroke={C.soft} strokeWidth="1.6" />
      <path d="M120 102V112M104 112H136" stroke={C.soft} strokeWidth="1.6" strokeLinecap="round" />
      <g transform="translate(150 16) scale(0.16)">
        <path d={KIDNEY} fill="rgba(255,138,128,0.35)" stroke={C.bloodHi} strokeWidth="8" />
      </g>
      <path d="M150 50H186M150 60H180M150 70H184" stroke="rgba(201,218,248,0.4)" strokeWidth="2" strokeLinecap="round" />
      {BARS.map((h, i) => (
        <g key={i} transform={`translate(${56 + i * 18} 94)`}>
          <rect x="0" y={-h} width="11" height={h} rx="2" fill={i === 4 ? C.glucose : C.line} opacity={i === 4 ? 1 : 0.85}>
            {motion && <animate attributeName="height" values={`0;${h};${h};0`} keyTimes="0;0.25;0.85;1" dur="6s" begin={`${i * 0.15}s`} {...loop} />}
            {motion && <animate attributeName="y" values={`0;${-h};${-h};0`} keyTimes="0;0.25;0.85;1" dur="6s" begin={`${i * 0.15}s`} {...loop} />}
          </rect>
        </g>
      ))}
      {motion && (
        <Rider href={`#${id('laser')}`} dur={6} begin={1.2}>
          <g>
            <circle r="5" fill="rgba(255,90,90,0.35)" />
            <circle r="2.2" fill="#ff5a5a" />
          </g>
        </Rider>
      )}
      {/* audience */}
      {[54, 84, 114, 144, 174].map((x, i) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <circle cx="6" cy="124" r="5" fill="rgba(156,194,255,0.55)" />
          <path d="M-2 140C-2 132 14 132 14 140" fill="rgba(156,194,255,0.35)" />
          {motion && <animateTransform attributeName="transform" type="translate" values={`${x} 0;${x} -2;${x} 0`} dur="2.4s" begin={`${i * 0.4}s`} {...loop} />}
        </g>
      ))}
    </Art>
  )
}

/* ---- Reference: a drug infused, filtered by the kidney, excreted in urine ---- */
export function DosingArt() {
  const motion = useMotionAllowed()
  const id = useIds('ds')
  const LINE = 'M48 72C48 116 140 118 194 70'
  const URETER = 'M198 78C190 100 204 118 198 138'
  return (
    <Art label="dosing">
      <defs>
        <path id={id('line')} d={LINE} />
        <path id={id('ureter')} d={URETER} />
      </defs>
      {/* IV bag + drip chamber */}
      <rect x="28" y="4" width="40" height="46" rx="9" fill="rgba(127,212,255,0.12)" stroke={C.soft} strokeWidth="1.6" />
      <rect x="31" y="22" width="34" height="25" rx="6" fill="rgba(199,146,255,0.35)">
        {motion && <animate attributeName="height" values="25;19;25" dur="12s" {...loop} />}
        {motion && <animate attributeName="y" values="22;28;22" dur="12s" {...loop} />}
      </rect>
      <path d="M38 12H58" stroke="rgba(201,218,248,0.5)" strokeWidth="2" strokeLinecap="round" />
      <rect x="42" y="54" width="12" height="18" rx="4" fill="rgba(127,212,255,0.1)" stroke={C.soft} strokeWidth="1.4" />
      <circle cx="48" cy="58" r="2" fill={C.sodium} opacity={motion ? 0 : 1}>
        {motion && <animate attributeName="cy" values="57;69" dur="1.2s" {...loop} />}
        {motion && <animate attributeName="opacity" values="1;1;0" keyTimes="0;0.8;1" dur="1.2s" {...loop} />}
      </circle>
      <Glass d={LINE} width={8} />
      <Glass d={URETER} width={8} />
      <g transform="translate(250 6) scale(-0.72 0.72)">
        <path d={KIDNEY} fill="rgba(255,120,120,0.16)" stroke={C.glassEdge} strokeWidth="3" />
        {/* the kidney glows as the drug arrives */}
        <path d={KIDNEY} fill="rgba(199,146,255,0.28)" opacity={motion ? 0 : 0.5}>
          {motion && <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.6s" {...loop} />}
        </path>
      </g>
      {motion && (
        <>
          {[0, 0.8, 1.6].map((b) => (
            <Rider key={`d${b}`} href={`#${id('line')}`} dur={2.4} begin={b}>
              <Dot fill={C.sodium} r={2.6} />
            </Rider>
          ))}
          {[0.6, 1.4, 2.2].map((b, i) => (
            <Rider key={`u${b}`} href={`#${id('ureter')}`} dur={2.4} begin={b}>
              <Dot fill={i === 1 ? C.sodium : C.urine} r={2.2} />
            </Rider>
          ))}
        </>
      )}
    </Art>
  )
}

/* ---- Calculators: eGFR gauge over a filtering glomerular membrane ---- */
export function FiltrationGaugeArt() {
  const motion = useMotionAllowed()
  const id = useIds('gf')
  const ARC = 'M68 72A52 52 0 0 1 172 72'
  const PORES = [72, 100, 128, 156]
  return (
    <Art label="gauge">
      <defs>
        <linearGradient id={id('arc')} x1="68" y1="0" x2="172" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff6b6b" />
          <stop offset="0.5" stopColor={C.glucose} />
          <stop offset="1" stopColor={C.amino} />
        </linearGradient>
        {PORES.map((x, i) => (
          <path key={x} id={id(`pore${i}`)} d={`M${x + 6} 84L${x + 6} 138`} />
        ))}
      </defs>
      <path d={ARC} stroke="rgba(255,255,255,0.12)" strokeWidth="10" strokeLinecap="round" />
      <path d={ARC} stroke={`url(#${id('arc')})`} strokeWidth="10" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="0.3">
        {motion && <animate attributeName="stroke-dashoffset" values="1;0.3;0.38;0.3" keyTimes="0;0.3;0.65;1" dur="5s" {...loop} />}
      </path>
      <g transform="rotate(36 120 72)">
        <path d="M120 72L120 32" stroke="#f5f5f7" strokeWidth="2.6" strokeLinecap="round" />
        {motion && <animateTransform attributeName="transform" type="rotate" values="-90 120 72;36 120 72;22 120 72;36 120 72" keyTimes="0;0.3;0.65;1" dur="5s" {...loop} />}
      </g>
      <circle cx="120" cy="72" r="5" fill="#f5f5f7" />
      <text x="150" y="68" textAnchor="middle" fontSize="8" fontWeight="700" fill={C.label} fontFamily="-apple-system, system-ui, sans-serif">
        eGFR
      </text>
      {/* membrane with pores */}
      <path d={`M40 108H${PORES[0]}${PORES.map((x, i) => `M${x + 12} 108H${PORES[i + 1] ?? 200}`).join('')}`} stroke={C.glassEdge} strokeWidth="4" strokeLinecap="round" />
      {motion && (
        <>
          {PORES.flatMap((_, i) =>
            [0, 1.1].map((o) => (
              <Rider key={`${i}${o}`} href={`#${id(`pore${i}`)}`} dur={2.2} begin={i * 0.45 + o}>
                <Dot fill={[C.water, C.glucose, C.sodium, C.urine][i]} r={2} />
              </Rider>
            ))
          )}
          {[52, 96, 188].map((x, i) => (
            <circle key={x} cx={x} cy="92" r="5" fill={C.protein} stroke="#a9c6ff" strokeWidth="0.8">
              <animate attributeName="cy" values="86;100;86" dur="1.6s" begin={`${i * 0.5}s`} {...loop} />
            </circle>
          ))}
        </>
      )}
    </Art>
  )
}

/* ---- Academy: an open book whose page draws a working nephron ---- */
export function NephronBookArt() {
  const motion = useMotionAllowed()
  const id = useIds('bk')
  const NEPH = 'M142 52C150 40 160 60 168 48L176 100Q182 114 188 100L196 52H208V114'
  const draw = (begin: number, dur = 6) =>
    motion ? <animate attributeName="stroke-dashoffset" values="1;0;0;1" keyTimes="0;0.35;0.9;1" dur={`${dur}s`} begin={`${begin}s`} {...loop} /> : null
  return (
    <Art label="book">
      <defs>
        <path id={id('neph')} d={NEPH} />
      </defs>
      <path d="M18 30Q68 18 118 34V128Q68 112 18 124Z" fill="rgba(255,255,255,0.07)" stroke={C.soft} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M222 30Q172 18 122 34V128Q172 112 222 124Z" fill="rgba(255,255,255,0.07)" stroke={C.soft} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M120 34V130" stroke={C.soft} strokeWidth="1.6" />
      <path d="M200 22V40L205 36L210 40V22" fill={C.glucose} />
      {[48, 60, 72, 84, 96, 108].map((y, i) => (
        <path key={y} d={`M32 ${y}H${i % 3 === 2 ? 84 : 104}`} stroke="rgba(201,218,248,0.45)" strokeWidth="2.4" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="0">
          {draw(i * 0.25)}
        </path>
      ))}
      <g>
        <circle cx="136" cy="56" r="8" stroke={C.glassEdge} strokeWidth="1.6" />
        <path d="M131 54c3-5 9-5 9 0s-6 3-3 7" stroke={C.bloodHi} strokeWidth="2" strokeLinecap="round" />
      </g>
      <Glass d={NEPH} width={7} />
      <path d={NEPH} stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset="0">
        {draw(0.4)}
      </path>
      {motion &&
        [0, 1.3, 2.6].map((b, i) => (
          <Rider key={b} href={`#${id('neph')}`} dur={3.9} begin={b}>
            <Dot fill={[C.glucose, C.water, C.sodium][i]} r={2} />
          </Rider>
        ))}
    </Art>
  )
}

/* ---- High-Yield: key points lighting up across the kidney ---- */
export function PearlsArt() {
  const motion = useMotionAllowed()
  const id = useIds('hy')
  const PEARLS: Array<[number, number]> = [
    [40, 34],
    [28, 76],
    [44, 112],
    [62, 56],
    [60, 96],
  ]
  return (
    <Art label="pearls">
      <g transform="translate(64 2) scale(0.9)">
        <path id={id('kidney')} d={KIDNEY} fill="rgba(255,120,120,0.12)" stroke={C.glassEdge} strokeWidth="2.4" />
        <path d="M44 40L64 58L40 62Z M30 76L56 76L34 96Z M46 112L64 92L40 114Z" fill="rgba(255,138,128,0.2)" />
        {PEARLS.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="3.4" fill="#fff" />
            <circle cx={x} cy={y} r="4" stroke={C.glucose} strokeWidth="1.6" opacity={motion ? 0 : 0.8}>
              {motion && <animate attributeName="r" values="4;4;14" keyTimes="0;0.02;0.25" dur="4s" begin={`${i * 0.8}s`} {...loop} />}
              {motion && <animate attributeName="opacity" values="0;1;0" keyTimes="0;0.02;0.25" dur="4s" begin={`${i * 0.8}s`} {...loop} />}
            </circle>
          </g>
        ))}
        {motion && (
          <Rider href={`#${id('kidney')}`} dur={4} begin={0}>
            <g>
              <circle r="6" fill="rgba(255,209,102,0.3)" />
              <circle r="2.6" fill={C.glucose} />
            </g>
          </Rider>
        )}
      </g>
      <path d="M196 14L178 50H192L182 82L210 40H194L204 14Z" fill={C.glucose} stroke="#fff3c4" strokeWidth="1" strokeLinejoin="round">
        {motion && <animate attributeName="opacity" values="1;0.55;1;1;0.7;1" keyTimes="0;0.05;0.1;0.6;0.65;0.7" dur="3s" {...loop} />}
      </path>
    </Art>
  )
}

/* ---- Study Hub: kidney at the centre of linked concepts ---- */
export function ConceptGraphArt() {
  const motion = useMotionAllowed()
  const id = useIds('cg')
  const NODES: Array<[number, number, string, string]> = [
    [34, 26, 'Na⁺', C.sodium],
    [34, 114, 'K⁺', C.amino],
    [206, 26, 'GFR', C.water],
    [206, 114, 'PTH', C.glucose],
    [120, 10, 'pH', '#ff8a80'],
    [120, 130, 'Ca²⁺', '#9CC2FF'],
  ]
  return (
    <Art label="graph">
      <defs>
        {NODES.map(([x, y], i) => (
          <path key={i} id={id(`e${i}`)} d={`M120 70L${x} ${y}`} />
        ))}
      </defs>
      {NODES.map(([x, y], i) => (
        <path key={i} d={`M120 70L${x} ${y}`} stroke="rgba(156,194,255,0.4)" strokeWidth="1.4" strokeDasharray="3 4" />
      ))}
      {motion &&
        NODES.map(([, , , color], i) => (
          <Rider key={i} href={`#${id(`e${i}`)}`} dur={1.6} begin={i * 0.55}>
            <Dot fill={color} r={2.4} />
          </Rider>
        ))}
      {NODES.map(([x, y, label, color], i) => (
        <g key={label}>
          <circle cx={x} cy={y} r="11" fill="rgba(10,35,82,0.9)" stroke={color} strokeWidth="1.6">
            {motion && <animate attributeName="stroke-width" values="1.6;3.4;1.6" keyTimes="0;0.15;0.4" dur="3.3s" begin={`${i * 0.55 + 1.4}s`} {...loop} />}
          </circle>
          <text x={x} y={y + 3} textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#eef3ff" fontFamily="-apple-system, system-ui, sans-serif">
            {label}
          </text>
        </g>
      ))}
      <circle cx="120" cy="70" r="20" fill="rgba(41,98,255,0.35)" stroke={C.soft} strokeWidth="1.6">
        {motion && <animate attributeName="r" values="20;22;20" dur="2.4s" {...loop} />}
      </circle>
      <g transform="translate(108 56) scale(0.2)">
        <path d={KIDNEY} fill="rgba(255,138,128,0.6)" stroke={C.bloodHi} strokeWidth="6" />
      </g>
    </Art>
  )
}

/* ---- Research: a glomerulus under the microscope ---- */
export function MicroscopeArt() {
  const motion = useMotionAllowed()
  const id = useIds('ms')
  const NUCLEI: Array<[number, number]> = [
    [104, 60],
    [116, 76],
    [128, 62],
    [110, 88],
    [134, 84],
    [122, 50],
    [60, 40],
    [178, 98],
    [72, 108],
    [170, 36],
    [150, 120],
    [90, 24],
  ]
  return (
    <Art label="microscope">
      <defs>
        <clipPath id={id('lens')}>
          <circle cx="120" cy="70" r="56" />
        </clipPath>
      </defs>
      <circle cx="120" cy="70" r="56" fill="rgba(255,170,190,0.12)" />
      <g clipPath={`url(#${id('lens')})`}>
        <g>
          {/* surrounding tubule cross-sections */}
          {[
            [56, 64],
            [184, 66],
            [92, 118],
            [160, 20],
            [70, 20],
            [176, 116],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="13" stroke="rgba(255,150,180,0.55)" strokeWidth="5" />
          ))}
          {/* glomerulus: Bowman's capsule + capillary loops */}
          <circle cx="120" cy="70" r="30" stroke="rgba(255,190,205,0.7)" strokeWidth="2" />
          <path
            d="M102 62c4-12 18-12 18-2s-12 8-6 16 18 4 20-6M106 80c8 8 22 8 28-2M120 52c8-4 16 2 12 10"
            stroke="rgba(230,100,140,0.85)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {NUCLEI.map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="rgba(140,90,220,0.9)" />
          ))}
          {motion && <animateTransform attributeName="transform" type="translate" values="0 0;-8 5;6 -4;0 0" dur="12s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" {...loop} />}
        </g>
        {motion && (
          <rect x="64" y="14" width="112" height="2" fill="rgba(127,212,255,0.6)">
            <animate attributeName="y" values="14;126;14" dur="5s" {...loop} />
          </rect>
        )}
      </g>
      <circle cx="120" cy="70" r="56" stroke={C.soft} strokeWidth="3" />
      <circle cx="120" cy="70" r="63" stroke="rgba(156,194,255,0.45)" strokeWidth="2" strokeDasharray="2 6">
        {motion && <animateTransform attributeName="transform" type="rotate" values="0 120 70;360 120 70" dur="30s" {...loop} />}
      </circle>
      <path d="M120 20V30M120 110V120M70 70H80M160 70H170" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
    </Art>
  )
}

/* ---- Export: data streaming out of the kidney into a spreadsheet ---- */
export function DataFlowArt() {
  const motion = useMotionAllowed()
  const id = useIds('dx')
  const STREAM = 'M66 70C96 40 118 98 148 66'
  const CELLS = Array.from({ length: 12 }, (_, i) => [162 + (i % 3) * 16, 34 + Math.floor(i / 3) * 16] as const)
  return (
    <Art label="export">
      <defs>
        <path id={id('stream')} d={STREAM} />
      </defs>
      <g transform="translate(6 18) scale(0.66)">
        <path d={KIDNEY} fill="rgba(255,120,120,0.14)" stroke={C.glassEdge} strokeWidth="3" />
      </g>
      <Glass d={STREAM} width={9} />
      <rect x="150" y="14" width="68" height="94" rx="9" fill="rgba(255,255,255,0.08)" stroke={C.soft} strokeWidth="1.6" />
      <path d="M150 28H218" stroke={C.soft} strokeWidth="1.2" />
      {CELLS.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="12" height="10" rx="2" fill={[C.water, C.glucose, C.amino, C.sodium][i % 4]} opacity={motion ? 0 : 0.85}>
          {motion && <animate attributeName="opacity" values="0;0;0.85;0.85;0" keyTimes={`0;${(i / 14).toFixed(2)};${((i + 1) / 14).toFixed(2)};0.92;1`} dur="7s" {...loop} />}
        </rect>
      ))}
      <g>
        <path d="M184 116V132M177 126L184 133L191 126" stroke={C.glucose} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {motion && <animateTransform attributeName="transform" type="translate" values="0 -3;0 2;0 -3" dur="1.6s" {...loop} />}
      </g>
      {motion &&
        [0, 0.5, 1, 1.5].map((b, i) => (
          <Rider key={b} href={`#${id('stream')}`} dur={2} begin={b}>
            <rect x="-3" y="-3" width="6" height="6" rx="1.5" fill={[C.water, C.glucose, C.amino, C.sodium][i]} />
          </Rider>
        ))}
    </Art>
  )
}

/* ---- Academic CV: a CV writing itself, sealed with a kidney ---- */
export function CvArt() {
  const motion = useMotionAllowed()
  const LINES: Array<[number, number, number]> = [
    [96, 30, 150],
    [96, 40, 136],
    [74, 62, 166],
    [74, 72, 156],
    [74, 82, 162],
    [74, 98, 150],
    [74, 108, 140],
  ]
  return (
    <Art label="cv">
      <rect x="62" y="10" width="116" height="124" rx="10" fill="rgba(238,243,255,0.95)" />
      <circle cx="82" cy="34" r="10" fill="#9CC2FF" />
      {LINES.map(([x1, y, x2], i) => (
        <path key={y} d={`M${x1} ${y}H${x2}`} stroke={i < 2 ? '#1e5bd8' : '#9fb3d6'} strokeWidth={i < 2 ? 3 : 2.4} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset="0">
          {motion && <animate attributeName="stroke-dashoffset" values="1;1;0;0;1" keyTimes={`0;${(i * 0.09).toFixed(2)};${(i * 0.09 + 0.09).toFixed(2)};0.92;1`} dur="7s" {...loop} />}
        </path>
      ))}
      {/* kidney seal */}
      <g transform="translate(168 112)">
        <path d="M-8 10L-12 26L-4 21L0 28L2 12Z M8 10L12 26L4 21L0 28L-2 12Z" fill="#d94b4b" />
        <circle r="17" fill="#ffc46b" stroke="#fff1cc" strokeWidth="2" />
        <circle r="12.5" stroke="#b97800" strokeWidth="1" strokeDasharray="2 2.4">
          {motion && <animateTransform attributeName="transform" type="rotate" values="0;360" dur="14s" {...loop} />}
        </circle>
        <g transform="translate(-6 -7.5) scale(0.1)">
          <path d={KIDNEY} fill="#b4441f" />
        </g>
      </g>
    </Art>
  )
}

/* ---- Settings: a lab trend crossing an adjustable alert threshold ---- */
export function ThresholdArt() {
  const motion = useMotionAllowed()
  const id = useIds('th')
  // Two identical periods side by side so a 100px shift loops seamlessly.
  const TREND = 'M0 92L20 86L36 96L52 60L64 74L80 70L100 92L120 86L136 96L152 60L164 74L180 70L200 92L220 86L236 96L252 60L264 74L280 70L300 92'
  const THRESH = { values: '64;54;70;64', dur: '8s' }
  return (
    <Art label="threshold">
      <defs>
        <clipPath id={id('chart')}>
          <rect x="24" y="12" width="192" height="96" rx="8" />
        </clipPath>
      </defs>
      <rect x="24" y="12" width="192" height="96" rx="8" fill="rgba(255,255,255,0.05)" stroke="rgba(156,194,255,0.35)" strokeWidth="1.2" />
      <g clipPath={`url(#${id('chart')})`}>
        <g>
          <path d={TREND} stroke={C.water} strokeWidth="2.4" strokeLinejoin="round" transform="translate(24 0)" />
          {motion && <animateTransform attributeName="transform" type="translate" values="0 0;-100 0" dur="5s" {...loop} />}
        </g>
        <g>
          <path d="M24 64H216" stroke="#ff6b6b" strokeWidth="1.6" strokeDasharray="5 4" />
          <rect x="24" y="12" width="192" height="52" fill="rgba(255,107,107,0.08)" />
          {motion && <animateTransform attributeName="transform" type="translate" values="0 0;0 -10;0 6;0 0" dur={THRESH.dur} {...loop} />}
        </g>
      </g>
      {/* threshold slider */}
      <path d="M44 126H196" stroke="rgba(156,194,255,0.4)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="120" cy="126" r="7" fill="#f5f5f7">
        {motion && <animate attributeName="cx" values="120;98;132;120" dur={THRESH.dur} {...loop} />}
      </circle>
      {/* alert bell */}
      <g transform="translate(206 20)">
        <circle r="11" fill="#ff6b6b" />
        <path d="M-4 3V-1a4 4 0 0 1 8 0v4l1.5 1.5h-11Z M-1.5 6.5a1.5 1.5 0 0 0 3 0" fill="#fff" />
        {motion && <animateTransform attributeName="transform" type="rotate" values="0;-14;12;-8;0;0" keyTimes="0;0.05;0.1;0.15;0.2;1" dur="2.5s" additive="sum" {...loop} />}
      </g>
    </Art>
  )
}
