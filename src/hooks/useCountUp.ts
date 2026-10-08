import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

// Animates a displayed number from 0 up to `target` over `durationMs`.
// Used for the Cr/eGFR stat values on the dashboard patient list —
// skips straight to the final value under prefers-reduced-motion.
export function useCountUp(target: number | null | undefined, durationMs = 700): number | null {
  const reducedMotion = usePrefersReducedMotion()
  const [value, setValue] = useState<number | null>(target ?? null)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (target == null) {
      setValue(null)
      return
    }
    if (reducedMotion) {
      setValue(target)
      return
    }
    const start = performance.now()
    const from = 0
    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(from + (target! - from) * eased)
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick)
      }
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [target, durationMs, reducedMotion])

  return value
}
