import { useCallback, useEffect, useRef, useState } from 'react'

// Measures an element's own rendered width via ResizeObserver -- used to
// pick a layout by the space actually available (so Split View / Slide
// Over on iPad get the right layout), instead of matchMedia/device
// detection which only sees the viewport, not the container.
export function useElementWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const elRef = useRef<T | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    return () => observerRef.current?.disconnect()
  }, [])

  const setRef = useCallback((el: T | null) => {
    observerRef.current?.disconnect()
    elRef.current = el
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    observerRef.current = observer
    setWidth(el.getBoundingClientRect().width)
  }, [])

  return [setRef, width]
}
