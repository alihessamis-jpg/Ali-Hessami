import { Glass, Rider, Vessel, useIds, useMotionAllowed } from '../heroArt/kit'

// Dashboard hero motion graphic: urine formation along one nephron.
// Blood (red cells + blue plasma proteins) runs through the glomerular
// tuft and leaves again; small solutes filter into Bowman's space and flow
// down a glassy tubule; glucose/amino acids are reabsorbed early, water and
// Na+ along the loop, and H+ is secreted into the collecting duct.

const AFFERENT = 'M0 34C18 34 26 52 34 66'
// A coiled capillary ball, like the tuft in the reference video.
const TUFT = 'C40 46 70 40 76 54S56 70 66 76S96 62 100 78S78 92 88 100S108 116 92 122S70 108 66 116S54 128 42 118S50 104 34 102'
const EFFERENT = 'C26 118 16 136 0 136'
const BLOOD = `${AFFERENT}${TUFT}${EFFERENT}`
const TUBULE = 'M118 85C138 58 150 112 170 86S196 56 210 76L232 146Q248 168 264 146L290 60C298 38 318 70 332 50S360 36 374 48L410 48L410 168'
const CAP_TOP = 'M120 26C150 16 182 40 214 26'
const VASA = 'M240 22C244 70 248 110 252 132Q256 142 260 132C264 110 268 70 272 22'
const CAP_DUCT = 'M440 20L440 168'

interface Solute {
  color: string
  r: number
  // Fraction of the tubule travelled before the solute leaves the lumen.
  until: number
  begin: number
}

// Glucose/amino acids go early (PCT), water and Na+ along the loop, urine solutes all the way.
const SOLUTES: Solute[] = [
  { color: '#ffd166', r: 2.8, until: 0.22, begin: 0 },
  { color: '#6ee7a8', r: 2.6, until: 0.2, begin: 1.1 },
  { color: '#7fd4ff', r: 2.2, until: 0.55, begin: 0.5 },
  { color: '#c792ff', r: 2.8, until: 0.62, begin: 1.6 },
  { color: '#7fd4ff', r: 2, until: 0.5, begin: 2.3 },
  { color: '#ffd166', r: 2.6, until: 0.22, begin: 3 },
  { color: '#f3e08a', r: 2.4, until: 1, begin: 0.8 },
  { color: '#c792ff', r: 2.4, until: 0.68, begin: 3.6 },
  { color: '#7fd4ff', r: 2.2, until: 0.58, begin: 4.2 },
  { color: '#f3e08a', r: 2.2, until: 1, begin: 4.8 },
  { color: '#6ee7a8', r: 2.4, until: 0.2, begin: 5.4 },
  { color: '#f3e08a', r: 2.6, until: 1, begin: 6.6 },
]
const TUBULE_S = 9

// Short hops across the tubule wall: [path, colour, begin].
const HOPS: Array<[string, string, number]> = [
  ['M160 76Q160 52 166 34', '#ffd166', 0.8], // PCT → peritubular capillary (glucose)
  ['M186 70Q186 50 192 34', '#6ee7a8', 2.2], // amino acids
  ['M220 106L248 104', '#7fd4ff', 1.4], // descending limb → vasa recta (water)
  ['M226 126L250 122', '#7fd4ff', 3.4],
  ['M280 96L262 98', '#c792ff', 2.6], // ascending limb → vasa recta (Na+)
  ['M276 114L260 116', '#c792ff', 4.4],
  ['M438 120L414 120', '#ff6b6b', 1.9], // secretion: capillary → collecting duct (H+)
  ['M438 90L414 90', '#ff6b6b', 4],
]

export function UrineFormationArt({ className }: { className?: string }) {
  const motion = useMotionAllowed()
  const id = useIds('uf')

  return (
    <svg className={className} viewBox="0 0 460 172" fill="none" aria-hidden="true">
      <defs>
        <path id={id('blood')} d={BLOOD} />
        <path id={id('tubule')} d={TUBULE} />
        {HOPS.map(([d], i) => (
          <path key={i} id={id(`hop${i}`)} d={d} />
        ))}
        <path id={id('filter-a')} d="M76 70Q100 70 118 85" />
        <path id={id('filter-b')} d="M80 104Q104 100 118 85" />
        <path id={id('filter-c')} d="M62 86Q96 88 118 85" />
        <radialGradient id={id('capsule')} cx="0.4" cy="0.4" r="0.7">
          <stop offset="0" stopColor="rgba(140,200,255,0.18)" />
          <stop offset="1" stopColor="rgba(140,200,255,0.04)" />
        </radialGradient>
      </defs>

      {/* Peritubular capillaries + vasa recta */}
      <Vessel d={CAP_TOP} width={5} />
      <Vessel d={VASA} width={5} />
      <Vessel d={CAP_DUCT} width={5} />

      {/* Tubule: PCT → loop of Henle → DCT → collecting duct */}
      <Glass d={TUBULE} />
      <path d={TUBULE} stroke="rgba(255,255,255,0.35)" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="4 10" className="dh-neph-flow" />

      {/* Bowman's capsule around the glomerular tuft */}
      <circle cx="68" cy="85" r="50" fill={`url(#${id('capsule')})`} stroke="rgba(190,225,255,0.55)" strokeWidth="2" />
      <Vessel d={AFFERENT} />
      <Vessel d={`M34 102${EFFERENT}`} />
      <g className="dh-neph-beat">
        <Vessel d={`M34 66${TUFT}`} width={7} />
      </g>

      {motion && (
        <>
          {/* Red cells and plasma proteins stay in the blood */}
          {[0, 0.9, 1.8, 2.7, 3.6].map((b, i) => (
            <Rider key={`rbc${i}`} href={`#${id('blood')}`} dur={4.5} begin={b} rotate>
              <ellipse rx="4" ry="2.4" fill="#ff5a5a" stroke="#ffb3ad" strokeWidth="0.6" />
            </Rider>
          ))}
          {[0.45, 2.25, 4].map((b, i) => (
            <Rider key={`prot${i}`} href={`#${id('blood')}`} dur={4.5} begin={b}>
              <circle r="3.4" fill="#3d7bff" stroke="#a9c6ff" strokeWidth="0.8" />
            </Rider>
          ))}

          {/* Filtrate crossing into Bowman's space */}
          {(['filter-a', 'filter-b', 'filter-c'] as const).flatMap((f, i) =>
            [0, 1.2].map((o) => (
              <Rider key={`${f}${o}`} href={`#${id(f)}`} dur={2} begin={i * 0.6 + o}>
                <circle r="1.8" fill={['#7fd4ff', '#ffd166', '#c792ff'][i]} />
              </Rider>
            ))
          )}

          {/* Solutes travelling the tubule */}
          {SOLUTES.map((s, i) => (
            <Rider key={`sol${i}`} href={`#${id('tubule')}`} dur={TUBULE_S * s.until + 0.6} begin={s.begin} until={s.until}>
              <circle r={s.r} fill={s.color} />
            </Rider>
          ))}

          {/* Reabsorption and secretion across the wall */}
          {HOPS.map(([, color, b], i) => (
            <Rider key={`hop${i}`} href={`#${id(`hop${i}`)}`} dur={1.8} begin={b}>
              <circle r="2.2" fill={color} />
            </Rider>
          ))}
        </>
      )}

      <g className="uf-labels" fill="rgba(201,218,248,0.7)" fontSize="8" fontFamily="Plus Jakarta Sans, sans-serif">
        <text x="40" y="160">Glomerulus</text>
        <text x="140" y="118">PCT</text>
        <text x="274" y="164">Loop of Henle</text>
        <text x="300" y="24">DCT</text>
        <text x="372" y="166">Duct</text>
      </g>
    </svg>
  )
}
