// Ported from the uploaded "Nephron Motion Kit" (nephron-motion-kit.html).
// Deliberately kept as close to the original canvas drawing code as
// possible -- it's small, dense and tuned by eye, not meant to be
// "clean" TypeScript. Types are loose (ctx: CanvasRenderingContext2D,
// everything else number) to match the original's terseness.

export type SceneId =
  | 'nephron'
  | 'dawn'
  | 'glomerulus'
  | 'branching'
  | 'cross'
  | 'converge'
  | 'microvilli'
  | 'channels'
  | 'spark'
  | 'loop'
  | 'membrane'
  | 'fibers'
  | 'pyramids'
  | 'podocyte'
  | 'jga'
  | 'system'
  | 'peristalsis'
  | 'peristalsis2'
  | 'kidney'
  | 'still'

type Point = [number, number]
type Path = { p: Point[]; len: number[]; L: number }

function rnd(s: number) {
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

// Catmull-Rom -> dense points with cumulative lengths.
function cr(pts: Point[], seg = 14): Path {
  const out: Point[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] || p2
    for (let t = 0; t < 1; t += 1 / seg) {
      const t2 = t * t
      const t3 = t2 * t
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ])
    }
  }
  out.push(pts[pts.length - 1])
  let L = 0
  const len = [0]
  for (let i = 1; i < out.length; i++) {
    L += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1])
    len.push(L)
  }
  return { p: out, len, L }
}

function at(path: Path, u: number): [number, number, number] {
  u = ((u % 1) + 1) % 1
  const d = u * path.L
  let lo = 0
  let hi = path.len.length - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (path.len[m] < d) lo = m
    else hi = m
  }
  const a = path.p[lo]
  const b = path.p[hi]
  const f = (d - path.len[lo]) / (path.len[hi] - path.len[lo] || 1)
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])]
}

const S = (pts: Point[], w: number, h: number): Point[] => pts.map(([x, y]) => [x * w, y * h])

function tube(c: CanvasRenderingContext2D, path: Path, wd: number, tint = 'rgba(140,185,255,') {
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.beginPath()
  path.p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])))
  c.strokeStyle = tint + '.10)'
  c.lineWidth = wd * 1.9
  c.stroke()
  c.strokeStyle = tint + '.55)'
  c.lineWidth = wd
  c.stroke()
  c.strokeStyle = '#123068'
  c.lineWidth = wd - 3
  c.stroke()
  c.strokeStyle = 'rgba(255,255,255,.10)'
  c.lineWidth = Math.max(1, wd * 0.22)
  c.stroke()
}

function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 1) {
  c.globalAlpha = a * 0.22
  c.fillStyle = col
  c.beginPath()
  c.arc(x, y, r * 2.6, 0, 7)
  c.fill()
  c.globalAlpha = a
  c.beginPath()
  c.arc(x, y, r, 0, 7)
  c.fill()
  c.globalAlpha = 1
}

function rbc(c: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number) {
  c.save()
  c.translate(x, y)
  c.rotate(ang)
  c.fillStyle = '#C9393F'
  c.beginPath()
  c.ellipse(0, 0, r * 1.5, r, 0, 0, 7)
  c.fill()
  c.fillStyle = 'rgba(120,10,20,.45)'
  c.beginPath()
  c.ellipse(0, 0, r * 0.7, r * 0.42, 0, 0, 7)
  c.fill()
  c.restore()
}

const COLS = ['#7FB2FF', '#F2B65A', '#3CCB8A', '#B48CFF', '#9DE7FF', '#FF8FA3']

function flow(
  c: CanvasRenderingContext2D,
  path: Path,
  n: number,
  t: number,
  wd: number,
  { speed = 0.035, cols = COLS, seed = 7, size = 1, red = false } = {}
) {
  const r = rnd(seed)
  for (let i = 0; i < n; i++) {
    const off = r()
    const sp = speed * (0.7 + r() * 0.6)
    const lat = (r() - 0.5) * wd * 0.55
    const col = cols[(r() * cols.length) | 0]
    const [x, y, a] = at(path, off + t * sp)
    const nx = x - Math.sin(a) * lat
    const ny = y + Math.cos(a) * lat
    if (red) rbc(c, nx, ny, wd * 0.16 * size, a)
    else glow(c, nx, ny, (1.4 + r() * 1.6) * size, col)
  }
}

function bg(c: CanvasRenderingContext2D, w: number, h: number, warm = 0) {
  const g = c.createRadialGradient(w * 0.72, h * 0.35, 10, w * 0.6, h * 0.5, w * 0.8)
  g.addColorStop(0, '#1A3F86')
  g.addColorStop(1, '#071735')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  if (warm) {
    const a = c.createRadialGradient(w * 0.05, h * 0.15, 5, w * 0.05, h * 0.15, w * 0.6)
    a.addColorStop(0, `rgba(242,182,90,${0.45 * warm})`)
    a.addColorStop(1, 'rgba(242,182,90,0)')
    c.fillStyle = a
    c.fillRect(0, 0, w, h)
  }
  const s = rnd(3)
  c.fillStyle = 'rgba(180,210,255,.25)'
  for (let i = 0; i < 40; i++) {
    c.beginPath()
    c.arc(s() * w, s() * h, s() * 1.2, 0, 7)
    c.fill()
  }
}

function coil(cx: number, cy: number, R: number, lobes = 6, k = 0): Point[] {
  const pts: Point[] = []
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2
    const r = R * (0.55 + 0.32 * Math.sin(lobes * a + k))
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}

type Scene = (c: CanvasRenderingContext2D, w: number, h: number, t: number) => void

export const SCENES: Record<SceneId, Scene> = {
  nephron(c, w, h, t) {
    bg(c, w, h)
    const wd = h * 0.075
    const cap = cr(
      S(
        [
          [0.17, 0.62],
          [0.1, 0.48],
          [0.18, 0.33],
          [0.3, 0.32],
          [0.36, 0.45],
          [0.31, 0.6],
          [0.17, 0.62],
        ],
        w,
        h
      ),
      10
    )
    c.strokeStyle = 'rgba(160,200,255,.35)'
    c.lineWidth = 2
    c.beginPath()
    cap.p.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])))
    c.stroke()
    const g = cr(coil(w * 0.235, h * 0.47, h * 0.13, 5, t * 0.3), 1)
    tube(c, g, wd * 0.55, 'rgba(255,120,130,')
    flow(c, g, 10, t, wd * 0.55, { red: true, speed: 0.06, seed: 2 })
    const tub = cr(
      S(
        [
          [0.34, 0.45],
          [0.42, 0.38],
          [0.47, 0.52],
          [0.53, 0.36],
          [0.58, 0.5],
          [0.6, 0.7],
          [0.63, 0.88],
          [0.67, 0.88],
          [0.7, 0.6],
          [0.75, 0.3],
          [0.82, 0.25],
          [0.86, 0.4],
          [0.87, 0.7],
          [0.88, 0.92],
        ],
        w,
        h
      )
    )
    tube(c, tub, wd)
    flow(c, tub, 46, t, wd, { seed: 5 })
    const ves = cr(
      S(
        [
          [0.02, 0.2],
          [0.2, 0.12],
          [0.45, 0.18],
          [0.7, 0.1],
          [0.98, 0.16],
        ],
        w,
        h
      )
    )
    tube(c, ves, wd * 0.7, 'rgba(255,110,120,')
    flow(c, ves, 14, t, wd * 0.7, { red: true, speed: 0.05, seed: 9 })
  },
  dawn(c, w, h, t) {
    bg(c, w, h, 1)
    const g = cr(coil(w * 0.5, h * 0.55, h * 0.3, 7, t * 0.2), 1)
    tube(c, g, h * 0.06, 'rgba(255,170,140,')
    flow(c, g, 20, t, h * 0.06, { red: true, speed: 0.04, seed: 4 })
    const r = rnd(11)
    for (let i = 0; i < 40; i++) {
      const a = r() * 7
      const d = h * (0.3 + ((r() + t * 0.03) % 1) * 0.25)
      glow(c, w * 0.5 + Math.cos(a) * d * 1.3, h * 0.55 + Math.sin(a) * d, 1.3, i % 3 ? '#9DE7FF' : '#F2B65A', 0.8)
    }
  },
  glomerulus(c, w, h, t) {
    bg(c, w, h)
    const z = 1 + 0.06 * Math.sin(t * 0.25)
    c.save()
    c.translate(w / 2, h / 2)
    c.scale(z, z)
    c.translate(-w / 2, -h / 2)
    c.strokeStyle = 'rgba(160,200,255,.4)'
    c.lineWidth = 3
    c.beginPath()
    c.ellipse(w * 0.5, h * 0.52, h * 0.42, h * 0.38, 0, 0, 7)
    c.stroke()
    for (let k = 0; k < 3; k++) {
      const g = cr(coil(w * 0.5, h * 0.52, h * (0.28 - k * 0.07), 5 + k, k + t * 0.15), 1)
      tube(c, g, h * 0.05, 'rgba(255,130,140,')
      flow(c, g, 8, t, h * 0.05, { red: true, speed: 0.05, seed: k + 3 })
    }
    const r = rnd(8)
    for (let i = 0; i < 50; i++) {
      const a = r() * 7
      const d = h * (0.1 + ((r() + t * 0.02) % 1) * 0.3)
      glow(c, w * 0.5 + Math.cos(a) * d * 1.2, h * 0.52 + Math.sin(a) * d, 1.1, '#9DE7FF', 0.7)
    }
    c.restore()
  },
  branching(c, w, h, t) {
    bg(c, w, h)
    const paths: { p: Path; d: number }[] = []
    const r = rnd(21)
    ;(function br(x: number, y: number, a: number, len: number, d: number) {
      if (d > 4) return
      const x2 = x + Math.cos(a) * len
      const y2 = y + Math.sin(a) * len
      paths.push({
        p: cr([[x, y], [(x + x2) / 2 + (r() - 0.5) * len * 0.2, (y + y2) / 2 + (r() - 0.5) * len * 0.2], [x2, y2]], 10),
        d,
      })
      br(x2, y2, a - 0.45 - r() * 0.2, len * 0.72, d + 1)
      br(x2, y2, a + 0.4 + r() * 0.2, len * 0.72, d + 1)
    })(w * 0.02, h * 0.6, -0.12, w * 0.26, 0)
    paths.forEach(({ p, d }, i) => {
      const wd = Math.max(3, h * 0.07 * Math.pow(0.72, d))
      tube(c, p, wd, 'rgba(255,120,130,')
      flow(c, p, d < 2 ? 6 : 2, t, wd, { red: true, speed: 0.12, seed: i + 1, size: 1 })
    })
  },
  cross(c, w, h, t) {
    bg(c, w, h)
    const cx = w * 0.5
    const cy = h * 0.5
    const R = h * 0.36
    const n = 14
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const p = 1 + 0.04 * Math.sin(t * 1.2 + i)
      c.save()
      c.translate(cx + Math.cos(a) * R * 0.72 * p, cy + Math.sin(a) * R * 0.72 * p)
      c.rotate(a)
      c.fillStyle = 'rgba(120,170,255,.18)'
      c.strokeStyle = 'rgba(160,200,255,.55)'
      c.lineWidth = 1.5
      c.beginPath()
      c.roundRect(-R * 0.2, -R * 0.16, R * 0.4, R * 0.32, 8)
      c.fill()
      c.stroke()
      c.fillStyle = 'rgba(180,140,255,.6)'
      c.beginPath()
      c.arc(R * 0.05, 0, R * 0.06, 0, 7)
      c.fill()
      c.restore()
    }
    const r = rnd(5)
    for (let i = 0; i < 30; i++) {
      const a = r() * 7
      const f = (r() + t * 0.06) % 1
      const d = R * (1.25 - f * 1.1)
      glow(c, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, COLS[i % 5], 1 - f * 0.6)
    }
  },
  converge(c, w, h, t) {
    bg(c, w, h)
    for (let i = 0; i < 6; i++) {
      const x0 = 0.12 + i * 0.15
      const p = cr(S([[x0, -0.05], [x0 + (0.5 - x0) * 0.3, 0.35], [0.5 + (x0 - 0.5) * 0.15, 0.7], [0.5, 1.05]], w, h))
      tube(c, p, h * 0.05)
      flow(c, p, 8, t, h * 0.05, { seed: i + 2, speed: 0.05 })
    }
  },
  microvilli(c, w, h, t) {
    bg(c, w, h)
    c.globalAlpha = 0.75
    for (let row = 0; row < 3; row++) {
      const y0 = h * (0.95 - row * 0.12)
      for (let x = 0; x < w + 20; x += w / 38) {
        const sw = Math.sin(t * 0.6 + x * 0.02 + row) * h * 0.03
        c.strokeStyle = `rgba(150,195,255,${0.35 - row * 0.08})`
        c.lineWidth = w / 110
        c.lineCap = 'round'
        c.beginPath()
        c.moveTo(x, y0)
        c.quadraticCurveTo(x + sw * 0.3, y0 - h * 0.18, x + sw, y0 - h * 0.34)
        c.stroke()
      }
    }
    c.globalAlpha = 1
    const r = rnd(4)
    for (let i = 0; i < 14; i++) {
      glow(c, (r() * w + t * 8 * (r() + 0.2)) % w, h * (0.15 + r() * 0.35), 1.2, '#9DE7FF', 0.5)
    }
  },
  channels(c, w, h, t) {
    bg(c, w, h)
    const x = w * 0.5
    c.fillStyle = 'rgba(120,170,255,.16)'
    c.fillRect(x - w * 0.035, 0, w * 0.07, h)
    c.strokeStyle = 'rgba(160,200,255,.5)'
    c.lineWidth = 2
    c.strokeRect(x - w * 0.035, -2, w * 0.07, h + 4)
    const beat = (t * 0.8) % 1
    for (let k = 0; k < 4; k++) {
      const y = h * (0.18 + k * 0.22)
      const open = Math.max(0, Math.sin(beat * Math.PI))
      c.fillStyle = '#0A2352'
      c.fillRect(x - w * 0.04, y - h * 0.035 * open - 2, w * 0.08, h * 0.07 * open + 4)
      c.fillStyle = 'rgba(91,140,255,.8)'
      c.fillRect(x - w * 0.04, y - h * 0.06, w * 0.08, h * 0.02)
      c.fillRect(x - w * 0.04, y + h * 0.04, w * 0.08, h * 0.02)
      for (let j = 0; j < 3; j++) {
        const f = (beat + j * 0.12) % 1
        glow(c, x - w * 0.3 + f * w * 0.6, y + (j - 1) * h * 0.01, 2, k % 2 ? '#F2B65A' : '#9DE7FF', open > 0.1 ? 1 : 0.35)
      }
    }
  },
  spark(c, w, h, t) {
    bg(c, w, h)
    const p = cr(S([[0.2, 0.05], [0.3, 0.4], [0.38, 0.85], [0.5, 0.92], [0.62, 0.85], [0.7, 0.4], [0.8, 0.05]], w, h))
    tube(c, p, h * 0.09)
    flow(c, p, 16, t, h * 0.09, { cols: ['#7FB2FF', '#9DE7FF'], speed: 0.03 })
    for (let k = 0; k < 26; k++) {
      const [x, y] = at(p, t * 0.09 - k * 0.006)
      glow(c, x, y, 4 - k * 0.13, '#F2B65A', 1 - k / 26)
    }
  },
  loop(c, w, h, t) {
    const g = c.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#0E2A62')
    g.addColorStop(1, '#5A3410')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    const a = cr(S([[0.3, -0.05], [0.33, 0.5], [0.38, 0.9], [0.46, 0.95], [0.52, 0.88], [0.55, 0.5], [0.56, -0.05]], w, h))
    tube(c, a, h * 0.08)
    flow(c, a, 22, t, h * 0.08, { speed: 0.04 })
    const v = cr(S([[0.66, -0.05], [0.68, 0.6], [0.73, 0.9], [0.8, 0.9], [0.84, 0.6], [0.86, -0.05]], w, h))
    tube(c, v, h * 0.05, 'rgba(255,120,130,')
    flow(c, v, 8, t, h * 0.05, { red: true, speed: 0.05, seed: 4 })
  },
  membrane(c, w, h, t) {
    bg(c, w, h)
    const y = h * 0.55
    c.fillStyle = 'rgba(120,170,255,.2)'
    c.fillRect(0, y - h * 0.04, w, h * 0.08)
    const n = 12
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (w / n)
      c.fillStyle = '#0A2352'
      c.fillRect(x - w * 0.008, y - h * 0.045, w * 0.016, h * 0.09)
    }
    c.strokeStyle = 'rgba(160,200,255,.5)'
    c.lineWidth = 1.5
    c.strokeRect(-2, y - h * 0.04, w + 4, h * 0.08)
    const r = rnd(6)
    for (let i = 0; i < 34; i++) {
      const slot = (r() * n) | 0
      const x = (slot + 0.5) * (w / n)
      const f = (r() + t * 0.08) % 1
      glow(c, x + (1 - f) * (r() - 0.5) * w * 0.08, h * (0.05 + f * 0.9), 1.5, COLS[i % 5], 1)
    }
    for (let i = 0; i < 6; i++) {
      const x = w * (0.1 + i * 0.16) + Math.sin(t * 0.4 + i) * 8
      c.fillStyle = 'rgba(242,182,90,.55)'
      c.beginPath()
      c.arc(x, y - h * 0.13, h * 0.04, 0, 7)
      c.fill()
    }
  },
  fibers(c, w, h, t) {
    bg(c, w, h)
    for (let i = 0; i < 5; i++) {
      const y = 0.14 + i * 0.18
      const p = cr(S([[-0.05, y], [0.5, y + 0.01], [1.05, y]], w, h))
      const blood = i % 2 === 0
      tube(c, p, h * 0.09, blood ? 'rgba(255,120,130,' : 'rgba(140,185,255,')
      if (blood) flow(c, p, 9, t, h * 0.09, { red: true, speed: 0.05, seed: i + 1 })
      else flow(c, p, 14, -t, h * 0.09, { cols: ['#9DE7FF', '#7FB2FF'], speed: 0.06, seed: i + 1 })
    }
  },
  pyramids(c, w, h, t) {
    bg(c, w, h)
    const dx = Math.sin(t * 0.15) * w * 0.04
    c.save()
    c.translate(dx, 0)
    c.strokeStyle = 'rgba(160,200,255,.55)'
    c.lineWidth = 3
    c.fillStyle = 'rgba(120,170,255,.08)'
    c.beginPath()
    c.ellipse(w * 0.5, h * 0.5, w * 0.3, h * 0.42, 0, 0, 7)
    c.fill()
    c.stroke()
    for (let i = 0; i < 5; i++) {
      const a = -1.2 + i * 0.6
      const bx = w * 0.5 + Math.cos(a + Math.PI) * w * 0.23
      const by = h * 0.5 + Math.sin(a + Math.PI) * h * 0.33
      c.fillStyle = 'rgba(91,140,255,.22)'
      c.beginPath()
      c.moveTo(bx - Math.sin(a) * h * 0.09, by + Math.cos(a) * h * 0.09)
      c.lineTo(bx + Math.sin(a) * h * 0.09, by - Math.cos(a) * h * 0.09)
      c.lineTo(w * 0.66, h * 0.5)
      c.closePath()
      c.fill()
      c.stroke()
      for (let k = 0; k < 4; k++) {
        const f = (t * 0.12 + k * 0.25 + i * 0.1) % 1
        glow(c, bx + (w * 0.66 - bx) * f, by + (h * 0.5 - by) * f, 1.6, '#9DE7FF', 1 - f * 0.5)
      }
    }
    c.fillStyle = 'rgba(242,182,90,.25)'
    c.beginPath()
    c.ellipse(w * 0.7, h * 0.5, w * 0.05, h * 0.12, 0, 0, 7)
    c.fill()
    c.restore()
  },
  podocyte(c, w, h, t) {
    bg(c, w, h)
    for (let i = 0; i < 14; i++) {
      const x = (w * (i + 0.5)) / 14
      const top = i % 2 === 0
      const len = h * (0.42 + 0.04 * Math.sin(t * 0.7 + i))
      c.strokeStyle = 'rgba(150,195,255,.6)'
      c.lineWidth = w * 0.03
      c.lineCap = 'round'
      c.beginPath()
      if (top) {
        c.moveTo(x, h * 0.02)
        c.lineTo(x, h * 0.02 + len)
      } else {
        c.moveTo(x, h * 0.98)
        c.lineTo(x, h * 0.98 - len)
      }
      c.stroke()
      c.strokeStyle = '#123068'
      c.lineWidth = w * 0.03 - 3
      c.stroke()
    }
    const r = rnd(2)
    for (let i = 0; i < 24; i++) {
      const x = (w * (((r() * 13) | 0) + 1)) / 14
      const f = (r() + t * 0.07) % 1
      glow(c, x, h * f, 1.4, '#9DE7FF', 0.9)
    }
  },
  jga(c, w, h, t) {
    bg(c, w, h)
    const p = cr(S([[-0.05, 0.3], [0.4, 0.32], [0.62, 0.4], [1.05, 0.38]], w, h))
    tube(c, p, h * (0.1 + 0.015 * Math.sin(t * 1.1)), 'rgba(255,120,130,')
    flow(c, p, 10, t, h * 0.1, { red: true, speed: 0.05 })
    const cx = w * 0.45
    const cy = h * 0.72
    glow(c, cx, cy, h * 0.05, '#F2B65A')
    for (let k = 0; k < 4; k++) {
      const f = (t * 0.35 + k * 0.25) % 1
      c.strokeStyle = `rgba(242,182,90,${0.6 * (1 - f)})`
      c.lineWidth = 2
      c.beginPath()
      c.arc(cx, cy, h * 0.06 + f * h * 0.4, 0, 7)
      c.stroke()
    }
  },
  system(c, w, h, t) {
    bg(c, w, h)
    const sw = Math.sin(t * 0.2) * 0.02
    ;[[0.32, 0.3], [0.68, 0.3]].forEach(([x, y], i) => {
      c.save()
      c.translate(w * (x + sw), h * y)
      c.strokeStyle = 'rgba(160,200,255,.6)'
      c.lineWidth = 3
      c.fillStyle = 'rgba(120,170,255,.14)'
      c.beginPath()
      c.ellipse(0, 0, w * 0.08, h * 0.2, i ? 0.15 : -0.15, 0, 7)
      c.fill()
      c.stroke()
      c.restore()
      const u = cr(S([[x + sw + (i ? -0.03 : 0.03), y + 0.15], [x + (i ? -0.06 : 0.06), 0.6], [0.5 + (i ? 0.04 : -0.04), 0.82]], w, h))
      tube(c, u, h * 0.035)
      flow(c, u, 5, t, h * 0.035, { cols: ['#F2B65A', '#9DE7FF'], speed: 0.08, seed: i + 2 })
    })
    c.strokeStyle = 'rgba(160,200,255,.6)'
    c.lineWidth = 3
    c.fillStyle = 'rgba(242,182,90,.12)'
    c.beginPath()
    c.ellipse(w * 0.5, h * 0.88, w * 0.08, h * 0.09, 0, 0, 7)
    c.fill()
    c.stroke()
  },
  peristalsis(c, w, h, t, warm = 0, n = 1) {
    bg(c, w, h, warm * 0.6)
    const yb = h * 0.55
    for (let x = 0; x <= w; x += 3) {
      let bulge = 0
      for (let k = 0; k < n; k++) {
        const cxw = ((t * 0.12 + k / n) % 1) * w * 1.2 - w * 0.1
        bulge += Math.exp(-Math.pow((x - cxw) / (w * 0.06), 2))
      }
      const r = h * (0.09 + 0.07 * bulge)
      c.strokeStyle = 'rgba(140,185,255,.5)'
      c.lineWidth = 3
      c.beginPath()
      c.moveTo(x, yb - r)
      c.lineTo(x + 3, yb - r)
      c.moveTo(x, yb + r)
      c.lineTo(x + 3, yb + r)
      c.stroke()
      c.fillStyle = 'rgba(18,48,104,.85)'
      c.fillRect(x, yb - r + 2, 3, 2 * r - 4)
    }
    for (let k = 0; k < n; k++) {
      const cxw = ((t * 0.12 + k / n) % 1) * w * 1.2 - w * 0.1
      glow(c, cxw, yb, h * 0.035, warm ? '#F2B65A' : '#9DE7FF')
    }
  },
  peristalsis2(c, w, h, t) {
    ;(SCENES.peristalsis as (c: CanvasRenderingContext2D, w: number, h: number, t: number, warm?: number, n?: number) => void)(
      c,
      w,
      h,
      t,
      1,
      3
    )
  },
  kidney(c, w, h, t) {
    bg(c, w, h)
    const N = 160
    const r = rnd(13)
    const ph = (t * 0.08) % 1
    const form = Math.min(1, ph * 2.2)
    const fade = ph > 0.85 ? (1 - ph) / 0.15 : 1
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2
      let kx = Math.cos(a) * 0.17
      const ky = Math.sin(a) * 0.36
      if (Math.cos(a) < -0.55) {
        kx += 0.06 * (Math.cos(a) + 0.55) * -1.2 * -1
      }
      if (Math.abs(Math.sin(a)) < 0.35 && Math.cos(a) < 0) {
        kx += 0.07
      }
      const sx = r()
      const sy = r()
      const e = form * form * (3 - 2 * form)
      const x = (sx * (1 - e) + (0.5 + kx) * e) * w
      const y = (sy * (1 - e) + (0.5 + ky * 0.95) * e) * h
      glow(c, x + Math.sin(t + i) * 1.5, y, 1.4, i % 7 ? '#9DE7FF' : '#F2B65A', fade * (0.5 + 0.5 * e))
    }
  },
  still(c, w, h) {
    SCENES.nephron(c, w, h, 3)
    c.fillStyle = 'rgba(6,20,47,.45)'
    c.fillRect(0, 0, w, h)
  },
}
