import { useEffect, useRef, useState } from 'react'
import { useMotionAllowed } from '../heroArt/kit'
import { SCENES, type SceneId } from './sceneEngine'

// Shared engine for every page hero: one requestAnimationFrame loop and one
// IntersectionObserver for all mounted scenes, matching the original motion
// kit's `live` Set + `io` pattern but scoped as module state so every
// <HeroScene> on the page rides the same loop instead of each starting its
// own rAF.

interface Instance {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  scene: SceneId
  intersecting: boolean
}

const instances = new Map<HTMLCanvasElement, Instance>()
const live = new Set<HTMLCanvasElement>()
let tabVisible = typeof document === 'undefined' || document.visibilityState === 'visible'
let rafId: number | null = null

function recompute(cv: HTMLCanvasElement) {
  const inst = instances.get(cv)
  if (!inst) return
  const shouldLive = inst.intersecting && tabVisible
  if (shouldLive) live.add(cv)
  else live.delete(cv)
  ensureLoop()
}

function ensureLoop() {
  if (rafId != null || live.size === 0) return
  rafId = requestAnimationFrame(frame)
}

function frame(ms: number) {
  rafId = null
  const t = ms / 1000
  live.forEach((cv) => {
    const inst = instances.get(cv)
    if (!inst) return
    inst.ctx.clearRect(0, 0, inst.w, inst.h)
    SCENES[inst.scene](inst.ctx, inst.w, inst.h, t)
  })
  ensureLoop()
}

let io: IntersectionObserver | null = null
function getObserver(): IntersectionObserver {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cv = entry.target as HTMLCanvasElement
          const inst = instances.get(cv)
          if (!inst) continue
          inst.intersecting = entry.isIntersecting
          recompute(cv)
        }
      },
      { rootMargin: '100px' }
    )
  }
  return io
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    tabVisible = document.visibilityState === 'visible'
    instances.forEach((_inst, cv) => recompute(cv))
  })
}

// Per-video existence cache so several <HeroScene page="x"> mounts (or
// remounts via route changes) don't each re-probe the network.
const videoAvailability = new Map<string, boolean>()

function videoSrc(page: string, ext: 'mp4' | 'webm') {
  return `/motion/${page}.${ext}`
}

interface HeroSceneProps {
  scene: SceneId
  /** Video lookup key for /public/motion/{page}.mp4 -- defaults to `scene`. */
  page?: string
  className?: string
  /** Chapter-header use on the Reader: lower opacity, no pointer events. */
  opacity?: number
}

export function HeroScene({ scene, page, className, opacity }: HeroSceneProps) {
  const pageKey = page ?? scene
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const motionAllowed = useMotionAllowed()
  const [videoOk, setVideoOk] = useState(videoAvailability.get(pageKey) ?? null)

  // Probe once per page key for /public/motion/{page}.mp4. A missing file
  // (no video produced yet) just keeps the canvas -- this is the switch
  // described in the request, wired now so dropping files in later needs
  // no further code change.
  useEffect(() => {
    if (videoAvailability.has(pageKey)) {
      setVideoOk(videoAvailability.get(pageKey)!)
      return
    }
    let cancelled = false
    fetch(videoSrc(pageKey, 'mp4'), { method: 'HEAD' })
      .then((res) => {
        if (cancelled) return
        // A SPA host without a dedicated 404 (Vercel's client-routing
        // rewrite, etc.) can answer a missing file with 200 + index.html --
        // guard against that false positive by requiring a video content type.
        const ok = res.ok && (res.headers.get('content-type') ?? '').startsWith('video/')
        videoAvailability.set(pageKey, ok)
        setVideoOk(ok)
      })
      .catch(() => {
        if (cancelled) return
        videoAvailability.set(pageKey, false)
        setVideoOk(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageKey])

  useEffect(() => {
    if (videoOk) return // video element takes over; canvas isn't mounted
    const cv = canvasRef.current
    const wrap = wrapRef.current
    if (!cv || !wrap) return

    const ctx = cv.getContext('2d')
    if (!ctx) return

    function resize() {
      const rect = wrap!.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width))
      const h = Math.max(1, Math.round(rect.height))
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv!.width = w * dpr
      cv!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const inst = instances.get(cv!)
      if (inst) {
        inst.w = w
        inst.h = h
      } else {
        instances.set(cv!, { ctx: ctx!, w, h, scene, intersecting: false })
      }
      // Draw one frame immediately so a resize (or first mount) never
      // shows a blank canvas while waiting for the next rAF tick.
      ctx!.clearRect(0, 0, w, h)
      SCENES[scene](ctx!, w, h, motionAllowed ? performance.now() / 1000 : 2)
    }

    resize()
    const inst = instances.get(cv)!
    inst.scene = scene

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    if (motionAllowed) {
      const observer = getObserver()
      observer.observe(cv)
      return () => {
        observer.unobserve(cv)
        instances.delete(cv)
        live.delete(cv)
        ro.disconnect()
      }
    }

    // prefers-reduced-motion (or the app's Animations setting is off):
    // one still frame only, never joins the live set.
    return () => {
      instances.delete(cv)
      live.delete(cv)
      ro.disconnect()
    }
  }, [scene, motionAllowed, videoOk])

  return (
    <div ref={wrapRef} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {videoOk ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={`/motion/${pageKey}.webp`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity }}
        >
          <source src={videoSrc(pageKey, 'webm')} type="video/webm" />
          <source src={videoSrc(pageKey, 'mp4')} type="video/mp4" />
        </video>
      ) : (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', opacity }}
        />
      )}
    </div>
  )
}
