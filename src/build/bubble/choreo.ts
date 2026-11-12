/**
 * The bubble's life as a pure function of scroll: hosting a section (floating
 * beside the artboard, spitting pieces) and the four transition events —
 * nightfall roll, slingshot, split & race, balloon. Colour, stretch, rotation,
 * eyes and mood all come out of here; the loop only adds time-based life
 * (tremble phase, wobble springs, blinking).
 */
import { camAt, hostAt, type CamPose, type Geo } from '../camera'
import { clamp01, inOut, inOutQuad, lerp, outBack, outCubic, outExpo, pieces, range, smooth, springOut } from '../runtime'
import { hex, mixRGB, phOf, SEC, secP, SPLIT_PAL, TRN, WORLDS, type RGB } from '../worlds'

export type EyeMood = 'normal' | 'wide' | 'squint' | 'dizzy'
export type Mood = 'curious' | 'spitting' | 'charging' | 'rolling' | 'stretching' | 'splitting' | 'racing' | 'floating' | 'popped' | 'home'

export interface Core {
  x: number
  y: number
  z: number
  R: number
  /** stretch along dir (negative squashes) */
  st: number
  col: RGB
  eyes: EyeMood
}
export interface Ball {
  x: number
  y: number
  z: number
  r: number
  col: RGB
}

export interface BubState {
  vis: number
  n: number
  cores: Core[]
  /** stretch direction in world xy (radians) */
  dir: number
  pal: [RGB, RGB, RGB]
  split: number
  rot: number
  flash: number
  /** time-based tremble amplitude (world px) */
  shake: number
  /** increments on every impact (bounce, merge, snap) */
  impact: number
  balls: Ball[]
  mood: Mood
  /** world colour weights, one per section */
  world: number[]
  /** balloon pop: confetti progress 0..1 (−1 off) and its origin */
  pop: number
  popAt: { x: number; y: number; z: number }
  mascot: { vis: number; x: number; y: number; z: number; s: number }
  /** transition index or −1 */
  tr: number
  tu: number
  shadow: number
}

const PALS = WORLDS.map((w) => w.pal.map(hex) as [RGB, RGB, RGB])
const SPL = SPLIT_PAL.map(hex) as [RGB, RGB, RGB]
const mixPal = (a: [RGB, RGB, RGB], b: [RGB, RGB, RGB], t: number): [RGB, RGB, RGB] => [mixRGB(a[0], b[0], t), mixRGB(a[1], b[1], t), mixRGB(a[2], b[2], t)]

const cam: CamPose = { x: 0, y: 0, s: 1, rx: 0, rz: 0 }
const hA = { x: 0, y: 0, z: 0 }
const hB = { x: 0, y: 0, z: 0 }

function mkCore(): Core {
  return { x: 0, y: 0, z: 0, R: 0, st: 0, col: [0, 0, 0], eyes: 'normal' }
}

export function makeState(): BubState {
  return {
    vis: 1,
    n: 1,
    cores: [mkCore(), mkCore(), mkCore()],
    dir: 0,
    pal: PALS[0],
    split: 0,
    rot: 0,
    flash: 0,
    shake: 0,
    impact: 0,
    balls: [],
    mood: 'curious',
    world: [1, 0, 0, 0, 0],
    pop: -1,
    popAt: { x: 0, y: 0, z: 0 },
    mascot: { vis: 0, x: 0, y: 0, z: 0, s: 1 },
    tr: -1,
    tu: 0,
    shadow: 0.22,
  }
}

const bump = (a: number, b: number, v: number) => smooth(a, (a + b) / 2, v) * (1 - smooth((a + b) / 2, b, v))

/** passengers inhaled before the nightfall roll: a few placed hero tones */
let passengerCache: { key: string; list: { x: number; y: number; col: RGB }[] } = { key: '', list: [] }
function passengers(sec: number) {
  const key = `${sec}:${pieces.size}`
  if (passengerCache.key === key) return passengerCache.list
  const list = [...pieces.values()]
    .filter((c) => c.section === sec && c.kind === 'hero')
    .slice(0, 4)
    .map((c) => ({ x: c.sx + c.w / 2, y: c.sy + c.h / 2, col: hex(c.tone) }))
  passengerCache = { key, list }
  return list
}

/** 01 Hello's closing beat: the bubble comes down to wait beside the scroll
 *  hint (k = 0..1), crouching as it charges for the nightfall roll */
function helloWait(g: Geo, k: number, out: { x: number; y: number }) {
  if (!g.hint0 || k <= 0) return
  out.x = lerp(out.x, g.hint0.x, k)
  out.y = lerp(out.y, g.hint0.y, k)
}

export function bubbleAt(g: Geo, p: number, S: BubState) {
  S.balls.length = 0
  S.flash = 0
  S.shake = 0
  S.split = 0
  S.dir = 0
  S.n = 1
  S.vis = 1
  S.pop = -1
  S.mascot.vis = 0
  S.tr = -1
  S.tu = 0
  S.impact = 0
  for (let k = 0; k < 5; k++) S.world[k] = 0
  const R = g.R
  const c0 = S.cores[0]
  c0.st = 0
  c0.eyes = 'normal'

  // which transition (if any)
  let tr = -1
  for (let i = 0; i < 4; i++) if (p > TRN[i][0] && p < TRN[i][1]) tr = i

  if (tr < 0) {
    let i = 0
    for (let k = 0; k < 5; k++) if (p >= SEC[k][0] - 1e-9) i = k
    camAt(g, p, cam)
    hostAt(g, i, cam, hA)
    S.world[i] = 1
    S.pal = PALS[i]
    S.shadow = WORLDS[i].shadow
    S.rot = p * 26
    c0.x = hA.x
    c0.y = hA.y
    c0.z = hA.z
    c0.R = R
    c0.col = PALS[i][0]
    S.mood = 'spitting'
    if (i === 0 && p < SEC[0][0] + 0.012) S.mood = 'curious'
    if (i === 0 && g.hint0) {
      const u = (p - SEC[0][0]) / (SEC[0][1] - SEC[0][0])
      const ph = phOf(0)
      helloWait(g, inOut(smooth(ph.descEnd + 0.02, ph.descEnd + 0.08, u)), c0)
      const ch = range(ph.descEnd + 0.07, 1, u)
      if (ch > 0) {
        c0.st = -0.09 * ch * ch
        c0.eyes = ch > 0.35 ? 'squint' : 'normal'
        S.shake = ch * ch * 2.6 * g.peak
      }
    }
    if (i === 4) {
      // after the pop only the little mascot is left; it walks to the CTA
      S.vis = 0
      S.mood = 'home'
      const u = (p - SEC[4][0]) / (SEC[4][1] - SEC[4][0])
      const go = smooth(0.8, 0.9, u)
      const m = S.mascot
      m.vis = 1
      m.x = lerp(hA.x, g.mascot.x, inOut(go))
      m.y = lerp(hA.y + 40, g.mascot.y, inOut(go))
      m.z = lerp(hA.z, 0, go) + Math.sin(Math.PI * go) * 160
      m.s = 1
      // confetti still settling just after the pop
      const pu = range(TRN[3][1] - TR3_POP_TAIL, secP(4, 0.05), p)
      if (pu < 1) {
        S.pop = 0.72 + 0.28 * pu
        popPoint(g, S)
      }
    }
    return S
  }

  /* ---------------------------------------------------- transitions */
  const [t0, t1] = TRN[tr]
  const u = (p - t0) / (t1 - t0)
  S.tr = tr
  S.tu = u
  camAt(g, t0, cam)
  hostAt(g, tr, cam, hA)
  if (tr === 0) helloWait(g, 1, hA)
  camAt(g, t1, cam)
  hostAt(g, tr + 1, cam, hB)
  const dx = hB.x - hA.x
  const dy = hB.y - hA.y
  const dist = Math.hypot(dx, dy) || 1
  const ux = dx / dist
  const uy = dy / dist
  const from = PALS[tr]
  const to = PALS[tr + 1]
  S.shadow = lerp(WORLDS[tr].shadow, WORLDS[tr + 1].shadow, smooth(0.3, 0.8, u))
  c0.R = R
  c0.z = hA.z

  if (tr === 0) {
    /* ------------------------------------------- 01 → 02 nightfall roll */
    const inh = range(0, 0.16, u)
    const list = passengers(0)
    list.forEach((q, k) => {
      const e = inOut(clamp01(inh * 1.25 - k * 0.08))
      if (e >= 1) return
      S.balls.push({ x: lerp(q.x, hA.x, e), y: lerp(q.y, hA.y, e), z: lerp(0, hA.z, e) + Math.sin(Math.PI * e) * 120, r: lerp(24, 10, e) * g.peak, col: q.col })
    })
    const charge = range(0.14, 0.42, u)
    // carries on the crouch + tremble it started while waiting by the hint
    const carry = g.hint0 ? 1 - range(0, 0.14, u) : 0
    S.shake = Math.max(charge * charge * 16, 2.6 * carry) * g.peak
    S.flash = bump(0.39, 0.5, u)
    const v = range(0.42, 1, u)
    const e = inOutQuad(v)
    c0.x = lerp(hA.x, hB.x, e)
    c0.y = lerp(hA.y, hB.y, e)
    // three bounces, each lower; squash flat on every impact
    const ph = v * 3
    const hop = Math.abs(Math.sin(Math.PI * ph)) * 260 * g.peak * Math.pow(1 - v, 1.1)
    c0.z = lerp(hA.z, hB.z, e) + hop
    const near = Math.min(ph % 1, 1 - (ph % 1))
    const sq = v > 0.02 && v < 0.99 ? Math.exp(-(near * near) / 0.006) : 0
    c0.st = -0.34 * sq * (1 - v * 0.5) + 0.06 * Math.sin(Math.PI * v) - 0.09 * carry
    S.dir = 0
    S.impact = v > 0 ? Math.floor(ph + 0.02) : 0
    S.rot = p * 26 + (dist * e) / R
    c0.R = R * (1 + 0.1 * inh) * (1 + 0.08 * charge)
    const m = smooth(0.46, 0.92, u)
    S.pal = mixPal(from, to, m)
    c0.eyes = u < 0.16 ? (carry > 0 ? 'squint' : 'normal') : u < 0.3 ? 'wide' : u < 0.42 ? 'squint' : u < 0.82 ? 'wide' : 'dizzy'
    S.mood = u < 0.42 ? 'charging' : 'rolling'
    const w = smooth(0.42, 0.92, u)
    S.world[0] = 1 - w
    S.world[1] = w
  } else if (tr === 1) {
    /* ----------------------------------------------- 02 → 03 slingshot */
    const pull = inOut(range(0, 0.4, u))
    const snap = range(0.4, 0.58, u)
    const back = range(0.58, 1, u)
    const PB = 210 * g.peak
    const OV = 260 * g.peak
    if (u < 0.4) {
      c0.x = hA.x - ux * PB * pull
      c0.y = hA.y - uy * PB * pull
      c0.st = 0.55 * pull
      S.shake = smooth(0.25, 0.4, u) * 5 * g.peak
    } else if (u < 0.58) {
      const e = outExpo(snap)
      c0.x = lerp(hA.x - ux * PB, hB.x + ux * OV, e)
      c0.y = lerp(hA.y - uy * PB, hB.y + uy * OV, e)
      c0.st = 0.55 + 0.85 * Math.sin(Math.PI * Math.min(1, snap * 1.4)) - 0.4 * snap
      S.flash = bump(0.4, 0.47, u) * 0.6
    } else {
      const o = OV * (1 - springOut(back, 2.6, 4.2))
      c0.x = hB.x + ux * o
      c0.y = hB.y + uy * o
      c0.st = 0.3 * Math.exp(-4 * back) * Math.cos(5 * Math.PI * back)
    }
    c0.z = lerp(hA.z, hB.z, smooth(0.4, 0.6, u)) + Math.sin(Math.PI * snap) * 90 * g.peak
    S.dir = Math.atan2(uy, ux)
    S.impact = u >= 0.4 ? 1 : 0
    if (u >= 0.6) S.impact = 2
    S.rot = p * 26 + snap * 2
    S.pal = mixPal(from, to, smooth(0.44, 0.56, u))
    c0.eyes = u < 0.4 ? 'squint' : u < 0.8 ? 'wide' : 'normal'
    S.mood = 'stretching'
    const w = smooth(0.42, 0.62, u)
    S.world[1] = 1 - w
    S.world[2] = w
  } else if (tr === 2) {
    /* -------------------------------------------- 03 → 04 split & race */
    S.shake = bump(0, 0.3, u) * 9 * g.peak
    const sp = smooth(0.18, 0.32, u)
    const merge = smooth(0.86, 0.97, u)
    const v = range(0.32, 0.88, u)
    S.n = sp > 0.01 && merge < 0.995 ? 3 : 1
    S.split = sp * (1 - merge)
    const r = R * 1.25 * sp * (1 - merge)
    for (let k = 0; k < 3; k++) {
      const C = S.cores[k]
      const a = (Math.PI * 2 * k) / 3 - Math.PI / 2
      const ek = clamp01(inOut(v) + 0.09 * Math.sin(Math.PI * v) * (k - 1))
      const bx = lerp(hA.x, hB.x, ek)
      const by = lerp(hA.y, hB.y, ek)
      const braid = Math.sin(Math.PI * 2 * 1.5 * v + (k * Math.PI * 2) / 3) * Math.sin(Math.PI * v) * 150 * g.peak
      C.x = bx + Math.cos(a) * r - uy * braid
      C.y = by + Math.sin(a) * r * 0.8 + ux * braid
      C.z = lerp(hA.z, hB.z, ek) + Math.abs(Math.sin(Math.PI * 4 * v + k)) * 70 * g.peak * Math.sin(Math.PI * v)
      C.R = sp < 0.01 || merge > 0.995 ? R : lerp(R, R * 0.58, sp) * lerp(1, 1 / 0.58, merge)
      C.st = 0.18 * Math.sin(Math.PI * v) * sp
      C.col = mixRGB(from[0], SPL[k], sp)
      C.eyes = u < 0.18 ? 'squint' : u < 0.88 ? 'wide' : 'normal'
    }
    if (S.n === 1) {
      c0.x = lerp(hA.x, hB.x, merge > 0.5 ? 1 : 0)
      c0.y = lerp(hA.y, hB.y, merge > 0.5 ? 1 : 0)
      c0.z = merge > 0.5 ? hB.z : hA.z
      c0.R = R * (1 + 0.12 * Math.exp(-6 * range(0.97, 1, u)) * merge)
      c0.st = merge > 0.5 ? -0.3 * Math.exp(-5 * range(0.96, 1, u)) * Math.cos(6 * Math.PI * range(0.96, 1, u)) : 0
      c0.eyes = u < 0.18 ? 'squint' : 'wide'
    }
    S.dir = Math.atan2(uy, ux)
    S.impact = u >= 0.96 ? 1 : 0
    S.rot = p * 26 + v * 8
    S.pal = mixPal(from, to, merge)
    S.mood = u < 0.32 ? 'splitting' : u < 0.88 ? 'racing' : 'splitting'
    const w = smooth(0.35, 0.86, u)
    S.world[2] = 1 - w
    S.world[3] = w
  } else {
    /* ------------------------------------------------- 04 → 05 balloon */
    popPoint(g, S)
    const P = S.popAt
    const inf = smooth(0, 0.22, u)
    const v = range(0.22, 0.8, u)
    const e = inOut(v)
    const sway = Math.sin(Math.PI * 2 * 1.5 * v) * 46 * g.peak * Math.sin(Math.PI * v)
    c0.x = lerp(hA.x, P.x, e) + sway
    c0.y = lerp(hA.y, P.y, e) - Math.sin(Math.PI * v) * 520 * g.peak
    c0.z = lerp(hA.z, P.z, e) + Math.sin(u * 30) * 6
    const swell = smooth(0.8, 0.88, u)
    const pop = range(0.88, 0.9, u)
    c0.R = R * (1 + 0.75 * inf + 0.12 * swell) * (1 + 0.25 * pop) * (pop >= 1 ? 0 : 1)
    c0.st = -0.06 * Math.sin(u * 40) * inf
    S.shake = swell * 7 * g.peak
    S.flash = bump(0.87, 0.93, u)
    S.dir = Math.PI / 2
    S.rot = p * 26 + v * 3
    S.pal = mixPal(from, to, smooth(0.28, 0.76, u))
    // the knot of the balloon
    if (pop < 1 && inf > 0.05) S.balls.push({ x: c0.x, y: c0.y + c0.R * 1.02, z: c0.z, r: c0.R * 0.13 * inf, col: S.pal[1] })
    c0.eyes = u < 0.8 ? 'wide' : 'squint'
    S.mood = u < 0.88 ? 'floating' : 'popped'
    if (pop >= 1) {
      S.vis = 0
      S.pop = range(0.88, 1, u) * 0.72
      const m = S.mascot
      const mu = range(0.89, 1, u)
      m.vis = 1
      camAt(g, t1, cam)
      hostAt(g, 4, cam, hB)
      m.x = lerp(P.x, hB.x, outCubic(mu))
      m.y = lerp(P.y, hB.y + 40, outCubic(mu))
      m.z = lerp(P.z, hB.z, mu)
      m.s = clamp01(outBack(clamp01(mu * 3), 2.4))
    }
    const w = smooth(0.3, 0.8, u)
    S.world[3] = 1 - w
    S.world[4] = w
  }
  c0.col = S.pal[0]
  return S
}

/** confetti keeps falling a moment into section 05 */
const TR3_POP_TAIL = 0.0

function popPoint(g: Geo, S: BubState) {
  const b = g.boards[4]
  S.popAt.x = b.x + g.FW * (g.narrow ? 0.5 : 0.6)
  S.popAt.y = b.y + (g.narrow ? 40 : 60)
  S.popAt.z = 300 * g.peak
}
