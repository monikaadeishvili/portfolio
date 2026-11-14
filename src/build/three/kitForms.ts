/**
 * The kit: 53 parts and the six formations they take (pure data, no three.js).
 * F0 loose · F1 lens (research) · F2 flow · F3 shelf (systems) · F4 exploded
 * phone (handoff) · F5 the finished phone (launch). Every formation uses every
 * part; nothing is added or removed. Seeded, so every load is identical.
 *
 * Units: the sculpture sits around the origin inside ~7 × 5.6 × 5. Rotations
 * are Euler XYZ in radians; the root of each formation has its own yaw/pitch.
 */

export type PartType = 'card' | 'pill' | 'dot' | 'bar' | 'ring' | 'slab'
export const TYPES: { type: PartType; n: number }[] = [
  { type: 'card', n: 14 },
  { type: 'pill', n: 10 },
  { type: 'dot', n: 12 },
  { type: 'bar', n: 10 },
  { type: 'ring', n: 6 },
  { type: 'slab', n: 1 },
]
export const KIT_COUNT = TYPES.reduce((a, t) => a + t.n, 0)

/** global index of the first part of each type */
export const START: Record<PartType, number> = { card: 0, pill: 14, dot: 24, bar: 36, ring: 46, slab: 52 }
/** the orange pill: the product's primary button in every shape */
export const HERO_PILL = START.pill

export const COLORS = { sand: '#EBE2D4', dune: '#CFC2AE', lime: '#C6F135', orange: '#E8590C', slab: '#2A211B' }
/** per-part colour: ~60% sand, ~20% dune, 8 lime, one orange */
export const PART_COLOR: string[] = (() => {
  const c: string[] = new Array(KIT_COUNT).fill(COLORS.sand)
  const lime = [START.dot + 0, START.dot + 1, START.dot + 2, START.pill + 3, START.pill + 7, START.ring + 1, START.ring + 4, START.card + 0]
  const dune = [2, 5, 8, 11, 13, START.pill + 5, START.pill + 9, START.dot + 7, START.dot + 10, START.bar + 2, START.bar + 6, START.bar + 9]
  dune.forEach((i) => (c[i] = COLORS.dune))
  lime.forEach((i) => (c[i] = COLORS.lime))
  c[HERO_PILL] = COLORS.orange
  c[START.slab] = COLORS.slab
  return c
})()

/** deterministic 0..1 per (part, channel) */
export const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7 + 74.7) * 43758.5453
  return x - Math.floor(x)
}

export interface Formation {
  /** per part: x y z */
  pos: Float32Array
  /** per part: euler x y z */
  rot: Float32Array
  /** per part: sx sy sz */
  scl: Float32Array
  yaw: number
  pitch: number
}

type V3 = [number, number, number]
function make(yaw: number, pitch: number) {
  const f: Formation = { pos: new Float32Array(KIT_COUNT * 3), rot: new Float32Array(KIT_COUNT * 3), scl: new Float32Array(KIT_COUNT * 3).fill(1), yaw, pitch }
  const set = (i: number, p: V3, r: V3 = [0, 0, 0], s: V3 | number = 1) => {
    f.pos.set(p, i * 3)
    f.rot.set(r, i * 3)
    f.scl.set(typeof s === 'number' ? [s, s, s] : s, i * 3)
  }
  return { f, set }
}
const D = Math.PI / 180
const card = (k: number) => START.card + k
const pill = (k: number) => START.pill + k
const dot = (k: number) => START.dot + k
const bar = (k: number) => START.bar + k
const ring = (k: number) => START.ring + k
const SLAB = START.slab

/* ------------------------------------------------------- F0 · loose */
function f0() {
  const { f, set } = make(0.2, 0.08)
  for (let i = 0; i < KIT_COUNT - 1; i++) {
    // a seeded scatter inside an ellipsoid (3.4, 2.4, 1.8), random tumble
    const u = rnd(i, 1) * Math.PI * 2
    const v = Math.acos(2 * rnd(i, 2) - 1)
    const r = 0.45 + 0.55 * Math.cbrt(rnd(i, 3))
    set(i, [Math.sin(v) * Math.cos(u) * 3.4 * r, Math.cos(v) * 2.4 * r, Math.sin(v) * Math.sin(u) * 1.8 * r], [rnd(i, 4) * 6.28, rnd(i, 5) * 6.28, rnd(i, 6) * 6.28], 0.9)
  }
  set(SLAB, [0.9, -0.1, -2.6], [0.18, -0.5, 0.14], 0.9)
  return f
}

/* ------------------------------------------------------- F1 · lens */
function f1() {
  const { f, set } = make(0.28, 0.1)
  const cx = -0.4
  const cy = 0.55
  const R = 1.55
  // the rim: ten pills tangent on a circle (the orange one at the top)
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k / 10) * Math.PI * 2
    set(pill(k), [cx + Math.cos(a) * R, cy + Math.sin(a) * R, 0], [0, 0, a + Math.PI / 2])
  }
  // the handle: six bars bundled 2×2 + 2 at -45°
  const dx = Math.cos(-45 * D)
  const dy = Math.sin(-45 * D)
  const sx = cx + dx * (R + 0.15)
  const sy = cy + dy * (R + 0.15)
  const nx = -dy
  const ny = dx
  const bundle: [number, number, number][] = [
    [0.85, 0.055, 0.055],
    [0.85, -0.055, 0.055],
    [0.85, 0.055, -0.055],
    [0.85, -0.055, -0.055],
    [2.48, 0.055, 0],
    [2.48, -0.055, 0],
  ]
  bundle.forEach(([t, o, z], k) => set(bar(k), [sx + dx * t + nx * o, sy + dy * t + ny * o, z], [0, 0, -45 * D]))
  // inside the glass: three clusters of four dots (findings)
  const cl: [number, number][] = [
    [-0.55, 0.32],
    [0.5, 0.42],
    [0.0, -0.55],
  ]
  for (let k = 0; k < 12; k++) {
    const [ox, oy] = cl[Math.floor(k / 4)]
    const j = k % 4
    set(dot(k), [cx + ox + (j % 2) * 0.38 - 0.19, cy + oy + Math.floor(j / 2) * 0.38 - 0.19, 0.05])
  }
  // focus tunnel: six rings behind the glass
  for (let k = 0; k < 6; k++) set(ring(k), [cx, cy, -0.32 * (k + 1)], [0, 0, 0], 1 + 0.5 * k)
  // the wall of notes, pinned to the slab (landscape)
  set(SLAB, [0.35, 0.45, -2.95], [0, 0, 90 * D], [1.35, 1.32, 1])
  for (let k = 0; k < 14; k++) {
    const col = k % 5
    const row = Math.floor(k / 5)
    set(card(k), [0.35 + (col - 2) * 1.25, 0.45 + (1 - row) * 0.9, -2.72], [0, 0, (rnd(k, 7) - 0.5) * 12 * D], 0.74)
  }
  // four spare bars lie on notes as lines of text
  for (let k = 6; k < 10; k++) {
    const n = [1, 3, 6, 8][k - 6]
    const col = n % 5
    const row = Math.floor(n / 5)
    set(bar(k), [0.35 + (col - 2) * 1.25, 0.45 + (1 - row) * 0.9 - 0.12, -2.64], [0, 0, 0], [0.5, 0.8, 0.8])
  }
  return f
}

/* ------------------------------------------------------- F2 · flow */
export const FLOW_NODES: [number, number][] = [
  [-3.2, 0.9],
  [-1.6, 0.9],
  [0, 0.9],
  [1.6, 1.9],
  [3.2, 1.9],
  [1.6, -0.1],
  [3.2, -0.1],
]
const FLOW_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [2, 5],
  [5, 6],
]
/** the path the users (dots) walk: start → fork → goal */
export const FLOW_PATH: [number, number][] = [FLOW_NODES[0], FLOW_NODES[1], FLOW_NODES[2], FLOW_NODES[3], FLOW_NODES[4]]
function f2() {
  const { f, set } = make(-18 * D, 12 * D)
  set(SLAB, [0, 0.6, -0.6], [0, 0, 90 * D], [1.0, 1.75, 1])
  FLOW_NODES.forEach(([x, y], k) => set(card(k), [x, y, 0], [0, 0, 0], 0.8))
  FLOW_EDGES.forEach(([a, b], k) => {
    const [x0, y0] = FLOW_NODES[a]
    const [x1, y1] = FLOW_NODES[b]
    const d = Math.hypot(x1 - x0, y1 - y0)
    set(bar(k), [(x0 + x1) / 2, (y0 + y1) / 2, 0.02], [0, 0, Math.atan2(y1 - y0, x1 - x0)], [Math.max(0.14, (d - 1.15) / 1.6), 1, 1])
  })
  // the deck of spare screens
  for (let k = 7; k < 14; k++) set(card(k), [-3.25, -1.75, 0.05 + (k - 7) * 0.11], [0, 0, (rnd(k, 8) - 0.5) * 10 * D], 0.8)
  for (let k = 6; k < 10; k++) set(bar(k), [-3.25, -2.45 - (k - 6) * 0.16, 0.05], [0, 0, 0], [0.55, 1, 1])
  // labels above the nodes; the orange one marks the goal
  const lab = [0, 1, 2, 3, 5, 6]
  set(pill(0), [FLOW_NODES[4][0], FLOW_NODES[4][1] + 0.62, 0.05], [0, 0, 0], 0.72)
  lab.forEach((n, k) => set(pill(k + 1), [FLOW_NODES[n][0], FLOW_NODES[n][1] + 0.62, 0.05], [0, 0, 0], 0.72))
  for (let k = 7; k < 10; k++) set(pill(k), [-1.75, -1.45 - (k - 7) * 0.42, 0.05], [0, 0, 0], 0.62)
  // rings on node corners (the decision at the fork is the big one)
  set(ring(0), [FLOW_NODES[2][0] + 0.55, FLOW_NODES[2][1] + 0.33, 0.1], [0, 0, 0], 0.6)
  ;[0, 1, 3, 4, 6].forEach((n, k) => set(ring(k + 1), [FLOW_NODES[n][0] - 0.5, FLOW_NODES[n][1] - 0.3, 0.1], [0, 0, 0], 0.38))
  // users walking the path (base positions; the scene animates them)
  for (let k = 0; k < 12; k++) {
    const [x, y] = pathAt(k / 12)
    set(dot(k), [x, y, 0.32], [0, 0, 0], 0.8)
  }
  return f
}
export function pathAt(t: number): [number, number] {
  const segs = FLOW_PATH.length - 1
  const x = ((t % 1) + 1) % 1 * segs
  const i = Math.min(segs - 1, Math.floor(x))
  const u = x - i
  return [FLOW_PATH[i][0] + (FLOW_PATH[i + 1][0] - FLOW_PATH[i][0]) * u, FLOW_PATH[i][1] + (FLOW_PATH[i + 1][1] - FLOW_PATH[i][1]) * u]
}

/* ------------------------------------------------------- F3 · shelf */
export const SHELF_GRID = { x0: -4.0, x1: 4.4, y0: -2.6, y1: 2.2, step: 0.4 }
function f3() {
  const { f, set } = make(10 * D, 52 * D)
  // knolling: everything axis-aligned on a 0.4 grid, lying on the table (z up)
  set(SLAB, [-3.3, -0.2, 0.1], [0, 0, 0], 0.72)
  for (let k = 0; k < 12; k++) set(dot(k), [-2.0 + (k % 6) * 0.4, 1.6 - Math.floor(k / 6) * 0.4, 0.17])
  for (let k = 0; k < 10; k++) {
    const sx = 1 - k * 0.075
    set(bar(k), [-2.2 + 0.8 * sx, 0.8 - k * 0.24, 0.05], [0, 0, 0], [sx, 1, 1])
  }
  for (let k = 0; k < 10; k++) set(pill(k), [0.6 + (k % 5) * 0.96, 1.6 - Math.floor(k / 5) * 0.4, 0.15])
  for (let k = 0; k < 14; k++) {
    const st = Math.floor(k / 7)
    const j = k % 7
    set(card(k), [1.2 + st * 2.2 + j * 0.12, -0.55 - j * 0.12, 0.05 + j * 0.1], [0, 0, (j - 3) * 2.2 * D], 0.86)
  }
  for (let k = 0; k < 6; k++) set(ring(k), [0.4 + k * 0.72, -2.15, 0.07], [0, 0, 0], 0.6 + k * 0.1)
  return f
}

/* ------------------------------------------------------- F4 · exploded / F5 · live */
function phone(gap: number, live: boolean) {
  const { f, set } = make(live ? -8 * D : -32 * D, live ? 4 * D : 14 * D)
  set(SLAB, [0, 0, 0])
  const zA = live ? 0.16 : gap
  const zB = live ? 0.22 : gap * 2
  const zC = live ? 0.28 : gap * 3
  // layer A: the hero card and three list cards
  set(card(0), [0, 1.35, zA], [0, 0, 0], [1.45, 1.45, 1])
  ;[0.05, -0.95, -1.95].forEach((y, k) => set(card(k + 1), [0, y, zA], [0, 0, 0], [1.5, 0.86, 1]))
  // layer B: lines of text, three tags, the orange CTA
  const lines: [number, number, number][] = [
    [-0.25, 1.75, 0.8],
    [-0.45, 1.5, 0.55],
    [-0.15, 0.2, 0.62],
    [-0.15, -0.8, 0.5],
    [-0.15, -1.8, 0.66],
    [-0.35, 0.95, 0.4],
  ]
  lines.forEach(([x, y, s], k) => set(bar(k), [x, y, zB], [0, 0, 0], [s, 1, 1]))
  set(pill(0), [0, -2.28, zB], [0, 0, 0], live ? 1.3 : 1.5)
  ;[-0.6, 0, 0.6].forEach((x, k) => set(pill(k + 1), [x, 0.82, zB], [0, 0, 0], 0.48))
  // layer C: avatars and the tab bar
  ;[0.05, -0.95, -1.95].forEach((y, k) => set(dot(k), [-0.85, y, zC], [0, 0, 0], 0.9))
  ;[-0.8, -0.27, 0.27, 0.8].forEach((x, k) => set(ring(k), [x, 2.22, zC], [0, 0, 0], 0.42))
  ;[-0.75, -0.25, 0.25, 0.75].forEach((x, k) => set(dot(k + 3), [x, -2.62 + (live ? 0.3 : 0), zC], [0, 0, 0], 0.55))
  if (!live) {
    // other states fanned behind the device
    for (let k = 4; k < 14; k++) set(card(k), [0.32 + (k - 4) * 0.2, 0.1 - (k - 4) * 0.06, -0.6 - (k - 4) * 0.13], [0, 4 * D, 0], [1.5, 1.5, 1])
    // a legend of the parts beside it
    for (let k = 4; k < 10; k++) set(pill(k), [2.35, 1.6 - (k - 4) * 0.46, 0.3], [0, 0, 0], 0.62)
    for (let k = 7; k < 12; k++) set(dot(k), [3.1, 1.6 - (k - 7) * 0.46, 0.3], [0, 0, 0], 0.7)
    for (let k = 6; k < 10; k++) set(bar(k), [2.65, -1.4 - (k - 6) * 0.22, 0.3], [0, 0, 0], [0.62, 1, 1])
    ;[4, 5].forEach((k, j) => set(ring(k), [2.35 + j * 0.75, -2.45, 0.3], [0, 0, 0], 0.5))
  } else {
    // everything spare tucked flat behind the phone
    for (let k = 4; k < 14; k++) set(card(k), [0, 0.6 - (k - 4) * 0.14, -0.2 - (k - 4) * 0.1], [0, 0, 0], [1.4, 1.2, 1])
    for (let k = 4; k < 10; k++) set(pill(k), [0, -1.2 + (k - 4) * 0.2, -1.3], [0, 0, 0], 0.5)
    for (let k = 6; k < 10; k++) set(bar(k), [0, 1.6 - (k - 6) * 0.25, -1.3], [0, 0, 0], [0.6, 1, 1])
    ;[4, 5].forEach((k, j) => set(ring(k), [-0.4 + j * 0.8, -2.0, -1.3], [0, 0, 0], 0.5))
    // five people orbiting (base positions on the ellipse; the scene animates them)
    for (let k = 7; k < 12; k++) {
      const a = ((k - 7) / 5) * Math.PI * 2
      set(dot(k), [Math.cos(a) * 2.6, Math.sin(a) * 1.2 - 0.2, Math.sin(a) * 1.4 + 0.6], [0, 0, 0], 0.85)
    }
  }
  return f
}

/** F0 … F5 */
export const FORMS: Formation[] = [f0(), f1(), f2(), f3(), phone(0.9, false), phone(0.06, true)]
