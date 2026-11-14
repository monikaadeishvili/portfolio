/**
 * 06 After hours: the trip. Three nested dreams, each one entered through a
 * pupil of the one before (an infinite zoom), composited with a liquid,
 * rainbow-rimmed portal:
 *
 *   page ─(momo's eye on the page)→ 1 Eye garden ─(momo's pupil)→
 *   2 Melting tools ─(a drop of ink)→ 3 Final_final tunnel → momo, awake
 *
 * Everything is a cartoon: toon bands, inverted-hull ink outlines, the acid
 * palette (tripGlsl.ts). Only the dreams on screen render (two at most,
 * during a dive), each into its own target; one full-screen pass composites.
 */
import * as THREE from 'three'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import { BACK_VERT, EYE_FRAG, INK_FRAG, LIB, VERT } from './tripGlsl'

/* ------------------------------------------------------------ the map */

/** each dream's span on the trip's progress f, and where in it the dive starts */
export const SPANS: [number, number][] = [
  [0, 0.38],
  [0.27, 0.68],
  [0.5775, 1],
]
const DIVE = [0.72, 0.75]
/** the page → garden portal opens over this much of f */
export const OPEN = 0.075

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
let seed = 7
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const INK = new THREE.Color('#120e0b')
const MOMO = new THREE.Color('#7464FF')
const LIME = new THREE.Color('#C6F135')
const ORANGE = new THREE.Color('#E8590C')
const PAPER = new THREE.Color('#F6F2EA')

/* ------------------------------------------------------------ materials */

type U = Record<string, THREE.IUniform>
/** time and hue, shared by every material in the trip */
const G: U = { uTime: { value: 0 }, uHue: { value: 0 } }

const shader = (frag: string, uniforms: U = {}, defines: Record<string, string | number | boolean> = {}, extra: THREE.ShaderMaterialParameters = {}) =>
  new THREE.ShaderMaterial({ vertexShader: LIB + VERT, fragmentShader: LIB + frag, uniforms: { ...G, ...uniforms }, defines, ...extra })

const BODY_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIri;
uniform float uMarble;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
#ifdef INST
varying float vSeed;
#endif
void main(){
  vec3 n = normalize(vN);
  vec3 v = normalize(cameraPosition - vW);
  float fr = 1.0 - max(0.0, dot(n, v));
  vec3 base = uColor;
  #ifdef INST
  base = acid(vSeed + uTime * 0.08);
  #endif
  if (uMarble > 0.0) {
    float m = fbm(vL * 0.55 + vec3(0.0, uTime * 0.12, uTime * 0.05));
    base = mix(base, acid(m * 0.9 + 0.62), uMarble * smoothstep(-0.1, 0.5, m));
  }
  vec3 col = base * toon(n);
  col = mix(col, acid(fr * 1.4 + vW.y * 0.12 + uTime * 0.2), uIri * smoothstep(0.38, 0.95, fr));
  vec3 h = normalize(normalize(vec3(0.45, 0.8, 0.55)) + v);
  if (dot(n, h) > 0.982) col = mix(col, vec3(1.0), 0.85);
  gl_FragColor = vec4(col, 1.0);
}
`

const body = (color: THREE.Color, iri = 0.5, defines: Record<string, boolean> = {}, extraU: U = {}, marble = 0) =>
  shader(BODY_FRAG, { uColor: { value: color.clone() }, uIri: { value: iri }, uMarble: { value: marble }, ...extraU }, defines)

/** inverted hull: the cartoon outline */
const ink = (w: number, defines: Record<string, boolean> = {}, extraU: U = {}) =>
  shader(INK_FRAG, { uW: { value: w }, ...extraU }, { OUTLINE: true, ...defines }, { side: THREE.BackSide })

const withInk = <T extends THREE.Mesh>(m: T, w: number, defines: Record<string, boolean> = {}, extraU: U = {}) => {
  m.add(new THREE.Mesh(m.geometry, ink(w, defines, extraU)))
  return m
}

/** a full-screen backdrop for a scene */
const backdrop = (frag: string, uniforms: U = {}) => {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: BACK_VERT, fragmentShader: LIB + frag, uniforms: { ...G, ...uniforms }, depthWrite: false, depthTest: false }),
  )
  m.frustumCulled = false
  m.renderOrder = -10
  return m
}

/* ------------------------------------------------------------ momo */

interface Momo {
  group: THREE.Group
  eyes: THREE.Mesh[]
  blink: { value: number }
  R: number
  /** look at a world point (eyes) */
  look: (p: THREE.Vector3) => void
  /** pupil centre (world) of eye i; returns the pupil radius */
  pupil: (i: number, out: THREE.Vector3) => number
}

function makeMomo(R: number, seg: number, smile: boolean): Momo {
  const group = new THREE.Group()
  const wob: U = { uWob: { value: R * 0.05 } }
  const geo = new THREE.SphereGeometry(R, seg, Math.round(seg * 0.66))
  const bodyM = new THREE.Mesh(geo, body(MOMO, 0.55, { WOBBLE: true }, wob, 0.2))
  withInk(bodyM, R * 0.035, { WOBBLE: true }, wob)
  bodyM.scale.set(1.07, 0.96, 1)
  group.add(bodyM)
  const blink = { value: 0 }
  const eyeMat = shader(EYE_FRAG, { uBlink: blink, uSkin: { value: MOMO.clone() } })
  const eyeGeo = new THREE.SphereGeometry(R * 0.26, 40, 28)
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(eyeGeo, eyeMat)
    withInk(e, R * 0.022)
    e.position.set(s * R * 0.31, R * 0.12, R * 0.84)
    e.scale.set(1, 1.25, 0.8)
    group.add(e)
    return e
  })
  if (smile) {
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(R * 0.2, R * 0.045, 10, 36, Math.PI), new THREE.MeshBasicMaterial({ color: INK }))
    mouth.rotation.z = Math.PI
    mouth.position.set(0, -R * 0.24, R * 0.95)
    mouth.rotation.x = -0.25
    group.add(mouth)
  }
  const fwd = new THREE.Vector3()
  return {
    group,
    eyes,
    blink,
    R,
    look: (p) => {
      group.updateMatrixWorld()
      eyes.forEach((e) => e.lookAt(p))
    },
    pupil: (i, out) => {
      const e = eyes[i]
      e.updateMatrixWorld()
      e.getWorldPosition(out)
      e.getWorldDirection(fwd)
      out.addScaledVector(fwd, R * 0.26 * 0.8 * group.scale.x)
      return R * 0.26 * 0.3 * group.scale.x
    },
  }
}

/* ------------------------------------------------------------ dreams */

interface Dream {
  scene: THREE.Scene
  cam: THREE.PerspectiveCamera
  /** l: local progress 0..1 over the dream's span */
  update: (l: number, t: number, dt: number) => void
  /** the hole into the next dream: its centre (world); returns its radius */
  target?: (out: THREE.Vector3) => number
}

const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()
const UP = new THREE.Vector3(0, 1, 0)
const dummy = new THREE.Object3D()

/** an exponential dive along a fixed direction into a moving target: constant perceived speed */
class Dive {
  dir = new THREE.Vector3()
  d0 = 1
  armed = false
  arm(cam: THREE.Camera, target: THREE.Vector3) {
    this.dir.copy(cam.position).sub(target)
    this.d0 = Math.max(0.01, this.dir.length())
    this.dir.normalize()
    this.armed = true
  }
  place(cam: THREE.PerspectiveCamera, target: THREE.Vector3, e: number) {
    const d = this.d0 * Math.pow(0.008, e)
    cam.position.copy(target).addScaledVector(this.dir, d)
    cam.lookAt(target)
  }
}

/* ---- 1 · Eye garden: a breathing field of eyeball flowers under momo, the sun */

const gh = (x: number, z: number, t: number) => 1.3 * Math.sin(x * 0.16 + t * 0.5) * Math.cos(z * 0.13 - t * 0.35) + 0.6 * Math.sin((x - z) * 0.27 + t * 0.3) - 0.8

function gardenDream(narrow: boolean, ptr: THREE.Vector2): Dream {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(55, 1, 0.005, 200)

  // sky: hard rainbow bands radiating from the sun
  const sunDir = new THREE.Vector3(0, 0.32, -1).normalize()
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 48, 24),
    shader(
      /* glsl */ `
      uniform vec3 uSun;
      varying vec3 vL;
      void main(){
        vec3 d = normalize(vL);
        float s = acos(clamp(dot(d, uSun), -1.0, 1.0));
        vec3 ax = normalize(cross(uSun, vec3(0.0, 1.0, 0.0)));
        float a = atan(dot(d, cross(uSun, ax)), dot(d, ax));
        float n = fbm(d * 2.4 + vec3(0.0, uTime * 0.05, 0.0));
        float k = s * 8.0 - uTime * 0.8 + n * 1.6 + sin(a * 5.0 + s * 7.0 - uTime * 0.7) * 0.4;
        vec3 col = acid(floor(k) * 0.11 + 0.15);
        float e = fract(k);
        col *= 0.72 + 0.28 * smoothstep(0.0, 0.05, e) * smoothstep(1.0, 0.95, e);
        gl_FragColor = vec4(col, 1.0);
      }`,
      { uSun: { value: sunDir } },
      {},
      { side: THREE.BackSide, depthWrite: false },
    ),
  )
  sky.renderOrder = -5
  scene.add(sky)

  // the breathing field, banded by height like a contour map on acid
  const gseg = narrow ? 96 : 150
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150, gseg, gseg).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { ...G },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying float vH;
        varying vec3 vW;
        float gh(vec2 p, float t){ return 1.3 * sin(p.x * 0.16 + t * 0.5) * cos(p.y * 0.13 - t * 0.35) + 0.6 * sin((p.x - p.y) * 0.27 + t * 0.3) - 0.8; }
        void main(){
          vec3 p = position;
          p.y = gh(p.xz, uTime);
          vH = p.y;
          vec4 w = modelMatrix * vec4(p, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader:
        LIB +
        /* glsl */ `
        varying float vH;
        varying vec3 vW;
        void main(){
          float k = vH * 1.7 + length(vW.xz - vec2(0.0, -40.0)) * 0.11 - uTime * 0.45;
          vec3 col = acid(floor(k) * 0.13 + 0.55);
          float e = fract(k);
          col *= 0.62 + 0.38 * smoothstep(0.0, 0.07, e);
          float far = smoothstep(26.0, 70.0, length(vW.xz - cameraPosition.xz));
          col = mix(col, vec3(0.16, 0.05, 0.28), far * 0.85);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  )
  scene.add(ground)

  // momo, the sun
  const momo = makeMomo(6, narrow ? 56 : 72, false)
  momo.group.position.set(0, 9.5, -40)
  scene.add(momo.group)

  // eyeball flowers
  const N = narrow ? 24 : 44
  const fl = Array.from({ length: N }, (_, i) => {
    let x = 0
    let z = 0
    do {
      x = (rnd() - 0.5) * 30
      z = 12 - rnd() * 40
    } while (Math.abs(x) < 1.8 + (12 - z) * 0.03)
    return { x, z, H: 1.3 + rnd() * 1.6, s: 0.75 + rnd() * 0.6, ph: rnd() * 6.28, i }
  })
  const seeds = new Float32Array(fl.map(() => rnd()))
  const eyeGeo = new THREE.SphereGeometry(0.42, 28, 20)
  eyeGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  const eyes = new THREE.InstancedMesh(eyeGeo, shader(EYE_FRAG, { uBlink: { value: 0 }, uSkin: { value: LIME.clone() } }, { INST: true }), N)
  const eyeInk = new THREE.InstancedMesh(eyeGeo, ink(0.035, { INST: true }), N)
  eyeInk.instanceMatrix = eyes.instanceMatrix
  const petGeo = new THREE.PlaneGeometry(1.9, 1.9)
  petGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  const petals = new THREE.InstancedMesh(
    petGeo,
    shader(
      /* glsl */ `
      varying vec2 vUv;
      varying float vSeed;
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = atan(p.y, p.x);
        float edge = 0.62 + 0.3 * abs(cos(a * 4.0 + vSeed * 6.0 + uTime * 0.6));
        if (r > edge) discard;
        vec3 col = acid(vSeed * 3.0 + r * 0.9 - uTime * 0.25);
        if (r > edge - 0.07) col = vec3(0.07, 0.055, 0.045);
        gl_FragColor = vec4(col, 1.0);
      }`,
      {},
      { INST: true },
      { side: THREE.DoubleSide },
    ),
    N,
  )
  const stemGeo = new THREE.CylinderGeometry(0.06, 0.09, 1, 6, 1).translate(0, 0.5, 0)
  stemGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
  const stems = new THREE.InstancedMesh(stemGeo, shader(INK_FRAG), N)
  ;[eyes, eyeInk, petals, stems].forEach((m) => {
    m.frustumCulled = false
    scene.add(m)
  })

  // floating balls, rising
  const NB = narrow ? 18 : 36
  const balls = Array.from({ length: NB }, () => ({ x: (rnd() - 0.5) * 34, z: 8 - rnd() * 44, y0: rnd() * 16, sp: 0.4 + rnd() * 0.7, r: 0.15 + rnd() * 0.35 }))
  const ballGeo = new THREE.SphereGeometry(1, 16, 12)
  ballGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(balls.map(() => rnd())), 1))
  const ballM = new THREE.InstancedMesh(ballGeo, body(PAPER, 0.9, { INST: true }), NB)
  const ballInk = new THREE.InstancedMesh(ballGeo, ink(0.12, { INST: true }), NB)
  ballInk.instanceMatrix = ballM.instanceMatrix
  ;[ballM, ballInk].forEach((m) => {
    m.frustumCulled = false
    scene.add(m)
  })

  const dive = new Dive()
  const look = new THREE.Vector3()
  const pupil = new THREE.Vector3()
  const base = new THREE.Vector3()
  const top = new THREE.Vector3()
  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()

  const update = (l: number, t: number) => {
    const dl = DIVE[0]
    // momo floats and breathes; blinks now and then (never mid-dive)
    momo.group.position.y = 9.5 + Math.sin(t * 0.8) * 0.5
    momo.group.rotation.z = Math.sin(t * 0.5) * 0.06
    momo.group.updateMatrixWorld()
    const bc = t % 5.3
    momo.blink.value = l < dl - 0.04 ? smooth(0, 0.08, bc) * (1 - smooth(0.1, 0.22, bc)) : 0

    // the camera wanders up the field toward the sun, then dives into its left pupil
    if (l < dl) {
      dive.armed = false
      const a = l / dl
      const e = inOut(a)
      const z = lerp(17, 3, e)
      const y = gh(0, z, t) + lerp(1.4, 3.6, e)
      const free = 1 - smooth(0.75, 1, a)
      cam.position.set((Math.sin(t * 0.35) * 0.6 + ptr.x * 0.8) * free, y + ptr.y * 0.4 * free, z)
      momo.pupil(0, pupil)
      tmpV.set(0, 2.5, -30)
      tmpV.lerp(pupil, smooth(0.25, 1, a))
      cam.up.set(Math.sin(t * 0.4) * 0.12 * free, 1, 0).normalize()
      cam.lookAt(tmpV)
      momo.look(tmpV2.copy(cam.position).add(tmpV.set(ptr.x * 4, ptr.y * 3, 0)))
    } else {
      // freeze the gaze on the camera, then fall in
      momo.look(cam.position)
      momo.pupil(0, pupil)
      if (!dive.armed) {
        // arm from a stable pose so scrubbing back and forth is exact
        const z = 3
        cam.position.set(0, gh(0, z, t) + 3.6, z)
        momo.look(cam.position)
        momo.pupil(0, pupil)
        dive.arm(cam, pupil)
      }
      cam.up.set(0, 1, 0)
      dive.place(cam, pupil, inOut((l - dl) / (1 - dl)))
    }
    cam.updateMatrixWorld()

    // flowers: stem from the ground, head on top, all eyes on the visitor
    cam.getWorldDirection(fwd)
    right.crossVectors(fwd, UP).normalize()
    up.crossVectors(right, fwd)
    look.copy(cam.position).addScaledVector(right, ptr.x * 5).addScaledVector(up, ptr.y * 3)
    fl.forEach((f) => {
      const sw = Math.sin(t * 1.3 + f.ph) * 0.35
      base.set(f.x, gh(f.x, f.z, t), f.z)
      top.set(f.x + sw * f.H * 0.5, base.y + f.H, f.z + Math.cos(t * 1.1 + f.ph) * 0.15 * f.H)
      // head
      dummy.position.copy(top)
      dummy.scale.setScalar(f.s)
      dummy.lookAt(look)
      dummy.updateMatrix()
      eyes.setMatrixAt(f.i, dummy.matrix)
      dummy.position.addScaledVector(tmpV.set(0, 0, 1).applyQuaternion(dummy.quaternion), -0.22 * f.s)
      dummy.updateMatrix()
      petals.setMatrixAt(f.i, dummy.matrix)
      // stem
      tmpV.copy(top).sub(base)
      const len = tmpV.length()
      tmpQ.setFromUnitVectors(UP, tmpV.normalize())
      dummy.position.copy(base)
      dummy.quaternion.copy(tmpQ)
      dummy.scale.set(1, len, 1)
      dummy.updateMatrix()
      stems.setMatrixAt(f.i, dummy.matrix)
    })
    eyes.instanceMatrix.needsUpdate = true
    petals.instanceMatrix.needsUpdate = true
    stems.instanceMatrix.needsUpdate = true

    balls.forEach((b, i) => {
      const y = ((b.y0 + t * b.sp) % 16) - 1
      dummy.position.set(b.x + Math.sin(t + i) * 0.4, y, b.z)
      dummy.quaternion.identity()
      dummy.scale.setScalar(b.r * (1 + 0.08 * Math.sin(t * 3 + i)))
      dummy.updateMatrix()
      ballM.setMatrixAt(i, dummy.matrix)
    })
    ballM.instanceMatrix.needsUpdate = true
  }

  return {
    scene,
    cam,
    update,
    target: (out) => momo.pupil(0, out),
  }
}

/* ---- 2 · Melting tools: her Figma tools on their day off, in a kaleidoscope */

function extrudeTess(shape: THREE.Shape, depth: number, edge: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 10 })
  g.center()
  return new TessellateModifier(edge, 8).modify(g)
}

function toolsDream(narrow: boolean, ptr: THREE.Vector2): Dream {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(50, 1, 0.005, 200)
  const res = { value: new THREE.Vector2(1, 1) }

  scene.add(
    backdrop(
      /* glsl */ `
      uniform vec2 uRes;
      uniform vec2 uPtr;
      varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float r = length(p);
        float a = atan(p.y, p.x) + uTime * 0.05 + uPtr.x * 0.4;
        float seg = 6.28318 / 8.0;
        a = mod(a, seg);
        a = abs(a - seg * 0.5);
        vec2 q = vec2(cos(a), sin(a)) * r;
        // an endless zoom: log-polar
        vec2 z = vec2(log(r + 1e-3) * 1.4 - uTime * 0.35, a * 2.0);
        float n = fbm(vec3(q * 2.2 + uPtr * 0.3, uTime * 0.12));
        float k = z.x + n * 1.3 + sin(z.y * 6.0 + uTime) * 0.15;
        vec3 col = acid(floor(k * 2.0) * 0.09 + n * 0.25 + 0.3);
        float e = fract(k * 2.0);
        col *= 0.7 + 0.3 * smoothstep(0.0, 0.06, e);
        col *= 0.55 + 0.45 * smoothstep(0.0, 0.5, r);
        gl_FragColor = vec4(col, 1.0);
      }`,
      { uRes: res, uPtr: { value: ptr } },
    ),
  )

  const edge = narrow ? 0.2 : 0.14
  // the move tool
  const cur = new THREE.Shape()
  ;[
    [0, 0],
    [0, -3.3],
    [0.85, -2.45],
    [1.45, -3.8],
    [2.05, -3.52],
    [1.48, -2.24],
    [2.6, -2.24],
  ].forEach(([x, y], i) => (i ? cur.lineTo(x, y) : cur.moveTo(x, y)))
  cur.closePath()
  // the pen tool's nib
  const nib = new THREE.Shape()
  ;[
    [-0.7, 2.0],
    [0.7, 2.0],
    [0.7, 1.2],
    [0.95, 1.2],
    [1.15, 0.2],
    [0.08, -1.9],
    [-0.08, -1.9],
    [-1.15, 0.2],
    [-0.95, 1.2],
    [-0.7, 1.2],
  ].forEach(([x, y], i) => (i ? nib.lineTo(x, y) : nib.moveTo(x, y)))
  nib.closePath()
  const hole = new THREE.Path()
  hole.absarc(0, 0.15, 0.24, 0, Math.PI * 2, true)
  nib.holes.push(hole)
  // the colour picker, turned on a lathe
  const pip = new THREE.LatheGeometry(
    [
      [0, -2.5],
      [0.1, -2.3],
      [0.22, -1.7],
      [0.22, 1.1],
      [0.46, 1.2],
      [0.46, 1.42],
      [0.3, 1.5],
      [0.5, 1.75],
      [0.58, 2.1],
      [0.5, 2.45],
      [0.28, 2.68],
      [0, 2.74],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  )

  interface Tool {
    mesh: THREE.Mesh
    u: U
    home: THREE.Vector3
    spin: THREE.Vector3
    melt: number
    ext: number
  }
  const tools: Tool[] = []
  const addTool = (geo: THREE.BufferGeometry, color: THREE.Color, home: [number, number, number], spin: [number, number, number], melt: number, scale = 1) => {
    geo.computeBoundingSphere()
    const u: U = { uMelt: { value: 0 }, uTop: { value: 0 }, uSpan: { value: 1 }, uSeed: { value: rnd() * 10 } }
    const m = new THREE.Mesh(geo, body(color, 0.65, { MELT: true }, u))
    withInk(m, 0.06, { MELT: true }, u)
    m.position.set(...home)
    m.scale.setScalar(scale)
    scene.add(m)
    tools.push({ mesh: m, u, home: m.position.clone(), spin: new THREE.Vector3(...spin), melt, ext: (geo.boundingSphere?.radius ?? 2) * scale })
    return m
  }
  addTool(extrudeTess(cur, 0.55, edge), PAPER, [-4.4, 1.4, -0.5], [0.15, 0.5, 0.1], 1, 1.05)
  const pen = addTool(extrudeTess(nib, 0.5, edge), ORANGE, [0.4, 2.3, 1.2], [0.05, 0.4, 0.04], 0, 0.95)
  addTool(new TessellateModifier(edge * 1.4, 8).modify(pip), LIME, [4.6, 0.3, -1.2], [0.2, 0.3, 0.5], 0.9, 1.05)

  // the ink drop on the nib: the way out
  const dropU: U = { uColor: { value: INK.clone() } }
  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 28),
    shader(
      /* glsl */ `
      varying vec3 vN;
      varying vec3 vW;
      void main(){
        vec3 n = normalize(vN);
        vec3 v = normalize(cameraPosition - vW);
        float fr = 1.0 - max(0.0, dot(n, v));
        vec3 col = vec3(0.025, 0.02, 0.035);
        col = mix(col, acid(fr * 2.0 + uTime * 0.3), smoothstep(0.55, 1.0, fr));
        if (dot(n, normalize(vec3(-0.4, 0.7, 0.6))) > 0.96) col = vec3(1.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
      dropU,
    ),
  )
  scene.add(drop)

  // two bezier paths weaving through, with their anchor points
  const paths = [
    new THREE.CubicBezierCurve3(new THREE.Vector3(-9, -3, -3), new THREE.Vector3(-3, 6, 2), new THREE.Vector3(3, -6, -1), new THREE.Vector3(9, 3, -4)),
    new THREE.CubicBezierCurve3(new THREE.Vector3(-8, 4, -6), new THREE.Vector3(-2, -5, -2), new THREE.Vector3(4, 7, -3), new THREE.Vector3(8, -4, -2)),
  ]
  paths.forEach((c, k) => {
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(c, narrow ? 90 : 140, 0.13, 10, false),
      shader(
        /* glsl */ `
        uniform float uK;
        varying vec2 vUv;
        varying vec3 vN;
        void main(){
          vec3 col = acid(vUv.x * 3.0 - uTime * 0.5 + uK);
          col *= toon(vN);
          gl_FragColor = vec4(col, 1.0);
        }`,
        { uK: { value: k * 0.5 } },
      ),
    )
    withInk(tube, 0.05)
    scene.add(tube)
    ;[c.v0, c.v3].forEach((p) => {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), body(PAPER, 0.2))
      withInk(a, 0.06)
      a.position.copy(p)
      scene.add(a)
    })
  })

  // a school of cursors
  const NS = narrow ? 16 : 30
  const smallGeo = new THREE.ExtrudeGeometry(cur, { depth: 0.4, bevelEnabled: false })
  smallGeo.center()
  smallGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: NS }, () => rnd())), 1))
  const school = new THREE.InstancedMesh(smallGeo, body(PAPER, 0.3, { INST: true }), NS)
  const schoolInk = new THREE.InstancedMesh(smallGeo, ink(0.07, { INST: true }), NS)
  schoolInk.instanceMatrix = school.instanceMatrix
  ;[school, schoolInk].forEach((m) => {
    m.frustumCulled = false
    scene.add(m)
  })
  const fish = Array.from({ length: NS }, () => ({ r: 6 + rnd() * 4, sp: 0.25 + rnd() * 0.3, ph: rnd() * 6.28, y: (rnd() - 0.5) * 7, s: 0.22 + rnd() * 0.16 }))

  const dive = new Dive()
  const tip = new THREE.Vector3()
  const dropC = new THREE.Vector3()
  let dropR = 0.4

  const placeDrop = (l: number, t: number) => {
    pen.updateMatrixWorld()
    tip.set(0, -1.9, 0)
    pen.localToWorld(tip)
    dropR = lerp(0.32, 0.62, smooth(0.1, DIVE[1], l)) * (1 + 0.04 * Math.sin(t * 5))
    dropC.copy(tip)
    dropC.y -= dropR * 1.05
    drop.position.copy(dropC)
    drop.scale.set(dropR, dropR * 1.12, dropR)
  }
  const target = (out: THREE.Vector3) => {
    out.copy(dropC).addScaledVector(tmpV2.copy(cam.position).sub(dropC).normalize(), dropR)
    return dropR * 0.92
  }

  const update = (l: number, t: number) => {
    res.value.set(cam.aspect, 1)
    const dl = DIVE[1]
    tools.forEach((tl, k) => {
      const m = tl.mesh
      m.position.copy(tl.home)
      m.position.y += Math.sin(t * 0.9 + k * 2) * 0.35
      m.rotation.set(Math.sin(t * tl.spin.x * 2 + k) * 0.5, t * tl.spin.y + k, Math.sin(t * tl.spin.z * 2) * 0.35)
      // melt and re-form, deeper as the visitor scrolls on
      const breathe = 0.5 + 0.5 * Math.sin(t * 0.7 + k * 1.9)
      tl.u.uMelt.value = tl.melt * (0.25 + 0.75 * breathe) * (0.5 + 0.5 * smooth(0.1, 0.6, l))
      tl.u.uTop.value = m.position.y + tl.ext * 0.6
      tl.u.uSpan.value = tl.ext * 1.6
    })
    // hold the pen still for the dive
    if (l >= dl - 0.05) {
      const k = smooth(dl - 0.05, dl, l)
      pen.rotation.set(lerp(pen.rotation.x, 0, k), lerp(pen.rotation.y, 0, k), lerp(pen.rotation.z, 0, k))
    }
    placeDrop(l, t)

    if (l < dl) {
      dive.armed = false
      // arrive still falling from the pupil, then drift around the tools
      const a = l / dl
      const arrive = outCubic(clamp01(a / 0.3))
      const z = lerp(70, 15.5, arrive) - smooth(0.3, 1, a) * 3.5
      const free = 1 - smooth(0.7, 1, a)
      const orbit = Math.sin(a * 2.4 - 0.6) * 0.38 + ptr.x * 0.12 * free
      cam.position.set(Math.sin(orbit) * z, 0.6 + (ptr.y * 1.2 + Math.sin(t * 0.4) * 0.3) * free, Math.cos(orbit) * z)
      tmpV.set(0, 0.5, 0).lerp(dropC, smooth(0.55, 1, a))
      cam.up.set(Math.sin(t * 0.3) * 0.18 * free, 1, 0).normalize()
      cam.lookAt(tmpV)
    } else {
      if (!dive.armed) {
        const z = 12
        const o = Math.sin(2.4 - 0.6) * 0.38
        cam.position.set(Math.sin(o) * z, 0.6, Math.cos(o) * z)
        placeDrop(dl, t)
        const tg = new THREE.Vector3()
        target(tg)
        dive.arm(cam, tg)
      }
      const tg = tmpV
      target(tg)
      cam.up.set(0, 1, 0)
      dive.place(cam, tg, inOut((l - dl) / (1 - dl)))
    }
    cam.updateMatrixWorld()

    fish.forEach((f, i) => {
      const a = t * f.sp + f.ph
      dummy.position.set(Math.cos(a) * f.r, f.y + Math.sin(a * 2) * 0.8, Math.sin(a) * f.r * 0.6 - 2)
      tmpV.set(-Math.sin(a), Math.cos(a * 2) * 0.3, Math.cos(a) * 0.6)
      dummy.lookAt(tmpV.add(dummy.position))
      dummy.rotateZ(Math.PI * 0.75)
      dummy.scale.setScalar(f.s)
      dummy.updateMatrix()
      school.setMatrixAt(i, dummy.matrix)
    })
    school.instanceMatrix.needsUpdate = true
  }

  return { scene, cam, update, target }
}

/* ---- 3 · Final_final tunnel: every file you ever named, and momo at the end */

const LABELS = ['Frame 1', 'final_final_v7', 'Untitled', 'Copy of copy', 'USE THIS ONE', 'logo_new_NEW', 'do not touch', 'v2 (real)', 'Desktop – 37', 'iPhone 15 – 12']

function labelAtlas() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 64 * LABELS.length
  const g = c.getContext('2d')!
  g.fillStyle = '#fff'
  g.font = '600 38px "JetBrains Mono Variable", ui-monospace, monospace'
  g.textBaseline = 'middle'
  LABELS.forEach((s, i) => g.fillText(s, 6, i * 64 + 34))
  const tx = new THREE.CanvasTexture(c)
  tx.anisotropy = 4
  return { tx, draw: () => { g.clearRect(0, 0, c.width, c.height); g.font = '600 38px "JetBrains Mono Variable", ui-monospace, monospace'; LABELS.forEach((s, i) => g.fillText(s, 6, i * 64 + 34)); tx.needsUpdate = true } }
}

function tunnelDream(narrow: boolean, ptr: THREE.Vector2, atlas: THREE.Texture): Dream {
  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(60, 1, 0.005, 220)
  const res = { value: new THREE.Vector2(1, 1) }
  const speed = { value: 0 }
  scene.add(
    backdrop(
      /* glsl */ `
      uniform vec2 uRes;
      uniform float uSpeed;
      varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        float r = length(p);
        float a = atan(p.y, p.x);
        vec2 q = vec2(a / 3.14159 * 4.0 + uTime * 0.05, 0.5 / (r + 0.02) + uSpeed);
        float ch = step(0.5, fract(q.x)) == step(0.5, fract(q.y)) ? 1.0 : 0.0;
        vec3 col = acid(floor(q.y) * 0.07 + ch * 0.18 + 0.1);
        col *= 0.62 + 0.38 * ch;
        col *= smoothstep(0.0, 0.45, r);
        gl_FragColor = vec4(col, 1.0);
      }`,
      { uRes: res, uSpeed: speed },
    ),
  )

  // frames: plane = frame + label band above it; P (world units) from the frame's bottom-left
  const NA = narrow ? 26 : 34
  const NSat = narrow ? 18 : 36
  const N = NA + NSat
  const M = 0.16
  const BAND = 0.58
  const size = new Float32Array(N * 2)
  const lab = new Float32Array(N)
  const sd = new Float32Array(N)
  interface F {
    w: number
    h: number
    z: number
    r: number
    a: number
    spin: number
    ax: THREE.Vector3
  }
  const frames: F[] = []
  for (let i = 0; i < N; i++) {
    const sat = i >= NA
    const w = sat ? 1.4 + rnd() * 1.6 : 5.6 + rnd() * 2.4
    const h = sat ? w * (0.6 + rnd() * 0.9) : 3.8 + rnd() * 1.4
    size[i * 2] = w
    size[i * 2 + 1] = h
    lab[i] = Math.floor(rnd() * LABELS.length)
    sd[i] = rnd()
    frames.push({ w, h, z: sat ? 6 - rnd() * 100 : -i * 2.55, r: sat ? 3.6 + rnd() * 4 : rnd() * 0.35, a: rnd() * 6.28, spin: (rnd() - 0.5) * 1.6, ax: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize() })
  }
  const fGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0)
  fGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 2))
  fGeo.setAttribute('aLab', new THREE.InstancedBufferAttribute(lab, 1))
  fGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1))
  const fm = new THREE.InstancedMesh(
    fGeo,
    new THREE.ShaderMaterial({
      uniforms: { ...G, uAtlas: { value: atlas } },
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec2 aSize;
        attribute float aLab;
        attribute float aSeed;
        varying vec2 vP;
        varying vec2 vS;
        varying float vLab;
        varying float vSeed;
        void main(){
          vec2 full = aSize + vec2(${(M * 2).toFixed(2)}, ${(M + BAND).toFixed(2)});
          vec3 p = vec3(position.xy * full - vec2(full.x * 0.5, ${M.toFixed(2)} + aSize.y * 0.5), 0.0);
          vP = position.xy * full - vec2(${M.toFixed(2)});
          vS = aSize;
          vLab = aLab;
          vSeed = aSeed;
          gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
        }`,
      fragmentShader:
        LIB +
        /* glsl */ `
        uniform sampler2D uAtlas;
        varying vec2 vP;
        varying vec2 vS;
        varying float vLab;
        varying float vSeed;
        void main(){
          vec2 P = vP;
          vec3 col = acid(vSeed * 0.9 + uTime * 0.12 + P.x * 0.02);
          vec3 inkc = vec3(0.07, 0.055, 0.045);
          if (P.y > vS.y + 0.1) {
            float ls = clamp(vS.x / 5.0, 0.35, 1.0);
            vec2 lu = vec2(P.x / (4.2 * ls), (P.y - vS.y - 0.1) / (0.42 * ls));
            if (lu.x < 0.0 || lu.x > 1.0 || lu.y > 1.0) discard;
            float a = texture2D(uAtlas, vec2(lu.x * 0.98, 1.0 - (vLab + 1.0 - lu.y) / ${LABELS.length.toFixed(1)})).a;
            if (a < 0.45) discard;
            gl_FragColor = vec4(col, 1.0);
            return;
          }
          // corner handles
          vec2 c0 = abs(P);
          vec2 c1 = abs(P - vec2(vS.x, 0.0));
          vec2 c2 = abs(P - vec2(0.0, vS.y));
          vec2 c3 = abs(P - vS);
          float hd = min(min(max(c0.x, c0.y), max(c1.x, c1.y)), min(max(c2.x, c2.y), max(c3.x, c3.y)));
          if (hd < 0.15) { gl_FragColor = vec4(hd > 0.1 ? inkc : vec3(1.0), 1.0); return; }
          float bw = 0.07;
          bool edge = P.x > -bw && P.y > -bw && P.x < vS.x + bw && P.y < vS.y + bw && (P.x < bw || P.y < bw || P.x > vS.x - bw || P.y > vS.y - bw);
          if (!edge) discard;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
    N,
  )
  fm.frustumCulled = false
  scene.add(fm)

  // momo at the end of the tunnel, smiling now
  const momo = makeMomo(3.2, narrow ? 48 : 64, true)
  const MZ = -97
  momo.group.position.set(0, 0, MZ)
  scene.add(momo.group)
  const fwd = new THREE.Vector3()
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  let bounce = 0

  const update = (l: number, t: number, dt: number) => {
    res.value.set(cam.aspect, 1)
    // fall in fast, glide down the tunnel, arrive at momo
    const fly = clamp01(l / 0.8)
    const e = 1 - Math.pow(1 - fly, 2.2)
    const z = lerp(14, MZ + 11, e)
    speed.value = -z * 0.12
    const hold = smooth(0.78, 0.9, l)
    cam.position.set(ptr.x * (0.6 + hold * 1.6) + Math.sin(t * 0.5) * 0.3 * (1 - hold), ptr.y * (0.4 + hold * 0.8), z)
    cam.up.set(Math.sin(l * 9) * 0.5 * (1 - hold), 1, 0).normalize()
    cam.lookAt(tmpV.set(0, 0, z - 10).lerp(momo.group.position, hold))
    cam.updateMatrixWorld()

    bounce = Math.max(0, bounce - dt * 2.2)
    const sq = Math.sin(bounce * Math.PI * 3) * bounce * 0.18
    momo.group.scale.set(1 + sq, 1 - sq, 1 + sq)
    momo.group.position.y = Math.sin(t * 1.2) * 0.25
    momo.group.rotation.z = Math.sin(t * 0.7) * 0.05
    const bc = t % 4.1
    momo.blink.value = smooth(0, 0.07, bc) * (1 - smooth(0.09, 0.2, bc))
    cam.getWorldDirection(fwd)
    right.crossVectors(fwd, UP).normalize()
    up.crossVectors(right, fwd)
    momo.look(tmpV2.copy(cam.position).addScaledVector(right, ptr.x * 6).addScaledVector(up, ptr.y * 4))

    frames.forEach((f, i) => {
      if (i < NA) {
        dummy.position.set(Math.cos(f.a + t * 0.2) * f.r, Math.sin(f.a + t * 0.2) * f.r, f.z)
        dummy.rotation.set(0, 0, i * 0.24 + t * 0.12 * (i % 2 ? 1 : -1))
      } else {
        const a = f.a + t * 0.1 * (i % 2 ? 1 : -1)
        dummy.position.set(Math.cos(a) * f.r, Math.sin(a) * f.r, f.z)
        dummy.quaternion.setFromAxisAngle(f.ax, t * f.spin + f.a)
      }
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      fm.setMatrixAt(i, dummy.matrix)
    })
    fm.instanceMatrix.needsUpdate = true
  }

  return {
    scene,
    cam,
    update,
    // used by the overlay: poke momo
    target: (out) => {
      bounce = 1
      out.copy(momo.group.position)
      return momo.R
    },
  }
}

/* ------------------------------------------------------------ the trip */

export interface TripFrame {
  /** trip progress 0..1 */
  f: number
  t: number
  dt: number
  /** where the page's portal opens (CSS px, top-left origin) */
  hole: { x: number; y: number; r: number }
}

export class TripScene {
  ok = true
  private renderer!: THREE.WebGLRenderer
  private rtA!: THREE.WebGLRenderTarget
  private rtB!: THREE.WebGLRenderTarget
  private comp!: THREE.ShaderMaterial
  private quad!: THREE.Scene
  private qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private dreams: Dream[] = []
  private ptr = new THREE.Vector2()
  private ptrT = new THREE.Vector2()
  private atlas!: ReturnType<typeof labelAtlas>
  private w = 1
  private h = 1
  private pr = 1
  private kick = 0
  private hueT = 0
  private hueK = 0
  private kickAt = new THREE.Vector2()
  private P = new THREE.Vector3()
  private R = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement, narrow: boolean) {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !narrow, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
    } catch {
      this.ok = false
      return
    }
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.autoClear = true
    const opts = { depthBuffer: true, samples: narrow ? 0 : 4 }
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts)
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts)
    this.atlas = labelAtlas()
    seed = 7
    this.dreams = [gardenDream(narrow, this.ptr), toolsDream(narrow, this.ptr), tunnelDream(narrow, this.ptr, this.atlas.tx)]
    this.comp = new THREE.ShaderMaterial({
      uniforms: {
        ...G,
        tA: { value: this.rtA.texture },
        tB: { value: this.rtB.texture },
        useA: { value: 0 },
        hc: { value: new THREE.Vector2() },
        hr: { value: 0 },
        res: { value: new THREE.Vector2(1, 1) },
        uKick: { value: 0 },
        kickAt: { value: this.kickAt },
        uCA: { value: 0 },
        uWarp: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader:
        LIB +
        /* glsl */ `
        uniform sampler2D tA;
        uniform sampler2D tB;
        uniform float useA;
        uniform vec2 hc;
        uniform float hr;
        uniform vec2 res;
        uniform float uKick;
        uniform vec2 kickAt;
        uniform float uCA;
        uniform float uWarp;
        varying vec2 vUv;
        vec4 samp(sampler2D t, vec2 uv, vec2 off){
          vec4 c = texture2D(t, uv);
          return vec4(texture2D(t, uv + off).r, c.g, texture2D(t, uv - off).b, c.a);
        }
        void main(){
          float t = uTime;
          vec2 uv = vUv;
          uv += uWarp * vec2(sin(uv.y * 9.0 + t * 1.3), cos(uv.x * 7.0 - t * 1.1)) * 0.0045;
          vec2 fc = uv * res;
          vec2 kd = fc - kickAt;
          float kl = length(kd);
          float wave = uKick * sin(kl * 0.04 - t * 13.0) * exp(-kl * 0.003);
          uv += (kd / max(kl, 1.0)) * wave * 16.0 / res;
          vec2 q = uv * res - hc;
          float ang = atan(q.y, q.x);
          float wob = 1.0 + 0.055 * sin(ang * 6.0 + t * 3.0) + 0.035 * sin(ang * 11.0 - t * 4.3);
          float d = length(q) - hr * wob;
          vec2 off = (uv - 0.5) * (0.004 + uCA * 0.012);
          vec4 B = samp(tB, uv, off);
          vec4 A = useA > 0.5 ? samp(tA, uv, off) : vec4(0.0);
          float inside = smoothstep(1.5, -1.5, d);
          vec4 col = mix(A, B, inside);
          float rimW = 5.0 + hr * 0.045;
          float rim = hr > 0.5 ? exp(-abs(d) / rimW) : 0.0;
          vec3 rc = acid(ang * 0.159 + t * 0.4 - d * 0.004);
          col.rgb = mix(col.rgb, rc, rim * 0.95);
          col.a = max(col.a, rim);
          float g = fract(sin(dot(fc + fract(t) * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
          col.rgb += (g - 0.5) * 0.06 * col.a;
          vec2 vv = vUv - 0.5;
          col.rgb *= 1.0 - dot(vv, vv) * 0.7 * col.a;
          gl_FragColor = vec4(col.rgb * col.a, col.a);
        }`,
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new THREE.Scene()
    const qm = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp)
    qm.frustumCulled = false
    this.quad.add(qm)
  }

  /** fonts for the labels, then compile every program so the first dive never hitches */
  async warm() {
    try {
      await document.fonts.load('600 38px "JetBrains Mono Variable"')
    } catch {
      /* fallback font */
    }
    this.atlas.draw()
    for (const d of this.dreams) {
      d.update(0.01, 0, 0.016)
      await this.renderer.compileAsync(d.scene, d.cam)
    }
    this.renderer.compile(this.quad, this.qcam)
  }

  resize(w: number, h: number, pr: number) {
    this.w = w
    this.h = h
    this.pr = pr
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(w, h, false)
    const W = Math.max(1, Math.round(w * pr))
    const H = Math.max(1, Math.round(h * pr))
    this.rtA.setSize(W, H)
    this.rtB.setSize(W, H)
    ;(this.comp.uniforms.res.value as THREE.Vector2).set(W, H)
    const aspect = w / Math.max(1, h)
    this.dreams.forEach((d) => {
      // tall screens: open the vertical angle so the dream still fits across
      const f0 = (d.cam.userData.fov0 ??= d.cam.fov) as number
      const k = 1 + Math.max(0, 1 - aspect) * 0.9
      d.cam.fov = (2 * Math.atan(Math.tan((f0 * Math.PI) / 360) * k) * 180) / Math.PI
      d.cam.aspect = aspect
      d.cam.updateProjectionMatrix()
    })
  }

  /** pointer in -1..1 (y up) */
  setPointer(nx: number, ny: number) {
    this.ptrT.set(nx, ny)
  }

  /** a click: a ripple from that point and the whole palette turns */
  poke(x: number, y: number, f: number) {
    this.kick = 1
    this.kickAt.set(x * this.pr, (this.h - y) * this.pr)
    this.hueT += 0.23 + Math.random() * 0.2
    if (f > SPANS[2][0] + 0.25) this.dreams[2].target?.(this.P)
  }

  private project(d: Dream, p: THREE.Vector3, r: number, out: THREE.Vector2) {
    const W = this.w * this.pr
    const H = this.h * this.pr
    this.R.setFromMatrixColumn(d.cam.matrixWorld, 0).multiplyScalar(r).add(p)
    p.project(d.cam)
    this.R.project(d.cam)
    out.set((p.x * 0.5 + 0.5) * W, (p.y * 0.5 + 0.5) * H)
    if (p.z > 1) return 0
    return Math.hypot((this.R.x - p.x) * 0.5 * W, (this.R.y - p.y) * 0.5 * H)
  }

  render({ f, t, dt, hole }: TripFrame) {
    G.uTime.value = t
    const k = 1 - Math.exp(-dt * 7)
    this.ptr.x += (this.ptrT.x - this.ptr.x) * k
    this.ptr.y += (this.ptrT.y - this.ptr.y) * k
    this.kick = Math.max(0, this.kick - dt * 0.9)
    this.hueK += (this.hueT - this.hueK) * (1 - Math.exp(-dt * 3))
    G.uHue.value = this.hueK + t * 0.015
    const U = this.comp.uniforms
    U.uKick.value = this.kick * this.kick
    const W = this.w * this.pr
    const H = this.h * this.pr
    const diag = Math.hypot(W, H)
    const loc = (i: number) => clamp01((f - SPANS[i][0]) / (SPANS[i][1] - SPANS[i][0]))

    let outer = -1
    let inner = 0
    if (f >= SPANS[1][0] && f < SPANS[0][1]) {
      outer = 0
      inner = 1
    } else if (f >= SPANS[0][1] && f < SPANS[2][0]) inner = 1
    else if (f >= SPANS[2][0] && f < SPANS[1][1]) {
      outer = 1
      inner = 2
    } else if (f >= SPANS[1][1]) inner = 2

    const hc = U.hc.value as THREE.Vector2
    let hr = diag * 4
    let dive = 0
    if (outer < 0 && inner === 0 && f < OPEN) {
      // the page's portal: from momo on the page to the whole screen
      const e = f / OPEN
      const r0 = Math.max(4, hole.r * this.pr)
      hr = r0 * Math.pow((diag * 1.15) / r0, e * e * (1.6 - 0.6 * e))
      hc.set(hole.x * this.pr, (this.h - hole.y) * this.pr)
      dive = Math.sin(Math.PI * e)
    }
    if (outer >= 0) {
      const A = this.dreams[outer]
      A.update(loc(outer), t, dt)
      const r = A.target!(this.P)
      hr = this.project(A, this.P, r, hc)
      const lo = loc(outer)
      dive = smooth(DIVE[outer], 1, lo)
      if (hr < diag * 1.2) {
        this.renderer.setRenderTarget(this.rtA)
        this.renderer.render(A.scene, A.cam)
      } else outer = -1
    }
    const B = this.dreams[inner]
    B.update(loc(inner), t, dt)
    this.renderer.setRenderTarget(this.rtB)
    this.renderer.render(B.scene, B.cam)

    U.useA.value = outer >= 0 ? 1 : 0
    U.hr.value = hr
    U.uCA.value = dive * 1.6 + this.kick
    U.uWarp.value = 0.6 + dive * 2.5 + this.kick * 2
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.quad, this.qcam)
  }

  clear() {
    this.renderer.setRenderTarget(null)
    this.renderer.clear()
  }

  dispose() {
    this.renderer?.dispose()
    this.rtA?.dispose()
    this.rtB?.dispose()
    this.atlas?.tx.dispose()
    this.dreams.forEach((d) =>
      d.scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else mat?.dispose()
      }),
    )
  }
}
