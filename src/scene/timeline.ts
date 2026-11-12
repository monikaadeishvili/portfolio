import { gsap } from './gsap'
import { creatures, type CreatureRuntime } from './creatures'
import { offsetIn } from './layout'
import { scene, type Breakpoint } from './store'

export interface SceneRefs {
  frameSpace: HTMLElement
  frameBg: HTMLElement
  labelHero: HTMLElement
  labelAbout: HTMLElement
  nameBlock: HTMLElement
  nameSel: HTMLElement
  roleRow: HTMLElement
  stickyLift: HTMLElement
  scribble: HTMLElement
  aboutLayer: HTMLElement
  ghostWork: HTMLElement
  ghostContact: HTMLElement
  momoHome: HTMLElement
  park: HTMLElement
  sheets: HTMLElement[]
}

export interface Geometry {
  fw: number
  fh: number
  bh: number
  aboutW: number
  aboutH: number
  anchor: { x: number; y: number }
  miniScale: number
  pad: number
}

/** creature order used for leaps and organism balls (nearest first) */
export function leapOrder(geo: Geometry, fs: HTMLElement): CreatureRuntime[] {
  const list = [...creatures.values()].filter((c) => !c.spawned && c.wrap.offsetParent !== null)
  const home = (c: CreatureRuntime) => {
    const o = offsetIn(c.wrap, fs)
    return { x: o.x + o.w / 2, y: o.y + o.h }
  }
  return list
    .map((c) => ({ c, d: Math.hypot(home(c).x - geo.anchor.x, home(c).y - geo.anchor.y) }))
    .sort((a, b) => a.d - b.d)
    .map((e) => e.c)
}

const clip = (top: number, right: number, bottom: number, left: number) =>
  `inset(${top.toFixed(1)}px ${right.toFixed(1)}px ${bottom.toFixed(1)}px ${left.toFixed(1)}px round 18px)`

export function heroClip(g: Geometry) {
  return clip(0, 0, g.bh - g.fh, 0)
}

/**
 * One timeline, duration 1 == scroll progress. Built from measured layout and
 * rebuilt (keeping progress) on resize, so every value here is static.
 */
export function buildTimeline(r: SceneRefs, g: Geometry, bp: Breakpoint, order: CreatureRuntime[]) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })
  const fs = r.frameSpace
  const mob = bp === 'mob'
  const zMul = mob ? 0.55 : 1
  const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1
  const cam = scene.cam
  const tilt = mob ? { rx: 40, rz: -16, s: 0.66 } : { rx: 58, rz: -32, s: 0.78 }

  // anchor the whole timeline to [0, 1]
  tl.set({}, {}, 0).set({}, {}, 1)

  /* ============================== Act 1 · Lift (0.08 – 0.30) ============ */

  // selection box releases: handles scatter, badge drops away
  const handles = r.nameSel.querySelectorAll<HTMLElement>('.h')
  handles.forEach((h, i) => {
    const a = (i / handles.length) * Math.PI * 2
    tl.to(h, { x: Math.cos(a) * 26, y: Math.sin(a) * 26, scale: 0.4, opacity: 0, duration: 0.05, ease: 'power2.in' }, 0.08 + i * 0.004)
  })
  tl.to(r.nameSel, { '--sel-a': 0, duration: 0.05, ease: 'power2.out' }, 0.085)
  tl.to(r.nameSel.querySelector('.size-badge'), { y: 14, opacity: 0, duration: 0.04, ease: 'power2.in' }, 0.08)

  // scribble rubs itself out, sticky peels off the page
  tl.to(r.scribble.querySelectorAll('path'), { strokeDashoffset: -1, duration: 0.06, ease: 'power2.in', stagger: 0.01 }, 0.08)
  tl.to(r.stickyLift, { z: 190 * zMul, rotation: -13, y: -18, duration: 0.14, ease: 'back.out(1.4)' }, 0.1)

  // camera tilts into the iso-ish table view
  tl.to(cam, { rx: tilt.rx, rz: tilt.rz, s: tilt.s, zoom: 0.72, duration: 0.2, ease: 'power3.inOut' }, 0.08)

  // layers separate along Z with stagger
  tl.to(r.nameBlock, { z: 60 * zMul, duration: 0.16, ease: 'power3.out' }, 0.11)
  tl.to(r.roleRow, { z: 60 * zMul, duration: 0.16, ease: 'power3.out' }, 0.12)
  order.forEach((c, i) => {
    tl.to(c.lift, { z: (70 + (c.def.z - 120) * 0.62) * zMul * Math.max(0.75, u), duration: 0.12, ease: 'back.out(1.7)' }, 0.11 + i * 0.011)
  })
  tl.to(scene, { lift: 1, duration: 0.08, ease: 'power2.out' }, 0.15)
  // footprints: where everyone stood, a colourful map on the tilted sheet
  order.forEach((c, i) => {
    const foot = c.wrap.querySelector('.cr-foot')
    if (foot) tl.to(foot, { opacity: 1, duration: 0.05, ease: 'power2.out' }, 0.12 + i * 0.011)
  })
  // exploded-layer wireframe sheets hovering between frame and creatures
  r.sheets.forEach((sh, k) => {
    const z = (k === 0 ? 44 : 104) * zMul
    const lbl = sh.querySelector('span')
    if (lbl) lbl.textContent = `z ${Math.round(z)}`
    tl.to(sh, { z, opacity: 1, duration: 0.14, ease: 'power3.out' }, 0.13 + k * 0.03)
  })

  /* ============================== Act 2 · Merge (0.30 – 0.55) =========== */

  tl.to(scene, { lift: 0, duration: 0.08, ease: 'power2.inOut' }, 0.47)

  // sticky floats away (paper, not a creature)
  tl.to(r.stickyLift, { x: 160 * u, y: -120 * u, z: 420 * zMul, rotation: 24, opacity: 0, duration: 0.09, ease: 'power2.in' }, 0.29)
  tl.to(r.roleRow, { opacity: 0, y: 24, duration: 0.06, ease: 'power2.in' }, 0.32)

  const N = order.length
  const span = 0.205
  scene.creatureBalls = order.map(() => ({ a: 0, r: 0 }))
  order.forEach((c, i) => {
    const o = offsetIn(c.wrap, fs)
    const dx = g.anchor.x - (o.x + o.w / 2)
    const dy = g.anchor.y - (o.y + o.h)
    const z0 = (70 + (c.def.z - 120) * 0.62) * zMul * Math.max(0.75, u)
    const s = 0.305 + (i * span) / Math.max(1, N)
    const peak = z0 * 0.6 + (90 + (i % 3) * 30) * zMul
    const ball = scene.creatureBalls[i]
    // anticipation squash
    tl.to(c.lift, { scaleX: 1.2, scaleY: 0.78, duration: 0.01, ease: 'power2.out' }, s)
    // flight: XY drift + Z parabola + stretch
    tl.to(c.lift, { x: dx, y: dy, duration: 0.05, ease: 'sine.inOut' }, s + 0.01)
    tl.to(c.lift, { z: peak, duration: 0.024, ease: 'power2.out' }, s + 0.01)
    tl.to(c.lift, { scaleX: 0.86, scaleY: 1.18, duration: 0.012, ease: 'power2.out' }, s + 0.01)
    tl.to(c.lift, { z: 90 * zMul, duration: 0.026, ease: 'power2.in' }, s + 0.034)
    tl.to(c.lift, { scaleX: 0.3, scaleY: 0.24, duration: 0.02, ease: 'power2.in' }, s + 0.04)
    tl.to(c.lift, { opacity: 0, duration: 0.012, ease: 'power1.in' }, s + 0.048)
    // its metaball takes over
    tl.to(ball, { a: 1, r: 1, duration: 0.024, ease: 'power2.in' }, s + 0.036)
  })
  tl.to(scene.org, { vis: 1, duration: 0.02 }, 0.33)

  // name lockup shrinks toward the top-left of the frame
  const n = offsetIn(r.nameBlock, fs)
  tl.to(r.nameBlock, { x: g.pad - n.x, y: g.pad - n.y, scale: g.miniScale, z: 0, duration: 0.16, ease: 'power3.inOut' }, 0.34)

  /* ============================== Act 3 · Build (0.55 – 0.82) =========== */

  tl.to(cam, { rx: 0, rz: 0, s: 1, zoom: 1, duration: 0.12, ease: 'back.out(1.25)' }, 0.55)
  tl.to(order.map((c) => c.lift), { z: 0, duration: 0.05 }, 0.56)
  tl.to(r.stickyLift, { z: 0, duration: 0.01 }, 0.56)
  tl.to(r.roleRow, { z: 0, duration: 0.01 }, 0.56)
  tl.to(order.map((c) => c.wrap.querySelector('.cr-foot')).filter(Boolean), { opacity: 0, duration: 0.05, stagger: 0.003, ease: 'power1.in' }, 0.545)
  tl.to(r.sheets, { z: 0, opacity: 0, duration: 0.06, ease: 'power2.inOut' }, 0.55)
  // the organism parks in the empty lower-right of the About frame to pour
  tl.to(scene.org, { park: 1, duration: 0.05, ease: 'power2.inOut' }, 0.555)
  tl.to(scene.org, { stretch: 0.6, duration: 0.06, ease: 'power2.inOut' }, 0.56)
  tl.to(r.labelHero, { opacity: 0, y: -6, duration: 0.02 }, 0.585)
  tl.fromTo(r.labelAbout, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.02 }, 0.6)
  tl.fromTo(r.frameBg, { clipPath: heroClip(g) }, { clipPath: clip(0, g.fw - g.aboutW, g.bh - g.aboutH, 0), duration: 0.07, ease: 'power3.inOut' }, 0.57)

  const pieces = Array.from(r.aboutLayer.querySelectorAll<HTMLElement>('.piece'))
  const guides = Array.from(r.aboutLayer.querySelectorAll<HTMLElement>('.guide'))
  scene.pieceBalls = pieces.map(() => ({ a: 0, r: 0 }))
  const pk = offsetIn(r.park, fs)
  pieces.forEach((el, j) => {
    const o = offsetIn(el, fs)
    const dx = pk.x - (o.x + o.w / 2)
    const dy = pk.y - (o.y + o.h / 2)
    const s = 0.615 + j * 0.027
    const d = 0.046
    const rise = Math.min(dy, 0) * 0.12 - 26 * u
    const ball = scene.pieceBalls[j]
    gsap.set(el, { x: dx, y: dy, scale: 0.32, opacity: 0, transformOrigin: '50% 50%' })
    tl.to(el, { x: 0, duration: d, ease: 'power1.inOut' }, s)
    tl.to(el, { y: rise, duration: d * 0.42, ease: 'power2.out' }, s)
    tl.to(el, { y: 0, duration: d * 0.58, ease: 'power2.in' }, s + d * 0.42)
    tl.to(el, { opacity: 1, duration: 0.012, ease: 'power1.out' }, s + 0.008)
    tl.to(el, { scale: 1.06, duration: d * 0.9, ease: 'power2.out' }, s)
    tl.to(el, { scale: 1, duration: 0.014, ease: 'back.out(3)' }, s + d * 0.9)
    tl.to(ball, { r: 1, duration: 0.014, ease: 'power2.out' }, s)
    tl.to(ball, { r: 0, duration: 0.02, ease: 'power2.in' }, s + 0.022)
    // arrives alive: outline + eyes during flight, eyes close as it settles
    const alive = el.querySelector<HTMLElement>('.piece-alive')
    const eyes = alive?.querySelector<HTMLElement>('.eyes')
    if (alive && eyes) {
      gsap.set(alive, { opacity: 0 })
      gsap.set(eyes, { scaleY: 1, opacity: 1 })
      tl.fromTo(alive, { opacity: 0 }, { opacity: 1, duration: 0.006, immediateRender: false }, s + 0.004)
      tl.fromTo(eyes, { scaleY: 1, opacity: 1 }, { scaleY: 0.1, opacity: 0, duration: 0.012, ease: 'power2.in', immediateRender: false }, s + d - 0.002)
      tl.fromTo(alive, { opacity: 1 }, { opacity: 0, duration: 0.012, immediateRender: false }, s + d + 0.006)
    }
    // one-beat violet selection flash + size badge
    const sel = el.querySelector('.piece-sel')
    tl.to(sel, { opacity: 1, duration: 0.004 }, s + d - 0.004)
    tl.to(sel, { opacity: 0, duration: 0.01 }, s + d + 0.014)
    const guide = guides.find((gd) => gd.dataset.k === String(j))
    if (guide) {
      tl.fromTo(guide, { opacity: 0 }, { opacity: 1, duration: 0.004 }, s + d)
      tl.to(guide, { opacity: 0, duration: 0.012 }, s + d + 0.02)
    }
    tl.to(scene.org, { mass: 1 - (j + 1) * 0.1, duration: 0.02, ease: 'power2.out' }, s + 0.01)
    if (el.dataset.piece === 'stats') {
      el.querySelectorAll<HTMLElement>('.stat-count').forEach((cnt, k) => {
        const target = Number(cnt.dataset.count)
        const obj = { v: 0 }
        cnt.textContent = '0'
        tl.to(obj, { v: target, duration: 0.05, ease: 'power2.out', onUpdate: () => (cnt.textContent = String(Math.round(obj.v))) }, s + 0.02 + k * 0.008)
      })
    }
  })

  // the organism walks home and becomes momo
  tl.to(scene.org, { stretch: 0, duration: 0.05, ease: 'power2.inOut' }, 0.74)
  tl.to(scene.org, { home: 1, mass: 0, duration: 0.055, ease: 'power3.inOut' }, 0.755)
  tl.to(scene.org, { swap: 1, duration: 0.014, ease: 'power1.inOut' }, 0.806)
  tl.fromTo(r.momoHome, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.016, ease: 'back.out(2.5)' }, 0.806)

  /* ============================== Act 4 · Home (0.82 – 1.0) ============= */

  tl.fromTo(r.ghostWork, { x: 90, opacity: 0 }, { x: 0, opacity: 1, duration: 0.07, ease: 'expo.out' }, 0.84)
  tl.fromTo(r.ghostContact, { y: 70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.07, ease: 'expo.out' }, 0.865)

  const maxPan = Math.max(0, g.aboutH + 28 - g.fh)
  if (mob) {
    if (maxPan > 0) tl.to(cam, { pan: -maxPan, duration: 0.3, ease: 'power1.inOut' }, 0.64)
  } else {
    // fit the taller About frame by zooming out, keeping its top (and label) below the top bar
    const room = window.innerHeight - scene.frame.y - 124
    const k = Math.min(1, room / Math.max(1, g.aboutH))
    if (k < 1) tl.to(cam, { s: k, zoom: k, pan: -(g.fh / 2) * (1 - k), duration: 0.2, ease: 'power1.inOut' }, 0.74)
  }

  return tl
}
