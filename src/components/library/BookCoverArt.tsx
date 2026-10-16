import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface BookCoverArtProps {
  coverSrc: string
  active: boolean
  pctRead: number
  onTilt?: (x: number, y: number) => void
}

const ENTRANCE_MS = 450

const MAX_TILT_DEG = 10
const SPRING_FACTOR = 0.18
const SETTLE_EPSILON = 0.05

// Cover thumbnail + float/shadow/shine (features 1-4) plus touch parallax
// (feature 7): dragging over the cover tilts it toward the pointer and
// springs back on release. Pointer handling and the tilt itself run
// through refs + requestAnimationFrame, never React state, so dragging
// never triggers a re-render.
export function BookCoverArt({ coverSrc, active, pctRead, onTilt }: BookCoverArtProps) {
  const pct = Math.max(0, Math.min(100, Math.round(pctRead)))
  const clusterRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const onTiltRef = useRef(onTilt)
  onTiltRef.current = onTilt

  // Entrance: plays whenever this card becomes/stays the active one on a
  // real book switch, but not for the book shown by default on first
  // paint. The carousel keeps one persistent instance per book (so a
  // switch toggles `active`); the desktop sidebar keeps one instance for
  // the whole switcher (so a switch instead changes `coverSrc` while
  // `active` stays true) -- skipping only the very first effect run
  // covers both without telling them apart.
  const isFirstRunRef = useRef(true)
  const [entering, setEntering] = useState(false)
  useEffect(() => {
    const wasFirstRun = isFirstRunRef.current
    isFirstRunRef.current = false
    if (!active || wasFirstRun) return
    setEntering(true)
    const t = window.setTimeout(() => setEntering(false), ENTRANCE_MS)
    return () => window.clearTimeout(t)
  }, [active, coverSrc])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  function startLoop() {
    if (rafRef.current != null) return
    const tick = () => {
      const cur = currentRef.current
      const target = targetRef.current
      cur.x += (target.x - cur.x) * SPRING_FACTOR
      cur.y += (target.y - cur.y) * SPRING_FACTOR
      const tilt = tiltRef.current
      if (tilt) tilt.style.transform = `rotateY(${cur.x}deg) rotateX(${cur.y}deg)`
      onTiltRef.current?.(cur.x, cur.y)
      const dx = Math.abs(target.x - cur.x)
      const dy = Math.abs(target.y - cur.y)
      if (dx > SETTLE_EPSILON || dy > SETTLE_EPSILON) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        rafRef.current = null
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function updateTarget(clientX: number, clientY: number) {
    const el = clusterRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = (clientX - rect.left) / rect.width - 0.5
    const py = (clientY - rect.top) / rect.height - 0.5
    targetRef.current = {
      x: Math.max(-1, Math.min(1, px)) * MAX_TILT_DEG,
      y: Math.max(-1, Math.min(1, -py)) * MAX_TILT_DEG,
    }
    startLoop()
  }

  function reset() {
    targetRef.current = { x: 0, y: 0 }
    startLoop()
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    e.currentTarget.setPointerCapture(e.pointerId)
    updateTarget(e.clientX, e.clientY)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.buttons === 0 && e.pointerType === 'mouse') return
    updateTarget(e.clientX, e.clientY)
  }

  return (
    <div
      className={entering ? 'bsw-cover bsw-cover-entering' : 'bsw-cover'}
      aria-hidden="true"
      ref={clusterRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={reset}
      onPointerCancel={reset}
      onPointerLeave={reset}
    >
      <div className="bsw-cover-shadow" />
      <div className="bsw-cover-float">
        <div className="bsw-cover-tilt" ref={tiltRef}>
          <img className="bsw-cover-img" src={coverSrc} alt="" loading="lazy" />
          <div className="bsw-cover-shine" />
        </div>
      </div>
      <svg className="bsw-cover-ring" viewBox="0 0 92 118">
        <rect className="bsw-cover-ring-track" x="2" y="2" width="88" height="114" rx="11" pathLength={100} />
        <rect
          className="bsw-cover-ring-fill"
          x="2"
          y="2"
          width="88"
          height="114"
          rx="11"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
        />
      </svg>
      <span className="bsw-cover-ring-pct">{pct}%</span>
    </div>
  )
}
