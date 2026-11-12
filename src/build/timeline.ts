/**
 * One scrubbed timeline for Page 2 (duration 1 == scroll progress), rebuilt
 * from measured layout on resize. Only plain scalars and a few DOM props are
 * tweened, always with explicit from-values so rebuilding mid-scroll is exact.
 */
import { gsap } from '../scene/gsap'
import { comps, type V3 } from './runtime'
import type { Lay } from './frames'

/* chapter segments on the scroll (weights per chapter) */
export const SEG = [0, 0.19, 0.38, 0.61, 0.82, 1]
export const segAt = (i: number, u: number): number => {
  if (u > 1 && i < 4) return segAt(i + 1, u - 1)
  return SEG[i] + u * (SEG[i + 1] - SEG[i])
}
export const span = (i: number, u0: number, u1: number) => segAt(i, u1) - segAt(i, u0)
export const chapterAt = (p: number) => {
  let c = 0
  for (let i = 0; i < 5; i++) if (p >= SEG[i] - 1e-6) c = i
  return c
}
/** where a click on the ruler lands: the finished, resolved frame */
export const HOLD_U = 0.7
export const holdOf = (i: number) => (i === 0 ? segAt(0, 0.7) : segAt(i, HOLD_U))

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Geo {
  lay: Lay
  /** avail rect on screen (between chrome) */
  view: Rect
  frames: Rect[]
  fits: number[]
  parks: V3[]
  mascot: V3
  mascotR: number
  tilt: { rx: number; rz: number; iso: number }
}

export const cam = { x: 0, y: 0, s: 1, rx: 0, rz: 0 }
export const bub = { t: 0, home: 0, swap: 0, intro: 1 }
export const R0 = 62

interface Pose3 {
  x: number
  y: number
  s: number
  rx: number
  rz: number
}

export function isoPose(g: Geo, i: number): Pose3 {
  const f = g.frames[i]
  const narrow = g.lay === 'narrow'
  return {
    x: f.x + f.w * (narrow ? 0.5 : 0.52),
    y: f.y + f.h * (narrow ? 0.54 : 0.58),
    s: g.fits[i] * g.tilt.iso,
    rx: g.tilt.rx,
    rz: g.tilt.rz,
  }
}
export function flatPose(g: Geo, i: number): Pose3 {
  const f = g.frames[i]
  return { x: f.x + f.w / 2, y: f.y + f.h / 2, s: g.fits[i], rx: 0, rz: 0 }
}
function departPose(g: Geo, i: number): Pose3 {
  const f = g.frames[i]
  const P = g.parks[i]
  const iso = isoPose(g, i)
  return {
    x: lerp(f.x + f.w / 2, P.x, 0.42),
    y: lerp(f.y + f.h / 2, P.y, 0.3),
    s: g.fits[i] * g.tilt.iso * 0.92,
    rx: iso.rx,
    rz: iso.rz + 7,
  }
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** stable pseudo-random per component */
function rnd(seed: string, n: number) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  h = Math.imul(h ^ n, 2246822507)
  return ((h >>> 0) % 10000) / 10000
}

/** waiting spots around/above the frame, relative to each slot */
export function placeWaiting(g: Geo) {
  const narrow = g.lay === 'narrow'
  comps.forEach((c) => {
    const f = g.frames[c.chapter]
    const cx = c.sx - f.x + c.w / 2
    const cy = c.sy - f.y + c.h / 2
    const j1 = rnd(c.id, 1) - 0.5
    const j2 = rnd(c.id, 2)
    const big = Math.max(c.w, c.h)
    let tx = cx
    let ty = cy
    let tz = 0
    if (c.travel === 'drop') {
      // stacked so the hero heading stays readable while everything waits
      const isNav = c.name === 'NavBar'
      const isPara = c.name === 'Paragraph'
      tx = cx + j1 * 60 + (isPara && !narrow ? -f.w * 0.26 : 0)
      ty = cy - 30 - j2 * 40 - (isNav ? (narrow ? 60 : 150) : 0) + (isPara ? (narrow ? 40 : 80) : 0)
      tz = (narrow ? 160 : 220) + (isNav ? 120 : isPara ? -60 : (c.order % 3) * (narrow ? 30 : 50)) + j2 * 30
    } else if (c.travel === 'leap') {
      // outside the frame along the direction from its centre
      const dx = cx - f.w / 2
      const dy = cy - f.h / 2
      const d = Math.hypot(dx, dy) || 1
      let ux = dx / d
      let uy = dy / d
      if (narrow) {
        ux *= 0.3
        uy = uy >= 0 ? 1 : -1
      }
      const toEdge = Math.min(ux ? (f.w / 2) / Math.abs(ux) : 1e9, uy ? (f.h / 2) / Math.abs(uy) : 1e9)
      const m = (narrow ? 40 : 60) + Math.min(big, 220) * 0.25 + j2 * 40
      tx = f.w / 2 + ux * (toEdge + m) + -uy * j1 * 120
      ty = f.h / 2 + uy * (toEdge + m) + ux * j1 * 120
      tz = c.order % 2 ? 0 : narrow ? 30 : 70
      // keep big leapers inside the shot (the inspector covers the far right)
      if (!narrow) tx = Math.max(-f.w * 0.2, Math.min(f.w * 1.06, tx))
    } else {
      // scurry: on the canvas just outside the nearest edge
      const edges = narrow
        ? [
            { e: 'b', d: f.h - cy },
            { e: 't', d: cy + 40 },
          ]
        : [
            { e: 'l', d: cx },
            { e: 'r', d: f.w - cx },
            { e: 'b', d: f.h - cy },
            { e: 't', d: cy + 120 },
          ]
      edges.sort((a, b) => a.d - b.d)
      const e = edges[0].e
      const m = 46 + c.h * 0.5 + j2 * 40
      if (e === 'l') {
        tx = -m - c.w * 0.5
        ty = cy + j1 * 90
      } else if (e === 'r') {
        tx = f.w + m + c.w * 0.5
        ty = cy + j1 * 90
      } else if (e === 'b') {
        tx = cx + j1 * 120
        ty = f.h + m
      } else {
        tx = cx + j1 * 120
        ty = -m
      }
    }
    c.wait = { x: tx - cx, y: ty - cy, z: tz }
  })
  // reused instances: source slot + bubble park points
  comps.forEach((c) => {
    c.src = null
    c.bubIn = null
    c.bubOut = null
    if (!c.from) return
    const s = comps.get(c.from)
    if (!s || s.chapter !== c.chapter - 1) return
    c.src = { x: s.sx - c.sx, y: s.sy - c.sy, z: 0 }
    const PI = g.parks[c.chapter - 1]
    const PO = g.parks[c.chapter]
    const ccx = c.sx + c.w / 2
    const ccy = c.sy + c.h / 2
    c.bubIn = { x: PI.x - ccx, y: PI.y - ccy, z: PI.z - c.h * 0.2 }
    c.bubOut = { x: PO.x - ccx, y: PO.y - ccy, z: PO.z - c.h * 0.2 }
  })
}

function byChapter(i: number) {
  return [...comps.values()].filter((c) => c.chapter === i).sort((a, b) => (a.hero ? 1 : 0) - (b.hero ? 1 : 0) || a.order - b.order)
}

export interface BuildRefs {
  frames: HTMLElement[]
  mascot: HTMLElement | null
}

export function resetState(g: Geo) {
  Object.assign(cam, isoPose(g, 0))
  bub.t = 0
  bub.home = 0
  bub.swap = 0
  comps.forEach((c) => {
    c.t.k = 0
    c.t.d = 0
    c.t.q = 0
  })
}

export function buildTimeline(g: Geo, r: BuildRefs) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none', immediateRender: false } })
  tl.set({}, {}, 0).set({}, {}, 1)
  resetState(g)
  const narrow = g.lay === 'narrow'

  for (let i = 0; i < 5; i++) {
    const list = byChapter(i)
    const frameEl = r.frames[i]
    const iso = isoPose(g, i)
    const flat = flatPose(g, i)

    /* ---- pour: reused instances leave the bubble */
    const reused = list.filter((c) => c.src)
    reused.forEach((c, j) => {
      tl.fromTo(c.t, { q: 0 }, { q: 1, duration: span(i, 0, 0.075) }, segAt(i, 0.05 + j * 0.022))
    })

    /* ---- assemble: staggered, overlapping, never in unison */
    const A0 = i === 0 ? 0.05 : 0.17
    const A1 = 0.47
    const n = list.length
    list.forEach((c, j) => {
      const dur = c.hero ? 0.13 : c.travel === 'scurry' ? 0.11 : 0.085
      const at = A0 + (A1 - A0 - dur) * (n > 1 ? j / (n - 1) : 0)
      tl.fromTo(c.t, { k: 0 }, { k: 1, duration: span(i, at, at + dur) }, segAt(i, at))
      c.land = segAt(i, at + dur)
    })

    /* ---- camera: drift while assembling, expo to flat, back to iso to leave */
    if (i === 0) Object.assign(cam, iso)
    const drift = { ...iso, rz: iso.rz + (narrow ? 4 : 7), s: iso.s * 1.04 }
    const r0 = i === 4 ? 0.55 : 0.475
    tl.fromTo(cam, { ...iso }, { ...drift, duration: span(i, 0.1, r0), ease: 'sine.inOut' }, segAt(i, 0.1))
    tl.fromTo(cam, { ...drift }, { ...flat, duration: span(i, r0, r0 + 0.1), ease: 'expo.inOut' }, segAt(i, r0))

    /* ---- layer sheets: rise on arrival, collapse into the frame */
    const sheets = Array.from(frameEl.querySelectorAll<HTMLElement>('.bf-sheet'))
    const zs = narrow ? [46, 92, 138] : [70, 140, 210]
    sheets.forEach((sh, k) => {
      gsap.set(sh, { z: i === 0 ? zs[k] : 0, opacity: i === 0 ? 1 : 0 })
      sh.dataset.z = String(zs[k])
      if (i > 0) tl.fromTo(sh, { z: 0, opacity: 0 }, { z: zs[k], opacity: 1, duration: span(i, 0, 0.1), ease: 'power3.out' }, segAt(i, 0.02 + k * 0.025))
      // each sheet fades once the pieces that fall through it have landed
      const out = [0.45, 0.36, 0.27][k]
      tl.fromTo(sh, { opacity: 1 }, { opacity: 0, duration: span(i, 0, 0.05), ease: 'power1.out' }, segAt(i, out))
      tl.fromTo(sh, { z: zs[k] }, { z: 0, duration: span(i, 0, 0.05), ease: 'power2.inOut' }, segAt(i, out + 0.05))
    })

    /* ---- headline: words rise through masks as the heading lands */
    const head = list.find((c) => c.name === 'Heading')
    if (head && i > 0) {
      const words = Array.from(head.slot.querySelectorAll<HTMLElement>('.w-in'))
      const skel = head.slot.querySelector('.u-h-skel')
      gsap.set(words, { yPercent: 118, rotation: 7 })
      gsap.set(skel, { opacity: 1 })
      const at = head.land - span(i, 0, 0.012)
      tl.fromTo(words, { yPercent: 118, rotation: 7 }, { yPercent: 0, rotation: 0, duration: span(i, 0, 0.05), stagger: span(i, 0, 0.006), ease: 'back.out(1.6)' }, at)
      tl.fromTo(skel, { opacity: 1 }, { opacity: 0, duration: span(i, 0, 0.02) }, at)
    }

    /* ---- per-frame specials */
    list.forEach((c) => {
      const land = c.land
      if (c.id === 'f2-route') {
        // the flight path draws itself and a little plane flies it
        const draw = c.slot.querySelector<SVGPathElement>('.u-map-draw')
        const plane = c.slot.querySelector<SVGGElement>('.u-map-plane')
        if (draw && plane) {
          const total = draw.getTotalLength()
          const fly = { t: 0 }
          const place = () => {
            const k = fly.t
            const pt = draw.getPointAtLength(total * k)
            const pt2 = draw.getPointAtLength(Math.min(total, total * k + 1))
            const ang = (Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180) / Math.PI
            plane.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${ang.toFixed(1)})`)
            plane.style.opacity = k <= 0.001 ? '0' : '1'
          }
          gsap.set(draw, { strokeDashoffset: 1 })
          place()
          tl.fromTo(draw, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: span(i, 0, 0.12), ease: 'power2.inOut' }, land)
          tl.fromTo(fly, { t: 0 }, { t: 1, duration: span(i, 0, 0.12), ease: 'power2.inOut', onUpdate: place }, land)
        }
      }
      if (c.id.startsWith('f3-c')) {
        const tick = c.slot.querySelector('.u-check-tick')
        const fill = c.slot.querySelector('.u-check-fill')
        gsap.set(tick, { strokeDashoffset: 1 })
        gsap.set(fill, { opacity: 0 })
        tl.fromTo(fill, { opacity: 0 }, { opacity: 1, duration: span(i, 0, 0.012) }, land + span(i, 0, 0.004))
        tl.fromTo(tick, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: span(i, 0, 0.028), ease: 'power2.out' }, land + span(i, 0, 0.008))
      }
      if (c.id.startsWith('f4-s')) {
        const cnt = c.slot.querySelector<HTMLElement>('.u-count')
        if (cnt) {
          const target = Number(cnt.dataset.count)
          const obj = { v: 0 }
          cnt.textContent = '0'
          tl.fromTo(obj, { v: 0 }, { v: target, duration: span(i, 0, 0.06), ease: 'power2.out', onUpdate: () => (cnt.textContent = String(Math.round(obj.v))) }, land)
        }
      }
    })

    if (i < 4) {
      /* ---- depart: reused pieces pop off and dive into the bubble */
      const next = byChapter(i + 1).filter((c) => c.src)
      next.forEach((c, j) => {
        tl.fromTo(c.t, { d: 0 }, { d: 1, duration: span(i, 0, 0.07) }, segAt(i, 0.825 + j * 0.016))
      })
      const dep = departPose(g, i)
      tl.fromTo(cam, { ...flat }, { ...dep, duration: span(i, 0.81, 0.9), ease: 'power3.inOut' }, segAt(i, 0.81))
      /* ---- the bubble rolls to the next frame; the camera tracks it */
      const q0 = segAt(i, 0.9)
      const q1 = segAt(i + 1, 0.06)
      tl.fromTo(bub, { t: i }, { t: i + 1, duration: q1 - q0, ease: 'power1.inOut' }, q0)
      tl.fromTo(cam, { ...dep }, { ...isoPose(g, i + 1), duration: q1 - q0, ease: 'power1.inOut' }, q0)
    } else {
      /* ---- last pieces out; the bubble shrinks into the mascot by the CTA */
      tl.fromTo(bub, { home: 0 }, { home: 1, duration: span(4, 0.46, 0.54), ease: 'power3.inOut' }, segAt(4, 0.46))
      tl.fromTo(bub, { swap: 0 }, { swap: 1, duration: span(4, 0, 0.025) }, segAt(4, 0.54))
      if (r.mascot) {
        gsap.set(r.mascot, { opacity: 0, scale: 0.8 })
        tl.fromTo(r.mascot, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: span(4, 0, 0.03), ease: 'back.out(2.4)' }, segAt(4, 0.538))
      }
    }
  }
  return tl
}
