/**
 * 01 Hello — the portrait as a living 3-D point cloud (experiment).
 *
 * ~90k particles are sampled from the cut-out photo and placed in depth (a
 * depth map estimated offline from the photo, see scripts/portrait3d). They are
 * stippled like an engraving — denser where the photo is darker — and inked in
 * the site's blues, from deep navy in the shadows to pale periwinkle on the
 * highlights. They shimmer and breathe, the cloud turns toward the pointer, and
 * when she arrives the dust gathers into her.
 *
 * Hover: a circle grows from the cursor; inside it the original photo burns
 * through, and the particles at its edge are blown outward like dust in a gust.
 *
 * Passes (one three.js renderer on the portrait canvas):
 *   1. particles → rtArt
 *   2. the photo on the same relief (so it lines up under the tilt) → rtPhoto
 *   3. full-screen composite (arrival burns, taste front, hover reveal,
 *      placeholder, blue rims) → canvas
 *
 * Debug views (dev): `?port=art`, `?port=photo`, `?port=depth`.
 */
import {
  Camera,
  DataTexture,
  DoubleSide,
  GLSL3,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoBlending,
  PerspectiveCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RedFormat,
  Scene,
  BufferGeometry,
  CustomBlending,
  Float32BufferAttribute,
  OneFactor,
  OneMinusSrcAlphaFactor,
  Points,
  Texture,
  UnsignedByteType,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three'

export interface Portrait3DFrame {
  time: number
  dt: number
  box: [number, number, number, number]
  sw: [number, number]
  r: number
  ring: number
  arrA: number
  arrB: number
  ph: [number, number, number, number]
  phOn: number
  man: number
  hot: number
  /** model tilt, radians: x (pitch), y (yaw) */
  tilt: [number, number]
  /** hover reveal: centre (canvas uv, top-left origin) and amount 0..1 */
  hv: [number, number, number]
  /** pointer near her: canvas uv (top-left) + strength 0..1, the dust parts around it */
  pt: [number, number, number]
}

/* ------------------------------------------------------------- tuning */
/** relief depth as a fraction of her height */
const DEPTH = 0.2
/** how much of the canvas height she fills (margin for the tilt) */
const FIT = 0.95
const FOV = 18
const SEG_Y = 340

const MESH_VERT = /* glsl */ `
in vec3 position;
in vec3 normal;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec2 vUv;
out vec3 vN;
out vec3 vV;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const MESH_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vN;
in vec3 vV;
out vec4 o;
uniform sampler2D uImg;
uniform sampler2D uDepth;
uniform float uLook;   // 1 photo, 2 depth (debug)
void main() {
  vec4 t = texture(uImg, vUv);
  // crisp, anti-aliased silhouette from the cut-out's alpha
  float a = clamp((t.a - 0.5) / max(fwidth(t.a), 1e-3) + 0.5, 0.0, 1.0);
  if (a <= 0.002) discard;
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  float diff = max(dot(N, normalize(vec3(-0.45, 0.6, 0.7))), 0.0);
  // the original photo, with a breath of the relief's light
  vec3 c = uLook < 1.5 ? t.rgb * mix(1.0, 0.88 + 0.26 * diff, 0.25) : vec3(texture(uDepth, vUv).r);
  o = vec4(c * a, a);
}
`

/* ---------------------------------------------------------- particles */
const PTS_VERT = /* glsl */ `
in vec3 position;   // home (relief space)
in vec4 aCol;       // rgb = ink colour, a = photo luminance (normalised)
in vec4 aRnd;       // per-particle random 0..1
in float aKind;     // 0 body grain, 1 wind mote
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uForm;  // 0 scattered dust .. 1 gathered into her
uniform vec2 uRes;    // canvas px
uniform vec3 uHv;     // hover centre (uv, top-left) + amount
uniform float uPx;    // point size scale (device px per unit)
uniform vec3 uPt;     // pointer (uv, top-left) + strength
out vec3 vCol;
out float vA;
out float vSoft;
void main() {
  vec3 p = position;
  float t = uTime;
  vec4 r = aRnd;
  // shimmer: each grain circles its home on its own slow orbit; the body breathes
  p += vec3(sin(t * (0.6 + r.x) + r.y * 6.283), cos(t * (0.5 + r.y) + r.z * 6.283), sin(t * (0.4 + r.z) + r.x * 6.283)) * (0.0016 + 0.0024 * r.w);
  p.z += sin(t * 0.7 + position.y * 4.0) * 0.004;
  // wind motes: lift off her edges, drift right and up with the shawl, fade, loop
  float life = fract(t * (0.07 + 0.06 * r.x) + r.y);
  float mote = aKind;
  if (mote > 0.5) {
    vec3 wind = vec3(0.21 + 0.12 * r.z, 0.05 + 0.06 * (r.w - 0.3), 0.04 * (r.x - 0.5));
    vec3 turb = vec3(sin(t * 1.3 + r.z * 9.0 + life * 7.0), cos(t * 1.1 + r.w * 7.0 + life * 5.0), sin(t * 0.9 + r.x * 5.0)) * 0.018 * life;
    p += wind * life * life * 1.4 + turb;
  }
  // arrival: dust drifts in from a wide, slow swirl and settles into place
  float f = smoothstep(0.0, 1.0, clamp(uForm * 1.25 - r.x * 0.25, 0.0, 1.0));
  vec3 away = normalize(vec3(r.y - 0.5, r.z - 0.5, r.w - 0.5) + 1e-3) * (0.35 + 0.45 * r.x);
  away.xy = mat2(cos(r.w * 3.0), -sin(r.w * 3.0), sin(r.w * 3.0), cos(r.w * 3.0)) * away.xy;
  p = mix(p + away, p, f);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  // hover: grains just outside the reveal circle are blown outward, like dust in a gust
  vec2 px = (clip.xy / clip.w * 0.5 + 0.5) * uRes;
  vec2 hc = vec2(uHv.x * uRes.x, (1.0 - uHv.y) * uRes.y);
  float R = uHv.z * length(uRes) * 1.08;
  vec2 dv = px - hc;
  float dd = length(dv);
  float band = uHv.z > 0.001 ? smoothstep(R + uRes.y * 0.16, R - uRes.y * 0.02, dd) : 0.0;
  vec2 dir = dv / max(dd, 1.0);
  vec2 tang = vec2(-dir.y, dir.x) * (r.y - 0.5) * 1.2;
  px += (dir + tang) * band * uRes.y * (0.05 + 0.09 * r.z);
  // the dust parts around the pointer and swirls a little, like a hand through smoke
  vec2 pc2 = vec2(uPt.x * uRes.x, (1.0 - uPt.y) * uRes.y);
  vec2 pv = px - pc2;
  float pd = length(pv);
  float Rp = uRes.y * (0.075 + 0.025 * r.z);
  float part = uPt.z * pow(clamp(1.0 - pd / Rp, 0.0, 1.0), 2.0);
  vec2 pdir = pv / max(pd, 1.0);
  px += (pdir + vec2(-pdir.y, pdir.x) * (0.35 + 0.4 * (r.w - 0.5))) * part * uRes.y * 0.05;
  clip.xy = ((px / uRes) * 2.0 - 1.0) * clip.w;
  gl_Position = clip;
  // size: a fine engraving; nearer grains a touch larger, a few larger motes
  float depthK = clamp(0.5 + position.z * 3.0, 0.0, 1.0);
  float big = step(0.985, r.x);
  // a few grains catch the light now and then
  float glint = big * pow(max(sin(t * (1.1 + r.z) + r.y * 40.0), 0.0), 10.0);
  // depth of field: grains behind her are larger, fainter, softer
  float s = mix(1.25, 1.0, depthK) * mix(0.85, 1.45, depthK) * mix(1.0, 2.1, big) * (1.0 + 0.9 * glint) * (1.0 + part * 0.6);
  gl_PointSize = s * uPx * mix(1.6, 1.0, f);
  vCol = mix(aCol.rgb, vec3(0.86, 0.9, 1.0), glint * 0.85);
  vSoft = 1.0 - smoothstep(0.25, 0.75, depthK);
  vA = mix(0.0, 1.0, smoothstep(0.0, 0.35, f)) * (1.0 - band * 0.35) * mix(0.5, 1.0, depthK) * (1.0 - part * 0.25);
  if (mote > 0.5) {
    // fade before the canvas edge so no mote is ever clipped
    vec2 e2 = min(px, uRes - px);
    vA *= sin(3.14159 * life) * 0.85 * smoothstep(0.0, uRes.y * 0.06, min(e2.x, e2.y));
    gl_PointSize *= mix(0.8, 1.35, r.z);
  }
}
`

const PTS_FRAG = /* glsl */ `
precision highp float;
in vec3 vCol;
in float vA;
in float vSoft;
out vec4 o;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = (1.0 - smoothstep(mix(0.32, 0.05, vSoft), 0.5, d)) * vA;
  if (a < 0.004) discard;
  o = vec4(vCol * a, a);
}
`

const QUAD_VERT = /* glsl */ `
in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const COMP_FRAG = /* glsl */ `
precision highp float;
out vec4 o;
uniform sampler2D uPhoto;
uniform sampler2D uArt;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uBox;
uniform vec2 uSw;
uniform float uR;
uniform float uRing;
uniform float uArrA;
uniform float uArrB;
uniform vec4 uPh;
uniform float uPhOn;
uniform float uMan;
uniform float uHot;
uniform vec3 uHv;
uniform float uDbg;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.07 + 17.3; a *= 0.5; }
  return s;
}
const vec3 BLUE = vec3(0.039, 0.294, 1.0);
const vec3 GLOW = vec3(0.616, 0.722, 1.0);
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float pxd(float e) { return e / max(fwidth(e), 1e-4); }
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 st = frag / uRes;
  vec2 uv = vec2(st.x, 1.0 - st.y);
  vec2 bp = uBox.xy + uv * uBox.zw;

  vec4 P4 = texture(uPhoto, st);
  vec4 C4 = texture(uArt, st);
  // the photo's silhouette drives the rims and the placeholder hand-off
  float a = P4.a;
  vec3 photo = P4.a > 0.002 ? P4.rgb / P4.a : vec3(0.0);
  vec3 artC = C4.a > 0.002 ? C4.rgb / C4.a : vec3(0.0);
  if (uDbg > 0.5) { o = uDbg < 1.5 ? C4 : P4; return; }

  // photo: cooler blacks, a hair of contrast (as before)
  float lum = luma(photo);
  vec3 graded = mix(photo, photo * vec3(0.93, 0.97, 1.07) + vec3(0.0, 0.002, 0.012), 1.0 - smoothstep(0.02, 0.42, lum));
  graded = clamp((graded - 0.5) * 1.035 + 0.5, 0.0, 1.0);
  vec4 photoP = vec4(graded * P4.a, P4.a);
  // the cloud before taste: grey dust
  float ga0 = C4.a * 0.75;
  vec4 greyP = vec4((vec3(luma(artC)) * 0.55 + 0.38) * ga0, ga0);

  float n1 = fbm(bp * 0.011 + vec2(uTime * 0.21, -uTime * 0.13));
  float n2 = fbm(bp * 0.0062 - vec2(uTime * 0.07, uTime * 0.05) + 9.0);
  float flick = 0.86 + 0.14 * noise(bp * 0.05 + uTime * 7.0);

  // hover: the photo burns through a circle that grows from the cursor
  vec2 hc = vec2(uHv.x * uRes.x, (1.0 - uHv.y) * uRes.y);
  float R = uHv.z * length(uRes) * 1.08;
  float eh = (R - length(frag - hc)) + (n1 - 0.5) * 0.09 * uRes.y * step(0.001, uHv.z);
  float dh = eh;
  float h = smoothstep(-1.0, 1.0, eh) * step(0.001, uHv.z);
  float rimH = step(0.001, uHv.z) * step(uHv.z, 0.999);

  // taste sweep from the switch
  float et = (uR - length(bp - uSw)) / 46.0 + (n2 - 0.5) * 1.6;
  float dt = pxd(et);
  float d = smoothstep(-0.8, 0.8, dt);

  // arrival: rising from the bottom
  float m = 0.16;
  float la = uArrA * (1.0 + 2.0 * m) - m;
  float ea = la - (1.0 - uv.y) + (n2 - 0.5) * m * 1.4;
  float da = pxd(ea);
  float A = smoothstep(-0.8, 0.8, da);
  float lb = uArrB * (1.0 + 2.0 * m) - m;
  float eb = lb - (1.0 - uv.y) + (n1 - 0.5) * m * 1.4;
  float db = pxd(eb);
  float B = smoothstep(-0.8, 0.8, db);

  /* composite (premultiplied): rest = the cloud, hover = the photo */
  vec4 lookP = mix(C4, photoP, h);
  vec4 consP = mix(greyP, C4, d);
  vec4 S = mix(consP, lookP, B);

  // the bland placeholder (only before the arrival / when taste is off)
  vec2 pc = (uPh.xy + uPh.zw) * 0.5;
  vec2 ph = (uPh.zw - uPh.xy) * 0.5 * uBox.zw;
  vec2 q = abs(bp - (uBox.xy + pc * uBox.zw)) - ph + 14.0;
  float rr = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 14.0;
  float phA = (1.0 - smoothstep(-0.5, 0.5, rr / max(fwidth(rr), 1e-4))) * uPhOn;
  float ring = (1.0 - smoothstep(0.0, 1.2, abs(rr / max(fwidth(rr), 1e-4) + 0.8))) * uPhOn;
  vec3 phC = mix(vec3(0.941, 0.941, 0.949), vec3(0.886, 0.886, 0.898), ring);
  vec2 ic = (bp - (uBox.xy + pc * uBox.zw)) / 34.0;
  float icon = 0.0;
  {
    vec2 r = abs(ic) - vec2(1.25, 1.0) + 0.18;
    float frame = abs(length(max(r, 0.0)) + min(max(r.x, r.y), 0.0) - 0.18) - 0.035;
    float sun = abs(length(ic - vec2(0.55, -0.38)) - 0.2) - 0.035;
    vec2 mp = ic - vec2(-0.2, 0.25);
    float mtn = abs(max(abs(mp.x) * 0.9 + mp.y * 0.75, -mp.y - 0.45) - 0.0) - 0.035;
    float dI = min(frame, min(sun, mtn));
    icon = 1.0 - smoothstep(0.0, fwidth(dI) * 1.2, dI);
  }
  phC = mix(phC, vec3(0.73, 0.73, 0.76), icon);
  vec4 Pl = vec4(phC * phA, phA);

  float Ae = mix(A, d, uMan);
  vec4 outc = mix(Pl, S, Ae);

  /* burning rims */
  float body = max(a, phA * (1.0 - Ae));
  float rimA = exp(-da * da / 3.2) * step(0.001, uArrA) * step(uArrA, 0.999) * max(a, phA);
  float rimB = exp(-db * db / 3.2) * step(0.001, uArrB) * step(uArrB, 0.999) * a;
  float rimT = exp(-dt * dt / 3.2) * uRing * mix(a, max(a, phA), uMan);
  float rimP = exp(-dh * dh / 2.6) * rimH * a;
  float core = max(max(rimA, rimB), max(rimT, rimP));
  float gA = exp(-da * da / 40.0) * step(0.001, uArrA) * step(uArrA, 0.999) * max(a, phA);
  float gB = exp(-db * db / 40.0) * step(0.001, uArrB) * step(uArrB, 0.999) * a;
  float gT = exp(-dt * dt / 40.0) * uRing * mix(a, max(a, phA), uMan);
  float gP = exp(-dh * dh / 34.0) * rimH * a;
  float glow = max(max(gA, gB), max(gT, gP));
  vec3 hotCol = mix(vec3(0.92, 0.92, 0.94), mix(GLOW, vec3(0.94, 0.96, 1.0), 0.45), d);
  float ca = clamp(core * flick * uHot, 0.0, 1.0);
  float ga = clamp(glow * 0.42 * flick * uHot, 0.0, 1.0) * (1.0 - ca);
  outc.rgb = outc.rgb * (1.0 - ga) + BLUE * ga;
  outc.a = outc.a * (1.0 - ga) + ga * body;
  float hot = smoothstep(0.55, 1.0, core);
  vec3 coreCol = mix(BLUE, hotCol, hot);
  outc.rgb = outc.rgb * (1.0 - ca) + coreCol * ca * body;
  outc.a = outc.a * (1.0 - ca) + ca * body;
  o = outc;
}
`

const loadImage = (url: string) => {
  const im = new Image()
  im.decoding = 'async'
  im.src = url
  return im.decode().then(() => im)
}

/** particle budget (the sampler aims for this many grains) */
const GRAINS = 80000
/** motes carried off her edges by the wind */
const MOTES = 5200
const NAVY: [number, number, number] = [0.02, 0.04, 0.2]
const BLUE: [number, number, number] = [0.039, 0.294, 1.0]
const PERI: [number, number, number] = [0.74, 0.8, 1.0]

/** The three.js side of the portrait. `ok` is false when WebGL2 is unavailable. */
export class Portrait3D {
  readonly canvas: HTMLCanvasElement
  ok = false
  ready = false
  private renderer: WebGLRenderer | null = null
  private scenePts = new Scene()
  private scenePhoto = new Scene()
  private gPts = new Group()
  private gPhoto = new Group()
  private cam3 = new PerspectiveCamera(FOV, 1, 0.1, 20)
  private compScene = new Scene()
  private compCam = new Camera()
  private meshMat: RawShaderMaterial
  private ptsMat: RawShaderMaterial
  private compMat: RawShaderMaterial
  private rtArt: WebGLRenderTarget | null = null
  private rtPhoto: WebGLRenderTarget | null = null
  private img: Texture | null = null
  private depthTex: DataTexture | null = null
  private geo: BufferGeometry | null = null
  private ptsGeo: BufferGeometry | null = null
  private aspect = 0.585
  private w = 2
  private h = 2
  private lastPhoto = ''
  private dbg = 0
  private lost = false
  /** how many grains were placed (dev readout) */
  grains = 0
  private hitM: Uint8Array | null = null
  private hitW = 0
  private hitH = 0
  private onLost = (e: Event) => {
    e.preventDefault()
    this.lost = true
  }

  constructor(canvas: HTMLCanvasElement, src: string, depthSrc: string, onReady: () => void) {
    this.canvas = canvas
    if (import.meta.env.DEV) {
      const v = new URLSearchParams(location.search).get('port')
      this.dbg = v === 'art' ? 1 : v === 'photo' ? 2 : v === 'depth' ? 3 : 0
    }
    this.meshMat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: MESH_VERT,
      fragmentShader: MESH_FRAG,
      uniforms: { uImg: { value: null }, uDepth: { value: null }, uLook: { value: this.dbg === 3 ? 2 : 1 } },
      side: DoubleSide,
      blending: NoBlending,
      depthTest: true,
      depthWrite: true,
    })
    this.ptsMat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: PTS_VERT,
      fragmentShader: PTS_FRAG,
      uniforms: { uTime: { value: 0 }, uForm: { value: 1 }, uRes: { value: [2, 2] }, uHv: { value: [0.5, 0.5, 0] }, uPx: { value: 2 }, uPt: { value: [0.5, 0.5, 0] } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    })
    this.compMat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: QUAD_VERT,
      fragmentShader: COMP_FRAG,
      uniforms: {
        uPhoto: { value: null },
        uArt: { value: null },
        uRes: { value: [2, 2] },
        uTime: { value: 0 },
        uBox: { value: [0, 0, 1, 1] },
        uSw: { value: [0, 0] },
        uR: { value: 0 },
        uRing: { value: 0 },
        uArrA: { value: 0 },
        uArrB: { value: 0 },
        uPh: { value: [0, 0, 1, 1] },
        uPhOn: { value: 1 },
        uMan: { value: 0 },
        uHot: { value: 1 },
        uHv: { value: [0.5, 0.5, 0] },
        uDbg: { value: this.dbg === 1 ? 1 : this.dbg >= 2 ? 2 : 0 },
      },
      blending: NoBlending,
      depthTest: false,
      depthWrite: false,
    })
    const tri = new BufferGeometry()
    tri.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
    const quad = new Mesh(tri, this.compMat)
    quad.frustumCulled = false
    this.compScene.add(quad)
    this.scenePts.add(this.gPts)
    this.scenePhoto.add(this.gPhoto)

    try {
      this.renderer = new WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' })
    } catch (err) {
      if (import.meta.env.DEV) console.info('[portrait3d] WebGL unavailable', err)
      return
    }
    this.renderer.setClearColor(0x000000, 0)
    canvas.addEventListener('webglcontextlost', this.onLost)
    this.ok = true

    Promise.all([loadImage(src), loadImage(depthSrc)]).then(
      ([im, dm]) => {
        if (!this.renderer || this.lost) return
        this.aspect = im.naturalWidth / im.naturalHeight
        const tex = new Texture(im)
        tex.generateMipmaps = true
        tex.minFilter = LinearMipmapLinearFilter
        tex.magFilter = LinearFilter
        tex.anisotropy = 4
        tex.needsUpdate = true
        this.img = tex
        // read depth + photo at the depth map's resolution (displacement and grains are built on the CPU)
        const dw = dm.naturalWidth
        const dh = dm.naturalHeight
        const c = document.createElement('canvas')
        c.width = dw
        c.height = dh
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.drawImage(dm, 0, 0)
        const dpx = ctx.getImageData(0, 0, dw, dh).data
        ctx.clearRect(0, 0, dw, dh)
        ctx.drawImage(im, 0, 0, dw, dh)
        const ppx = ctx.getImageData(0, 0, dw, dh).data
        const d8 = new Uint8Array(dw * dh)
        // flip rows so v = 0 is the bottom (matches the plane's uv)
        for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) d8[(dh - 1 - y) * dw + x] = dpx[(y * dw + x) * 4]
        this.depthTex = new DataTexture(d8, dw, dh, RedFormat, UnsignedByteType)
        this.depthTex.magFilter = LinearFilter
        this.depthTex.minFilter = LinearFilter
        this.depthTex.needsUpdate = true
        this.buildRelief(d8, dw, dh)
        this.buildGrains(d8, ppx, dw, dh)
        this.meshMat.uniforms.uImg.value = this.img
        this.meshMat.uniforms.uDepth.value = this.depthTex
        this.ready = true
        onReady()
      },
      () => {
        this.ok = false
        onReady()
      },
    )
  }

  /** bilinear depth (0..1) at plane uv (v = 0 bottom) */
  private depthAt(d8: Uint8Array, dw: number, dh: number, u: number, v: number) {
    const x = Math.min(dw - 1.001, Math.max(0, u * (dw - 1)))
    const y = Math.min(dh - 1.001, Math.max(0, v * (dh - 1)))
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const i = y0 * dw + x0
    const a = d8[i] * (1 - fx) + d8[i + 1] * fx
    const b = d8[i + dw] * (1 - fx) + d8[i + dw + 1] * fx
    return (a * (1 - fy) + b * fy) / 255
  }

  /** the photo's relief mesh (pass 2) */
  private buildRelief(d8: Uint8Array, dw: number, dh: number) {
    const segY = SEG_Y
    const segX = Math.max(8, Math.round(segY * this.aspect))
    const g = new PlaneGeometry(this.aspect, 1, segX, segY)
    const pos = g.attributes.position as Float32BufferAttribute
    const uv = g.attributes.uv as Float32BufferAttribute
    for (let i = 0; i < pos.count; i++) pos.setZ(i, (this.depthAt(d8, dw, dh, uv.getX(i), uv.getY(i)) - 0.5) * DEPTH)
    pos.needsUpdate = true
    g.computeVertexNormals()
    this.geo = g
    const mesh = new Mesh(g, this.meshMat)
    mesh.scale.setScalar(FIT)
    this.gPhoto.add(mesh)
  }

  /**
   * The grains (pass 1): stippled from the photo — a grain is more likely where
   * the photo is darker — and inked by its normalised luminance, navy → blue →
   * periwinkle. Deterministic (seeded), so the cloud is the same every visit.
   */
  private buildGrains(d8: Uint8Array, px: Uint8ClampedArray, dw: number, dh: number) {
    let seed = 1337
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    // luminance percentiles over the figure, so the tones span the whole palette
    const lums: number[] = []
    for (let i = 0; i < dw * dh; i += 7) if (px[i * 4 + 3] > 160) lums.push(0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2])
    lums.sort((a, b) => a - b)
    const lo = lums[Math.floor(lums.length * 0.03)] ?? 0
    const hi = lums[Math.floor(lums.length * 0.97)] ?? 255
    const L = new Float32Array(dw * dh)
    for (let i = 0; i < dw * dh; i++) L[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]
    // local mean (box blur via an integral image): local contrast brings out the
    // features an engraver would pick — eyes, folds, the shawl's pattern
    const R = Math.max(4, Math.round(dw / 45))
    const I = new Float64Array((dw + 1) * (dh + 1))
    for (let y = 0; y < dh; y++) {
      let row = 0
      for (let x = 0; x < dw; x++) {
        row += L[y * dw + x]
        I[(y + 1) * (dw + 1) + x + 1] = I[y * (dw + 1) + x + 1] + row
      }
    }
    const local = (x: number, y: number) => {
      const x0 = Math.max(0, x - R), x1 = Math.min(dw, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(dh, y + R + 1)
      const S = I[y1 * (dw + 1) + x1] - I[y0 * (dw + 1) + x1] - I[y1 * (dw + 1) + x0] + I[y0 * (dw + 1) + x0]
      return S / ((x1 - x0) * (y1 - y0))
    }
    const span = Math.max(1, hi - lo)
    const toneAt = new Float32Array(dw * dh)
    for (let y = 0; y < dh; y++)
      for (let x = 0; x < dw; x++) {
        const i = y * dw + x
        const g = (L[i] - lo) / span
        const l = (L[i] - local(x, y)) / span
        toneAt[i] = Math.min(1, Math.max(0, 0.5 + (g - 0.5) * 0.75 + l * 1.6))
      }
    const tone = (i: number) => toneAt[i]
    // expected count → acceptance scale
    let expect = 0
    for (let i = 0; i < dw * dh; i++) {
      const a = px[i * 4 + 3] / 255
      if (a > 0.5) expect += 0.08 + 0.92 * Math.pow(1 - tone(i), 1.8)
    }
    const k = Math.min(1, GRAINS / Math.max(1, expect))
    const pos: number[] = []
    const col: number[] = []
    const rn: number[] = []
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const i = y * dw + x
        if (px[i * 4 + 3] < 128) continue
        const t = tone(i)
        if (rnd() > k * (0.08 + 0.92 * Math.pow(1 - t, 1.8))) continue
        const u = (x + rnd()) / dw
        const vTop = (y + rnd()) / dh
        const v = 1 - vTop
        const z = (this.depthAt(d8, dw, dh, u, v) - 0.5) * DEPTH
        pos.push((u - 0.5) * this.aspect * FIT, (v - 0.5) * FIT, z * FIT)
        const c = t < 0.5 ? NAVY.map((n, j) => n + (BLUE[j] - n) * (t / 0.5)) : BLUE.map((n, j) => n + (PERI[j] - n) * ((t - 0.5) / 0.5))
        col.push(c[0], c[1], c[2], t)
        rn.push(rnd(), rnd(), rnd(), rnd())
      }
    }
    // hit mask: the silhouette at 1/4 resolution, grown by ~2 cells so grazing her counts
    {
      const hw = Math.ceil(dw / 4)
      const hh = Math.ceil(dh / 4)
      const m0 = new Uint8Array(hw * hh)
      for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) if (px[(y * dw + x) * 4 + 3] > 128) m0[(y >> 2) * hw + (x >> 2)] = 1
      const m1 = new Uint8Array(hw * hh)
      for (let y = 0; y < hh; y++)
        for (let x = 0; x < hw; x++) {
          let on = 0
          for (let j = -2; j <= 2 && !on; j++) for (let i = -2; i <= 2 && !on; i++) {
            const xx = x + i
            const yy = y + j
            if (xx >= 0 && yy >= 0 && xx < hw && yy < hh && m0[yy * hw + xx]) on = 1
          }
          m1[y * hw + x] = on
        }
      this.hitM = m1
      this.hitW = hw
      this.hitH = hh
    }
    const kind: number[] = new Array(pos.length / 3).fill(0)
    // motes: seeded on her silhouette (more on the windward right, where the shawl flies)
    const edges: number[] = []
    for (let y = 1; y < dh - 1; y++)
      for (let x = 1; x < dw - 1; x++) {
        const i = y * dw + x
        if (px[i * 4 + 3] < 128) continue
        if (px[(i - 1) * 4 + 3] < 128 || px[(i + 1) * 4 + 3] < 128 || px[(i - dw) * 4 + 3] < 128 || px[(i + dw) * 4 + 3] < 128) edges.push(i)
      }
    for (let m = 0; m < MOTES && edges.length; m++) {
      let i = edges[Math.floor(rnd() * edges.length)]
      // bias toward the right half (the shawl)
      if ((i % dw) / dw < 0.45 && rnd() < 0.6) i = edges[Math.floor(rnd() * edges.length)]
      const x = i % dw
      const y = Math.floor(i / dw)
      const u = (x + rnd()) / dw
      const v = 1 - (y + rnd()) / dh
      const z = (this.depthAt(d8, dw, dh, u, v) - 0.5) * DEPTH
      pos.push((u - 0.5) * this.aspect * FIT, (v - 0.5) * FIT, z * FIT)
      const t = rnd()
      const c = t < 0.5 ? NAVY.map((n, j) => n + (BLUE[j] - n) * (t / 0.5)) : BLUE.map((n, j) => n + (PERI[j] - n) * ((t - 0.5) / 0.5))
      col.push(c[0], c[1], c[2], t)
      rn.push(rnd(), rnd(), rnd(), rnd())
      kind.push(1)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('aCol', new Float32BufferAttribute(col, 4))
    g.setAttribute('aRnd', new Float32BufferAttribute(rn, 4))
    g.setAttribute('aKind', new Float32BufferAttribute(kind, 1))
    this.ptsGeo = g
    this.grains = pos.length / 3
    const pts = new Points(g, this.ptsMat)
    pts.frustumCulled = false
    this.gPts.add(pts)
  }

  /** is the canvas uv (top-left origin) over her (with a small margin)? */
  hit(u: number, v: number) {
    const m = this.hitM
    if (!m) return u > 0 && u < 1 && v > 0 && v < 1
    const x = Math.floor(((u - 0.5) / FIT + 0.5) * this.hitW)
    const y = Math.floor(((v - 0.5) / FIT + 0.5) * this.hitH)
    if (x < 0 || y < 0 || x >= this.hitW || y >= this.hitH) return false
    return m[y * this.hitW + x] > 0
  }

  /** backing-store size in device px */
  size(w: number, h: number) {
    if (!this.renderer || !this.ok) return
    w = Math.max(2, Math.round(w))
    h = Math.max(2, Math.round(h))
    if (w === this.w && h === this.h && this.rtArt) return
    this.w = w
    this.h = h
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    if (!this.rtArt) {
      this.rtArt = new WebGLRenderTarget(w, h, { depthBuffer: false, stencilBuffer: false })
      this.rtPhoto = new WebGLRenderTarget(w, h, { samples: 4, depthBuffer: true, stencilBuffer: false })
    } else {
      this.rtArt.setSize(w, h)
      this.rtPhoto!.setSize(w, h)
    }
    this.cam3.aspect = w / h
    this.cam3.position.set(0, 0, 0.5 / Math.tan((FOV * Math.PI) / 360))
    this.cam3.lookAt(0, 0, 0)
    this.cam3.updateProjectionMatrix()
    this.lastPhoto = ''
  }

  /** kept for the old interface (the hover reveal needs no buffer) */
  resetTrail() {}

  render(f: Portrait3DFrame) {
    const r = this.renderer
    if (!r || !this.ok || !this.ready || this.lost || !this.rtArt || !this.rtPhoto) return
    this.gPts.rotation.set(f.tilt[0], f.tilt[1], 0)
    /* pass 1: the grains (they move every frame) */
    const P = this.ptsMat.uniforms
    P.uTime.value = f.time
    P.uForm.value = f.arrB
    P.uRes.value = [this.w, this.h]
    P.uHv.value = f.hv
    P.uPt.value = f.pt
    P.uPx.value = this.h / 440
    r.setRenderTarget(this.rtArt)
    r.clear()
    r.render(this.scenePts, this.cam3)
    /* pass 2: the photo on the relief, only when the tilt (or size) changed */
    const mk = `${f.tilt[0].toFixed(4)}|${f.tilt[1].toFixed(4)}|${this.w}x${this.h}`
    if (mk !== this.lastPhoto) {
      this.lastPhoto = mk
      this.gPhoto.rotation.set(f.tilt[0], f.tilt[1], 0)
      r.setRenderTarget(this.rtPhoto)
      r.clear()
      r.render(this.scenePhoto, this.cam3)
    }
    /* pass 3: composite */
    const C = this.compMat.uniforms
    C.uPhoto.value = this.rtPhoto.texture
    C.uArt.value = this.rtArt.texture
    C.uRes.value = [this.w, this.h]
    C.uTime.value = f.time
    C.uBox.value = f.box
    C.uSw.value = f.sw
    C.uR.value = f.r
    C.uRing.value = f.ring
    C.uArrA.value = f.arrA
    C.uArrB.value = f.arrB
    C.uPh.value = f.ph
    C.uPhOn.value = f.phOn
    C.uMan.value = f.man
    C.uHot.value = f.hot
    C.uHv.value = f.hv
    r.setRenderTarget(null)
    r.clear()
    r.render(this.compScene, this.compCam)
  }

  /** dev: block until the GPU has finished (for timing a frame) */
  sync() {
    const r = this.renderer
    if (!r) return
    const gl = r.getContext()
    const px = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  }

  dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    this.geo?.dispose()
    this.ptsGeo?.dispose()
    this.meshMat.dispose()
    this.ptsMat.dispose()
    this.compMat.dispose()
    this.img?.dispose()
    this.depthTex?.dispose()
    this.rtArt?.dispose()
    this.rtPhoto?.dispose()
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.forceContextLoss()
    }
    this.renderer = null
    this.ok = false
  }
}
