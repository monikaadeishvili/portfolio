/**
 * Page 2 runtime: plain mutable state read by the single ticker loop.
 * Every component is driven by scrubbed scalars (k: travel to slot, d: dive
 * into the bubble, q: pour out of it). The pose — position, billboard, squash
 * — is a pure function of those scalars, so scrubbing backwards is exact.
 */
import type { AliveMeta, LifeState, Travel } from '../ui/Alive'

export interface V3 {
  x: number
  y: number
  z: number
}

export interface Comp extends AliveMeta {
  chapter: number
  /** slot top-left in world px (layout, untransformed) */
  sx: number
  sy: number
  w: number
  h: number
  /** waiting pose, relative to the slot */
  wait: V3
  /** source slot (previous frame) relative to this slot — reused instances */
  src: V3 | null
  /** bubble park points relative to this slot: where it dives in / pours out */
  bubIn: V3 | null
  bubOut: V3 | null
  t: { k: number; d: number; q: number; in: number }
  /** scroll progress at which it lands */
  land: number
  /** z on the previous frame (sheet hit-test) */
  pz: number
  /** live pose */
  pose: Pose
  /** idle + reaction springs (time based, on top of the scrubbed pose) */
  hz: number
  hv: number
  wob: number
  wv: number
  wave: number
  ph: number
  nextHop: number
  /** screen centre from the last read */
  scx: number
  scy: number
  last: string
  lastSh: string
  lastOp: string
  lastSt: string
  lastWalk: string
  lastPre: string
}

export interface Pose {
  x: number
  y: number
  z: number
  b: number
  rot: number
  sx: number
  sy: number
  op: number
  state: LifeState
  walk: boolean
  pre: boolean
  /** 0..1 metaball weight while diving in / pouring out */
  ball: number
  /** fully inside the bubble */
  inside: boolean
}

export const comps = new Map<string, Comp>()

export function registerComp(m: AliveMeta, chapter: number) {
  const c: Comp = {
    ...m,
    chapter,
    sx: 0,
    sy: 0,
    w: 0,
    h: 0,
    wait: { x: 0, y: 0, z: 0 },
    src: null,
    bubIn: null,
    bubOut: null,
    t: { k: 0, d: 0, q: 0, in: 1 },
    land: 0,
    pz: 0,
    pose: { x: 0, y: 0, z: 0, b: 1, rot: 0, sx: 1, sy: 1, op: 1, state: 'roaming', walk: false, pre: false, ball: 0, inside: false },
    hz: 0,
    hv: 0,
    wob: 0,
    wv: 0,
    wave: 0,
    ph: Math.random() * Math.PI * 2,
    nextHop: 3 + Math.random() * 9,
    scx: 0,
    scy: 0,
    last: '',
    lastSh: '',
    lastOp: '',
    lastSt: '',
    lastWalk: '',
    lastPre: '',
  }
  comps.set(m.id, c)
  return () => {
    if (comps.get(m.id) === c) comps.delete(m.id)
  }
}

/* --------------------------------------------------------------- easing */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a))
  return x * x * (3 - 2 * x)
}
export const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const outCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const outBack = (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)

/* ----------------------------------------------------------------- pose */

const STAND: Pose = { x: 0, y: 0, z: 0, b: 1, rot: 0, sx: 1, sy: 1, op: 1, state: 'roaming', walk: false, pre: false, ball: 0, inside: false }

function reset(p: Pose) {
  Object.assign(p, STAND)
  return p
}

/** pose from the scrubbed scalars only (no idle life) */
export function evalPose(c: Comp, peakMul: number) {
  const p = reset(c.pose)
  const { k, d, q } = c.t
  const W = c.wait

  // reused instance: still part of the previous frame / in flight / inside
  if (c.src && q <= 0) {
    p.pre = true
    const S = c.src
    const BI = c.bubIn!
    if (d <= 0) {
      p.x = S.x
      p.y = S.y
      p.z = 0
      p.b = 0
      p.op = 0
      p.state = 'placed'
      return p
    }
    if (d < 0.25) {
      // pop: eyes open, stands up, hops off its original
      const t = d / 0.25
      p.x = S.x
      p.y = S.y
      p.z = 54 * outCubic(t) * peakMul
      p.b = smooth(0, 0.9, t)
      const sq = Math.sin(Math.PI * t)
      p.sx = 1 - 0.1 * sq
      p.sy = 1 + 0.14 * sq
      p.state = 'roaming'
      return p
    }
    if (d < 1) {
      const t = (d - 0.25) / 0.75
      const e = inOut(t)
      p.x = lerp(S.x, BI.x, e)
      p.y = lerp(S.y, BI.y, e)
      p.z = lerp(54 * peakMul, BI.z, t) + 4 * 190 * peakMul * t * (1 - t)
      const sc = lerp(1, 0.3, t * t)
      p.sx = sc * (1 - 0.06 * Math.sin(Math.PI * t))
      p.sy = sc * (1 + 0.12 * Math.sin(Math.PI * t))
      p.rot = Math.sin(Math.PI * t) * 14 * (c.order % 2 ? 1 : -1)
      p.op = 1 - smooth(0.74, 0.97, t)
      p.ball = smooth(0.55, 1, t)
      p.state = 'leaping'
      return p
    }
    p.x = BI.x
    p.y = BI.y
    p.z = BI.z
    p.op = 0
    p.ball = 1
    p.inside = true
    p.state = 'inside'
    return p
  }

  if (c.src && q < 1) {
    // pouring out of the bubble toward its waiting spot
    const BO = c.bubOut!
    const t = q
    const e = outCubic(t)
    p.x = lerp(BO.x, W.x, e)
    p.y = lerp(BO.y, W.y, e)
    p.z = lerp(BO.z, W.z, t) + 4 * 130 * peakMul * t * (1 - t)
    const sc = lerp(0.3, 1, clamp01(outBack(t, 2.2)))
    p.sx = sc * (1 + 0.1 * Math.sin(Math.PI * t))
    p.sy = sc * (1 - 0.06 * Math.sin(Math.PI * t))
    p.op = smooth(0, 0.16, t)
    p.ball = 1 - smooth(0, 0.42, t)
    p.state = 'leaping'
    return p
  }

  if (k <= 0) {
    p.x = W.x
    p.y = W.y
    p.z = W.z
    return p
  }
  if (k >= 1) {
    p.b = 0
    p.state = 'placed'
    return p
  }

  const hero = c.hero ? 1.7 : 1
  const travel: Travel = c.travel
  if (travel === 'scurry') {
    const dist = Math.hypot(W.x, W.y) || 1
    const hf = Math.min(1, (c.hero ? 150 : 96) / dist)
    const Hx = W.x * hf
    const Hy = W.y * hf
    if (k < 0.7) {
      const t = k / 0.7
      const e = inOut(t)
      p.x = lerp(W.x, Hx, e)
      p.y = lerp(W.y, Hy, e)
      p.z = lerp(W.z, 0, e) + Math.abs(Math.sin(t * Math.PI * 7)) * 5
      p.rot = Math.sin(t * Math.PI * 14) * 3.5
      p.walk = true
      p.state = 'roaming'
    } else {
      const t = (k - 0.7) / 0.3
      const e = inOut(t)
      p.x = lerp(Hx, 0, e)
      p.y = lerp(Hy, 0, e)
      p.z = 4 * 64 * hero * peakMul * t * (1 - t)
      p.b = 1 - smooth(0.4, 0.96, t)
      landSquash(p, t, hero)
      p.state = 'leaping'
    }
    return p
  }
  if (travel === 'leap') {
    if (k < 0.14) {
      const s = smooth(0, 1, k / 0.14)
      p.x = W.x
      p.y = W.y
      p.z = W.z
      p.sx = 1 + 0.16 * s * hero * 0.8
      p.sy = 1 - 0.16 * s * hero * 0.8
      p.state = 'roaming'
      return p
    }
    const t = (k - 0.14) / 0.86
    const e = inOut(t)
    p.x = lerp(W.x, 0, e)
    p.y = lerp(W.y, 0, e)
    p.z = lerp(W.z, 0, t) + 4 * 150 * hero * peakMul * t * (1 - t)
    const air = Math.sin(Math.PI * clamp01(t / 0.9))
    p.sx = 1 - 0.08 * air
    p.sy = 1 + 0.14 * air
    p.rot = air * 7 * (c.order % 2 ? 1 : -1)
    p.b = 1 - smooth(0.5, 0.94, t)
    landSquash(p, t, hero)
    p.state = 'leaping'
    return p
  }
  // drop: from high above, straight down through the layer sheets
  if (k < 0.16) {
    const s = Math.sin((Math.PI / 2) * (k / 0.16))
    p.x = W.x
    p.y = W.y
    p.z = W.z + 26 * s
    p.sx = 1 + 0.05 * s
    p.sy = 1 - 0.05 * s
    p.state = 'roaming'
    return p
  }
  const t = (k - 0.16) / 0.84
  p.x = lerp(W.x, 0, outCubic(t))
  p.y = lerp(W.y, 0, outCubic(t))
  p.z = lerp(W.z + 26, 0, t * t)
  p.b = 1 - smooth(0.08, 0.8, t)
  p.sy = 1 + 0.1 * t * (1 - smooth(0.85, 1, t))
  p.sx = 1 - 0.05 * t * (1 - smooth(0.85, 1, t))
  landSquash(p, t, hero)
  p.state = 'leaping'
  return p
}

function landSquash(p: Pose, t: number, hero: number) {
  if (t < 0.88) return
  const s = Math.sin(Math.PI * ((t - 0.88) / 0.12))
  p.sx *= 1 + 0.15 * s * hero
  p.sy *= 1 - 0.15 * s * hero
}
