/**
 * The ONE per-frame loop (runs on gsap.ticker, which also drives Lenis and
 * ScrollTrigger). Order per frame: camera write → batched reads → writes.
 */
import { gsap } from './gsap'
import { billboards, creatures, dragInfo, type CreatureRuntime } from './creatures'
import { readEyes, updateEyes } from './Eyes'
import { hexToRgb, MAX_BALLS, type Organism, type OrganismFrame } from './organism'
import {
  hover,
  landedCount,
  moodFor,
  phase,
  phaseFor,
  pointer,
  rectCache,
  registry,
  scene,
  storySel,
  tool,
  ui,
} from './store'
import { bots, updateCursors } from '../canvas/Cursors'
import { updateRuler } from '../chrome/ChapterRuler'

export interface LoopCtx {
  organism: Organism | null
  orgProxy: HTMLElement
  orgAnchor: HTMLElement
  momoHome: HTMLElement
  park: HTMLElement
  frameBg: HTMLElement
  world: HTMLElement
  nameBlock: HTMLElement
  l1: HTMLElement[]
  l2: HTMLElement[]
  getTimeline: () => gsap.core.Timeline | null
  order: () => CreatureRuntime[]
  pieces: () => HTMLElement[]
  pieceColors: () => string[]
  onMood: (m: string) => void
}

const smooth = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smoothstep = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a))
  return x * x * (3 - 2 * x)
}

/** a little shock-wave through the creatures (intro landing, spawns) */
export function ripple(fromId: string) {
  const src = creatures.get(fromId)
  if (!src) return
  const r0 = src.body.getBoundingClientRect()
  const sx = r0.left + r0.width / 2
  const sy = r0.top + r0.height / 2
  creatures.forEach((c) => {
    if (c === src) return
    const r = c.body.getBoundingClientRect()
    const dx = r.left + r.width / 2 - sx
    const dy = r.top + r.height / 2 - sy
    const d = Math.hypot(dx, dy) || 1
    const f = Math.max(0, 1 - d / 520) * 340
    c.fvx += (dx / d) * f * 0.5
    c.fvy += (dy / d) * f * 0.25 - f * 0.6
  })
}

export function startLoop(ctx: LoopCtx) {
  let lastCam = ''
  let frame = 0
  let lastZoom = ''
  let lastRing = -1
  let lastWalk = ''
  let dragEnabled: boolean | null = null
  let orgShown = false
  let wob = 0
  let wobV = 0
  const prevA: number[] = []
  const prevPR: number[] = []
  const inspCache: Record<string, string> = {}
  const fbuf: OrganismFrame = {
    count: 0,
    balls: new Float32Array(MAX_BALLS * 4),
    cols: new Float32Array(MAX_BALLS * 3),
    core: [0, 0, 0, 0],
    coreCol: hexToRgb('#5B4BFF'),
    wobble: 0,
    alpha: 0,
    bbox: [0, 0, 0, 0],
  }
  const nameState = {
    l1: ctx.l1.map(() => ({ w: 800, wd: 100 })),
    l2: ctx.l2.map(() => ({ y: 0, r: 0 })),
    offs: null as { x: number; y: number }[] | null,
    offs2: null as { x: number; y: number }[] | null,
  }
  const cacheNameOffsets = () => {
    const nb = ctx.nameBlock
    const off = (el: HTMLElement) => {
      let x = 0
      let y = 0
      let n: HTMLElement | null = el
      while (n && n !== nb) {
        x += n.offsetLeft
        y += n.offsetTop
        n = n.offsetParent as HTMLElement | null
      }
      return { x: x + el.offsetWidth / 2, y: y + el.offsetHeight / 2 }
    }
    nameState.offs = ctx.l1.map((el) => off(el.parentElement as HTMLElement))
    nameState.offs2 = ctx.l2.map(off)
  }
  document.fonts?.ready.then(cacheNameOffsets)
  const onResize = () => cacheNameOffsets()
  window.addEventListener('resize', onResize)

  const tick = (time: number, deltaMs: number) => {
    const t = time
    const dt = Math.min(Math.max(deltaMs, 1) / 1000, 0.05)
    frame++
    const tl = ctx.getTimeline()
    if (tl) scene.p = tl.progress()
    const p = scene.p
    const cam = scene.cam
    const fine = scene.fine

    /* ---------------------------------------------------- camera write */
    const camKey = `${cam.rx.toFixed(3)}|${cam.rz.toFixed(3)}|${cam.s.toFixed(4)}|${cam.pan.toFixed(1)}|${billboards.size}`
    if (camKey !== lastCam && !scene.reduced) {
      lastCam = camKey
      ctx.world.style.transform = `translate3d(0, ${cam.pan.toFixed(2)}px, 0) rotateX(${cam.rx.toFixed(3)}deg) rotateZ(${cam.rz.toFixed(3)}deg) scale(${cam.s.toFixed(4)})`
      billboards.forEach((el) => gsap.set(el, { rotation: -cam.rz, rotationX: -cam.rx }))
    }

    /* ------------------------------------------------------ READ phase */
    const orgActive = p > 0.29 && p < 0.84 && !!ctx.organism?.ok
    const needCreatureRects = orgActive || !!dragInfo.id
    const order = ctx.order()
    if (needCreatureRects) {
      creatures.forEach((c) => {
        const r = c.body.getBoundingClientRect()
        c.cx = r.left + r.width / 2
        c.cy = r.top + r.height / 2
        c.r = Math.max(r.width, r.height) / 2
      })
    }
    readEyes()
    rectCache.clear()
    const selId = hover.get() ?? storySel.get()
    for (const id of [selId, 'sticky', 'cta', 'c-blob', 'organism']) {
      if (rectCache.has(id)) continue
      const info = registry.get(id)
      if (info?.el) rectCache.set(id, info.el.getBoundingClientRect())
    }
    const frameRect = ctx.frameBg.getBoundingClientRect()
    let anchorR: DOMRect | null = null
    let homeR: DOMRect | null = null
    let parkR: DOMRect | null = null
    const pieceRects: DOMRect[] = []
    if (orgActive) {
      anchorR = ctx.orgAnchor.getBoundingClientRect()
      homeR = ctx.momoHome.getBoundingClientRect()
      if (scene.org.park > 0) parkR = ctx.park.getBoundingClientRect()
      if (p > 0.6) ctx.pieces().forEach((el) => pieceRects.push(el.getBoundingClientRect()))
    }
    const nameRippleOn = fine && !scene.reduced && p < 0.12
    const nameR = nameRippleOn ? ctx.nameBlock.getBoundingClientRect() : null

    /* ----------------------------------------------------- WRITE phase */

    // creatures: breathe, hop wave, flinch springs, contact shadows
    const dragged = dragInfo.id ? creatures.get(dragInfo.id) : null
    const u = scene.frame.w ? Math.max(0.6, Math.min(1.25, scene.frame.w / 920)) : 1
    let idx = 0
    creatures.forEach((c) => {
      idx++
      const oi = order.indexOf(c)
      const absorbed = oi >= 0 ? (scene.creatureBalls[oi]?.a ?? 0) : 0
      // flinch away from a creature being dragged past
      let tx = 0
      let ty = 0
      if (dragged && dragged !== c) {
        const dx = c.cx - dragged.cx
        const dy = c.cy - dragged.cy
        const d = Math.hypot(dx, dy) || 1
        const R = 170 * u
        if (d < R) {
          const push = (1 - d / R) * 34 * u
          tx = (dx / d) * push
          ty = (dy / d) * push
        }
      }
      const k = 260
      const damp = 2 * Math.sqrt(k) * 0.42
      c.fvx += ((tx - c.fx) * k - c.fvx * damp) * dt
      c.fvy += ((ty - c.fy) * k - c.fvy * damp) * dt
      c.fx += c.fvx * dt
      c.fy += c.fvy * dt

      const br = scene.reduced ? 0 : Math.sin(t * c.speed * 1.9 + c.phase)
      let sx = 1 + 0.014 * br
      let sy = 1 + 0.03 * br
      let hy = 0
      const amp = scene.lift * (1 - absorbed)
      if (amp > 0.001) {
        const s = Math.sin(t * 5.4 - idx * 0.62)
        const h = Math.abs(s)
        const contact = 1 - smoothstep(0, 0.28, h)
        hy = -h * 22 * u * amp
        sy *= 1 - 0.14 * contact * amp + 0.06 * h * amp
        sx *= 1 + 0.12 * contact * amp - 0.04 * h * amp
      }
      c.body.style.transform = `translate3d(${c.fx.toFixed(2)}px, ${(c.fy + hy).toFixed(2)}px, 0) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`

      const z = (gsap.getProperty(c.lift, 'z') as number) || 0
      const lx = (gsap.getProperty(c.lift, 'x') as number) + (gsap.getProperty(c.drag, 'x') as number)
      const ly = (gsap.getProperty(c.lift, 'y') as number) + (gsap.getProperty(c.drag, 'y') as number)
      const op = gsap.getProperty(c.lift, 'opacity') as number
      const height = z - hy * 1.4
      const ks = 1 / (1 + Math.max(0, height) / 210)
      c.shadow.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0) scale(${ks.toFixed(3)})`
      c.shadow.style.opacity = ((0.22 + 0.4 * clamp01(z / 60)) * Math.max(0.35, ks) * op).toFixed(3)
    })

    // eyes: pupils follow the visitor (or Monika's cursor on touch), blink
    const lookX = fine && pointer.inCanvas ? pointer.x : bots.monika.x
    const lookY = fine && pointer.inCanvas ? pointer.y : bots.monika.y
    updateEyes(t, dt, lookX, lookY)

    // name lockup: variable-font weight/width ripple under the cursor
    if (nameState.offs && nameState.offs2) {
      const scale = nameR ? nameR.width / Math.max(1, ctx.nameBlock.offsetWidth) : 1
      const s = smooth(9, dt)
      ctx.l1.forEach((el, i) => {
        const st = nameState.l1[i]
        let infl = 0
        if (nameR && pointer.inCanvas && nameState.offs) {
          const o = nameState.offs[i]
          const d = Math.hypot(pointer.x - (nameR.left + o.x * scale), (pointer.y - (nameR.top + o.y * scale)) * 1.25)
          infl = 1 - smoothstep(0, 280, d)
        }
        const tw = 800 - 300 * infl
        const twd = 100 - 24 * infl
        if (Math.abs(tw - st.w) < 0.25 && Math.abs(twd - st.wd) < 0.1) return
        st.w += (tw - st.w) * s
        st.wd += (twd - st.wd) * s
        el.style.fontVariationSettings = `"wght" ${st.w.toFixed(1)}, "wdth" ${st.wd.toFixed(1)}`
      })
      ctx.l2.forEach((el, i) => {
        const st = nameState.l2[i]
        let infl = 0
        if (nameR && pointer.inCanvas && nameState.offs2) {
          const o = nameState.offs2[i]
          const d = Math.hypot(pointer.x - (nameR.left + o.x * scale), (pointer.y - (nameR.top + o.y * scale)) * 1.25)
          infl = 1 - smoothstep(0, 240, d)
        }
        const ty = -infl * 0.07
        const tr = -infl * 5
        if (Math.abs(ty - st.y) < 0.0005 && Math.abs(tr - st.r) < 0.02) return
        st.y += (ty - st.y) * s
        st.r += (tr - st.r) * s
        el.style.transform = `translate3d(0, ${st.y.toFixed(4)}em, 0) rotate(${st.r.toFixed(2)}deg)`
      })
    }

    // organism (WebGL) + its DOM eyes / proxy
    const org = scene.org
    const alpha = org.vis * (1 - org.swap)
    if (orgActive && anchorR && homeR && alpha > 0.002 && ctx.organism) {
      const N = Math.max(1, scene.creatureBalls.length)
      let sumA = 0
      scene.creatureBalls.forEach((b, i) => {
        sumA += b.a
        if ((prevA[i] ?? 0) < 0.97 && b.a >= 0.97) wobV += 2.4
        prevA[i] = b.a
      })
      scene.pieceBalls.forEach((b, j) => {
        if ((prevPR[j] ?? 0) < 0.6 && b.r >= 0.6) wobV -= 1.6
        prevPR[j] = b.r
      })
      wobV += (-140 * wob - 6.5 * wobV) * dt
      wob += wobV * dt

      const pkv = org.park
      let ax = anchorR.left + anchorR.width / 2
      let ay = anchorR.top + anchorR.height / 2
      if (parkR && pkv > 0) {
        ax += (parkR.left + parkR.width / 2 - ax) * pkv
        ay += (parkR.top + parkR.height / 2 - ay) * pkv
      }
      const hx = homeR.left + homeR.width / 2
      const hy2 = homeR.top + homeR.height * 0.56
      const baseR = Math.min(scene.frame.w, scene.frame.h) * (scene.bp === 'mob' ? 0.2 : 0.138) * cam.s
      const appear = clamp01(sumA * 1.4)
      let R = baseR * (0.34 + 0.66 * Math.sqrt(sumA / N)) * appear * (0.5 + 0.5 * org.mass)
      R *= (1 + 0.028 * Math.sin(t * 1.9)) * (1 - 0.42 * pkv)
      const momoR = homeR.width * 0.46
      const hm = org.home
      R = R + (momoR - R) * hm
      const cx = ax + (hx - ax) * hm
      const cy = ay + (hy2 - ay) * hm
      const stretch = org.stretch

      let n = 0
      let x0 = cx - R * 2.6
      let x1 = cx + R * 2.6
      let y0 = cy - R * 1.6
      let y1 = cy + R * 1.6
      const order2 = order
      scene.creatureBalls.forEach((b, i) => {
        if (n >= MAX_BALLS) return
        const c = order2[i]
        const o = n * 4
        if (!c || b.a <= 0.002) {
          fbuf.balls[o + 2] = 0
          n++
          return
        }
        const th = i * 2.399 + t * (0.32 + (i % 3) * 0.11) * (i % 2 ? 1 : -1)
        const orR = R * 0.4 * (1 + 0.12 * Math.sin(t * 0.9 + i))
        const ox = cx + Math.cos(th) * orR * (1 + 1.0 * stretch)
        const oy = cy + Math.sin(th) * orR * (1 - 0.25 * stretch)
        const a = b.a
        const bx = c.cx + (ox - c.cx) * a * a
        const by = c.cy + (oy - c.cy) * a * a
        const br = a * R * 0.46 * (1 - hm)
        fbuf.balls[o] = bx
        fbuf.balls[o + 1] = by
        fbuf.balls[o + 2] = br
        const col = hexToRgb(c.def.color)
        fbuf.cols.set(col, n * 3)
        if (br > 0.5) {
          x0 = Math.min(x0, bx - br)
          x1 = Math.max(x1, bx + br)
          y0 = Math.min(y0, by - br)
          y1 = Math.max(y1, by + br)
        }
        n++
      })
      const pcols = ctx.pieceColors()
      scene.pieceBalls.forEach((b, j) => {
        if (n >= MAX_BALLS) return
        const o = n * 4
        const r = pieceRects[j]
        if (!r || b.r <= 0.002) {
          fbuf.balls[o + 2] = 0
          n++
          return
        }
        const bx = r.left + r.width / 2
        const by = r.top + r.height / 2
        const br = b.r * Math.min(86, Math.max(18, Math.min(r.width, r.height) * 0.34))
        fbuf.balls[o] = bx
        fbuf.balls[o + 1] = by
        fbuf.balls[o + 2] = br
        fbuf.cols.set(hexToRgb(pcols[j] ?? '#5B4BFF'), n * 3)
        x0 = Math.min(x0, bx - br)
        x1 = Math.max(x1, bx + br)
        y0 = Math.min(y0, by - br)
        y1 = Math.max(y1, by + br)
        n++
      })
      for (let i = n; i < MAX_BALLS; i++) fbuf.balls[i * 4 + 2] = 0
      fbuf.count = n
      fbuf.core[0] = cx
      fbuf.core[1] = cy
      fbuf.core[2] = R
      fbuf.core[3] = stretch
      fbuf.wobble = wob
      fbuf.alpha = alpha
      fbuf.bbox[0] = x0
      fbuf.bbox[1] = y0
      fbuf.bbox[2] = x1
      fbuf.bbox[3] = y1 + 30
      ctx.organism.render(fbuf, t)

      const ps = Math.max(0.001, R / 100)
      ctx.orgProxy.style.transform = `translate3d(${(cx - 100).toFixed(1)}px, ${(cy - 100).toFixed(1)}px, 0) scale(${ps.toFixed(4)}, ${(ps * (1 - 0.06 * wob)).toFixed(4)})`
      ctx.orgProxy.style.opacity = R > 6 ? alpha.toFixed(3) : '0'
      orgShown = true
    } else if (orgShown) {
      orgShown = false
      ctx.organism?.clear()
      ctx.orgProxy.style.opacity = '0'
    }

    // cursors + chapter ruler
    updateCursors(t, dt)
    updateRuler(p)
    const walking = scene.lift > 0.3 ? '1' : '0'
    if (walking !== lastWalk) {
      lastWalk = walking
      ctx.world.closest('.stage')?.setAttribute('data-walk', walking)
    }

    // inspector — live values, throttled to every other frame
    if (frame % 2 === 0) {
      const info = registry.get(selId)
      const r = rectCache.get(selId)
      if (info && r) {
        const lift = info.liftEl
        const own = lift ? ((gsap.getProperty(lift, 'rotation') as number) || 0) : 0
        const rot = info.kind === 'component' ? own + (info.baseRotation ?? 0) : info.kind === 'organism' ? wob * 6 : cam.rz + (info.baseRotation ?? 0) + (info.kind === 'note' ? own : 0)
        const z = info.kind === 'organism' ? 80 : lift ? ((gsap.getProperty(lift, 'z') as number) || 0) : 0
        const op = info.kind === 'organism' ? alpha : lift ? (gsap.getProperty(lift, 'opacity') as number) : 1
        const vals: Record<string, string> = {
          x: String(Math.round(r.left - frameRect.left)),
          y: String(Math.round(r.top - frameRect.top)),
          w: String(Math.round(r.width)),
          h: String(Math.round(r.height)),
          r: `${rot.toFixed(1)}°`,
          z: String(Math.round(z)),
          op: `${Math.round(op * 100)}%`,
          hex: info.color.replace('#', '').toUpperCase(),
        }
        for (const key in vals) {
          const sink = ui.insp[key as keyof typeof ui.insp]
          if (sink && inspCache[key] !== vals[key]) {
            inspCache[key] = vals[key]
            sink.textContent = vals[key]
          }
        }
        if (ui.insp.swatch && inspCache.sw !== info.color) {
          inspCache.sw = info.color
          ui.insp.swatch.style.background = info.color
        }
      }
    }

    // zoom readout + play ring
    const zoom = `${Math.round(cam.zoom * 100)}%`
    if (ui.zoom && zoom !== lastZoom) {
      lastZoom = zoom
      ui.zoom.textContent = zoom
    }
    const ring = Math.round(p * 1000)
    if (ui.ring && ring !== lastRing) {
      lastRing = ring
      ui.ring.style.strokeDashoffset = String(1 - p)
      if (ui.playPct) ui.playPct.textContent = `${Math.round(p * 100)}`
    }

    // discrete story state → channels (React re-renders only on change)
    phase.set(phaseFor(p))
    ctx.onMood(moodFor(p))
    storySel.set(p < 0.08 ? 'name' : p < 0.3 ? 'c-blob' : p < 0.58 ? 'organism' : p < 0.82 ? (['portrait', 'headline', 'bio', 'stats', 'chips', 'cta'][Math.min(5, Math.max(0, landedCount.get() - 1))] ?? 'portrait') : 'cta')
    if (frame % 3 === 0) {
      let landed = 0
      ctx.pieces().forEach((el) => {
        if ((gsap.getProperty(el, 'opacity') as number) > 0.9) landed++
      })
      landedCount.set(landed)
    }

    // creatures are draggable only on the flat file with the Move tool
    const canDrag = p < 0.03 && tool.get() === 'move'
    if (canDrag !== dragEnabled) {
      dragEnabled = canDrag
      creatures.forEach((c) => (canDrag ? c.draggable?.enable() : c.draggable?.disable()))
    }
    creatures.forEach((c) => {
      if (!c.spawned) return
      const away = c.owner === 'hero' ? p > 0.34 : p < 0.7
      if (c.wrap.classList.contains('is-away') !== away) c.wrap.classList.toggle('is-away', away)
    })
  }

  gsap.ticker.add(tick)
  return () => {
    gsap.ticker.remove(tick)
    window.removeEventListener('resize', onResize)
  }
}
