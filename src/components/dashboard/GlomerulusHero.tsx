import { useEffect, useRef } from 'react'
import { useMotionAllowed } from '../heroArt/kit'

// Ported from the standalone nephron-hero.html prototype: a glomerulus
// (Bowman's capsule + capillary tuft + afferent/efferent arterioles, with
// flowing blood cells and filtrate) rendered with three.js. Only the
// canvas + scene logic lives here -- the dashboard hero's own date/title/
// paragraph markup stays in DashboardHero.tsx.
//
// `three` is loaded with a dynamic import so its ~600KB doesn't sit in the
// main bundle; it's fetched only once this component actually mounts.

type ThreeModule = typeof import('three')

export function GlomerulusHero({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const motionAllowed = useMotionAllowed()

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    let cancelled = false
    let dispose: (() => void) | undefined

    import('three').then((THREE) => {
      if (cancelled || !wrapRef.current) return
      dispose = mountGlomerulusScene(THREE, wrapRef.current, motionAllowed)
    })

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [motionAllowed])

  return <div ref={wrapRef} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />
}

function mountGlomerulusScene(THREE: ThreeModule, container: HTMLElement, motionAllowed: boolean): () => void {
  let renderer: InstanceType<ThreeModule['WebGLRenderer']>
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return () => {}
  }

  // Everything created below is tracked here so it can be disposed exactly
  // once, regardless of which branch created it.
  const geometries: InstanceType<ThreeModule['BufferGeometry']>[] = []
  const materials: InstanceType<ThreeModule['Material']>[] = []
  const textures: InstanceType<ThreeModule['Texture']>[] = []
  function geo<T extends InstanceType<ThreeModule['BufferGeometry']>>(g: T): T {
    geometries.push(g)
    return g
  }
  function mat<T extends InstanceType<ThreeModule['Material']>>(m: T): T {
    materials.push(m)
    return m
  }
  function tex<T extends InstanceType<ThreeModule['Texture']>>(t: T): T {
    textures.push(t)
    return t
  }

  const DPR = Math.min(window.devicePixelRatio || 1, 1.75)
  renderer.setPixelRatio(DPR)
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  container.prepend(renderer.domElement)

  const scene = new THREE.Scene()
  // Narrower FOV than the original prototype (32 -> 20): a longer "lens"
  // compresses perspective and crops in tight on the capillary tuft, closer
  // to the macro photography look of the reference stills (coiled tubes
  // filling the frame) instead of showing the whole small corpuscle.
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100)
  camera.position.set(0, 0, 9)
  const root = new THREE.Group()
  scene.add(root)
  const corpuscle = new THREE.Group()
  root.add(corpuscle)
  corpuscle.rotation.z = 0.55 // vascular pole up-left, urinary pole down-right

  let seed = 21
  const rnd = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646)
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  /* ================= environment & lights ================= */
  {
    const env = new THREE.Scene()
    const envSphere = new THREE.Mesh(
      geo(new THREE.SphereGeometry(10, 32, 16)),
      mat(new THREE.MeshBasicMaterial({ color: 0x0a1634, side: THREE.BackSide }))
    )
    env.add(envSphere)
    const panel = (c: number, w: number, h: number, p: InstanceType<ThreeModule['Vector3']>) => {
      const m = new THREE.Mesh(geo(new THREE.PlaneGeometry(w, h)), mat(new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })))
      m.position.copy(p)
      m.lookAt(0, 0, 0)
      env.add(m)
    }
    panel(0xffffff, 7, 3, V(5, 6, 4))
    panel(0x5b8cff, 4, 8, V(-8, 0, 2))
    panel(0xff8a7a, 6, 2, V(2, -7, 4))
    panel(0xbfe3ff, 3, 3, V(0, 2, 9))
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envRT = pmrem.fromScene(env, 0.03)
    scene.environment = envRT.texture
    pmrem.dispose()
  }
  const key = new THREE.DirectionalLight(0xfff0e6, 2.6)
  key.position.set(4, 5, 6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x6fa8ff, 1.8)
  rim.position.set(-5, 1, -4)
  scene.add(rim)
  scene.add(new THREE.AmbientLight(0x2a3a66, 0.7))

  /* ================= textures ================= */
  function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, srgb?: boolean) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    draw(c.getContext('2d')!, w, h)
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    return tex(t)
  }
  const fleshMap = canvasTex(
    512,
    128,
    (g, w, h) => {
      g.fillStyle = '#b9714a'
      g.fillRect(0, 0, w, h)
      for (let i = 0; i < 3200; i++) {
        const l = 34 + Math.random() * 32,
          hue = 10 + Math.random() * 16
        g.fillStyle = `hsla(${hue},${45 + Math.random() * 20}%,${l}%,.35)`
        g.beginPath()
        g.ellipse(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 1 + Math.random() * 2.5, 0, 0, 6.3)
        g.fill()
      }
      g.strokeStyle = 'rgba(60,15,12,.25)'
      for (let i = 0; i < 70; i++) {
        g.lineWidth = 0.5 + Math.random()
        const y = Math.random() * h
        g.beginPath()
        g.moveTo(0, y)
        g.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y)
        g.stroke()
      }
    },
    true
  )
  const fleshBump = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#808080'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 2600; i++) {
      const v = Math.floor(Math.random() * 255)
      g.fillStyle = `rgba(${v},${v},${v},.3)`
      g.beginPath()
      g.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 2.2, 0, 6.3)
      g.fill()
    }
  })
  const glowTex = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.3, 'rgba(255,255,255,.45)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 64, 64)
  })

  /* ================= materials ================= */
  const fleshMat = mat(
    new THREE.MeshPhysicalMaterial({
      map: fleshMap,
      bumpMap: fleshBump,
      bumpScale: 0.025,
      roughness: 0.38,
      clearcoat: 0.78,
      clearcoatRoughness: 0.22,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0x42230f),
      emissiveIntensity: 0.32,
      envMapIntensity: 1.1,
    })
  )
  const fresnel = (color: string, power: number, intensity: number, base: number, side = THREE.DoubleSide) =>
    mat(
      new THREE.ShaderMaterial({
        uniforms: { uC: { value: new THREE.Color(color) }, uP: { value: power }, uI: { value: intensity }, uB: { value: base } },
        vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform vec3 uC; uniform float uP,uI,uB; varying vec3 vN; varying vec3 vV;
      void main(){ float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),uP); gl_FragColor=vec4(uC*(uB+f*uI), uB+f); }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side,
      })
    )
  const glassMat = mat(
    new THREE.MeshPhysicalMaterial({
      color: 0xaed4ff,
      roughness: 0.04,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 3,
    })
  )

  /* ================= geometry helpers ================= */
  // tube that can be cut open along its length (like the cut-away capillaries in the reference)
  function openTube(
    curve: InstanceType<ThreeModule['CatmullRomCurve3']>,
    segs: number,
    radius: number,
    radial: number,
    arcStart: number,
    arcLen: number
  ) {
    const fr = curve.computeFrenetFrames(segs, false)
    const len = curve.getLength()
    const pos: number[] = [],
      uv: number[] = [],
      idx: number[] = []
    const P = new THREE.Vector3(),
      N = new THREE.Vector3()
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      curve.getPointAt(t, P)
      const r = radius * (0.88 + 0.12 * Math.sin(t * 9 + radius * 50))
      for (let j = 0; j <= radial; j++) {
        const a = arcStart + (arcLen * j) / radial,
          s = Math.sin(a),
          c = -Math.cos(a)
        N.set(
          c * fr.normals[i].x + s * fr.binormals[i].x,
          c * fr.normals[i].y + s * fr.binormals[i].y,
          c * fr.normals[i].z + s * fr.binormals[i].z
        ).normalize()
        pos.push(P.x + r * N.x, P.y + r * N.y, P.z + r * N.z)
        uv.push(t * len * 1.1, j / radial)
      }
    }
    for (let i = 0; i < segs; i++)
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j,
          b = a + radial + 1
        idx.push(a, b, a + 1, b, b + 1, a + 1)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return geo(g)
  }

  interface Vessel {
    curve: InstanceType<ThreeModule['CatmullRomCurve3']>
    r: number
    reverse: boolean
    segs: number
    fr: ReturnType<InstanceType<ThreeModule['CatmullRomCurve3']>['computeFrenetFrames']>
  }
  const vessels: Vessel[] = []
  function addVessel(curve: InstanceType<ThreeModule['CatmullRomCurve3']>, r: number, reverse: boolean) {
    vessels.push({ curve, r, reverse, segs: 200, fr: curve.computeFrenetFrames(200, false) })
    return vessels.length - 1
  }

  /* ================= Bowman's capsule (glass) ================= */
  const profile: Array<[number, number]> = [
    [0.33, 1.1],
    [0.56, 1.04],
    [0.86, 0.9],
    [1.1, 0.6],
    [1.22, 0.2],
    [1.22, -0.2],
    [1.12, -0.62],
    [0.88, -0.98],
    [0.55, -1.22],
    [0.32, -1.42],
    [0.28, -1.75],
  ]
  const profCurve = new THREE.CatmullRomCurve3(profile.map(([r, y]) => V(r, y, 0)))
  const latheGeo = geo(new THREE.LatheGeometry(profCurve.getPoints(70).map((p) => new THREE.Vector2(p.x, p.y)), 72))
  const capsule = new THREE.Mesh(latheGeo, glassMat)
  capsule.renderOrder = 3
  corpuscle.add(capsule)
  const capRim = new THREE.Mesh(latheGeo, fresnel('#9fd4ff', 2.4, 1.1, 0.015))
  capRim.renderOrder = 4
  corpuscle.add(capRim)
  const capInner = new THREE.Mesh(latheGeo, fresnel('#6fb6ff', 3.2, 0.55, 0))
  capInner.scale.setScalar(0.965)
  capInner.renderOrder = 4
  corpuscle.add(capInner)
  const radiusAt = (y: number) => {
    // capsule inner radius at height y
    for (let i = 0; i < profile.length - 1; i++) {
      const [r0, y0] = profile[i],
        [r1, y1] = profile[i + 1]
      if (y <= y0 && y >= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
    }
    return 0
  }

  // proximal tubule leaving the urinary pole
  const tubCurve = new THREE.CatmullRomCurve3([
    V(0, -1.6, 0),
    V(0, -2.1, 0),
    V(0.12, -2.7, 0.05),
    V(0.5, -3.3, 0),
    V(1.2, -3.8, -0.15),
    V(2.2, -4.1, -0.1),
    V(3.6, -4.2, 0),
  ])
  const tubGeo = geo(new THREE.TubeGeometry(tubCurve, 160, 0.28, 32))
  const tub = new THREE.Mesh(tubGeo, glassMat)
  tub.renderOrder = 3
  corpuscle.add(tub)
  const tubRim = new THREE.Mesh(tubGeo, fresnel('#9fd4ff', 2.4, 1.0, 0.015))
  tubRim.renderOrder = 4
  corpuscle.add(tubRim)

  /* ================= glomerular tuft ================= */
  const pole = V(0, 0.84, 0)
  const loopVessels: number[] = []
  for (let k = 0; k < 17; k++) {
    const dir = V(rnd() * 2 - 1, rnd() * 2 - 1, (rnd() * 2 - 1) * 0.9).normalize()
    if (dir.y > 0.2) dir.y = -dir.y
    dir.normalize()
    const far = dir.clone().multiplyScalar(0.6 + rnd() * 0.25)
    const axis = far.clone().sub(pole).normalize()
    const perp = new THREE.Vector3().crossVectors(axis, V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize()).normalize()
    const w = 0.15 + rnd() * 0.1
    const m1 = pole.clone().lerp(far, 0.35),
      m2 = pole.clone().lerp(far, 0.75)
    const bow = m2.clone().normalize().multiplyScalar(0.12)
    const pts = [
      pole.clone().addScaledVector(perp, 0.05),
      m1.clone().addScaledVector(perp, w * 0.7),
      m2.clone().addScaledVector(perp, w).add(bow),
      far.clone().addScaledVector(dir, 0.12),
      m2.clone().addScaledVector(perp, -w).add(bow),
      m1.clone().addScaledVector(perp, -w * 0.7),
      pole.clone().addScaledVector(perp, -0.05),
    ].map((p) => p.clampLength(0, 0.97))
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const r = 0.092 + rnd() * 0.025
    const open = k % 2 === 0
    corpuscle.add(new THREE.Mesh(openTube(curve, 130, r, 16, rnd() * 6.28, open ? Math.PI * 1.3 : Math.PI * 2), fleshMat))
    if (open) loopVessels.push(addVessel(curve, r, false))
  }
  const hilum = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 24, 16)), fleshMat)
  hilum.position.copy(pole)
  corpuscle.add(hilum)

  // afferent (in) & efferent (out) arterioles, cut open
  const affCurve = new THREE.CatmullRomCurve3([V(0.04, 0.84, 0.08), V(0.25, 1.5, 0.25), V(0.22, 2.3, 0.2), V(0, 3.6, 0.1)])
  corpuscle.add(new THREE.Mesh(openTube(affCurve, 120, 0.2, 22, 1.2, Math.PI * 1.35), fleshMat))
  const affV = addVessel(affCurve, 0.2, true)
  const effCurve = new THREE.CatmullRomCurve3([V(-0.1, 0.84, -0.1), V(-0.38, 1.5, -0.3), V(-0.62, 2.3, -0.4), V(-0.85, 3.6, -0.4)])
  corpuscle.add(new THREE.Mesh(openTube(effCurve, 120, 0.16, 22, 2.4, Math.PI * 1.3), fleshMat))
  const effV = addVessel(effCurve, 0.16, false)

  /* ================= blood cells ================= */
  const rbcGeo = (() => {
    const pts: InstanceType<ThreeModule['Vector2']>[] = []
    const h = (r: number) => 0.6 * Math.sqrt(Math.max(0, 1 - r * r)) * (0.21 + 2 * r * r - 1.12 * r ** 4)
    for (let i = 0; i <= 18; i++) {
      const r = i / 18
      pts.push(new THREE.Vector2(r, h(r)))
    }
    for (let i = 17; i >= 0; i--) {
      const r = i / 18
      pts.push(new THREE.Vector2(r, -h(r)))
    }
    const g = new THREE.LatheGeometry(pts, 32)
    g.scale(0.075, 0.075, 0.075)
    return geo(g)
  })()
  const rbcMat = mat(
    new THREE.MeshPhysicalMaterial({ color: 0xc8202c, roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.2, emissive: 0x3a0006, envMapIntensity: 1.2 })
  )
  const blueMat = mat(
    new THREE.MeshPhysicalMaterial({
      color: 0x3f86ec,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      emissive: 0x0a2a6a,
      emissiveIntensity: 0.6,
      envMapIntensity: 2,
    })
  )

  interface Cell {
    v: number
    t: number
    s: number
    a: number
    orb: number
    rr: number
    q0: InstanceType<ThreeModule['Quaternion']>
    axis: InstanceType<ThreeModule['Vector3']>
    spin: number
  }
  const makeCells = (list: Array<[number, number]>): Cell[] =>
    list.flatMap(([v, n]) =>
      Array.from({ length: n }, () => {
        const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6.3, rnd() * 6.3, rnd() * 6.3))
        return {
          v,
          t: rnd(),
          s: 0.035 + rnd() * 0.03,
          a: rnd() * 6.3,
          orb: (rnd() - 0.5) * 0.8,
          rr: rnd() * Math.max(0.005, vessels[v].r - 0.07),
          q0,
          axis: V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
          spin: 0.4 + rnd() * 1.2,
        }
      })
    )
  const rbcCells = makeCells([[affV, 30], [effV, 22], ...loopVessels.map((v): [number, number] => [v, 7])])
  const blueCells = makeCells([[affV, 6], [effV, 5], ...loopVessels.map((v): [number, number] => [v, 2])])
  const rbcMesh = new THREE.InstancedMesh(rbcGeo, rbcMat, rbcCells.length)
  const blueSphereGeo = geo(new THREE.SphereGeometry(0.045, 20, 14))
  const blueMesh = new THREE.InstancedMesh(blueSphereGeo, blueMat, blueCells.length)
  corpuscle.add(rbcMesh, blueMesh)

  const P = new THREE.Vector3(),
    O = new THREE.Vector3(),
    Q = new THREE.Quaternion(),
    Qs = new THREE.Quaternion(),
    M = new THREE.Matrix4(),
    S1 = V(1, 1, 1)
  function updateCells(cells: Cell[], mesh: InstanceType<ThreeModule['InstancedMesh']>, time: number, flow: number) {
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i],
        v = vessels[c.v]
      let t = (c.t + flow * c.s) % 1
      if (v.reverse) t = 1 - t
      v.curve.getPointAt(t, P)
      const k = Math.round(t * v.segs),
        a = c.a + time * c.orb
      O.copy(v.fr.normals[k])
        .multiplyScalar(Math.cos(a) * c.rr)
        .addScaledVector(v.fr.binormals[k], Math.sin(a) * c.rr)
      P.add(O)
      Q.copy(c.q0).multiply(Qs.setFromAxisAngle(c.axis, time * c.spin))
      mesh.setMatrixAt(i, M.compose(P, Q, S1))
    }
    mesh.instanceMatrix.needsUpdate = true
  }

  /* ================= sparkling filtrate ================= */
  const sparkMat = (color: string, jitter: number) =>
    mat(
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uJitter: { value: jitter }, uColor: { value: new THREE.Color(color) } },
        vertexShader: `attribute float aPhase; attribute float aSize;
      uniform float uTime, uScale, uJitter; varying float vA;
      void main(){
        vec3 p = position + uJitter*vec3(sin(uTime*.7+aPhase), cos(uTime*.6+aPhase*1.3), sin(uTime*.5+aPhase*.7));
        vec4 mv = modelViewMatrix*vec4(p,1.);
        float tw = .55+.45*sin(uTime*2.6+aPhase*3.);
        vA = tw;
        gl_PointSize = aSize*uScale*(.7+.5*tw)/(-mv.z);
        gl_Position = projectionMatrix*mv;
      }`,
        fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){
        vec2 c = gl_PointCoord-.5; float d = length(c);
        float a = pow(smoothstep(.5,0.,d),2.4)*vA;
        float star = max(0.,1.-abs(c.x)*16.)*smoothstep(.5,0.,abs(c.y)) + max(0.,1.-abs(c.y)*16.)*smoothstep(.5,0.,abs(c.x));
        a += star*.4*vA*vA;
        gl_FragColor = vec4(uColor*(1.+star), a);
      }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
  function pointGeo(n: number, posFn: (i: number) => [number, number, number]) {
    const pos = new Float32Array(n * 3),
      ph = new Float32Array(n),
      sz = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos.set(posFn(i), i * 3)
      ph[i] = rnd() * 6.3
      sz[i] = 0.035 + rnd() * 0.055
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
    return geo(g)
  }
  // Bowman's space
  const bowman = new THREE.Points(
    pointGeo(950, () => {
      for (;;) {
        const x = (rnd() * 2 - 1) * 1.2,
          y = rnd() * 2.75 - 1.65,
          z = (rnd() * 2 - 1) * 1.2
        if (Math.hypot(x, z) < radiusAt(y) - 0.07) return [x, y, z]
      }
    }),
    sparkMat('#bfe4ff', 0.035)
  )
  bowman.renderOrder = 2
  corpuscle.add(bowman)

  // filtrate streaming out into the tubule
  const flowCurve = new THREE.CatmullRomCurve3([V(0.75, -0.2, 0.3), V(0.5, -0.95, 0.15), V(0.05, -1.5, 0), ...tubCurve.points.slice(1)])
  const FN = 380,
    flowFr = flowCurve.computeFrenetFrames(300, false)
  const flowData = Array.from({ length: FN }, () => ({ t: rnd(), s: 0.025 + rnd() * 0.02, a: rnd() * 6.3, r: Math.sqrt(rnd()) }))
  const flowGeo = pointGeo(FN, () => [0, 0, 0])
  const flowPts = new THREE.Points(flowGeo, sparkMat('#d6efff', 0))
  flowPts.renderOrder = 2
  corpuscle.add(flowPts)
  function updateFlow(time: number) {
    const pos = (flowGeo.attributes.position as InstanceType<ThreeModule['BufferAttribute']>).array as Float32Array
    for (let i = 0; i < FN; i++) {
      const d = flowData[i],
        t = (d.t + time * d.s) % 1
      flowCurve.getPointAt(t, P)
      const k = Math.round(t * 300),
        rr = d.r * (t < 0.18 ? 0.4 : 0.22),
        a = d.a + time * 0.6
      O.copy(flowFr.normals[k])
        .multiplyScalar(Math.cos(a) * rr)
        .addScaledVector(flowFr.binormals[k], Math.sin(a) * rr)
      pos[i * 3] = P.x + O.x
      pos[i * 3 + 1] = P.y + O.y
      pos[i * 3 + 2] = P.z + O.z
    }
    flowGeo.attributes.position.needsUpdate = true
  }

  /* ================= background bokeh & dust ================= */
  const bokeh: Array<InstanceType<ThreeModule['Sprite']> & { userData: { y0: number; ph: number; sp: number } }> = []
  ;['#ff5c6c', '#4d7dff', '#6fd3ff', '#ff8a6b', '#8a6bff'].forEach((c) => {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(
        mat(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: 0.06 + rnd() * 0.14, depthWrite: false, blending: THREE.AdditiveBlending }))
      ) as InstanceType<ThreeModule['Sprite']> & { userData: { y0: number; ph: number; sp: number } }
      const sc = 0.6 + rnd() * 2.2
      s.scale.set(sc, sc, 1)
      s.position.set((rnd() - 0.5) * 26, (rnd() - 0.5) * 7, -8 + rnd() * 4.5)
      s.userData = { y0: s.position.y, ph: rnd() * 6.3, sp: 0.1 + rnd() * 0.2 }
      root.add(s)
      bokeh.push(s)
    }
  })
  const dust = new THREE.Points(
    pointGeo(420, () => [(rnd() - 0.5) * 26, (rnd() - 0.5) * 7, -5 + rnd() * 5]),
    sparkMat('#8fb6ff', 0.25)
  )
  ;(dust.material as InstanceType<ThreeModule['ShaderMaterial']>).uniforms.uJitter.value = 0.25
  root.add(dust)
  const sparkMats = [bowman.material, flowPts.material, dust.material] as InstanceType<ThreeModule['ShaderMaterial']>[]

  /* ================= layout & loop ================= */
  function resize() {
    const W = container.clientWidth,
      H = container.clientHeight
    if (W === 0 || H === 0) return
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const visW = visH * camera.aspect
    // Bigger scale cap + a smaller rightward offset than the original
    // prototype crops in tighter on the capillary tuft (per the reference
    // macro photos) instead of showing the whole small corpuscle in the
    // corner of the banner.
    const s = Math.min(1.7, visW / 5.2)
    corpuscle.scale.setScalar(s)
    corpuscle.position.set(visW / 2 - 1.7 * s, 0.15 * s, 0)
    const pxScale = (H * DPR) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    sparkMats.forEach((m) => (m.uniforms.uScale.value = pxScale))
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  const ptr = { x: 0, y: 0 },
    cur = { x: 0, y: 0 }
  function onPointerMove(e: PointerEvent) {
    const r = container.getBoundingClientRect()
    ptr.x = ((e.clientX - r.left) / r.width - 0.5) * 2
    ptr.y = ((e.clientY - r.top) / r.height - 0.5) * 2
  }
  function onPointerLeave() {
    ptr.x = ptr.y = 0
  }
  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerleave', onPointerLeave)

  let visible = true
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting
  })
  io.observe(container)

  let last = performance.now(),
    time = 4,
    flow = 4
  let rafId: number | null = null

  function step(dt: number) {
    time += dt
    const beat = Math.pow(Math.max(0, Math.sin(time * 2.3)), 8) // ~ heartbeat
    flow += dt * (1 + beat * 1.6)
    cur.x += (ptr.x - cur.x) * 0.04
    cur.y += (ptr.y - cur.y) * 0.04
    root.rotation.y = cur.x * 0.1
    root.rotation.x = cur.y * 0.06
    corpuscle.rotation.y = Math.sin(time * 0.18) * 0.35 + 0.15
    corpuscle.rotation.x = Math.sin(time * 0.13) * 0.12
    camera.position.z = 9 - 0.35 * Math.sin(time * 0.12)
    fleshMat.emissiveIntensity = 0.35 + beat * 0.5
    updateCells(rbcCells, rbcMesh, time, flow)
    updateCells(blueCells, blueMesh, time, flow * 0.8)
    updateFlow(time)
    sparkMats.forEach((m) => (m.uniforms.uTime.value = time))
    bokeh.forEach((b) => {
      b.position.y = b.userData.y0 + Math.sin(time * b.userData.sp + b.userData.ph) * 0.3
    })
    renderer.render(scene, camera)
  }
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (visible && !document.hidden) step(dt)
    rafId = requestAnimationFrame(frame)
  }
  if (!motionAllowed) step(0)
  else rafId = requestAnimationFrame(frame)

  return function dispose() {
    if (rafId != null) cancelAnimationFrame(rafId)
    ro.disconnect()
    io.disconnect()
    container.removeEventListener('pointermove', onPointerMove)
    container.removeEventListener('pointerleave', onPointerLeave)

    geometries.forEach((g) => g.dispose())
    materials.forEach((m) => m.dispose())
    textures.forEach((t) => t.dispose())
    if (scene.environment) scene.environment.dispose()

    rbcMesh.dispose()
    blueMesh.dispose()

    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }
}
