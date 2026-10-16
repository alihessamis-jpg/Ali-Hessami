import { useCallback, useEffect, useRef, useState } from 'react'

// Measures an element's own rendered width via ResizeObserver -- used to
// pick a layout by the space actually available (so Split View / Slide
// Over on iPad get the right layout), instead of matchMedia/device
// detection which only sees the viewport, not the container.
//
// Rounds to whole pixels and skips the state update when the width hasn't
// actually changed: ResizeObserver can fire repeatedly for sub-pixel
// fluctuations (a loading cover image, font swap, scrollbar appearing),
// and on a container sitting right at a layout breakpoint, re-rendering
// on every one of those can flip the layout back and forth continuously.
// Rounding alone doesn't fully solve that (see BookSwitcher's hysteresis
// for the breakpoint itself) but it cuts most of the noise at the source.
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const elRef = useRef<T | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const widthRef = useRef(0)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    return () => observerRef.current?.disconnect()
  }, [])

  const report = useCallback((raw: number) => {
    const rounded = Math.round(raw)
    if (rounded === widthRef.current) return
    widthRef.current = rounded
    setWidth(rounded)
  }, [])

  const setRef = useCallback(
    (el: T | null) => {
      observerRef.current?.disconnect()
      elRef.current = el
      if (!el) return
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) report(entry.contentRect.width)
      })
      observer.observe(el)
      observerRef.current = observer
      report(el.getBoundingClientRect().width)
    },
    [report]
  )

  return [setRef, width]
}
