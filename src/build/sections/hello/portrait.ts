/**
 * 01 Hello — the portrait. One WebGL2 canvas sized to the portrait box, two
 * looks of the same cut-out:
 *  - colour: the photo, lightly graded (cooler blacks, natural skin);
 *  - construct: a procedural drawing derived from the photo in the shader —
 *    topographic isolines of its luminance (the stage's contour lines running
 *    on through her), a few feature edges and the silhouette, ink with every
 *    fifth line in electric blue (grey while the front has not reached it yet).
 * A half-resolution ping-pong trail buffer accumulates soft capsule stamps
 * along the pointer path and heals over ~2.2s; it is thresholded through
 * animated fbm noise into an irregular burning edge with a thin electric-blue
 * emissive rim and a paler hot core.
 *
 *   taste on : rests in colour, the pointer burns through to the construct
 *   taste off: no portrait at all, only the grey image placeholder
 *
 * The arrival burns her in from the bottom: grey placeholder → construct →
 * colour. Playing the switch burns her away / back in over the placeholder with
 * the same edge, timed to the taste front. Renders only while something
 * is actually changing and the section is on screen.
 */

export const MODES = { iso: 0, mesh: 1 } as const

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const NOISE = `
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
`

/* trail: decay + a capsule stamp along the pointer segment */
const TRAIL = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uPrev;
uniform vec2 uRes;      // trail px
uniform vec2 uA;        // segment start, trail px (y up)
uniform vec2 uB;        // segment end
uniform float uRad;     // stamp radius, trail px
uniform float uOn;      // stamp strength
uniform float uDecay;   // amount to subtract this frame
void main() {
  vec2 p = gl_FragCoord.xy;
  float v = texture(uPrev, p / uRes).r;
  v = max(0.0, v - uDecay);
  if (uOn > 0.0) {
    vec2 ab = uB - uA;
    float t = clamp(dot(p - uA, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    float d = length(p - (uA + ab * t)) / max(uRad, 1.0);
    float s = exp(-d * d * 2.4) * uOn;
    v = max(v, min(1.0, s * 1.15));
  }
  o = vec4(v, 0.0, 0.0, 1.0);
}
`

const MAIN = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uImg;
uniform sampler2D uTrail;
uniform sampler2D uFld;   // baked field: R,G = calm luminance (hi, lo), B = pen ink
uniform vec2 uRes;       // canvas px
uniform float uTime;
uniform vec4 uBox;       // portrait box in board px: x, y, w, h
uniform vec2 uSw;        // taste origin, board px
uniform float uR;        // taste radius, board px
uniform float uRing;     // 0..1: the taste front is moving (draw its rim)
uniform float uArrA;     // placeholder -> construct
uniform float uArrB;     // construct -> colour
uniform vec4 uPh;        // placeholder rect, uv (x0, y0, x1, y1)
uniform float uPhOn;
uniform float uMan;      // 1: the switch is being played (the taste front reveals / burns her)
uniform float uMode;
uniform float uHot;      // global rim strength
uniform float uStatic;   // 1: colour only (reduced motion fallback path)
${NOISE}
const vec3 INK = vec3(0.043, 0.043, 0.047);
const vec3 BLUE = vec3(0.039, 0.294, 1.0);
const vec3 GLOW = vec3(0.616, 0.722, 1.0);
const vec3 PORC = vec3(0.965, 0.965, 0.953);
const vec3 GREY = vec3(0.60, 0.60, 0.63);

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
/* a 1px anti-aliased line on the iso-levels of f */
float isoLine(float f, float w) {
  float g = fract(f);
  float d = min(g, 1.0 - g);
  float fw = max(fwidth(f), 1e-4);
  float l = 1.0 - smoothstep(w * 0.5, w * 0.5 + 1.0, d / fw);
  // too dense to read: fade instead of moiré
  return l * (1.0 - smoothstep(0.22, 0.45, fw));
}
/* the baked field, 12-bit in two bytes, filtered by hand (bilinear) */
float fetchF(ivec2 i, ivec2 sz) {
  vec3 t = texelFetch(uFld, clamp(i, ivec2(0), sz - 1), 0).rgb;
  return (t.r * 65280.0 + t.g * 255.0) / 65535.0;
}
float fieldAt(vec2 uv) {
  ivec2 sz = textureSize(uFld, 0);
  vec2 p = uv * vec2(sz) - 0.5;
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  return mix(mix(fetchF(i, sz), fetchF(i + ivec2(1, 0), sz), f.x), mix(fetchF(i + ivec2(0, 1), sz), fetchF(i + ivec2(1, 1), sz), f.x), f.y);
}
/* signed px distance of a field's zero level (positive inside) */
float pxd(float e) { return e / max(fwidth(e), 1e-4); }

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = vec2(frag.x / uRes.x, 1.0 - frag.y / uRes.y);
  vec2 bp = uBox.xy + uv * uBox.zw;          // board px

  vec4 tx = texture(uImg, uv);
  // the photo is cropped at the sides (sleeves): feather those cuts instead of a hard edge
  float a = tx.a * smoothstep(0.0, 0.04, uv.x) * smoothstep(1.0, 0.96, uv.x);
  vec3 col = tx.rgb;

  /* ---- colour layer: cooler blacks, a hair of contrast */
  float lum = luma(col);
  vec3 graded = mix(col, col * vec3(0.93, 0.97, 1.07) + vec3(0.0, 0.002, 0.012), 1.0 - smoothstep(0.02, 0.42, lum));
  graded = clamp((graded - 0.5) * 1.035 + 0.5, 0.0, 1.0);

  if (uStatic > 0.5) { o = vec4(graded * a, a); return; }

  /* ---- construct layer (lines from the baked field, anti-aliased here) */
  float Ls = fieldAt(uv);
  float ink = texture(uFld, uv).b;
  float lines;
  float blueL;
  if (uMode < 0.5) {
    // topographic isolines of the calm luminance (the stage's contours run on through her)
    float f = Ls * 17.0;
    float iso = isoLine(f, 0.9);
    float idx = floor(f + 0.5);
    float major = 1.0 - step(0.5, mod(idx, 4.0));
    // a few in electric blue: on the face and hair, never across the dark blazer
    blueL = iso * (1.0 - step(0.5, abs(mod(idx, 7.0) - 3.0))) * smoothstep(0.26, 0.34, Ls);
    lines = max(iso * mix(0.4, 0.72, major), smoothstep(0.035, 0.38, ink));
  } else {
    // displaced scan mesh: fine horizontal lines lifted by luminance
    float sp = uRes.y / 96.0;
    float yy = frag.y + (Ls - 0.5) * sp * 3.4;
    float h = isoLine(yy / sp, 1.0);
    float xx = frag.x + (Ls - 0.5) * sp * 1.2;
    float v = isoLine(xx / (sp * 2.0), 1.0) * 0.28;
    lines = max(h * 0.8, v);
    blueL = h * (1.0 - step(0.5, mod(floor(yy / sp + 0.5), 8.0)));
    lines = max(lines, smoothstep(0.08, 0.7, ink) * 0.8);
  }
  // the silhouette, a crisp contour
  float sil = 1.0 - smoothstep(0.5, 1.6, abs(pxd(a - 0.5)));
  lines = max(lines, sil * 0.9);
  vec3 inkC = mix(PORC, INK, lines * 0.86);
  inkC = mix(inkC, BLUE, blueL * 0.9);
  vec3 greyC = mix(vec3(1.0), GREY, lines * 0.78);

  /* ---- masks (all burning edges share the same organic noise) */
  float n1 = fbm(bp * 0.011 + vec2(uTime * 0.21, -uTime * 0.13));
  float n2 = fbm(bp * 0.0062 - vec2(uTime * 0.07, uTime * 0.05) + 9.0);
  float flick = 0.86 + 0.14 * noise(bp * 0.05 + uTime * 7.0);

  // pointer trail
  float tv = texture(uTrail, frag / uRes).r;
  float eh = tv - 0.42 + (n1 - 0.5) * 0.62;
  float dh = pxd(eh);
  float h = smoothstep(-0.8, 0.8, dh) * step(0.015, tv);
  float rimH = step(0.015, tv) * smoothstep(0.03, 0.2, tv);

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

  /* ---- composite (premultiplied) */
  vec3 designedLook = mix(graded, inkC, h);
  vec3 look = designedLook;
  vec3 constructX = mix(greyC, inkC, d);
  vec3 stage = mix(constructX, look, B);
  vec4 S = vec4(stage * a, a);

  // the bland placeholder (only before the arrival)
  vec2 pc = (uPh.xy + uPh.zw) * 0.5;
  vec2 ph = (uPh.zw - uPh.xy) * 0.5 * uBox.zw;
  vec2 q = abs(bp - (uBox.xy + pc * uBox.zw)) - ph + 14.0;
  float rr = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 14.0;
  float phA = (1.0 - smoothstep(-0.5, 0.5, rr / max(fwidth(rr), 1e-4))) * uPhOn;
  float ring = (1.0 - smoothstep(0.0, 1.2, abs(rr / max(fwidth(rr), 1e-4) + 0.8))) * uPhOn;
  vec3 phC = mix(vec3(0.941, 0.941, 0.949), vec3(0.886, 0.886, 0.898), ring);
  // the generic image icon
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
  vec4 P = vec4(phC * phA, phA);

  // played by the switch: the taste front is the edge between placeholder and portrait
  float Ae = mix(A, d, uMan);
  vec4 outc = mix(P, S, Ae);

  /* ---- burning rims: thin electric-blue edge, paler hot core, a few px of glow */
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
  float sweep = max(max(rimA, rimB), max(rimT, max(max(gA, gB), gT)));
  vec3 rimCol = BLUE;
  vec3 hotCol = mix(vec3(0.92, 0.92, 0.94), mix(GLOW, vec3(0.94, 0.96, 1.0), 0.45), d);
  float ca = clamp(core * flick * uHot, 0.0, 1.0);
  float ga = clamp(glow * 0.42 * flick * uHot, 0.0, 1.0) * (1.0 - ca);
  vec3 em = rimCol * ga;
  outc.rgb = outc.rgb * (1.0 - ga) + em;
  outc.a = outc.a * (1.0 - ga) + ga * body;
  // hot core: blue edge with a pale centre line
  float hot = smoothstep(0.55, 1.0, core);
  vec3 coreCol = mix(rimCol, hotCol, hot);
  outc.rgb = outc.rgb * (1.0 - ca) + coreCol * ca * body;
  outc.a = outc.a * (1.0 - ca) + ca * body;
  o = outc;
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error(log ?? 'shader')
  }
  return s
}
function link(gl: WebGL2RenderingContext, fs: string) {
  const p = gl.createProgram()!
  const v = compile(gl, gl.VERTEX_SHADER, VERT)
  const f = compile(gl, gl.FRAGMENT_SHADER, fs)
  gl.attachShader(p, v)
  gl.attachShader(p, f)
  gl.linkProgram(p)
  gl.deleteShader(v)
  gl.deleteShader(f)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  return p
}

const MAIN_U = ['uImg', 'uTrail', 'uFld', 'uRes', 'uTime', 'uBox', 'uSw', 'uR', 'uRing', 'uArrA', 'uArrB', 'uPh', 'uPhOn', 'uMan', 'uMode', 'uHot', 'uStatic'] as const
const TRAIL_U = ['uPrev', 'uRes', 'uA', 'uB', 'uRad', 'uOn', 'uDecay'] as const

export interface PortraitFrame {
  time: number
  /** seconds since the last frame */
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
  mode: number
  hot: number
  /** pointer segment this frame in canvas uv (top-left origin), or null */
  seg: [number, number, number, number] | null
  /** stamp radius as a fraction of the canvas height */
  rad: number
}

/** The GL side of the portrait. `ok` is false when WebGL2 (or the image) is unavailable. */
export class PortraitGL {
  readonly canvas: HTMLCanvasElement
  ok = false
  ready = false
  private gl: WebGL2RenderingContext | null
  private main: WebGLProgram | null = null
  private trail: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buf: WebGLBuffer | null = null
  private img: WebGLTexture | null = null
  private fld: WebGLTexture | null = null
  private tt: (WebGLTexture | null)[] = [null, null]
  private fb: (WebGLFramebuffer | null)[] = [null, null]
  private cur = 0
  private tw = 0
  private th = 0
  private float = false
  private lm: Partial<Record<(typeof MAIN_U)[number], WebGLUniformLocation | null>> = {}
  private lt: Partial<Record<(typeof TRAIL_U)[number], WebGLUniformLocation | null>> = {}
  private lost = false
  private onLost = (e: Event) => {
    e.preventDefault()
    this.lost = true
  }

  constructor(canvas: HTMLCanvasElement, src: string, fieldSrc: string, onReady: () => void) {
    this.canvas = canvas
    this.gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' })
    const gl = this.gl
    if (!gl) return
    try {
      this.main = link(gl, MAIN)
      this.trail = link(gl, TRAIL)
    } catch (err) {
      if (import.meta.env.DEV) console.info('[portrait] shader unavailable', err)
      return
    }
    this.float = !!gl.getExtension('EXT_color_buffer_float')
    for (const n of MAIN_U) this.lm[n] = gl.getUniformLocation(this.main, n)
    for (const n of TRAIL_U) this.lt[n] = gl.getUniformLocation(this.trail, n)
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    this.buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    for (const p of [this.main, this.trail]) {
      const loc = gl.getAttribLocation(p, 'aPos')
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
      }
    }
    canvas.addEventListener('webglcontextlost', this.onLost)
    this.ok = true
    const load = (url: string) => {
      const im = new Image()
      im.decoding = 'async'
      im.src = url
      return im.decode().then(() => im)
    }
    Promise.all([load(src), load(fieldSrc)]).then(
      ([im, fi]) => {
        if (!this.gl || this.lost) return
        const g = this.gl
        g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
        g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL, g.NONE)
        this.img = g.createTexture()
        g.bindTexture(g.TEXTURE_2D, this.img)
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, im)
        g.generateMipmap(g.TEXTURE_2D)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
        this.fld = g.createTexture()
        g.bindTexture(g.TEXTURE_2D, this.fld)
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, fi)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
        this.ready = true
        onReady()
      },
      () => {
        this.ok = false
        onReady()
      },
    )
  }

  /** backing-store size in device px; the trail runs at half of it */
  size(w: number, h: number) {
    const gl = this.gl
    if (!gl || !this.ok) return
    w = Math.max(2, Math.round(w))
    h = Math.max(2, Math.round(h))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    const tw = Math.max(2, Math.round(w / 2))
    const th = Math.max(2, Math.round(h / 2))
    if (tw === this.tw && th === this.th) return
    this.tw = tw
    this.th = th
    for (let i = 0; i < 2; i++) {
      if (!this.tt[i]) this.tt[i] = gl.createTexture()
      if (!this.fb[i]) this.fb[i] = gl.createFramebuffer()
      gl.bindTexture(gl.TEXTURE_2D, this.tt[i])
      if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, tw, th, 0, gl.RGBA, gl.HALF_FLOAT, null)
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[i])
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tt[i], 0)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /** forget the trail (e.g. leaving the section) */
  resetTrail() {
    const gl = this.gl
    if (!gl || !this.ok) return
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[i])
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  render(f: PortraitFrame) {
    const gl = this.gl
    if (!gl || !this.ok || !this.ready || this.lost || !this.main || !this.trail) return
    gl.bindVertexArray(this.vao)
    gl.disable(gl.BLEND)
    /* trail pass (half res) */
    const nxt = 1 - this.cur
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fb[nxt])
    gl.viewport(0, 0, this.tw, this.th)
    gl.useProgram(this.trail)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tt[this.cur])
    const T = this.lt
    gl.uniform1i(T.uPrev!, 0)
    gl.uniform2f(T.uRes!, this.tw, this.th)
    if (f.seg) {
      gl.uniform2f(T.uA!, f.seg[0] * this.tw, (1 - f.seg[1]) * this.th)
      gl.uniform2f(T.uB!, f.seg[2] * this.tw, (1 - f.seg[3]) * this.th)
      gl.uniform1f(T.uOn!, 1)
    } else gl.uniform1f(T.uOn!, 0)
    gl.uniform1f(T.uRad!, f.rad * this.th)
    // linear heal: a full stamp is gone in ~2.2s (the burn edge closes at ~0.42 of it)
    gl.uniform1f(T.uDecay!, f.dt / 2.2)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.cur = nxt

    /* main pass */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.main)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.img)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.tt[this.cur])
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, this.fld)
    const L = this.lm
    gl.uniform1i(L.uImg!, 0)
    gl.uniform1i(L.uTrail!, 1)
    gl.uniform1i(L.uFld!, 2)
    gl.uniform2f(L.uRes!, this.canvas.width, this.canvas.height)
    gl.uniform1f(L.uTime!, f.time)
    gl.uniform4f(L.uBox!, f.box[0], f.box[1], f.box[2], f.box[3])
    gl.uniform2f(L.uSw!, f.sw[0], f.sw[1])
    gl.uniform1f(L.uR!, f.r)
    gl.uniform1f(L.uRing!, f.ring)
    gl.uniform1f(L.uArrA!, f.arrA)
    gl.uniform1f(L.uArrB!, f.arrB)
    gl.uniform4f(L.uPh!, f.ph[0], f.ph[1], f.ph[2], f.ph[3])
    gl.uniform1f(L.uPhOn!, f.phOn)
    gl.uniform1f(L.uMan!, f.man)
    gl.uniform1f(L.uMode!, f.mode)
    gl.uniform1f(L.uHot!, f.hot)
    gl.uniform1f(L.uStatic!, 0)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** dev: block until the GPU has finished (for timing a frame) */
  sync() {
    const gl = this.gl
    if (!gl) return
    const px = new Uint8Array(4)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
  }

  dispose() {
    const gl = this.gl
    this.canvas.removeEventListener('webglcontextlost', this.onLost)
    if (!gl) return
    if (this.main) gl.deleteProgram(this.main)
    if (this.trail) gl.deleteProgram(this.trail)
    if (this.buf) gl.deleteBuffer(this.buf)
    if (this.vao) gl.deleteVertexArray(this.vao)
    if (this.img) gl.deleteTexture(this.img)
    if (this.fld) gl.deleteTexture(this.fld)
    this.tt.forEach((t) => t && gl.deleteTexture(t))
    this.fb.forEach((b) => b && gl.deleteFramebuffer(b))
    // free the context right away (StrictMode mounts twice)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    this.gl = null
    this.ok = false
  }
}
