/**
 * The /build bubble: raw WebGL2 SDF metaballs with up to three cores (for the
 * split), a rolling marbled palette (uRot really rotates the marbling with the
 * roll), directional stretch, flash and palette uniforms. Small balls are the
 * pieces leaving the goo. All positions arrive per frame in CSS px.
 */
export const MAX_BALLS = 20
export const MAX_CORES = 3

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform float uTime;
uniform float uDpr;
uniform int uCount;
uniform vec4 uBalls[${MAX_BALLS}];
uniform vec3 uCols[${MAX_BALLS}];
uniform int uCoreN;
uniform vec4 uCores[${MAX_CORES}];   // x, y, radius, stretch
uniform vec3 uCoreCols[${MAX_CORES}];
uniform vec3 uPal[3];
uniform float uSplit;
uniform float uDir;
uniform float uRot;
uniform float uWobble;
uniform float uAlpha;
uniform float uFlash;
uniform float uShadow;
uniform float uK;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float coreDist(int i, vec2 p) {
  vec4 C = uCores[i];
  float R = C.z;
  if (R < 0.5) return 1e5;
  vec2 d = rot(uDir) * (p - C.xy);
  float w = 1.0 + 0.12 * uWobble;
  float h = 1.0 - 0.1 * uWobble;
  d.x /= w; d.y /= h;
  float s = C.w;
  vec2 hb = vec2(R * (1.0 + s * 1.05), R * (1.0 - s * 0.26));
  float rad = mix(R, R * 0.6, clamp(s, 0.0, 1.0));
  float ang = atan(d.y, d.x);
  float wob = (sin(ang * 3.0 + uTime * 1.7 + float(i)) * 0.5 + sin(ang * 5.0 - uTime * 2.3) * 0.3) * (0.022 + 0.05 * abs(uWobble)) * R;
  return sdRoundBox(d, hb, rad) + wob;
}

float field(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < ${MAX_CORES}; i++) {
    if (i >= uCoreN) break;
    d = smin(d, coreDist(i, p), uK);
  }
  for (int i = 0; i < ${MAX_BALLS}; i++) {
    if (i >= uCount) break;
    vec4 b = uBalls[i];
    if (b.z < 0.5) continue;
    d = smin(d, length(p - b.xy) - b.z, uK * 0.8);
  }
  return d;
}

vec3 marble(vec2 p) {
  // rolling marble in the frame of core 0
  vec4 C = uCores[0];
  vec2 q = rot(-uRot) * (p - C.xy) / max(C.z, 1.0);
  float n = fbm(q * 1.35 + 3.1);
  float band = sin((q.x * 2.2 + q.y * 0.8) + n * 5.5 + uTime * 0.25);
  vec3 c = mix(uPal[0], uPal[1], smoothstep(0.15, 0.75, band * 0.5 + 0.5) * 0.85);
  float n2 = fbm(q * 2.4 - 7.0 + uTime * 0.05);
  c = mix(c, uPal[2], smoothstep(0.58, 0.8, n2));
  return c;
}

vec3 tint(vec2 p) {
  vec2 q = p / (uDpr * 60.0);
  vec2 warp = vec2(noise(q + uTime * 0.18), noise(q.yx - uTime * 0.15 + 7.3)) - 0.5;
  vec2 pw = p + warp * uDpr * 30.0;
  // cores
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  vec3 single = marble(pw);
  for (int i = 0; i < ${MAX_CORES}; i++) {
    if (i >= uCoreN) break;
    float dc = coreDist(i, pw);
    float w = exp(-max(dc + uCores[i].z * 0.5, 0.0) / (uDpr * 14.0)) + 1e-4;
    vec3 sc = mix(uCoreCols[i], vec3(1.0), smoothstep(0.62, 0.9, fbm(rot(-uRot) * (pw - uCores[i].xy) / max(uCores[i].z, 1.0) * 1.6 + float(i) * 4.0)) * 0.35);
    acc += mix(single, sc, uSplit) * w;
    wsum += w;
  }
  vec3 core = acc / max(wsum, 1e-4);
  // balls (pieces leaving / passengers) tint locally
  vec3 bacc = core * 0.6;
  float bw = 0.6;
  for (int i = 0; i < ${MAX_BALLS}; i++) {
    if (i >= uCount) break;
    vec4 b = uBalls[i];
    if (b.z < 0.5) continue;
    float di = length(pw - b.xy) - b.z;
    float w = exp(-max(di, 0.0) / (uDpr * 8.0)) * (1.0 + smoothstep(0.0, -b.z * 0.6, di) * 5.0);
    w = w * w * w;
    bacc += uCols[i] * w;
    bw += w;
  }
  return bacc / bw;
}

void main() {
  vec2 p = gl_FragCoord.xy;
  float d = field(p);

  float ds = field(p - vec2(10.0, -24.0) * uDpr);
  float shadow = (1.0 - smoothstep(-24.0 * uDpr, 34.0 * uDpr, ds)) * uShadow;

  float aa = 1.2 * uDpr;
  float cover = 1.0 - smoothstep(-aa, aa, d);
  if (cover <= 0.0 && shadow <= 0.003) { outColor = vec4(0.0); return; }

  float R0 = uCores[0].z;
  float B = max(min(R0 * 0.9, 70.0 * uDpr), 12.0 * uDpr);
  vec2 e = vec2(1.5 * uDpr, 0.0);
  float dx = field(p + e.xy) - d;
  float dy = field(p + e.yx) - d;
  vec2 g = vec2(dx, dy) / e.x;
  float t = clamp(1.0 + d / B, 0.0, 1.0);
  float slope = t / sqrt(max(1.0 - t * t, 0.02));
  vec3 n = normalize(vec3(g * slope, 1.0));

  vec3 L = normalize(vec3(-0.55, 0.65, 0.75));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float spec = pow(clamp(dot(n, H), 0.0, 1.0), 48.0);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);

  vec3 base = tint(p);
  vec3 col = base * (0.8 + 0.3 * diff);
  col = mix(col, base * 0.62, rim * 0.4);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(lum), col, 1.18), 0.0, 1.0);
  col += vec3(1.0) * spec * 0.34;
  col = mix(col, vec3(1.0), uFlash * 0.85);
  float edge = smoothstep(-2.6 * uDpr, -0.6 * uDpr, d);
  col = mix(col, vec3(0.086, 0.075, 0.114), edge * 0.85);

  vec4 blob = vec4(col * cover, cover);
  vec4 sh = vec4(vec3(0.03, 0.03, 0.08) * shadow, shadow);
  outColor = (blob + sh * (1.0 - blob.a)) * uAlpha;
}
`

export interface BubbleFrame {
  count: number
  balls: Float32Array // x, y, r, _ css px
  cols: Float32Array
  coreN: number
  cores: Float32Array // x, y, r, stretch css px
  coreCols: Float32Array
  pal: Float32Array // 3 × rgb
  split: number
  dir: number
  rot: number
  wobble: number
  alpha: number
  flash: number
  shadow: number
  bbox: [number, number, number, number]
}

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error(log ?? 'shader compile failed')
  }
  return s
}

const NAMES = ['uTime', 'uDpr', 'uCount', 'uBalls', 'uCols', 'uCoreN', 'uCores', 'uCoreCols', 'uPal', 'uSplit', 'uDir', 'uRot', 'uWobble', 'uAlpha', 'uFlash', 'uShadow', 'uK']

export class Bubble {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buf: WebGLBuffer | null = null
  private loc: Record<string, WebGLUniformLocation | null> = {}
  private dpr = 1
  private cleared = true
  private canvas: HTMLCanvasElement
  private ballsDev = new Float32Array(MAX_BALLS * 4)
  private coresDev = new Float32Array(MAX_CORES * 4)
  private lastScissor: [number, number, number, number] | null = null
  readonly ok: boolean

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, alpha: true, powerPreference: 'high-performance' })
    if (!this.gl) {
      this.ok = false
      return
    }
    const gl = this.gl
    try {
      const prog = gl.createProgram()!
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(prog)
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link failed')
      this.prog = prog
    } catch {
      this.ok = false
      return
    }
    this.vao = gl.createVertexArray()
    gl.bindVertexArray(this.vao)
    this.buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(this.prog, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)
    for (const n of NAMES) this.loc[n] = gl.getUniformLocation(this.prog, n)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.ok = true
    this.resize()
  }

  resize() {
    if (!this.gl) return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.round(window.innerWidth * this.dpr)
    const h = Math.round(window.innerHeight * this.dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.cleared = false
    this.lastScissor = null
    this.clear()
  }

  clear() {
    const gl = this.gl
    if (!gl || this.cleared) return
    gl.disable(gl.SCISSOR_TEST)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.cleared = true
    this.lastScissor = null
  }

  render(f: BubbleFrame, time: number) {
    const gl = this.gl
    if (!gl || !this.ok || !this.prog) return
    const dpr = this.dpr
    const H = this.canvas.height
    for (let i = 0; i < MAX_BALLS; i++) {
      const o = i * 4
      this.ballsDev[o] = f.balls[o] * dpr
      this.ballsDev[o + 1] = H - f.balls[o + 1] * dpr
      this.ballsDev[o + 2] = f.balls[o + 2] * dpr
    }
    for (let i = 0; i < MAX_CORES; i++) {
      const o = i * 4
      this.coresDev[o] = f.cores[o] * dpr
      this.coresDev[o + 1] = H - f.cores[o + 1] * dpr
      this.coresDev[o + 2] = f.cores[o + 2] * dpr
      this.coresDev[o + 3] = f.cores[o + 3]
    }
    const pad = 70
    const x0 = Math.max(0, Math.floor((f.bbox[0] - pad) * dpr))
    const x1 = Math.min(this.canvas.width, Math.ceil((f.bbox[2] + pad) * dpr))
    const y0 = Math.max(0, Math.floor(H - (f.bbox[3] + pad) * dpr))
    const y1 = Math.min(H, Math.ceil(H - (f.bbox[1] - pad) * dpr))

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.enable(gl.SCISSOR_TEST)
    if (this.lastScissor) {
      const [a, b, c, d] = this.lastScissor
      gl.scissor(a, b, c, d)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    const sw = Math.max(0, x1 - x0)
    const sh = Math.max(0, y1 - y0)
    gl.scissor(x0, y0, sw, sh)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.lastScissor = [x0, y0, sw, sh]
    this.cleared = false
    if (sw === 0 || sh === 0) return

    const L = this.loc
    gl.useProgram(this.prog)
    gl.bindVertexArray(this.vao)
    gl.uniform1f(L.uTime, time)
    gl.uniform1f(L.uDpr, dpr)
    gl.uniform1i(L.uCount, f.count)
    gl.uniform4fv(L.uBalls, this.ballsDev)
    gl.uniform3fv(L.uCols, f.cols)
    gl.uniform1i(L.uCoreN, f.coreN)
    gl.uniform4fv(L.uCores, this.coresDev)
    gl.uniform3fv(L.uCoreCols, f.coreCols)
    gl.uniform3fv(L.uPal, f.pal)
    gl.uniform1f(L.uSplit, f.split)
    gl.uniform1f(L.uDir, f.dir)
    gl.uniform1f(L.uRot, f.rot)
    gl.uniform1f(L.uWobble, f.wobble)
    gl.uniform1f(L.uAlpha, f.alpha)
    gl.uniform1f(L.uFlash, f.flash)
    gl.uniform1f(L.uShadow, f.shadow)
    let rmax = 1
    for (let i = 0; i < f.coreN; i++) rmax = Math.max(rmax, f.cores[i * 4 + 2])
    gl.uniform1f(L.uK, Math.max(16, rmax * 0.7) * dpr)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.gl
    if (!gl) return
    if (this.buf) gl.deleteBuffer(this.buf)
    if (this.vao) gl.deleteVertexArray(this.vao)
    if (this.prog) gl.deleteProgram(this.prog)
    this.gl = null
  }
}
