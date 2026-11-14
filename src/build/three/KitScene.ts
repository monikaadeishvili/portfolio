/**
 * The Kit, rendered: 53 clay parts (five InstancedMeshes + the slab) on one
 * canvas, re-forming between the formations of ./kitForms as a pure function
 * of scroll. Time-based life (float, the flow's walkers, the launch orbit,
 * the CTA press) rides on top and never changes where things land; the
 * pointer tilts the sculpture and nudges parts aside; "take it apart" springs
 * everything outward and back.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DirectionalLight,
  Euler,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Raycaster,
  Scene,
  ShadowMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  Plane,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { COLORS, FORMS, HERO_PILL, KIT_COUNT, PART_COLOR, pathAt, rnd, SHELF_GRID, START, TYPES, type PartType } from './kitForms'

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export interface KitState {
  /** gather loose → lens, 0..1 (before the pan) */
  pre: number
  /** station coordinate along the pan, 0..4 */
  s: number
  t: number
  dt: number
  /** low-passed station velocity (for a touch of roll) */
  vel: number
}

export class KitScene {
  readonly ok: boolean
  private r: WebGLRenderer | null = null
  private scene = new Scene()
  private cam = new PerspectiveCamera(28, 1, 0.1, 60)
  private root = new Group()
  private meshes = new Map<PartType, InstancedMesh>()
  private slab!: Mesh
  private grid!: LineSegments
  private red!: LineSegments
  private glow!: Mesh
  private geos: BufferGeometry[] = []
  private mats: { dispose(): void }[] = []
  private pmremTarget: { dispose(): void } | null = null
  private m4 = new Matrix4()
  private q = new Quaternion()
  private qa = new Quaternion()
  private qb = new Quaternion()
  private qs = new Quaternion()
  private e = new Euler()
  private v = new Vector3()
  private vs = new Vector3()
  private axis: Vector3[] = []
  /** per-part spring offsets (pointer push) */
  private push = new Float32Array(KIT_COUNT * 3)
  private pushV = new Float32Array(KIT_COUNT * 3)
  /** live root-space positions this frame (for the push + anchors) */
  private live = new Float32Array(KIT_COUNT * 3)
  private ptr = { x: 0, y: 0, in: false, tx: 0, ty: 0, vx: 0, vy: 0 }
  private ray = new Raycaster()
  private plane = new Plane(new Vector3(0, 0, 1), 0)
  private hit = new Vector3()
  private ex = { v: 0, x: 0, target: 0 }
  private size = { w: 1, h: 1 }

  constructor(canvas: HTMLCanvasElement, narrow: boolean) {
    let r: WebGLRenderer | null = null
    try {
      r = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    } catch {
      r = null
    }
    this.ok = !!r
    if (!r) return
    this.r = r
    r.outputColorSpace = SRGBColorSpace
    r.toneMapping = NeutralToneMapping
    r.toneMappingExposure = 1.0
    r.setClearColor(0x000000, 0)
    r.shadowMap.enabled = !narrow
    r.shadowMap.type = PCFSoftShadowMap

    // light: a procedural room for soft reflections, a warm key, a lime rim
    const pm = new PMREMGenerator(r)
    const env = new RoomEnvironment()
    const rt = pm.fromScene(env, 0.04)
    this.scene.environment = rt.texture
    this.scene.environmentIntensity = 0.55
    this.pmremTarget = rt
    pm.dispose()
    const key = new DirectionalLight('#FFE2C4', 2.4)
    key.position.set(4, 7, 6)
    key.castShadow = !narrow
    key.shadow.mapSize.set(1024, 1024)
    const sc = key.shadow.camera
    sc.left = sc.bottom = -5.5
    sc.right = sc.top = 5.5
    sc.near = 1
    sc.far = 24
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    this.scene.add(key)
    this.scene.add(new HemisphereLight('#F3ECE1', '#1E1712', 0.5))
    const rim = new DirectionalLight('#C6F135', 0.8)
    rim.position.set(-6, 2, -4)
    this.scene.add(rim)

    // the floor that catches the shadow
    const floorG = new PlaneGeometry(16, 16)
    const floorM = new ShadowMaterial({ opacity: 0.45 })
    const floor = new Mesh(floorG, floorM)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -3.05
    floor.receiveShadow = true
    this.scene.add(floor)
    this.geos.push(floorG)
    this.mats.push(floorM)

    // the parts: one clay material, colour per instance
    const seg = narrow ? 0.5 : 1
    const G: Record<PartType, BufferGeometry> = {
      card: new RoundedBoxGeometry(1.5, 0.95, 0.09, 4, 0.045),
      pill: new RoundedBoxGeometry(0.9, 0.3, 0.3, 6, 0.15),
      dot: new SphereGeometry(0.17, Math.round(24 * seg), Math.round(16 * seg)),
      bar: new RoundedBoxGeometry(1.6, 0.09, 0.09, 3, 0.045),
      ring: new TorusGeometry(0.3, 0.07, Math.round(12 * seg), Math.round(40 * seg)),
      slab: new RoundedBoxGeometry(2.5, 5.0, 0.2, 6, 0.32),
    }
    Object.values(G).forEach((g) => this.geos.push(g))
    const clay = new MeshPhysicalMaterial({ roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 })
    const slabM = new MeshPhysicalMaterial({ color: COLORS.slab, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.35 })
    this.mats.push(clay, slabM)
    const col = new Color()
    for (const { type, n } of TYPES) {
      if (type === 'slab') continue
      const m = new InstancedMesh(G[type], clay, n)
      m.castShadow = !narrow
      m.receiveShadow = !narrow
      m.frustumCulled = false
      for (let k = 0; k < n; k++) m.setColorAt(k, col.set(PART_COLOR[START[type] + k]))
      if (m.instanceColor) m.instanceColor.needsUpdate = true
      this.meshes.set(type, m)
      this.root.add(m)
    }
    this.slab = new Mesh(G.slab, slabM)
    this.slab.castShadow = this.slab.receiveShadow = !narrow
    this.root.add(this.slab)

    // the systems grid (F3) and the handoff redlines (F4), lime hairlines
    const gp: number[] = []
    const { x0, x1, y0, y1, step } = SHELF_GRID
    for (let x = x0; x <= x1 + 1e-6; x += step) gp.push(x, y0, 0.002, x, y1, 0.002)
    for (let y = y0; y <= y1 + 1e-6; y += step) gp.push(x0, y, 0.002, x1, y, 0.002)
    const gridG = new BufferGeometry()
    gridG.setAttribute('position', new Float32BufferAttribute(gp, 3))
    const gridM = new LineBasicMaterial({ color: COLORS.lime, transparent: true, opacity: 0, depthWrite: false })
    this.grid = new LineSegments(gridG, gridM)
    this.root.add(this.grid)
    const rp: number[] = []
    const bx = 1.55
    for (const z of [0, 0.9, 1.8, 2.7]) rp.push(bx, 2.6, z, bx + 0.25, 2.6, z)
    rp.push(bx + 0.12, 2.6, 0, bx + 0.12, 2.6, 2.7)
    rp.push(-1.25, -2.85, 0, 1.25, -2.85, 0, -1.25, -2.75, 0, -1.25, -2.95, 0, 1.25, -2.75, 0, 1.25, -2.95, 0)
    rp.push(-1.55, -2.5, 0, -1.55, 2.5, 0, -1.45, 2.5, 0, -1.65, 2.5, 0, -1.45, -2.5, 0, -1.65, -2.5, 0)
    const redG = new BufferGeometry()
    redG.setAttribute('position', new Float32BufferAttribute(rp, 3))
    const redM = new LineBasicMaterial({ color: COLORS.lime, transparent: true, opacity: 0, depthWrite: false })
    this.red = new LineSegments(redG, redM)
    this.root.add(this.red)
    // the warm glow behind the finished phone (F5)
    const glowG = new PlaneGeometry(7, 7)
    const glowM = new MeshBasicMaterial({ color: '#E8590C', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })
    glowM.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nvec2 cuv = vUv - 0.5; gl_FragColor.a *= smoothstep(0.5, 0.0, length(cuv));',
      )
      sh.vertexShader = sh.vertexShader.replace('#include <uv_pars_vertex>', 'varying vec2 vUv;').replace('#include <uv_vertex>', 'vUv = uv;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <uv_pars_fragment>', 'varying vec2 vUv;')
    }
    this.glow = new Mesh(glowG, glowM)
    this.glow.position.set(0, 0, -1.6)
    this.root.add(this.glow)
    this.geos.push(gridG, redG, glowG)
    this.mats.push(gridM, redM, glowM)

    for (let i = 0; i < KIT_COUNT; i++) this.axis.push(new Vector3(rnd(i, 11) - 0.5, rnd(i, 12) - 0.5, rnd(i, 13) - 0.5).normalize())
    this.scene.add(this.root)
    this.cam.position.set(0, 0.4, narrow ? 17 : 19)
    this.cam.lookAt(0, 0, 0)
    // wide: the sculpture lives in the right ~55% of the stage, clear of the copy
    this.root.position.x = narrow ? 0 : 2.75
    this.root.scale.setScalar(narrow ? 1 : 0.92)
  }

  /** compile shaders up front so the first visible frame has no hitch */
  warm() {
    if (!this.r) return Promise.resolve()
    return this.r.compileAsync(this.scene, this.cam).catch(() => {})
  }

  resize(w: number, h: number, pr: number) {
    if (!this.r) return
    this.size.w = Math.max(1, w)
    this.size.h = Math.max(1, h)
    this.r.setPixelRatio(pr)
    this.r.setSize(this.size.w, this.size.h, false)
    this.cam.aspect = this.size.w / this.size.h
    this.cam.updateProjectionMatrix()
  }

  /** pointer in canvas px (element-local) */
  setPointer(x: number, y: number, inside: boolean) {
    this.ptr.x = x
    this.ptr.y = y
    this.ptr.in = inside
  }
  setExplode(target: number) {
    this.ex.target = target
  }

  /** a root-space part position projected to canvas px (for DOM labels) */
  anchorPx(i: number, out: [number, number]) {
    this.v.set(this.live[i * 3], this.live[i * 3 + 1], this.live[i * 3 + 2]).applyMatrix4(this.root.matrixWorld).project(this.cam)
    out[0] = (this.v.x * 0.5 + 0.5) * this.size.w
    out[1] = (-this.v.y * 0.5 + 0.5) * this.size.h
  }

  render(st: KitState) {
    const r = this.r
    if (!r) return
    const dt = Math.min(0.05, st.dt)
    // which pair of formations, and how far between them
    let A = 0
    let B = 1
    let f = st.pre
    if (st.s > 0 || st.pre >= 1) {
      const s = Math.min(4, Math.max(0, st.s))
      const k = Math.min(3, Math.floor(s))
      A = 1 + k
      B = 2 + k
      f = s - k
    }
    const FA = FORMS[A]
    const FB = FORMS[B]
    // the root: blend the formations' yaw/pitch, tilt toward the pointer, roll with velocity
    const p = this.ptr
    const tx = p.in ? (p.x / this.size.w - 0.5) * 2 : 0
    const ty = p.in ? (p.y / this.size.h - 0.5) * 2 : 0
    const kS = 1 / 0.4
    p.vx += ((tx - p.tx) * kS * kS - 2 * kS * p.vx) * dt
    p.vy += ((ty - p.ty) * kS * kS - 2 * kS * p.vy) * dt
    p.tx += p.vx * dt
    p.ty += p.vy * dt
    const mR = inOut(f)
    this.root.rotation.set(
      FA.pitch + (FB.pitch - FA.pitch) * mR + p.ty * 0.08,
      FA.yaw + (FB.yaw - FA.yaw) * mR + p.tx * 0.14,
      Math.max(-0.12, Math.min(0.12, st.vel * 0.05)),
    )
    this.root.updateMatrixWorld()
    // pointer → root-space point on the sculpture's plane
    let hx = 1e5
    let hy = 1e5
    if (p.in) {
      this.ray.setFromCamera(new Vector2(tx, -ty), this.cam)
      this.plane.normal.set(0, 0, 1).applyQuaternion(this.root.quaternion)
      this.plane.constant = -this.plane.normal.dot(this.root.position)
      if (this.ray.ray.intersectPlane(this.plane, this.hit)) {
        this.root.worldToLocal(this.hit)
        hx = this.hit.x
        hy = this.hit.y
      }
    }
    // take it apart: a spring toward the target (a little bounce on the way back)
    const back = this.ex.target < this.ex.x
    const w0 = 2 * Math.PI / (back ? 0.42 : 0.35)
    const z = back ? 0.8 : 1
    this.ex.v += ((this.ex.target - this.ex.x) * w0 * w0 - 2 * z * w0 * this.ex.v) * dt
    this.ex.x += this.ex.v * dt
    const ex = Math.max(-0.05, this.ex.x)
    // idle blend: live motion only when settled on a formation
    const settle = 1 - smooth(0.04, 0.16, Math.min(f, 1 - f))
    const atFlow = B === 2 ? smooth(0.85, 1, f) : A === 2 ? 1 - smooth(0, 0.15, f) : 0
    const atLive = B === 5 ? smooth(0.85, 1, f) : 0
    const atShelf = B === 3 ? smooth(0.6, 1, f) : A === 3 ? 1 - smooth(0, 0.3, f) : 0
    const atRed = B === 4 ? smooth(0.75, 1, f) : A === 4 ? 1 - smooth(0, 0.25, f) : 0
    ;(this.grid.material as LineBasicMaterial).opacity = 0.35 * atShelf
    ;(this.red.material as LineBasicMaterial).opacity = 0.85 * atRed
    ;(this.glow.material as MeshBasicMaterial).opacity = 0.25 * atLive
    this.grid.visible = atShelf > 0.002
    this.red.visible = atRed > 0.002
    this.glow.visible = atLive > 0.002
    const t = st.t
    const ptrK = 120
    const ptrC = 14

    for (let i = 0; i < KIT_COUNT; i++) {
      const i3 = i * 3
      // staggered progress (near parts leave first), one arc, one tumble, an exact landing
      const stg = rnd(i, 2)
      const m = inOut(clamp01(f * 1.35 - stg * 0.35))
      const side = rnd(i, 9) > 0.5 ? 1 : -1
      let x = FA.pos[i3] + (FB.pos[i3] - FA.pos[i3]) * m
      let y = FA.pos[i3 + 1] + (FB.pos[i3 + 1] - FA.pos[i3 + 1]) * m
      let zz = FA.pos[i3 + 2] + (FB.pos[i3 + 2] - FA.pos[i3 + 2]) * m
      const arc = Math.sin(Math.PI * m)
      if (arc > 1e-4) {
        const ang = arc * 0.6 * side
        const c = Math.cos(ang)
        const sn = Math.sin(ang)
        const rx = x * c + zz * sn
        zz = -x * sn + zz * c
        x = rx
        y += arc * (0.5 + 0.9 * rnd(i, 3))
      }
      // time-based life on the settled formations
      if (i >= START.dot && i < START.dot + 12 && atFlow > 0) {
        const [px, py] = pathAt((i - START.dot) / 12 + t * 0.06)
        x += (px - x) * atFlow
        y += (py - y) * atFlow
      }
      if (i >= START.dot + 7 && i < START.dot + 12 && atLive > 0) {
        const a = ((i - START.dot - 7) / 5) * Math.PI * 2 + t * 0.35
        x += (Math.cos(a) * 2.6 - x) * atLive
        y += (Math.sin(a) * 1.2 - 0.2 - y) * atLive
        zz += (Math.sin(a) * 1.4 + 0.6 - zz) * atLive
      }
      if (settle > 0) y += Math.sin(t * 2.5 + rnd(i, 4) * 6.28) * 0.03 * settle
      if (i === HERO_PILL && atLive > 0.5) {
        const ph = (t % 2.4) / 2.4
        zz -= ph < 0.07 ? Math.sin((ph / 0.07) * Math.PI) * 0.06 : 0
      }
      // the pointer nudges parts aside (springs, so they settle back)
      let fx = 0
      let fy = 0
      const dx = x - hx
      const dy = y - hy
      const d = Math.hypot(dx, dy)
      if (d < 1.1 && d > 1e-4) {
        const k = (1 - d / 1.1) ** 2 * 0.35
        fx = (dx / d) * k
        fy = (dy / d) * k
      }
      this.pushV[i3] += ((fx - this.push[i3]) * ptrK - this.pushV[i3] * ptrC) * dt
      this.pushV[i3 + 1] += ((fy - this.push[i3 + 1]) * ptrK - this.pushV[i3 + 1] * ptrC) * dt
      this.push[i3] += this.pushV[i3] * dt
      this.push[i3 + 1] += this.pushV[i3 + 1] * dt
      x += this.push[i3]
      y += this.push[i3 + 1]
      // apart: outward from the centre, with a spin
      let spin = 0
      if (Math.abs(ex) > 1e-3) {
        const ox = x + (rnd(i, 14) - 0.5) * 0.6
        const oy = y + (rnd(i, 15) - 0.5) * 0.6
        const oz = zz + (rnd(i, 16) - 0.5) * 0.6 + 0.4
        const l = Math.hypot(ox, oy, oz) || 1
        const k = (1.6 + 1.2 * rnd(i, 17)) * ex
        x += (ox / l) * k
        y += (oy / l) * k
        zz += (oz / l) * k
        spin = ex * 0.9
      }
      this.live[i3] = x
      this.live[i3 + 1] = y
      this.live[i3 + 2] = zz
      // rotation: slerp + one full tumble that lands exactly
      this.e.set(FA.rot[i3], FA.rot[i3 + 1], FA.rot[i3 + 2])
      this.qa.setFromEuler(this.e)
      this.e.set(FB.rot[i3], FB.rot[i3 + 1], FB.rot[i3 + 2])
      this.qb.setFromEuler(this.e)
      this.q.slerpQuaternions(this.qa, this.qb, m)
      const tumble = Math.PI * 2 * m * (rnd(i, 10) > 0.5 ? 1 : -1) * (m > 0 && m < 1 ? 1 : 0) + spin * (rnd(i, 18) - 0.5) * 2
      if (tumble) this.q.premultiply(this.qs.setFromAxisAngle(this.axis[i], tumble))
      const sx = FA.scl[i3] + (FB.scl[i3] - FA.scl[i3]) * m
      const sy = FA.scl[i3 + 1] + (FB.scl[i3 + 1] - FA.scl[i3 + 1]) * m
      const sz = FA.scl[i3 + 2] + (FB.scl[i3 + 2] - FA.scl[i3 + 2]) * m
      this.m4.compose(this.v.set(x, y, zz), this.q, this.vs.set(sx, sy, sz))
      if (i === START.slab) {
        this.slab.matrixAutoUpdate = false
        this.slab.matrix.copy(this.m4)
        this.slab.matrixWorldNeedsUpdate = true
      } else {
        const type = i < START.pill ? 'card' : i < START.dot ? 'pill' : i < START.bar ? 'dot' : i < START.ring ? 'bar' : 'ring'
        this.meshes.get(type)!.setMatrixAt(i - START[type], this.m4)
      }
    }
    this.meshes.forEach((m) => (m.instanceMatrix.needsUpdate = true))
    r.render(this.scene, this.cam)
  }

  dispose() {
    this.geos.forEach((g) => g.dispose())
    this.mats.forEach((m) => m.dispose())
    this.pmremTarget?.dispose()
    if (this.r) {
      this.r.dispose()
      this.r.forceContextLoss()
    }
    this.r = null
  }
}
