// Original inline-SVG nephron illustration: a pulsing glomerulus feeding
// a tubule that a dashed stroke animates "flow" along (stroke-dashoffset),
// with two soft radial glows drifting slowly behind it. Pure decoration —
// the pulse/flow/drift loops are driven by CSS keyframes in index.css
// (.nephron-glomerulus / .nephron-tubule / .nephron-glow), and disabled
// under prefers-reduced-motion there too.
export function NephronIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 260"
      fill="none"
      className={`nephron-illustration ${className ?? ''}`}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="nephron-glow-a" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2f63ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#2f63ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nephron-glow-b" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6fa8ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6fa8ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nephron-glomerulus-fill" cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#bcd4ff" />
          <stop offset="100%" stopColor="#5f8cf0" />
        </radialGradient>
      </defs>

      <circle className="nephron-glow" cx="70" cy="60" r="90" fill="url(#nephron-glow-a)" />
      <circle className="nephron-glow nephron-glow--b" cx="170" cy="190" r="70" fill="url(#nephron-glow-b)" />

      {/* Tubule: proximal segment, loop of Henle, distal segment + duct */}
      <path
        className="nephron-tubule"
        d="M78 70 C 110 78, 118 96, 104 118 C 86 146, 70 158, 82 188 C 92 210, 60 214, 58 236 C 56 250, 90 252, 110 240"
        stroke="#8fb4ff"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />

      {/* Glomerulus: capillary tuft inside Bowman's capsule */}
      <circle cx="64" cy="54" r="30" stroke="#8fb4ff" strokeWidth="2.5" fill="none" opacity="0.6" />
      <g className="nephron-glomerulus">
        <circle cx="64" cy="54" r="21" fill="url(#nephron-glomerulus-fill)" />
        <circle cx="57" cy="47" r="5" fill="#eef3ff" opacity="0.55" />
        <circle cx="72" cy="58" r="4" fill="#eef3ff" opacity="0.45" />
        <circle cx="62" cy="62" r="3.5" fill="#eef3ff" opacity="0.4" />
      </g>
    </svg>
  )
}
