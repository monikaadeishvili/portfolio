/**
 * Geometry, camera and scheduling for /build — all pure functions of the
 * scroll progress, rebuilt from measured layout on resize.
 */
import type { Breakpoint } from '../scene/store'
import { offsetIn } from '../scene/layout'
import { fxs, inOut, lerp, outBack, pieces, regions, rnd, smooth, texts, clamp, clamp01, type Piece, type Region } from './runtime'
import { phOf, SEC, secP, TRN } from './worlds'

export type Lay = 'wide' | 'narrow'
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface CamPose {
  x: number
  y: number
  s: number
  rx: number
  rz: number
}
interface Key {
  u: number
  c: CamPose
}

export interface Geo {
  lay: Lay
  bp: Breakpoint
  narrow: boolean
  view: Rect
  FW: number
  boards: Rect[]
  regs: Region[][]
  keys: Key[][]
  /** p-windows of each region's build */
  wins: [number, number][][]
  sTilt: number
  sDesc: number
  tilt: { rx: number; rz: number }
  mascot: { x: number; y: number }
  /** bubble radius (world px) */
  R: number
  /** 01 Hello: where the bubble waits beside the scroll hint (world px) */
  hint0?: { x: number; y: number }
  peak: number
}

/* -------------------------------------------------------------- layout */

export function viewFor(bp: Breakpoint): { view: Rect; lay: Lay; fw: number } {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  let l: number, r: number, t: number, b: number
  if (bp === 'desk') [l, r, t, b] = [12 + 240 + 28, 12 + 248 + 28, 12 + 48 + 34, 112]
  else if (bp === 'tab') [l, r, t, b] = [24, 12 + 248 + 24, 12 + 48 + 30, 108]
  else [l, r, t, b] = [12, 12, 10 + 44 + 26, 92]
  const view = { x: l, y: t, w: Math.max(240, vw - l - r), h: Math.max(320, vh - t - b) }
  const lay: Lay = view.w >= 640 ? 'wide' : 'narrow'
  const fw = lay === 'wide' ? 1120 : Math.round(clamp(view.w * 1.02, 360, 540))
  return { view, lay, fw }
}

/* ------------------------------------------------------------- camera */

const ZERO: CamPose = { x: 0, y: 0, s: 1, rx: 0, rz: 0 }

function mixPose(a: CamPose, b: CamPose, t: number, out: CamPose) {
  out.x = lerp(a.x, b.x, t)
  out.y = lerp(a.y, b.y, t)
  out.s = Math.exp(lerp(Math.log(a.s), Math.log(b.s), t))
  out.rx = lerp(a.rx, b.rx, t)
  out.rz = lerp(a.rz, b.rz, t)
  return out
}

function keysAt(keys: Key[], u: number, out: CamPose) {
  if (u <= keys[0].u) return Object.assign(out, keys[0].c)
  for (let k = 1; k < keys.length; k++) {
    if (u <= keys[k].u) {
      const a = keys[k - 1]
      const b = keys[k]
      return mixPose(a.c, b.c, inOut((u - a.u) / (b.u - a.u || 1)), out)
    }
  }
  return Object.assign(out, keys[keys.length - 1].c)
}

/** transition shapes: when the bubble leaves (m0) and how the camera chases it */
export const TR_SHAPE = [
  { m0: 0.42, lag: 0.05, over: 1.25, dip: 0.34 }, // nightfall roll
  { m0: 0.4, lag: 0.035, over: 1.9, dip: 0.24 }, // slingshot
  { m0: 0.3, lag: 0.05, over: 1.1, dip: 0.3 }, // split & race
  { m0: 0.22, lag: 0.06, over: 0.9, dip: 0.36 }, // balloon
]
/** charge-up camera push + shake amplitude per transition, 0..1 */
export function chargeOf(i: number, u: number) {
  const m0 = TR_SHAPE[i].m0
  return smooth(0.04, m0, u) * (1 - smooth(m0, m0 + 0.06, u))
}

const tmpA: CamPose = { ...ZERO }
const tmpB: CamPose = { ...ZERO }

export function camAt(g: Geo, p: number, out: CamPose) {
  for (let i = 0; i < 4; i++) {
    const [t0, t1] = TRN[i]
    if (p > t0 && p < t1) {
      const u = (p - t0) / (t1 - t0)
      keysAt(g.keys[i], 1, tmpA)
      keysAt(g.keys[i + 1], 0, tmpB)
      const S = TR_SHAPE[i]
      const v = clamp01((u - S.m0 - S.lag) / (1 - S.m0 - S.lag))
      const e = v < 1 ? clamp(outBack(inOut(v) * 0.6 + v * 0.4, S.over), -0.2, 1.3) : 1
      out.x = lerp(tmpA.x, tmpB.x, e)
      out.y = lerp(tmpA.y, tmpB.y, e)
      const sm = smooth(0, 1, v)
      out.s = Math.exp(lerp(Math.log(tmpA.s), Math.log(tmpB.s), sm)) * (1 - S.dip * Math.sin(Math.PI * v))
      out.rx = lerp(tmpA.rx, tmpB.rx, sm)
      out.rz = lerp(tmpA.rz, tmpB.rz, sm)
      // charge-up: lean in toward the bubble (the loop adds the time-based shake)
      const ch = chargeOf(i, u)
      if (ch > 0 && !g.narrow) out.s *= 1 + 0.07 * ch
      return out
    }
  }
  let i = 0
  for (let k = 0; k < 5; k++) if (p >= SEC[k][0] - 1e-9) i = k
  const u = (p - SEC[i][0]) / (SEC[i][1] - SEC[i][0])
  return keysAt(g.keys[i], u, out)
}

/** bubble host spot while a section builds: beside the artboard, near the camera */
export function hostAt(g: Geo, i: number, cam: CamPose, out: { x: number; y: number; z: number }) {
  const b = g.boards[i]
  const visH = g.view.h / cam.s
  if (g.narrow) {
    out.x = b.x + g.FW - 52
    out.y = clamp(cam.y - visH * 0.33, b.y + 90, b.y + b.h - 120)
    out.z = 150
    // 01 Hello: low on the right, beside the CTA and clear of the portrait card
    const r0 = i === 0 ? g.regs[0]?.[0] : undefined
    if (r0) {
      const r0b = b.y + r0.y + r0.h
      const k = 1 - smooth(r0b - 160, r0b + 200, cam.y)
      out.y = lerp(out.y, r0b - 52, k)
      out.x = lerp(out.x, b.x + g.FW - 26, k)
    }
  } else {
    // beside the artboard, but never under the inspector
    const maxX = cam.x + (g.view.w / 2 - g.R * cam.s * 1.5 - 26) / cam.s
    out.x = Math.min(b.x + g.FW + 150, maxX)
    out.y = clamp(cam.y - visH * 0.26, b.y + 150, b.y + b.h - 160)
    // 01 Hello: on the hero, wait in its top-right gutter; below it, in the
    // still-empty bottom-right corner of the board
    const r0 = i === 0 ? g.regs[0]?.[0] : undefined
    if (r0) {
      const r0b = b.y + r0.y + r0.h
      const k = 1 - smooth(r0b - 140, r0b + 240, cam.y)
      // on the hero the board fills the canvas: wait in its clear top-right
      // gutter, under the role caption and clear of headline, portrait and pill
      out.x = lerp(out.x, b.x + g.FW - 140, k)
      out.y = lerp(out.y, b.y + r0.y + 336, k)
      // below the hero the board fills the free canvas (no room beside it):
      // wait inside its still-empty bottom-right corner, where the close lands
      out.x = lerp(b.x + g.FW - 112, out.x, k)
      out.y = lerp(b.y + b.h - 150, out.y, k)
    }
    out.z = 110
  }
  return out
}

/* ---------------------------------------------------------- projection */

export interface Proj {
  x: number
  y: number
  /** perspective factor (screen px per world px incl. camera scale) */
  f: number
}
/** world point → viewport px, matching the CSS world transform + perspective */
export function project(g: Geo, c: CamPose, X: number, Y: number, Z: number, out: Proj, persp = 2200) {
  const cx = g.view.x + g.view.w / 2
  const cy = g.view.y + g.view.h / 2
  const s = c.s
  let x = (X - c.x) * s
  let y = (Y - c.y) * s
  let z = Z * s
  const rz = (c.rz * Math.PI) / 180
  const rx = (c.rx * Math.PI) / 180
  const x1 = x * Math.cos(rz) - y * Math.sin(rz)
  const y1 = x * Math.sin(rz) + y * Math.cos(rz)
  x = x1
  y = y1 * Math.cos(rx) - z * Math.sin(rx)
  z = y1 * Math.sin(rx) + z * Math.cos(rx)
  const f = persp / Math.max(200, persp - z)
  out.x = cx + x * f
  out.y = cy + y * f
  out.f = f * s
  return out
}

/** viewport px → world point on the z = 0 plane (inverse of `project`) */
export function unproject(g: Geo, c: CamPose, sx: number, sy: number, out: { x: number; y: number }, persp = 2200) {
  const cx = g.view.x + g.view.w / 2
  const cy = g.view.y + g.view.h / 2
  const a = sx - cx
  const b = sy - cy
  const rx = (c.rx * Math.PI) / 180
  const rz = (c.rz * Math.PI) / 180
  const y1 = (b * persp) / (persp * Math.cos(rx) + b * Math.sin(rx))
  const f = persp / Math.max(200, persp - y1 * Math.sin(rx))
  const x1 = a / f
  const x = x1 * Math.cos(rz) + y1 * Math.sin(rz)
  const y = -x1 * Math.sin(rz) + y1 * Math.cos(rz)
  out.x = c.x + x / c.s
  out.y = c.y + y / c.s
  return out
}

/* ------------------------------------------------------------- measure */

export function measure(world: HTMLElement, boardsEl: HTMLElement[], bp: Breakpoint): Geo {
  const { view, lay, fw: FW } = viewFor(bp)
  const narrow = lay === 'narrow'
  const boards = boardsEl.map((f) => ({ x: f.offsetLeft, y: f.offsetTop, w: f.offsetWidth, h: f.offsetHeight }))
  boardsEl.forEach((f, i) => {
    const b = f.querySelector('.bf-size')
    if (b) b.textContent = `${boards[i].w} × ${boards[i].h}`
  })
  const regs: Region[][] = [[], [], [], [], []]
  regions.forEach((r) => {
    const o = offsetIn(r.el, boardsEl[r.section])
    r.y = o.y
    r.h = o.h
    regs[r.section].push(r)
  })
  regs.forEach((l) => l.sort((a, b) => a.index - b.index))

  // tilted views: width-fit, but capped by height so on wide, short windows the
  // heroes parked above the artboard stay clear of the top bar
  const sTilt = narrow ? (view.w * 0.8) / FW : Math.min(view.w * 0.66, view.h * 1.0) / FW
  const sDesc = narrow ? (view.w * 0.86) / FW : Math.min(1.1, (view.w * 0.66) / FW)
  const tilt = narrow ? { rx: 30, rz: -4 } : { rx: 40, rz: -6 }
  const sHold = (h: number) => (narrow ? Math.min((view.w * 0.94) / FW, (view.h * 0.94) / h) : Math.min(1.25, (view.w * 0.8) / FW, (view.h * 0.9) / h))
  // 01 Hello reads at a glance: its flat holds fill the free canvas between the
  // panels (16px margins), height permitting
  const vw0 = document.documentElement.clientWidth
  const vh0 = window.innerHeight
  const free = { w: vw0 - (bp === 'desk' ? 252 : 0) - (bp !== 'mob' ? 260 : 0) - 32, h: vh0 - 62 - (bp === 'mob' ? 72 : 121) - 24 } // top bar · dock (two rows on desktop/tablet) · margins
  const fit0 = (h: number) => Math.min(1.25, free.w / FW, free.h / h)

  pieces.forEach((c) => {
    const o = offsetIn(c.slot, world)
    c.sx = o.x
    c.sy = o.y
    c.w = o.w
    c.h = o.h
  })
  // vertical extent of each lower region's parked heroes (artboard px)
  const parkSpan = (i: number, r: number): [number, number] | null => {
    let lo = Infinity
    let hi = -Infinity
    pieces.forEach((c) => {
      if (c.section !== i || c.region !== r || c.kind !== 'hero' || !c.park) return
      const [, py] = parsePark(c.park, { FW, boards, regs } as Geo, i, r, c)
      lo = Math.min(lo, py)
      hi = Math.max(hi, py + c.h + 30)
    })
    return lo < hi ? [lo, hi] : null
  }
  const keys: Key[][] = []
  const wins: [number, number][][] = []
  for (let i = 0; i < 5; i++) {
    const PH = phOf(i)
    const b = boards[i]
    const rs = regs[i].length ? regs[i] : [{ y: 0, h: b.h } as Region]
    const cxw = b.x + FW / 2
    const r0 = rs[0]
    const ty = b.y + r0.y + r0.h * (narrow ? 0.5 : 0.52)
    // the very first view sits closer: the page and its heroes fill the canvas
    const sT = i === 0 && !narrow ? sTilt * 1.12 : sTilt
    // aim a little above the region's centre: the board sits lower in the frame,
    // leaving headroom for the heroes parked above it
    const tiltPose = (s: number, rz: number): CamPose => ({ x: cxw, y: ty - (narrow ? 0 : 44), s, rx: tilt.rx, rz })
    const big = i === 0 && !narrow
    // 01 Hello: the frame from just above the artboard's top edge to a peek of the region below
    const fH = r0.y + r0.h + 34
    const flat: CamPose = big ? { x: cxw, y: b.y - 16 + fH / 2, s: fit0(fH), rx: 0, rz: 0 } : { x: cxw, y: b.y + r0.y + r0.h / 2, s: Math.min(sHold(r0.h), sDesc * 1.25), rx: 0, rz: 0 }
    const K: Key[] = [
      { u: 0, c: tiltPose(sT * 0.94, tilt.rz + 4) },
      { u: PH.arrive, c: tiltPose(sT, tilt.rz) },
      { u: PH.topEnd, c: tiltPose(sT * 1.04, tilt.rz - 3) },
      { u: PH.flat, c: flat },
      { u: PH.descStart, c: { ...flat } },
    ]
    const W: [number, number][] = [[secP(i, PH.arrive * (i === 0 ? 0.4 : 1)), secP(i, PH.topEnd)]]
    const n = rs.length - 1
    const wt = rs.map((r) => Number(r.el?.dataset.weight ?? 1) || 1)
    const wsum = wt.slice(1).reduce((a, b2) => a + b2, 0) || 1
    let a = PH.descStart
    for (let r = 1; r <= n; r++) {
      const reg = rs[r]
      const w = ((PH.descEnd - PH.descStart) * wt[r]) / wsum
      const yc = b.y + reg.y + reg.h / 2
      // frame the region together with the heroes waiting for it
      const ps = parkSpan(i, r)
      const sD = big ? fit0(reg.h + 120) : sDesc
      const visD = view.h / sD
      let yBuild = yc
      if (ps) {
        const lo = Math.min(reg.y, ps[0])
        const hi = Math.max(reg.y + reg.h, ps[1])
        yBuild = b.y + (lo + hi) / 2
        // keep the region's top in view
        yBuild = Math.min(yBuild, b.y + reg.y + visD * 0.5 - 40)
      }
      if (reg.el?.dataset.pan != null) {
        // a pan region: the camera glides in, then holds flat and fitted while
        // the region's content travels sideways (the section's fx drives it)
        const sP = narrow ? Math.min((view.w * 0.96) / FW, (view.h * 0.94) / reg.h) : Math.min(1.25, free.w / FW, free.h / reg.h)
        K.push({ u: a + w * 0.08, c: { x: cxw, y: yc, s: sP, rx: 0, rz: 0 } })
        K.push({ u: a + w * 0.96, c: { x: cxw, y: yc, s: sP, rx: 0, rz: 0 } })
      } else {
        K.push({ u: a + w * 0.3, c: { x: cxw, y: yBuild, s: sD, rx: narrow ? 6 : 10, rz: 0 } })
        K.push({ u: a + w * 0.92, c: { x: cxw, y: yBuild, s: sD, rx: 2, rz: 0 } })
      }
      W.push([secP(i, a + w * 0.16), secP(i, a + w * 1.02)])
      a += w
    }
    const lastR = rs[rs.length - 1]
    // hold: the last region, with the artboard's bottom edge resting low in
    // the frame (contact leaves room for the crowd along the bottom edge)
    const extra = i === 4 ? (narrow ? 90 : 170) : 0
    const holdS = big ? fit0(lastR.h + 90) : sHold(lastR.h + extra)
    const visH = view.h / holdS
    const bottomAnchor = b.y + b.h + extra - visH * 0.5 + (narrow ? 20 : 40)
    const holdY = Math.min(bottomAnchor, b.y + lastR.y + visH * 0.5 - 30)
    K.push({ u: PH.descEnd + 0.035, c: { x: cxw, y: holdY, s: holdS, rx: 0, rz: 0 } })
    K.push({ u: 1, c: { x: cxw, y: holdY, s: holdS, rx: 0, rz: 0 } })
    keys.push(K)
    wins.push(W)
  }

  const mascotEl = world.querySelector<HTMLElement>('.f5-mascot-spot')
  let mascot = { x: boards[4].x + FW / 2, y: boards[4].y + boards[4].h - 200 }
  if (mascotEl) {
    const o = offsetIn(mascotEl, world)
    mascot = { x: o.x + o.w / 2, y: o.y + o.h / 2 }
  }

  const g: Geo = {
    lay,
    bp,
    narrow,
    view,
    FW,
    boards,
    regs,
    keys,
    wins,
    sTilt,
    sDesc,
    tilt,
    mascot,
    R: narrow ? 46 : 70,
    peak: narrow ? 0.6 : 1,
  }

  texts.forEach((t) => {
    const o = offsetIn(t.el, world)
    t.y = o.y
    t.h = o.h
  })
  fxs.forEach((f) => f.measure?.(g))
  schedule(g)
  return g
}

/* ------------------------------------------------------------ schedule */

const cam0: CamPose = { ...ZERO }
const host0 = { x: 0, y: 0, z: 0 }

function schedule(g: Geo) {
  for (let i = 0; i < 5; i++) {
    const b = g.boards[i]
    g.wins[i].forEach(([A, B], r) => {
      const L = B - A
      const inReg = <T extends { section: number; region: number; order: number }>(m: Map<string, T>) =>
        [...m.values()].filter((c) => c.section === i && c.region === r).sort((a, b2) => a.order - b2.order)

      /* texts: rise / typewriter as the region builds */
      inReg(texts).forEach((t, j) => {
        if (t.mode === 'pre') {
          t.p0 = -2
          t.p1 = -1
          return
        }
        const d = t.mode === 'type' ? 0.34 : 0.2
        t.p0 = A + L * (0.01 + j * 0.09)
        t.p1 = t.p0 + L * d
      })

      const list = inReg(pieces)
      /* heroes: never more than two in flight */
      const heroes = list.filter((c) => c.kind === 'hero')
      const nh = heroes.length
      const h0 = A + L * 0.14
      const hEnd = B - L * 0.02
      let dH = L * 0.34
      let gap = nh > 1 ? (hEnd - dH - h0) / (nh - 1) : 0
      if (nh > 1 && gap < dH * 0.52) {
        dH = (hEnd - h0) / (1 + 0.52 * (nh - 1))
        gap = dH * 0.52
      }
      heroes.forEach((c, j) => {
        const d = c.dur != null ? c.dur * L : dH
        if (c.at != null) {
          c.p1 = A + c.at * L
          c.p0 = c.p1 - d
        } else {
          c.p0 = h0 + j * gap
          c.p1 = c.p0 + d
        }
        c.rest = c.travel === 'slap' ? (rnd(c.id, 9) - 0.5) * 14 : c.travel === 'stamp' ? (rnd(c.id, 9) - 0.5) * 16 : 0
        // appear: dropped in as the section (or its region) arrives
        if (i === 0 && r === 0) {
          c.in0 = -1
          c.in1 = -1
        } else {
          // drop in as the camera arrives, settle before the first one leaves
          c.in0 = r === 0 ? SEC[i][0] - 0.006 + j * 0.0015 : A - L * 0.3 + j * 0.002
          c.in1 = r === 0 ? c.in0 + 0.012 : A + L * 0.06 + j * 0.002
        }
        const [px, py] = parsePark(c.park, g, i, r, c)
        c.wait = { x: b.x + px - c.sx, y: b.y + py - c.sy, z: 0 }
      })

      /* bubble-born: popcorn rhythm, at most three in the air */
      const born = list.filter((c) => c.kind === 'bubble')
      const nb = born.length
      const s0 = A + L * 0.04
      const sEnd = B - L * 0.06
      let dB = Math.min(L * 0.17, 0.012)
      let gb = nb > 1 ? (sEnd - dB - s0) / (nb - 1) : 0
      if (nb > 1 && gb < (dB / 3) * 1.35) {
        dB = Math.max(0.002, ((sEnd - s0) / (1 + (0.45 * (nb - 1)))) )
        gb = nb > 1 ? (sEnd - dB - s0) / (nb - 1) : 0
      }
      born.forEach((c, j) => {
        const jit = nb > 1 ? (rnd(c.id, 4) - 0.5) * 0.3 * gb : 0
        if (c.at != null) {
          c.p1 = A + c.at * L
          c.p0 = c.p1 - dB
        } else {
          c.p0 = s0 + j * gb + jit
          c.p1 = c.p0 + dB
        }
        c.rest = c.travel === 'rain' ? (rnd(c.id, 9) - 0.5) * 6 : 0
        const cx = c.sx + c.w / 2
        const cy = c.sy + c.h / 2
        if (c.travel === 'slide') {
          c.wait = { x: Math.min(260, g.FW * 0.24), y: 0, z: 0 }
        } else if (c.travel === 'rain') {
          c.wait = { x: (rnd(c.id, 7) - 0.5) * 360, y: -760 * g.peak - c.h, z: 380 * g.peak }
        } else {
          camAt(g, c.p0, cam0)
          hostAt(g, i, cam0, host0)
          c.wait = { x: host0.x - cx, y: host0.y - cy, z: host0.z - c.h * 0.3 }
        }
      })
    })
  }
}

/**
 * Parking spot "x,y" in artboard px of the hero box' top-left. x is from the
 * artboard's left edge; y is relative to the hero's region top, or "n+N" (next
 * region top), or "b+N" (artboard bottom).
 */
function parsePark(spec: string | undefined, g: Geo, i: number, r: number, c: Piece): [number, number] {
  const b = g.boards[i]
  const reg = g.regs[i][r]
  const fallback: [number, number] = [g.FW + 40, c.sy - b.y]
  if (!spec) return fallback
  const [xs, ys] = spec.split(',').map((v) => v.trim())
  const x = Number(xs)
  let y: number
  if (ys.startsWith('b')) y = b.h + Number(ys.slice(1))
  else if (ys.startsWith('n')) {
    const nx = g.regs[i][r + 1]
    y = (nx ? nx.y : b.h) + Number(ys.slice(1))
  } else y = (reg ? reg.y : 0) + Number(ys)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return fallback
  return [x, y]
}

/** region build progress (for chrome + fx) */
export function regionProgress(g: Geo, i: number, r: number, p: number) {
  const w = g.wins[i]?.[r]
  if (!w) return 0
  return clamp01((p - w[0]) / (w[1] - w[0]))
}

