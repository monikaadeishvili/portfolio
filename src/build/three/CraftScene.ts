/**
 * 03 Craft — an exploded interface in true 3-D (three.js, own lazy chunk).
 * Five slabs (Background, Layout grid, Content, Components, Interactions)
 * fly in from a scatter, hang as an exploded isometric stack while palette
 * tokens orbit and dock into the Components slab, then compress into one
 * finished card facing the viewer. Scroll sets `q`; the pointer orbits ±12°.
 */
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three'

const INK = '#16131D'
const W = 6
const D = 4
const T = 0.16

export const SLAB_NAMES = ['Background', 'Layout grid', 'Content', 'Components', 'Interactions']

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a))
  return x * x * (3 - 2 * x)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** the slab faces, drawn in the momo style */
function face(i: number): HTMLCanvasElement {
  const cw = 1024
  const ch = Math.round((cw * D) / W)
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const g = c.getContext('2d')!
  const R = 56
  g.lineJoin = 'round'
  g.lineCap = 'round'
  const font = (w: number, s: number, f = 'Bricolage Grotesque Variable, Bricolage Grotesque, system-ui') => `${w} ${s}px ${f}`
  if (i === 0) {
    rr(g, 0, 0, cw, ch, R)
    g.fillStyle = '#B6F03A'
    g.fill()
    g.fillStyle = 'rgba(22,19,29,0.12)'
    for (let x = 40; x < cw; x += 40) for (let y = 40; y < ch; y += 40) g.fillRect(x - 2, y - 2, 4, 4)
  } else if (i === 1) {
    rr(g, 0, 0, cw, ch, R)
    g.fillStyle = '#FFD3EE'
    g.fill()
    const m = 64
    const gap = 18
    const colW = (cw - m * 2 - gap * 11) / 12
    for (let k = 0; k < 12; k++) {
      const x = m + k * (colW + gap)
      g.fillStyle = 'rgba(255,92,190,0.32)'
      g.fillRect(x, 26, colW, ch - 52)
      g.strokeStyle = 'rgba(255,61,154,0.85)'
      g.lineWidth = 2
      g.strokeRect(x, 26, colW, ch - 52)
    }
  } else if (i === 2) {
    // skeleton text + image block
    rr(g, 0, 0, cw, ch, R)
    g.fillStyle = '#FFF4D6'
    g.fill()
    g.fillStyle = INK
    rr(g, 70, 90, 470, 54, 27)
    g.fill()
    rr(g, 70, 168, 360, 54, 27)
    g.fill()
    g.fillStyle = 'rgba(22,19,29,0.35)'
    for (let k = 0; k < 4; k++) {
      rr(g, 70, 270 + k * 40, k === 3 ? 260 : 420, 18, 9)
      g.fill()
    }
    rr(g, 600, 80, 350, 330, 34)
    g.fillStyle = '#FFF4D1'
    g.fill()
    g.lineWidth = 7
    g.strokeStyle = INK
    g.stroke()
    g.fillStyle = '#FFC629'
    g.beginPath()
    g.arc(860, 170, 40, 0, Math.PI * 2)
    g.fill()
    g.stroke()
    g.fillStyle = '#2DB8FF'
    g.beginPath()
    g.moveTo(612, 398)
    g.lineTo(720, 250)
    g.lineTo(800, 340)
    g.lineTo(850, 290)
    g.lineTo(938, 398)
    g.closePath()
    g.fill()
    g.stroke()
  } else if (i === 3) {
    // button, toggle, input
    rr(g, 0, 0, cw, ch, R)
    g.fillStyle = '#FFFFFF'
    g.fill()
    const btn = (x: number, y: number, w: number, label: string, fill: string, color: string) => {
      rr(g, x, y + 10, w, 92, 30)
      g.fillStyle = INK
      g.fill()
      rr(g, x, y, w, 92, 30)
      g.fillStyle = fill
      g.fill()
      g.lineWidth = 6
      g.strokeStyle = INK
      g.stroke()
      g.fillStyle = color
      g.font = font(800, 40)
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(label, x + w / 2, y + 48)
    }
    btn(70, 470, 300, 'Button', '#5B4BFF', '#fff')
    btn(400, 470, 250, 'Ghost', '#FFC629', INK)
    // toggle
    rr(g, 720, 482, 160, 80, 40)
    g.fillStyle = '#19D3A2'
    g.fill()
    g.lineWidth = 6
    g.strokeStyle = INK
    g.stroke()
    g.beginPath()
    g.arc(840, 522, 28, 0, Math.PI * 2)
    g.fillStyle = '#fff'
    g.fill()
    g.stroke()
    // input
    rr(g, 70, 590, 580, 64, 18)
    g.fillStyle = '#fff'
    g.fill()
    g.lineWidth = 5
    g.stroke()
    g.fillStyle = INK
    g.font = font(500, 30, 'Inter Variable, Inter, system-ui')
    g.textAlign = 'left'
    g.fillText('hello@momo.design', 96, 623)
    g.fillRect(380, 600, 4, 44)
  } else {
    // cursor + ripple on violet glass
    rr(g, 0, 0, cw, ch, R)
    g.fillStyle = 'rgba(139,124,255,0.22)'
    g.fill()
    g.strokeStyle = 'rgba(91,75,255,0.9)'
    for (let k = 0; k < 3; k++) {
      g.lineWidth = 6 - k * 1.6
      g.globalAlpha = 1 - k * 0.28
      g.beginPath()
      g.arc(250, 500, 34 + k * 30, 0, Math.PI * 2)
      g.stroke()
    }
    g.globalAlpha = 1
    g.save()
    g.translate(256, 506)
    g.scale(4.2, 4.2)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(16, 8)
    g.lineTo(9.6, 10)
    g.lineTo(6.6, 16.4)
    g.closePath()
    g.fillStyle = '#FF5C39'
    g.fill()
    g.lineWidth = 1.6
    g.strokeStyle = '#fff'
    g.stroke()
    g.restore()
    g.fillStyle = '#FF5C39'
    rr(g, 330, 610, 150, 46, 12)
    g.fill()
    g.fillStyle = '#fff'
    g.font = font(700, 26, 'Inter Variable, Inter, system-ui')
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText('You', 405, 634)
    rr(g, 18, 18, cw - 36, ch - 36, R - 10)
    g.setLineDash([16, 14])
    g.lineWidth = 4
    g.strokeStyle = 'rgba(91,75,255,0.55)'
    g.stroke()
  }
  return c
}

function aaTex(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#FFFDF8'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = INK
  g.font = '800 150px Bricolage Grotesque Variable, Bricolage Grotesque, system-ui'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('Aa', 128, 140)
  return c
}

function roundedShape(w: number, d: number, r: number) {
  const s = new Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + d - r)
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d)
  s.lineTo(x + r, y + d)
  s.quadraticCurveTo(x, y + d, x, y + d - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

interface Slab {
  g: Group
  body: Mesh
  top: Mesh
  edge: LineSegments
  scatter: { p: Vector3; r: Vector3 }
}

interface Token {
  m: Group
  dock: Vector3
  phase: number
  h: number
}

export class CraftScene {
  private renderer: WebGLRenderer
  private scene = new Scene()
  private cam = new PerspectiveCamera(28, 1.6, 1, 120)
  private slabs: Slab[] = []
  private tokens: Token[] = []
  private shadow: Mesh
  private stack = new Group()
  private disposables: { dispose: () => void }[] = []
  private yaw = 0
  private pitch = 0
  private vy = 0
  private vp = 0
  private tYaw = 0
  private tPitch = 0
  private q = 0
  private v = new Vector3()
  w = 1
  h = 1
  readonly anchors: Vector3[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.setClearColor(0x000000, 0)
    this.scene.add(new AmbientLight(0xffffff, 1.6))
    const key = new DirectionalLight(0xffffff, 1.6)
    key.position.set(-4, 9, 6)
    this.scene.add(key)
    this.scene.add(this.stack)

    const shape = roundedShape(W, D, 0.34)
    const geo = new ExtrudeGeometry(shape, { depth: T, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 })
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, -T / 2, 0)
    const edges = new EdgesGeometry(geo, 30)
    const topGeo = new PlaneGeometry(W - 0.02, D - 0.02)
    topGeo.rotateX(-Math.PI / 2)
    const lineMat = new LineBasicMaterial({ color: INK })
    this.disposables.push(geo, edges, topGeo, lineMat)

    const bodyCols = ['#8FD614', '#FF7AD1', '#F5E6BF', '#FFFFFF', '#8B7CFF']
    for (let i = 0; i < 5; i++) {
      const g = new Group()
      const solid = i < 4
      const mat = new MeshStandardMaterial({ color: new Color(bodyCols[i]), roughness: 0.55, metalness: 0, transparent: !solid, opacity: solid ? 1 : 0.45, depthWrite: solid })
      const body = new Mesh(geo, mat)
      const tex = new CanvasTexture(face(i))
      tex.colorSpace = SRGBColorSpace
      tex.anisotropy = 4
      const topMat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: i < 4 })
      const top = new Mesh(topGeo, topMat)
      top.position.y = T / 2 + 0.035
      top.renderOrder = 10 + i
      const edge = new LineSegments(edges, lineMat)
      g.add(body, top, edge)
      this.stack.add(g)
      const a = i * 1.7 + 0.6
      this.slabs.push({
        g,
        body,
        top,
        edge,
        scatter: { p: new Vector3(Math.cos(a) * 2.6, -1.6 + i * 1.1, Math.sin(a) * 1.8), r: new Vector3((i % 2 ? 1 : -1) * 0.55, a * 0.5, ((i % 3) - 1) * 0.35) },
      })
      this.disposables.push(mat, tex, topMat)
      this.anchors.push(new Vector3())
    }

    // flat hard shadow under the stack (momo's offset shadow, in 3-D)
    const shGeo = new ExtrudeGeometry(roundedShape(W, D, 0.34), { depth: 0.001, bevelEnabled: false })
    shGeo.rotateX(-Math.PI / 2)
    const shMat = new MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.85, depthWrite: false })
    this.shadow = new Mesh(shGeo, shMat)
    this.shadow.renderOrder = 1
    this.stack.add(this.shadow)
    this.disposables.push(shGeo, shMat)

    // palette tokens that orbit and dock into the Components slab
    const tok = (m: Group, dock: [number, number], h: number) => {
      this.tokens.push({ m, dock: new Vector3(dock[0], 0, dock[1]), phase: this.tokens.length * ((Math.PI * 2) / 6), h })
      this.stack.add(m)
    }
    const std = (c: string) => {
      const m = new MeshStandardMaterial({ color: new Color(c), roughness: 0.45 })
      this.disposables.push(m)
      return m
    }
    const sph = new SphereGeometry(0.26, 32, 20)
    const chip = new BoxGeometry(0.62, 0.12, 0.44)
    const cap = new CapsuleGeometry(0.2, 0.62, 8, 16)
    cap.rotateZ(Math.PI / 2)
    const aa = new BoxGeometry(0.62, 0.12, 0.62)
    this.disposables.push(sph, chip, cap, aa)
    const outline = (geo2: BoxGeometry | CapsuleGeometry | SphereGeometry, mesh: Mesh) => {
      if (geo2 instanceof SphereGeometry) return mesh
      const e = new EdgesGeometry(geo2, 25)
      this.disposables.push(e)
      mesh.add(new LineSegments(e, lineMat))
      return mesh
    }
    const one = (geo2: BoxGeometry | CapsuleGeometry | SphereGeometry, mat: Material) => {
      const g = new Group()
      g.add(outline(geo2, new Mesh(geo2, mat)))
      return g
    }
    tok(one(sph, std('#5B4BFF')), [-2.3, 1.35], 0.26)
    tok(one(sph, std('#FF5C39')), [-1.65, 1.35], 0.26)
    tok(one(sph, std('#FFC629')), [-1.0, 1.35], 0.26)
    tok(one(chip, std('#FF7AD1')), [2.2, -1.35], 0.06)
    const aaTexture = new CanvasTexture(aaTex())
    aaTexture.colorSpace = SRGBColorSpace
    const aaMats = [std('#FFFDF8'), std('#FFFDF8'), new MeshBasicMaterial({ map: aaTexture }), std('#FFFDF8'), std('#FFFDF8'), std('#FFFDF8')]
    this.disposables.push(aaTexture, aaMats[2])
    const aaMesh = new Mesh(aa, aaMats)
    const aaG = new Group()
    aaG.add(outline(aa, aaMesh))
    tok(aaG, [1.45, -1.35], 0.06)
    const pill = new Group()
    pill.add(outline(cap, new Mesh(cap, std('#5B4BFF'))))
    tok(pill, [0.35, -1.35], 0.2)
    const tg = new Group()
    tg.add(outline(cap, new Mesh(cap, std('#19D3A2'))))
    const knob = new Mesh(new SphereGeometry(0.17, 24, 16), std('#FFFFFF'))
    this.disposables.push(knob.geometry)
    knob.position.set(0.3, 0.06, 0)
    tg.add(knob)
    tok(tg, [2.25, 0.0], 0.2)
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w
    this.h = h
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.cam.aspect = w / h
    // shift the stack left so the labels get a clean column on the right
    this.cam.setViewOffset(w, h, w * 0.07, 0, w, h)
    this.cam.updateProjectionMatrix()
  }

  setProgress(q: number) {
    this.q = q
  }

  /** pointer in −1..1 (relative to the viewport); orbits the stack ±12° */
  setPointer(nx: number, ny: number) {
    this.tYaw = nx * 12
    this.tPitch = ny * 8
  }

  /** returns true while something still moves (keep rendering) */
  render(t: number, dt: number) {
    const q = this.q
    // inertia toward the pointer target, calmer once compressed
    const k = 30
    const c = 2 * Math.sqrt(k) * 0.8
    const calm = 1 - smooth(0.72, 0.95, q) * 0.85
    this.vy += ((this.tYaw * calm - this.yaw) * k - this.vy * c) * dt
    this.vp += ((this.tPitch * calm - this.pitch) * k - this.vp * c) * dt
    this.yaw += this.vy * dt
    this.pitch += this.vp * dt

    const fly = inOut(smooth(0, 0.16, q))
    const press = inOut(smooth(0.84, 0.98, q))
    const gap = lerp(1.05, 0.05, press)
    for (let i = 0; i < 5; i++) {
      const s = this.slabs[i]
      const ey = i * gap - 2 * gap
      const ex = -i * 0.08 * (1 - press)
      s.g.position.set(lerp(s.scatter.p.x, ex, fly), lerp(s.scatter.p.y, ey, fly), lerp(s.scatter.p.z, 0, fly))
      s.g.rotation.set(lerp(s.scatter.r.x, 0, fly), lerp(s.scatter.r.y, 0, fly), lerp(s.scatter.r.z, 0, fly))
      // the grid sheet steps back once everything is placed
      s.g.scale.setScalar(lerp(0.72, 1, fly))
      this.anchors[i].set(W / 2 + 0.05, 0, -D / 2 + 0.2).applyEuler(s.g.rotation).add(s.g.position)
    }
    const bottom = this.slabs[0].g.position.y
    // hard offset shadow, like every momo component
    this.shadow.position.set(0.45, bottom - T / 2 - 0.25, 0.55)
    ;(this.shadow.material as MeshBasicMaterial).opacity = 0.9 * fly

    // tokens: orbit, then dock one by one, then sink into the slab
    const comp = this.slabs[3].g
    this.tokens.forEach((tk, j) => {
      const d = inOut(smooth(0.34 + j * 0.05, 0.46 + j * 0.05, q))
      const a = tk.phase + t * 0.45
      const orbit = this.v.set(Math.cos(a) * 4.1, 0.4 + Math.sin(a * 1.3 + j) * 1.0, Math.sin(a) * 3.0)
      const ox = orbit.x
      const oy = orbit.y
      const oz = orbit.z
      const dx = comp.position.x + tk.dock.x
      const dy = comp.position.y + T / 2 + tk.h + 0.02
      const dz = comp.position.z + tk.dock.z
      tk.m.position.set(lerp(ox, dx, d), lerp(oy, dy, d) + Math.sin(Math.PI * d) * 1.2, lerp(oz, dz, d))
      tk.m.rotation.set((1 - d) * (t * 0.7 + j), (1 - d) * (t * 0.9 + j * 2), 0)
      const vis = smooth(0.06, 0.16, q) * (1 - smooth(0.86, 0.95, q))
      const sc = Math.max(0.001, vis * (1 + 0.15 * Math.sin(Math.PI * d)))
      tk.m.scale.set(sc, sc * (1 - 0.6 * smooth(0.84, 0.95, q)), sc)
      tk.m.visible = vis > 0.001
    })

    // camera: isometric while exploded → straight on once it's one card
    const polar = lerp(56, 4, press) + this.pitch
    const az = lerp(38, 0, press) + this.yaw
    const r = lerp(14.4, 12.8, press)
    const P = (polar * Math.PI) / 180
    const A = (az * Math.PI) / 180
    this.cam.position.set(Math.sin(P) * Math.sin(A) * r, Math.cos(P) * r, Math.sin(P) * Math.cos(A) * r)
    this.cam.up.set(0, press > 0.5 ? 0 : 1, press > 0.5 ? -1 : 0)
    if (press > 0.02 && press <= 0.5) this.cam.up.set(0, 1 - press * 2, -press * 2).normalize()
    this.cam.lookAt(0, lerp(0, this.slabs[4].g.position.y * 0.5, 0.5), 0)
    this.renderer.render(this.scene, this.cam)
    return Math.abs(this.vy) + Math.abs(this.vp) > 0.01
  }

  /** screen px (canvas CSS space) of slab i's label anchor */
  anchorPx(i: number, out: { x: number; y: number }) {
    this.v.copy(this.anchors[i]).project(this.cam)
    out.x = (this.v.x * 0.5 + 0.5) * this.w
    out.y = (-this.v.y * 0.5 + 0.5) * this.h
    return out
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
    this.scene.clear()
  }
}

export type { Texture }
