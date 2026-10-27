import { useEffect, useRef } from 'react'
import type {
  Group,
  InstancedMesh,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Texture,
  BufferGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import { useMotionAllowed } from '../heroArt/kit'

// Dashboard hero stage: a sagittally sectioned kidney (cortex, medullary
// pyramids, renal artery/vein branches, pelvis + ureter) floating in the
// middle, tilting toward the pointer, with red cells, white cells and
// platelets circulating around it and plasma specks rising behind.
//
// Everything is one WebGL canvas (instanced cells) so the hero costs one
// draw loop, and the loop pauses when the hero is off-screen, the tab is
// hidden, or motion is turned off. `three` and GLTFLoader are dynamic
// imports, and the model (public/models, ~4 MB, cached by the service
// worker after the first visit) loads after the page has painted.

export type KidneyMode = 'clinical' | 'academy'

type ThreeModule = typeof import('three')
type GLTFLoaderModule = typeof import('three/examples/jsm/loaders/GLTFLoader.js')
type RoomEnvModule = typeof import('three/examples/jsm/environments/RoomEnvironment.js')

interface StageApi {
  setMode: (mode: KidneyMode) => void
  dispose: () => void
}

const MODEL_URL = '/models/kidney-section.glb'

export function KidneyStage({ mode, className }: { mode: KidneyMode; className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<StageApi | null>(null)
  const modeRef = useRef(mode)
  const motionAllowed = useMotionAllowed()

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let cancelled = false
    Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/environments/RoomEnvironment.js'),
    ])
      .then(([THREE, gltf, room]) => {
        if (cancelled || !wrapRef.current) return
        apiRef.current = mountKidneyStage(THREE, gltf, room, wrapRef.current, motionAllowed)
      })
      .catch((err) => console.error('Kidney hero failed to start', err))
    return () => {
      cancelled = true
      apiRef.current?.dispose()
      apiRef.current = null
    }
  }, [motionAllowed])

  useEffect(() => {
    if (modeRef.current === mode) return
    modeRef.current = mode
    apiRef.current?.setMode(mode)
  }, [mode])

  return <div ref={wrapRef} className={className} aria-hidden="true" />
}

/* ---------------- easing ---------------- */
const easeInQuad = (x: number) => x * x
const backOut = (x: number, s: number) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

interface Cell {
  theta: number
  omega: number
  rx: number
  ry: number
  z: number
  size: number
  floatDur: number
  phase: number
  q0: Quaternion
  axis: Vector3
  angle: number
  spin: number
  ox: number
  oy: number
}

function mountKidneyStage(
  THREE: ThreeModule,
  gltfModule: GLTFLoaderModule,
  roomModule: RoomEnvModule,
  container: HTMLElement,
  motionAllowed: boolean
): StageApi {
  let renderer: WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return { setMode: () => {}, dispose: () => {} }
  }

  const geometries: BufferGeometry[] = []
  const materials: Material[] = []
  const textures: Texture[] = []
  const geo = <T extends BufferGeometry>(g: T): T => (geometries.push(g), g)
  const mat = <T extends Material>(m: T): T => (materials.push(m), m)

  const DPR = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(DPR)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.domElement.style.display = 'block'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera: PerspectiveCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 60)
  camera.position.set(0, 0, 12)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envRT = pmrem.fromScene(new roomModule.RoomEnvironment(), 0.04)
  scene.environment = envRT.texture
  pmrem.dispose()
  const key = new THREE.DirectionalLight(0xfff4ec, 1.6)
  key.position.set(3, 5, 8)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x8fd6ff, 1.1)
  rim.position.set(-6, -2, -4)
  scene.add(rim)

  // mutable state shared by the loader callback, resize and the frame loop
  let clock = 0
  let disposed = false
  let visible = true
  let switchStart = -1
  let reseeded = false
  let gather = 0
  let spin = 0
  const ptr = { x: 0, y: 0, active: false }
  const cur = { x: 0, y: 0 }

  // seeded random so the composition is the same on every visit
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646)

  /* ---------------- kidney ---------------- */
  const kidneyRoot: Group = new THREE.Group() // position + float
  const tilt: Group = new THREE.Group() // fixed 25° lean, like the original can
  const spinGroup: Group = new THREE.Group() // pointer tilt + mode-switch spin
  tilt.rotation.z = THREE.MathUtils.degToRad(-25)
  kidneyRoot.add(tilt)
  tilt.add(spinGroup)
  scene.add(kidneyRoot)
  let kidney: Object3D | null = null
  let kidneyAppear = 0 // 0..1 scale-in after load
  let kidneyBaseScale = 1
  const kidneyCenter = new THREE.Vector3()

  const loader = new gltfModule.GLTFLoader()
  loader.load(
    MODEL_URL,
    (gltf) => {
      if (disposed) {
        gltf.scene.traverse((o) => {
          const m = o as Mesh
          if (m.isMesh) {
            m.geometry.dispose()
            const mm = m.material as Material
            mm.dispose()
          }
        })
        return
      }
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)
      const holder = new THREE.Group()
      holder.add(model)
      kidneyBaseScale = 1 / size.y // normalised to unit height; resize() scales to the stage
      model.traverse((o) => {
        const m = o as Mesh
        if (!m.isMesh) return
        geometries.push(m.geometry)
        const mm = m.material as Material & { envMapIntensity?: number; map?: Texture | null }
        if (mm.envMapIntensity !== undefined) mm.envMapIntensity = 0.85
        if (mm.map) textures.push(mm.map)
        materials.push(mm)
      })
      kidney = holder
      spinGroup.add(holder)
      resize()
      if (!motionAllowed) {
        kidneyAppear = 1
        step(0)
      }
    },
    undefined,
    (err) => console.error('Kidney model failed to load', err)
  )

  /* ---------------- cells ---------------- */
  // Red cell: biconcave disc from a lathe profile (unit radius).
  const rbcGeo = (() => {
    const pts = []
    const h = (r: number) => 0.62 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.21 + 2 * r * r - 1.12 * r ** 4)
    for (let i = 0; i <= 20; i++) pts.push(new THREE.Vector2(i / 20, h(i / 20)))
    for (let i = 19; i >= 0; i--) pts.push(new THREE.Vector2(i / 20, -h(i / 20)))
    const g = new THREE.LatheGeometry(pts, 40)
    g.computeVertexNormals()
    return geo(g)
  })()
  // White cell: ruffled membrane sphere; its lobed nucleus shows through.
  const wbcGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 5)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize()
      const n =
        0.05 * Math.sin(v.x * 9 + v.y * 4) * Math.sin(v.y * 8 - v.z * 5) +
        0.035 * Math.sin(v.z * 17 + v.x * 13) +
        0.02 * Math.sin(v.x * 29 - v.y * 23 + v.z * 19)
      v.multiplyScalar(1 + n)
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return geo(g)
  })()
  const lobeGeo = geo(new THREE.SphereGeometry(1, 20, 14))
  // Platelet: small flattened, slightly irregular disc.
  const pltGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 2)
    g.scale(1, 0.38, 0.8)
    return geo(g)
  })()

  const rbcMat = mat(
    new THREE.MeshPhysicalMaterial({
      color: 0xc81e2c,
      roughness: 0.32,
      clearcoat: 0.8,
      clearcoatRoughness: 0.18,
      sheen: 0.6,
      sheenColor: new THREE.Color(0xff7a7a),
      emissive: 0x3a0008,
    })
  )
  const wbcMat = mat(
    new THREE.MeshPhysicalMaterial({
      color: 0xf1ecfb,
      roughness: 0.55,
      clearcoat: 0.4,
      sheen: 1,
      sheenColor: new THREE.Color(0xd9ccff),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  )
  const lobeMat = mat(new THREE.MeshStandardMaterial({ color: 0x6b3fb3, roughness: 0.5, emissive: 0x1d0b40 }))
  const pltMat = mat(new THREE.MeshStandardMaterial({ color: 0xe9b7d6, roughness: 0.45, emissive: 0x2a0d22 }))

  const makeCells = (n: number, sMin: number, sMax: number, zMin: number, zMax: number): Cell[] =>
    Array.from({ length: n }, () => ({
      theta: rnd() * Math.PI * 2,
      omega: (0.04 + rnd() * 0.08) * (rnd() < 0.8 ? 1 : -1),
      rx: 0.55 + rnd() * 0.45,
      ry: 0.5 + rnd() * 0.5,
      z: zMin + rnd() * (zMax - zMin),
      size: sMin + rnd() * (sMax - sMin),
      floatDur: [5, 7, 6, 8, 5.5, 6.5, 9, 11, 10][Math.floor(rnd() * 9)],
      phase: rnd() * 10,
      q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3)),
      axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
      angle: rnd() * 6.3,
      spin: 0.25 + rnd() * 0.5,
      ox: 0,
      oy: 0,
    }))

  const rbcs = makeCells(22, 0.2, 0.34, -4, 2.2)
  const wbcs = makeCells(6, 0.3, 0.42, -3, 1.6)
  const plts = makeCells(16, 0.06, 0.1, -4, 2.5)
  const rbcMesh: InstancedMesh = new THREE.InstancedMesh(rbcGeo, rbcMat, rbcs.length)
  const wbcMesh: InstancedMesh = new THREE.InstancedMesh(wbcGeo, wbcMat, wbcs.length)
  const LOBES = [
    [-0.32, 0.12, 0.05, 0.3],
    [0.02, -0.1, -0.05, 0.33],
    [0.33, 0.1, 0.04, 0.28],
  ] as const
  const lobeMesh: InstancedMesh = new THREE.InstancedMesh(lobeGeo, lobeMat, wbcs.length * LOBES.length)
  const pltMesh: InstancedMesh = new THREE.InstancedMesh(pltGeo, pltMat, plts.length)
  wbcMesh.renderOrder = 2
  scene.add(rbcMesh, lobeMesh, wbcMesh, pltMesh)

  /* ---------------- plasma specks ---------------- */
  const SPECKS = 70
  const speckPos = new Float32Array(SPECKS * 3)
  const speckVel = new Float32Array(SPECKS)
  const dotTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    const t = new THREE.CanvasTexture(c)
    textures.push(t)
    return t
  })()
  const speckGeo = geo(new THREE.BufferGeometry())
  speckGeo.setAttribute('position', new THREE.BufferAttribute(speckPos, 3))
  const speckMat = mat(
    new THREE.PointsMaterial({
      map: dotTex,
      size: 0.09,
      color: 0xd8fff6,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  const specks = new THREE.Points(speckGeo, speckMat)
  scene.add(specks)

  /* ---------------- layout ---------------- */
  let hw = 4,
    hh = 3,
    narrow = false
  const visAt = (z: number) => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z)
  function seedSpecks() {
    for (let i = 0; i < SPECKS; i++) {
      speckPos[i * 3] = (rnd() * 2 - 1) * hw * 1.4
      speckPos[i * 3 + 1] = (rnd() * 2 - 1) * hh * 1.4
      speckPos[i * 3 + 2] = -5 + rnd() * 4
      speckVel[i] = 0.12 + rnd() * 0.3
    }
    speckGeo.attributes.position.needsUpdate = true
  }
  function resize() {
    const W = Math.max(1, container.clientWidth),
      H = Math.max(1, container.clientHeight)
    renderer.setSize(W, H)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    hh = visAt(0)
    hw = hh * camera.aspect
    narrow = camera.aspect < 0.85
    const kidneyH = hh * 2 * (narrow ? 0.46 : 0.66)
    kidneyRoot.scale.setScalar(kidneyH * kidneyBaseScale)
    kidneyCenter.set(0, narrow ? -hh * 0.12 : 0, 0)
    kidneyRoot.position.copy(kidneyCenter)
    if (!motionAllowed) step(0)
  }

  /* ---------------- pointer ---------------- */
  function onPointerMove(e: PointerEvent) {
    const r = container.getBoundingClientRect()
    if (r.width === 0) return
    ptr.x = ((e.clientX - r.left) / r.width - 0.5) * 2
    ptr.y = ((e.clientY - r.top) / r.height - 0.5) * 2
    ptr.active = e.clientY >= r.top && e.clientY <= r.bottom
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  /* ---------------- mode switch timeline ---------------- */
  function setMode() {
    if (!motionAllowed) return
    switchStart = clock
    reseeded = false
  }
  function updateSwitch() {
    if (switchStart < 0) return
    const t = clock - switchStart
    // kidney: 360° in 0.6 s easing in, then another 360° settling with a soft overshoot
    spin = t < 0.6 ? Math.PI * 2 * easeInQuad(t / 0.6) : Math.PI * 2 * (1 + backOut(clamp01((t - 0.6) / 1.5), 0.7))
    // cells: implode to the kidney (0.5 s), hold (0.3 s), burst out to new orbits (0.9 s)
    if (t < 0.5) gather = easeInQuad(t / 0.5)
    else if (t < 0.8) {
      gather = 1
      if (!reseeded) {
        reseeded = true
        for (const list of [rbcs, wbcs, plts]) for (const c of list) c.theta = rnd() * Math.PI * 2
      }
    } else gather = 1 - backOut(clamp01((t - 0.8) / 0.9), 1.5)
    if (t > 2.1) {
      switchStart = -1
      spin = 0
      gather = 0
    }
  }

  /* ---------------- per-frame ---------------- */
  const P = new THREE.Vector3(),
    S = new THREE.Vector3(),
    Q = new THREE.Quaternion(),
    Qa = new THREE.Quaternion(),
    M = new THREE.Matrix4(),
    ML = new THREE.Matrix4(),
    NDC = new THREE.Vector3()

  function placeCells(cells: Cell[], mesh: InstancedMesh, dt: number, onMatrix?: (i: number, m: typeof M) => void) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      c.theta += c.omega * dt
      const fl = ((clock + c.phase) * Math.PI * 2) / c.floatDur
      const depthScale = visAt(c.z) / hh
      // home position on an elliptical orbit around the kidney
      P.set(
        Math.cos(c.theta) * hw * 0.82 * c.rx * depthScale,
        Math.sin(c.theta) * hh * 0.78 * c.ry * depthScale + Math.sin(fl) * 0.12,
        c.z
      )
      // parallax: cells in front drift with the pointer, cells behind against it
      const par = c.z > 0 ? 0.35 : -0.18
      P.x += cur.x * par
      P.y -= cur.y * par

      // pointer repulsion in screen space
      let tx = 0,
        ty = 0,
        speed = 1
      if (ptr.active && dt > 0) {
        NDC.copy(P).project(camera)
        const dx = (NDC.x - ptr.x) * camera.aspect,
          dy = NDC.y + ptr.y
        const d = Math.hypot(dx, dy)
        if (d < 0.5 && d > 1e-4) {
          const f = (0.5 - d) / 0.5
          tx = (dx / d) * f * 1.1 * depthScale
          ty = (dy / d) * f * 1.1 * depthScale
          speed = 1 + f * 5
        }
      }
      c.ox += (tx - c.ox) * 0.1
      c.oy += (ty - c.oy) * 0.1
      P.x += c.ox
      P.y += c.oy
      c.angle += dt * c.spin * speed

      if (gather !== 0) P.lerp(kidneyCenter, gather)
      const s = c.size * (1 - 0.9 * clamp01(gather))
      Q.copy(c.q0).multiply(Qa.setFromAxisAngle(c.axis, c.angle + Math.cos(fl) * 0.1))
      M.compose(P, Q, S.set(s, s, s))
      mesh.setMatrixAt(i, M)
      onMatrix?.(i, M)
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  const lobeOffset = new THREE.Vector3(),
    lobeQ = new THREE.Quaternion(),
    lobeS = new THREE.Vector3()
  function wbcLobes(i: number, m: typeof M) {
    for (let k = 0; k < LOBES.length; k++) {
      const [x, y, z, r] = LOBES[k]
      ML.compose(lobeOffset.set(x, y, z), lobeQ, lobeS.set(r, r, r)).premultiply(m)
      lobeMesh.setMatrixAt(i * LOBES.length + k, ML)
    }
    lobeMesh.instanceMatrix.needsUpdate = true
  }

  function step(dt: number) {
    clock += dt
    cur.x += ((ptr.active ? ptr.x : 0) - cur.x) * 0.05
    cur.y += ((ptr.active ? ptr.y : 0) - cur.y) * 0.05
    updateSwitch()

    if (kidney) {
      kidneyAppear = Math.min(1, kidneyAppear + dt / 0.9)
      const a = motionAllowed ? backOut(kidneyAppear, 1.2) : 1
      kidney.scale.setScalar(Math.max(0.001, a))
      // tilt toward the pointer (±20° yaw, ±10° pitch) plus the switch spin
      spinGroup.rotation.y = -cur.x * 0.35 - spin
      spinGroup.rotation.x = -cur.y * 0.17
      // gentle bob, 6 s period, like the original can
      kidneyRoot.position.y = kidneyCenter.y + Math.sin((clock * Math.PI * 2) / 6) * hh * 0.035
    }

    placeCells(rbcs, rbcMesh, dt)
    placeCells(wbcs, wbcMesh, dt, wbcLobes)
    placeCells(plts, pltMesh, dt)

    for (let i = 0; i < SPECKS; i++) {
      speckPos[i * 3 + 1] += speckVel[i] * dt
      speckPos[i * 3] += Math.sin(clock * 0.6 + i) * 0.002
      if (speckPos[i * 3 + 1] > hh * 1.5) speckPos[i * 3 + 1] = -hh * 1.5
    }
    speckGeo.attributes.position.needsUpdate = true

    renderer.render(scene, camera)
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(container)
  resize()
  seedSpecks()

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
  })
  io.observe(container)

  let rafId: number | null = null
  let last = performance.now()
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (visible && !document.hidden) step(dt)
    rafId = requestAnimationFrame(frame)
  }
  if (motionAllowed) rafId = requestAnimationFrame(frame)
  else step(0)

  return {
    setMode,
    dispose() {
      disposed = true
      if (rafId != null) cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
      textures.forEach((t) => t.dispose())
      envRT.dispose()
      rbcMesh.dispose()
      wbcMesh.dispose()
      lobeMesh.dispose()
      pltMesh.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
