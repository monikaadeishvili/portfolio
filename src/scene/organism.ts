/**
 * The organism: a raw WebGL2 fullscreen fragment shader rendering 2-D SDF
 * metaballs (polynomial smooth-min) with a height-field normal, top-left key
 * light, rim + specular, marbled colour mixing and a soft paper shadow.
 * Ball positions arrive every frame in CSS px from the ticker loop.
 */

export const MAX_BALLS = 24

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uRes;
uniform float uTime;
uniform float uDpr;
uniform int uCount;
uniform vec4 uBalls[${MAX_BALLS}];
uniform vec3 uCols[${MAX_BALLS}];
uniform vec4 uCore;      // x, y, radius, stretch
uniform vec3 uCoreCol;
uniform float uWobble;
uniform float uAlpha;
uniform float uK;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float coreDist(vec2 p) {
  float R = uCore.z;
  if (R < 0.5) return 1e5;
  vec2 d = p - uCore.xy;
  float w = 1.0 + 0.12 * uWobble;
  float h = 1.0 - 0.1 * uWobble;
  d.x /= w; d.y /= h;
  float s = uCore.w;
  vec2 hb = vec2(R * (1.0 + s * 1.05), R * (1.0 - s * 0.22));
  float rad = mix(R, R * 0.62, s);
  float ang = atan(d.y, d.x);
  float wob = (sin(ang * 3.0 + uTime * 1.7) * 0.5 + sin(ang * 5.0 - uTime * 2.3) * 0.3) * (0.022 + 0.05 * abs(uWobble)) * R;
  return sdRoundBox(d, hb, rad) + wob;
}

float field(vec2 p) {
  float d = coreDist(p);
  for (int i = 0; i < ${MAX_BALLS}; i++) {
    if (i >= uCount) break;
    vec4 b = uBalls[i];
    if (b.z < 0.5) continue;
    d = smin(d, length(p - b.xy) - b.z, uK);
  }
  return d;
}

vec3 tint(vec2 p) {
  // marbled colour: domain-warped sample point, influence-weighted palette
  vec2 q = p / (uDpr * 60.0);
  vec2 warp = vec2(noise(q + uTime * 0.18), noise(q.yx - uTime * 0.15 + 7.3)) - 0.5;
  vec2 pw = p + warp * uDpr * 46.0;
  float dc = coreDist(pw);
  float wc = exp(-max(dc + uCore.z * 0.55, 0.0) / (uDpr * 16.0)) * 0.12;
  vec3 acc = uCoreCol * wc;
  float wsum = wc;
  for (int i = 0; i < ${MAX_BALLS}; i++) {
    if (i >= uCount) break;
    vec4 b = uBalls[i];
    if (b.z < 0.5) continue;
    float di = length(pw - b.xy) - b.z;
    float w = exp(-max(di, 0.0) / (uDpr * 9.0)) * (1.0 + smoothstep(0.0, -b.z * 0.6, di) * 5.0);
    w = w * w * w;
    acc += uCols[i] * w;
    wsum += w;
  }
  return acc / max(wsum, 1e-4);
}

void main() {
  vec2 p = gl_FragCoord.xy;
  float d = field(p);

  // soft drop shadow on the paper, offset down-right (y is up in GL)
  float ds = field(p - vec2(10.0, -22.0) * uDpr);
  float shadow = (1.0 - smoothstep(-24.0 * uDpr, 34.0 * uDpr, ds)) * 0.2;

  float aa = 1.2 * uDpr;
  float cover = 1.0 - smoothstep(-aa, aa, d);
  if (cover <= 0.0 && shadow <= 0.003) { outColor = vec4(0.0); return; }

  // height field: circular bevel of radius B
  float B = max(min(uCore.z * 0.9, 70.0 * uDpr), 14.0 * uDpr);
  vec2 e = vec2(1.5 * uDpr, 0.0);
  float dx = field(p + e.xy) - d;
  float dy = field(p + e.yx) - d;
  vec2 g = vec2(dx, dy) / e.x;
  float t = clamp(1.0 + d / B, 0.0, 1.0);          // 0 deep inside .. 1 at edge
  float slope = t / sqrt(max(1.0 - t * t, 0.02));  // dH/dd for circular profile
  vec3 n = normalize(vec3(g * slope, 1.0));

  vec3 L = normalize(vec3(-0.55, 0.65, 0.75));
  vec3 V = vec3(0.0, 0.0, 1.0);
  float diff = clamp(dot(n, L), 0.0, 1.0);
  vec3 H = normalize(L + V);
  float spec = pow(clamp(dot(n, H), 0.0, 1.0), 48.0);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0);

  vec3 base = tint(p);
  vec3 col = base * (0.8 + 0.3 * diff);
  col = mix(col, base * 0.62, rim * 0.4);                 // darker turning edge
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = clamp(mix(vec3(lum), col, 1.22), 0.0, 1.0);        // keep creature colours saturated
  col += vec3(1.0) * spec * 0.32;                           // glossy highlight
  // thin ink contour where it helps the silhouette read
  float edge = smoothstep(-2.6 * uDpr, -0.6 * uDpr, d);
  col = mix(col, vec3(0.086, 0.075, 0.114), edge * 0.85);

  vec4 blob = vec4(col * cover, cover);
  vec4 sh = vec4(vec3(0.086, 0.075, 0.114) * shadow, shadow);
  outColor = (blob + sh * (1.0 - blob.a)) * uAlpha;
}
`

export interface OrganismFrame {
  count: number
  balls: Float32Array // x, y, r, _ in CSS px
  cols: Float32Array
  core: [number, number, number, number]
  coreCol: [number, number, number]
  wobble: number
  alpha: number
  bbox: [number, number, number, number] // css px x0,y0,x1,y1
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

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export class Organism {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private buf: WebGLBuffer | null = null
  private loc: Record<string, WebGLUniformLocation | null> = {}
  private dpr = 1
  private cleared = true
  readonly ok: boolean
  private canvas: HTMLCanvasElement

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
    for (const name of ['uRes', 'uTime', 'uDpr', 'uCount', 'uBalls', 'uCols', 'uCore', 'uCoreCol', 'uWobble', 'uAlpha', 'uK']) {
      this.loc[name] = gl.getUniformLocation(this.prog, name)
    }
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
    this.clear()
  }

  clear() {
    const gl = this.gl
    if (!gl || this.cleared) return
    gl.disable(gl.SCISSOR_TEST)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.cleared = true
  }

  private ballsDev = new Float32Array(MAX_BALLS * 4)
  private lastScissor: [number, number, number, number] | null = null

  render(f: OrganismFrame, time: number) {
    const gl = this.gl
    if (!gl || !this.ok || !this.prog) return
    const dpr = this.dpr
    const H = this.canvas.height
    const toDevX = (x: number) => x * dpr
    const toDevY = (y: number) => H - y * dpr

    for (let i = 0; i < MAX_BALLS; i++) {
      const o = i * 4
      this.ballsDev[o] = toDevX(f.balls[o])
      this.ballsDev[o + 1] = toDevY(f.balls[o + 1])
      this.ballsDev[o + 2] = f.balls[o + 2] * dpr
      this.ballsDev[o + 3] = 0
    }

    // scissor to the organism's bounding box (+ shadow/AA margin): huge saving
    const pad = 60
    const x0 = Math.max(0, Math.floor((f.bbox[0] - pad) * dpr))
    const x1 = Math.min(this.canvas.width, Math.ceil((f.bbox[2] + pad) * dpr))
    const y0 = Math.max(0, Math.floor(H - (f.bbox[3] + pad) * dpr))
    const y1 = Math.min(H, Math.ceil(H - (f.bbox[1] - pad) * dpr))

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    // clear the union of last + current scissor so no trails are left behind
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

    gl.useProgram(this.prog)
    gl.bindVertexArray(this.vao)
    gl.uniform2f(this.loc.uRes, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.loc.uTime, time)
    gl.uniform1f(this.loc.uDpr, dpr)
    gl.uniform1i(this.loc.uCount, f.count)
    gl.uniform4fv(this.loc.uBalls, this.ballsDev)
    gl.uniform3fv(this.loc.uCols, f.cols)
    gl.uniform4f(this.loc.uCore, toDevX(f.core[0]), toDevY(f.core[1]), f.core[2] * dpr, f.core[3])
    gl.uniform3f(this.loc.uCoreCol, f.coreCol[0], f.coreCol[1], f.coreCol[2])
    gl.uniform1f(this.loc.uWobble, f.wobble)
    gl.uniform1f(this.loc.uAlpha, f.alpha)
    gl.uniform1f(this.loc.uK, Math.max(18, f.core[2] * 0.7) * dpr)
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
