/** GLSL shared by the After hours trip (./TripScene.ts). */

/** Ashima simplex noise, fbm, the acid palette and the cartoon light */
export const LIB = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { s += a * snoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return s;
}
uniform float uTime;
uniform float uHue;
/* the acid palette: a full rainbow, pushed toward hot pink, lime and violet */
vec3 acid(float t){
  vec3 c = 0.5 + 0.5 * cos(6.28318 * (t + uHue + vec3(0.0, 0.33, 0.67)));
  return pow(c, vec3(0.75));
}
float toon(vec3 n){
  float d = dot(normalize(n), normalize(vec3(0.45, 0.8, 0.55)));
  return d > 0.42 ? 1.0 : d > -0.12 ? 0.74 : 0.52;
}
`

/** vertex body that hands world position, world normal and local position to the fragment */
export const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
varying vec2 vUv;
#ifdef OUTLINE
uniform float uW;
#endif
#ifdef MELT
uniform float uMelt;
uniform float uTop;
uniform float uSpan;
uniform float uSeed;
#endif
#ifdef INST
attribute float aSeed;
varying float vSeed;
#endif
#ifdef WOBBLE
uniform float uWob;
#endif
void main(){
  vec3 p = position;
  vec3 n = normal;
  vL = p;
  vUv = uv;
  #ifdef WOBBLE
  p += normalize(n) * snoise(normalize(p) * 1.6 + vec3(uTime * 0.4)) * uWob;
  #endif
  #ifdef OUTLINE
  p += normalize(n) * uW;
  #endif
  #ifdef USE_INSTANCING
  p = (instanceMatrix * vec4(p, 1.0)).xyz;
  n = mat3(instanceMatrix) * n;
  #endif
  #ifdef INST
  vSeed = aSeed;
  #endif
  vec4 w = modelMatrix * vec4(p, 1.0);
  #ifdef MELT
  // gravity in world space: the lower a vertex sits, the further its column drips
  float below = clamp((uTop - w.y) / uSpan, 0.0, 1.0);
  float col = 0.35 + 1.9 * pow(max(0.0, snoise(vec3(w.x * 1.7, w.z * 1.7, uSeed))), 1.6);
  float drip = uMelt * below * below * col;
  w.y -= drip * 2.6;
  w.x += sin(w.y * 3.0 + uTime * 2.0 + uSeed) * drip * 0.18;
  #endif
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

/** plain ink for the inverted-hull outlines */
export const INK_FRAG = /* glsl */ `
void main(){ gl_FragColor = vec4(0.07, 0.055, 0.045, 1.0); }
`

/** an eyeball looking down its local +Z: iris, pupil, glint, blinking lids */
export const EYE_FRAG = /* glsl */ `
uniform float uBlink;
uniform vec3 uSkin;
varying vec3 vN;
varying vec3 vW;
varying vec3 vL;
#ifdef INST
varying float vSeed;
#endif
float blinkAt(float t, float per){
  float c = mod(t, per);
  return smoothstep(0.0, 0.07, c) * (1.0 - smoothstep(0.09, 0.2, c));
}
void main(){
  vec3 n0 = normalize(vL);
  float seed = 0.0;
  float lid = uBlink;
  #ifdef INST
  seed = vSeed;
  lid = max(lid, blinkAt(uTime + seed * 9.0, 3.2 + fract(seed * 7.3) * 3.5));
  #endif
  float sh = toon(vN);
  vec3 col;
  if (abs(n0.y) > 1.0 - lid * 1.04) {
    col = uSkin * sh;
    if (abs(abs(n0.y) - (1.0 - lid * 1.04)) < 0.05) col = vec3(0.07, 0.055, 0.045);
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  float fz = n0.z;
  col = vec3(0.98, 0.96, 0.92);
  float ir = 0.78;
  if (fz > ir) {
    float a = atan(n0.y, n0.x);
    float r = (1.0 - fz) / (1.0 - ir);
    col = acid(seed + r * 0.6 + uTime * 0.12 + sin(a * 9.0) * 0.04);
    col *= 0.8 + 0.2 * sin(a * 22.0 + r * 6.0);
    if (r > 0.86) col = vec3(0.07, 0.055, 0.045);
    if (fz > 0.955) col = vec3(0.02, 0.015, 0.03);
  }
  col *= mix(1.0, sh, 0.6);
  // the glint
  vec3 g = normalize(vec3(-0.35, 0.45, 1.0));
  if (dot(n0, g) > 0.985) col = vec3(1.0);
  gl_FragColor = vec4(col, 1.0);
}
`

/** a full-screen backdrop drawn behind everything in a scene */
export const BACK_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`
