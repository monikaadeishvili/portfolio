/**
 * Page 2 runtime: plain mutable registries read by the single ticker loop.
 *
 * Everything on /build is a pure function of the scroll progress `p`
 * (camera, bubble, every piece, every text reveal). The few time-based bits
 * (idle breathing, hop springs, blinking) ride on top and never change where
 * anything ends up, so scrubbing backwards is exact.
 */
import type { LifeState } from '../ui/Alive'
import type { Geo } from './camera'

export interface V3 {
  x: number
  y: number
  z: number
}

/** hero: big, characterful, waits parked beside the artboard and travels on
 *  its own legs. bubble: neat UI spat out of the bubble (or rained by the
 *  balloon pop) in a fast arc. */
export type Kind = 'hero' | 'bubble'
export type Travel = 'crawl' | 'leap' | 'slap' | 'stamp' | 'spit' | 'rain' | 'slide'

export interface PieceMeta {
  id: string
  name: string
  kind: Kind
  tone: string
  section: number
  region: number
  order: number
  travel: Travel
  /** landing time inside the region's build window (0..1), optional */
  at?: number
  /** hero travel length as a fraction of the region window (default: shared) */
  dur?: number
  /** parking spot, artboard px of the hero box' top-left: "x,y" */
  park?: string
  slot: HTMLElement
  alive: HTMLElement
  inner: HTMLElement
  shadow: HTMLElement
  trail: HTMLElement[]
}

export interface Pose {
  x: number
  y: number
  z: number
  /** billboard factor: 1 = standing up toward the camera */
  b: number
  rot: number
  sx: number
  sy: number
  op: number
  state: LifeState
  walk: boolean
  /** 0..1 metaball weight (still part of the bubble's goo) */
  ball: number
}

export interface Piece extends PieceMeta {
  /** slot top-left in world px (layout, untransformed) */
  sx: number
  sy: number
  w: number
  h: number
  /** travel window on the global progress */
  p0: number
  p1: number
  /** hero appears (drops in) over [in0, in1] */
  in0: number
  in1: number
  /** waiting pose (hero) or launch point (bubble), relative to the slot */
  wait: V3
  /** final resting rotation (stickers, stamps) */
  rest: number
  pose: Pose
  hz: number
  hv: number
  wob: number
  wv: number
  wave: number
  ph: number
  nextHop: number
  scx: number
  scy: number
  last: string
  lastSh: string
  lastOp: string
  lastSt: string
  lastWalk: string
  lastTrail: string
}

export interface TextMeta {
  id: string
  section: number
  region: number
  order: number
  mode: 'rise' | 'type' | 'pre'
  el: HTMLElement
  words: HTMLElement[]
  label: string
}
export interface TextBlock extends TextMeta {
  p0: number
  p1: number
  last: Int16Array
  y: number
  h: number
}

export interface RegionMeta {
  section: number
  index: number
  label: string
  el: HTMLElement
}
export interface Region extends RegionMeta {
  y: number
  h: number
}

/** per-section frame hook (marquee drift, flight path, counters, 3-D…) */
export interface FxEnv {
  p: number
  /** section-local progress 0..1 */
  u: number
  t: number
  dt: number
  section: number
  near: boolean
  /** region build progress 0..1 per region */
  reg: number[]
  /** p-window of a region's build */
  win: (region: number) => [number, number]
  piece: (id: string) => Piece | undefined
  reduced: boolean
  narrow: boolean
}
export interface Fx {
  id: string
  section: number
  update: (e: FxEnv) => void
  /** after layout + camera keys, before pieces are scheduled */
  measure?: (g: Geo) => void
}

export const pieces = new Map<string, Piece>()
export const texts = new Map<string, TextBlock>()
export const regions = new Map<string, Region>()
export const fxs = new Map<string, Fx>()

const STAND: Pose = { x: 0, y: 0, z: 0, b: 1, rot: 0, sx: 1, sy: 1, op: 1, state: 'roaming', walk: false, ball: 0 }

export function registerPiece(m: PieceMeta) {
  const c: Piece = {
    ...m,
    sx: 0,
    sy: 0,
    w: 0,
    h: 0,
    p0: 2,
    p1: 2,
    in0: -1,
    in1: -1,
    wait: { x: 0, y: 0, z: 0 },
    rest: 0,
    pose: { ...STAND },
    hz: 0,
    hv: 0,
    wob: 0,
    wv: 0,
    wave: 0,
    ph: Math.random() * Math.PI * 2,
    nextHop: 4 + Math.random() * 9,
    scx: 0,
    scy: 0,
    last: '',
    lastSh: '',
    lastOp: '',
    lastSt: '',
    lastWalk: '',
    lastTrail: '',
  }
  pieces.set(m.id, c)
  return () => {
    if (pieces.get(m.id) === c) pieces.delete(m.id)
  }
}

export function registerText(m: TextMeta) {
  const t: TextBlock = { ...m, p0: 2, p1: 2, last: new Int16Array(m.words.length).fill(-1), y: 0, h: 0 }
  texts.set(m.id, t)
  return () => {
    if (texts.get(m.id) === t) texts.delete(m.id)
  }
}

export function registerRegion(m: RegionMeta) {
  const key = `${m.section}:${m.index}`
  const r: Region = { ...m, y: 0, h: 0 }
  regions.set(key, r)
  return () => {
    if (regions.get(key) === r) regions.delete(key)
  }
}

export function registerFx(f: Fx) {
  fxs.set(f.id, f)
  return () => {
    if (fxs.get(f.id) === f) fxs.delete(f.id)
  }
}

/* --------------------------------------------------------------- easing */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a))
  return x * x * (3 - 2 * x)
}
export const range = (a: number, b: number, v: number) => clamp01((v - a) / (b - a))
export const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const inOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
export const outCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const outQuart = (t: number) => 1 - Math.pow(1 - t, 4)
export const outExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
export const inCubic = (t: number) => t * t * t
export const outBack = (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
/** damped spring step response, 0 → 1 with overshoot */
export const springOut = (t: number, f = 3.2, d = 5.5) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-d * t) * Math.cos(f * Math.PI * t))

/** stable pseudo-random per id */
export function rnd(seed: string, n: number) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  h = Math.imul(h ^ n, 2246822507)
  return ((h >>> 0) % 10000) / 10000
}

/* ----------------------------------------------------------------- pose */

function reset(p: Pose) {
  Object.assign(p, STAND)
  return p
}

/** 01 Hello's placed objects settle with a short, refined overshoot
 *  (≤ ~6%) instead of the rubbery cartoon squash of the other sections */
export const settleOf = (c: { section: number }) => (c.section === 0 ? 0.32 : 1)

function landSquash(p: Pose, t: number, amt: number) {
  if (t < 0.86) return
  const s = Math.sin(Math.PI * ((t - 0.86) / 0.14))
  p.sx *= 1 + 0.16 * s * amt
  p.sy *= 1 - 0.16 * s * amt
}

/**
 * Pose of a piece from the scroll alone (no idle life). Offsets are relative
 * to the slot's layout box; z lifts toward the camera.
 */
export function evalPose(c: Piece, p: number, peak: number) {
  const P = reset(c.pose)
  const k = c.p1 > c.p0 ? clamp01((p - c.p0) / (c.p1 - c.p0)) : p >= c.p1 ? 1 : 0
  const W = c.wait

  if (k >= 1) {
    P.b = 0
    P.rot = c.rest
    P.state = 'placed'
    return P
  }

  /* ------------------------------------------------ bubble-born */
  if (c.kind === 'bubble') {
    if (k <= 0) {
      P.op = 0
      P.b = 0
      P.state = 'inside'
      P.x = W.x
      P.y = W.y
      P.z = W.z
      return P
    }
    if (c.travel === 'slide') {
      // a long horizontal strip: glides in along its own axis, no arc
      const e = outCubic(k)
      P.x = lerp(W.x, 0, e)
      P.y = lerp(W.y, 0, e)
      P.z = 0
      P.op = smooth(0, 0.45, k)
      P.b = 0
      P.state = 'leaping'
      return P
    }
    if (c.travel === 'rain') {
      // confetti: tumbles down from the pop, sways, lands with a pat
      const e = outCubic(k)
      const sway = Math.sin(k * Math.PI * 3 + c.ph) * (1 - k) * 60
      P.x = lerp(W.x, 0, e) + sway
      P.y = lerp(W.y, 0, inOutQuad(k))
      P.z = lerp(W.z, 0, k * k)
      P.rot = (1 - k) * (rnd(c.id, 3) - 0.5) * 140 + c.rest * k
      const sc = lerp(0.55, 1, outBack(clamp01(k * 1.2), 1.6))
      P.sx = sc
      P.sy = sc
      P.op = smooth(0, 0.08, k)
      P.b = (1 - k) * 0.4
      landSquash(P, k, 0.8)
      P.state = 'leaping'
      return P
    }
    // spit: shot out of the bubble in a fast arc
    const e = outCubic(k)
    const dist = Math.hypot(W.x, W.y)
    const arc = (120 + dist * 0.22) * peak
    P.x = lerp(W.x, 0, e)
    P.y = lerp(W.y, 0, e)
    P.z = lerp(W.z, 0, k) + 4 * arc * k * (1 - k)
    const sf = settleOf(c)
    const sc = lerp(0.3, 1, clamp01(outBack(clamp01(k * 1.15), sf < 1 ? 0.9 : 2)))
    const air = Math.sin(Math.PI * k)
    P.sx = sc * (1 + 0.1 * air * sf)
    P.sy = sc * (1 - 0.06 * air * sf)
    P.rot = air * 10 * (c.order % 2 ? 1 : -1) + c.rest * k
    P.op = smooth(0, 0.07, k)
    P.ball = 1 - smooth(0, 0.3, k)
    P.b = (1 - smooth(0.4, 0.95, k)) * 0.5
    landSquash(P, k, 0.9 * sf)
    P.state = 'leaping'
    return P
  }

  /* ------------------------------------------------------- heroes */
  if (k <= 0) {
    P.x = W.x
    P.y = W.y
    P.z = W.z
    return P
  }
  const travel = c.travel
  if (travel === 'crawl') {
    const dist = Math.hypot(W.x, W.y) || 1
    const hf = Math.min(1, 140 / dist)
    const Hx = W.x * hf
    const Hy = W.y * hf
    if (k < 0.72) {
      const t = k / 0.72
      const e = inOut(t)
      P.x = lerp(W.x, Hx, e)
      P.y = lerp(W.y, Hy, e)
      P.z = lerp(W.z, 0, e) + Math.abs(Math.sin(t * Math.PI * 8)) * 6
      P.rot = Math.sin(t * Math.PI * 16) * 3
      P.walk = true
      P.state = 'roaming'
    } else {
      const t = (k - 0.72) / 0.28
      const e = inOut(t)
      P.x = lerp(Hx, 0, e)
      P.y = lerp(Hy, 0, e)
      P.z = 4 * 110 * peak * t * (1 - t)
      P.b = 1 - smooth(0.4, 0.96, t)
      P.rot = c.rest * e
      landSquash(P, t, 1.3)
      P.state = 'leaping'
    }
    return P
  }
  if (travel === 'slap' || travel === 'stamp') {
    // lifts off, sails over, then slams down flat with an overshoot
    const stamp = travel === 'stamp'
    if (k < 0.12) {
      const s = smooth(0, 1, k / 0.12)
      P.x = W.x
      P.y = W.y
      P.z = W.z
      P.sx = 1 + 0.14 * s
      P.sy = 1 - 0.14 * s
      P.state = 'roaming'
      return P
    }
    const t = (k - 0.12) / 0.88
    const e = inOut(t)
    P.x = lerp(W.x, 0, e)
    P.y = lerp(W.y, 0, e)
    const high = (stamp ? 260 : 220) * peak
    P.z = t < 0.78 ? lerp(W.z, high, outCubic(t / 0.78)) : high * (1 - inCubic((t - 0.78) / 0.22))
    const spin = stamp ? 0 : (rnd(c.id, 5) > 0.5 ? 1 : -1) * 180
    P.rot = lerp(spin, 0, outCubic(t)) + c.rest * e
    const grow = stamp ? 0.4 : 0.22
    const sc = 1 + grow * smooth(0.1, 0.7, t) * (1 - smooth(0.82, 1, t))
    P.sx = sc
    P.sy = sc
    P.b = 1 - smooth(0.2, 0.7, t)
    landSquash(P, t, stamp ? 1.6 : 1.2)
    P.state = 'leaping'
    return P
  }
  // leap: anticipation squash, big arc, land squash
  if (k < 0.15) {
    const s = smooth(0, 1, k / 0.15)
    P.x = W.x
    P.y = W.y
    P.z = W.z
    P.sx = 1 + 0.15 * s
    P.sy = 1 - 0.15 * s
    P.state = 'roaming'
    return P
  }
  const t = (k - 0.15) / 0.85
  const e = inOut(t)
  P.x = lerp(W.x, 0, e)
  P.y = lerp(W.y, 0, e)
  P.z = lerp(W.z, 0, t) + 4 * 230 * peak * t * (1 - t)
  const air = Math.sin(Math.PI * clamp01(t / 0.9))
  P.sx = 1 - 0.07 * air
  P.sy = 1 + 0.12 * air
  P.rot = air * 8 * (c.order % 2 ? 1 : -1) + c.rest * e
  P.b = 1 - smooth(0.5, 0.94, t)
  landSquash(P, t, 1.4 * settleOf(c))
  P.state = 'leaping'
  return P
}
