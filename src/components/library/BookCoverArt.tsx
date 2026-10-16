import { useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface BookCoverArtProps {
  coverSrc: string
  onTilt?: (x: number, y: number) => void
}

const MAX_TILT_DEG = 10
const SPRING_FACTOR = 0.18
const SETTLE_EPSILON = 0.05

// Cover thumbnail + float/shadow/shine (features 1-4) plus touch parallax
// (feature 7): dragging over the cover tilts it toward the pointer and
// springs back on release. Pointer handling and the tilt itself run
// through refs + requestAnimationFrame, never React state, so dragging
// never triggers a re-render.
export function BookCoverArt({ coverSrc, onTilt }: BookCoverArtProps) {
  const clusterRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const onTiltRef = useRef(onTilt)
  onTiltRef.current = onTilt

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
      className="bsw-cover"
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
    </div>
  )
}
