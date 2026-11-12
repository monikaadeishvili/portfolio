/**
 * Page 2's ONE per-frame loop on gsap.ticker (which also drives Lenis and
 * ScrollTrigger). Per frame: WRITE camera + components + bubble anchor →
 * one batched READ (anchor, travelling components, eyes) → WRITE organism,
 * eyes, cursors and chrome sinks.
 */
import { gsap } from '../scene/gsap'
import { readEyes, updateEyes } from '../scene/Eyes'
import { hexToRgb, MAX_BALLS, type Organism, type OrganismFrame } from '../scene/organism'
import { hover, pointer, scene, ui } from '../scene/store'
import { bots, updateCursors } from '../canvas/Cursors'
import { updateRuler } from '../chrome/ChapterRuler'
import { comps, evalPose, lerp, type Comp } from './runtime'
import { bub, cam, chapterAt, R0, type Geo } from './timeline'
import { bsinks, chapterCh, inspSel, inspState, placedVer } from './bstore'

export interface LoopCtx {
  world: HTMLElement
  paper: HTMLElement
  anchor: HTMLElement
  bubEyes: HTMLElement
  organism: Organism | null
  getTimeline: () => gsap.core.Timeline | null
  getGeo: () => Geo | null
  sheetsOf: (i: number) => HTMLElement[]
}

export const live = {
  /** id of the component currently travelling (latest started) */
  travelling: null as string | null,
  bubScreen: { x: 0, y: 0, r: 0 },
  hits: new Map<HTMLElement, number>(),
}

/** reaction impulses from pointer events */
export function nudge(c: Comp, kind: 'hover' | 'poke') {
  if (scene.reduced) return
  if (c.pose.state === 'placed') return
  c.hv += kind === 'poke' ? 300 : 210
  c.wave = 1
}

const smoothK = (k: number) => {
  const x = Math.min(1, Math.max(0, (k - 0.55) / 0.42))
  return x * x * (3 - 2 * x)
}

export function startLoop(ctx: LoopCtx) {
  let lastCam = ''
  let lastAnchor = ''
  let frame = 0
  let orgShown = false
  let wob = 0
  let wobV = 0
  let lastZoom = ''
  let prevBounce = 0
  let placedSig = ''
  let lastChap = -1
  let pw = 0
  let ph = 0
  const prevBall = new Map<string, number>()
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
  const colCache = new Map<string, [number, number, number]>()
  const col = (hex: string) => {
    let c = colCache.get(hex)
    if (!c) colCache.set(hex, (c = hexToRgb(hex)))
    return c
  }
  const list = () => [...comps.values()]
  let all = list()
  let allSize = -1

  const tick = (time: number, deltaMs: number) => {
    const t = time
    const dt = Math.min(Math.max(deltaMs, 1) / 1000, 0.05)
    frame++
    const tl = ctx.getTimeline()
    const g = ctx.getGeo()
    if (!g) return
    if (tl) scene.p = tl.progress()
    const p = scene.p
    const chap = chapterAt(p)
    const narrow = g.lay === 'narrow'
    const peakMul = narrow ? 0.6 : 1
    if (comps.size !== allSize) {
      all = list()
      allSize = comps.size
    }
    if (chap !== lastChap) {
      // components entering the near range get a fresh write
      lastChap = chap
      for (const c of all) c.last = ''
    }

    /* ------------------------------------------------- WRITE: camera */
    const { rx, rz, s } = cam
    const cx = g.view.x + g.view.w / 2
    const cy = g.view.y + g.view.h / 2
    const camKey = `${cam.x.toFixed(1)}|${cam.y.toFixed(1)}|${s.toFixed(4)}|${rx.toFixed(2)}|${rz.toFixed(2)}`
    const camMoved = camKey !== lastCam
    if (camMoved) {
      lastCam = camKey
      if (!pw) {
        pw = ctx.paper.offsetWidth
        ph = ctx.paper.offsetHeight
      }
      const snap = (v: number) => Math.round(v / 26) * 26
      ctx.paper.style.transform = `translate3d(${snap(cam.x - pw / 2)}px, ${snap(cam.y - ph / 2)}px, 0)`
      ctx.world.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale3d(${s.toFixed(4)}, ${s.toFixed(4)}, ${s.toFixed(4)}) translate3d(${(-cam.x).toFixed(1)}px, ${(-cam.y).toFixed(1)}px, 0)`
    }

    /* ------------------------------------------ WRITE: components */
    const fine = scene.fine
    const lookX = fine && pointer.inCanvas ? pointer.x : bots.monika.x
    const lookY = fine && pointer.inCanvas ? pointer.y : bots.monika.y
    let travelling: Comp | null = null
    let sig = ''
    let insideW = 0
    for (const c of all) {
      const near = Math.abs(c.chapter - chap) <= 1 || c.pose.state === 'leaping' || (c.src && c.t.d > 0 && c.t.q < 1)
      const P = evalPose(c, peakMul)
      // which one is "the" travelling component
      const k = c.t.k
      const moving = (k > 0 && k < 1) || (c.src && ((c.t.d > 0 && c.t.d < 1) || (c.t.q > 0 && c.t.q < 1)))
      if (moving && c.chapter >= chap - 1 && (!travelling || c.order >= travelling.order || travelling.chapter < c.chapter)) travelling = c
      if (P.inside || P.ball > 0) insideW += P.inside ? 1 : P.ball
      const placed = P.state === 'placed' && P.op > 0
      sig += placed ? '1' : P.inside ? '2' : '0'

      // springs: hop + wave (idle), settle wobble (placed)
      if (!scene.reduced && near) {
        if (P.state === 'roaming' && k <= 0 && P.op > 0.5 && c.chapter === chap) {
          if (t > c.nextHop) {
            c.hv += 170 + Math.random() * 120
            c.nextHop = t + 5 + Math.random() * 10
          }
        }
        c.hv += (-c.hz * 110 - c.hv * 8.5) * dt
        c.hz += c.hv * dt
        c.wv += (-c.wob * 300 - c.wv * 10) * dt
        c.wob += c.wv * dt
        c.wave *= Math.exp(-2.6 * dt)
      }
      if (c.lastSt !== P.state) {
        if (P.state === 'placed' && c.lastSt === 'leaping') c.wv += c.hero ? 9 : 5
        c.lastSt = P.state
        c.slot.dataset.st = P.state
      }
      if (!near && c.last) continue

      let x = P.x
      let y = P.y
      let z = P.z
      let rot = P.rot
      let sx = P.sx
      let sy = P.sy
      if (P.state !== 'placed' && !scene.reduced && P.op > 0) {
        const idle = k <= 0 ? 1 : 0
        const br = Math.sin(t * 1.9 + c.ph)
        sy *= 1 + 0.022 * br * idle
        sx *= 1 - 0.011 * br * idle
        if (idle && c.wait.z > 40) {
          z += 7 * Math.sin(t * 1.05 + c.ph)
          x += 5 * Math.sin(t * 0.63 + c.ph)
        }
        if (idle && c.scx) {
          const dx = lookX - c.scx
          rot += Math.max(-1, Math.min(1, dx / 520)) * 5
        }
        z += Math.max(0, c.hz)
        rot += Math.sin(t * 17) * 7 * c.wave
        const hopSq = Math.max(0, -c.hz) * 0.004
        sx *= 1 + hopSq
        sy *= 1 - hopSq
      }
      // intro drop-in
      const din = c.t.in
      let op = P.op
      if (din < 1) {
        z += (1 - din) * 320 * peakMul
        op *= Math.min(1, din * 4)
      }
      if (c.wob) {
        sx *= 1 + 0.05 * c.wob
        sy *= 1 - 0.05 * c.wob
      }
      // roaming pieces read at 1.3× until they settle into their slot
      if (P.state !== 'placed') {
        let grow = 1.3
        if (c.src && c.t.q <= 0) grow = 1 + 0.3 * Math.min(1, c.t.d / 0.25)
        else if (k > 0) grow = 1 + 0.3 * (1 - smoothK(k))
        sx *= grow
        sy *= grow
      }

      const b = P.b
      const bill = b > 0.001 ? ` rotateZ(${(-rz * b).toFixed(2)}deg) rotateX(${(-rx * b).toFixed(2)}deg)` : ''
      const tr = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)${bill} rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
      if (tr !== c.last) {
        c.last = tr
        c.alive.style.transform = tr
      }
      const opS = op < 0.01 ? 'h' : op.toFixed(2)
      if (opS !== c.lastOp) {
        c.lastOp = opS
        c.inner.style.opacity = op < 0.01 ? '0' : opS
        c.inner.style.visibility = op < 0.01 ? 'hidden' : ''
      }
      // contact shadow on the plane under the feet
      const height = Math.max(0, z)
      const shOp = b * op * (0.55 / (1 + height / 110))
      const ks = 1 / (1 + height / 260)
      const sh = shOp < 0.01 ? 'off' : `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(ks * sx).toFixed(3)})|${shOp.toFixed(2)}`
      if (sh !== c.lastSh) {
        c.lastSh = sh
        if (sh === 'off') c.shadow.style.opacity = '0'
        else {
          const [tr2, o2] = sh.split('|')
          c.shadow.style.transform = tr2
          c.shadow.style.opacity = o2
        }
      }
      const walk = P.walk ? '1' : '0'
      if (walk !== c.lastWalk) {
        c.lastWalk = walk
        c.slot.dataset.walk = walk
      }
      const pre = P.pre ? '1' : '0'
      if (pre !== c.lastPre) {
        c.lastPre = pre
        c.slot.dataset.pre = pre
      }
    }
    live.travelling = travelling ? travelling.id : null

    /* ---------------------------------------- WRITE: bubble anchor */
    const bt = bub.t
    const bi = Math.min(3, Math.floor(bt))
    const bf = Math.min(1, Math.max(0, bt - bi))
    const P0 = g.parks[bi]
    const P1 = g.parks[Math.min(4, bi + 1)]
    const Rw = (R0 + 15 * Math.sqrt(insideW)) * peakMul * 1.25
    let bx = lerp(P0.x, P1.x, bf)
    let by = lerp(P0.y, P1.y, bf)
    const bounce = bf > 0 && bf < 1 ? Math.abs(Math.sin(Math.PI * 3 * bf)) * 120 * peakMul * (1 - bf * 0.55) : 0
    let bz = Rw * 0.6 + bounce
    if (prevBounce > 8 && bounce <= 8 && bf > 0.05) wobV += 2.6
    prevBounce = bounce
    let R = Rw
    if (bub.home > 0) {
      bx = lerp(P1.x, g.mascot.x, bub.home)
      by = lerp(P1.y, g.mascot.y, bub.home)
      bz = lerp(bz, g.mascot.z, bub.home)
      R = lerp(Rw, g.mascotR, bub.home)
    }
    R *= bub.intro
    const anchorKey = `${bx.toFixed(1)}|${by.toFixed(1)}|${bz.toFixed(1)}|${camKey}`
    if (anchorKey !== lastAnchor) {
      lastAnchor = anchorKey
      ctx.anchor.style.transform = `translate3d(${(bx - 50).toFixed(1)}px, ${(by - 50).toFixed(1)}px, ${bz.toFixed(1)}px) rotateZ(${(-rz).toFixed(2)}deg) rotateX(${(-rx).toFixed(2)}deg)`
    }

    /* ------------------------------------------------ sheets: ripples */
    const sheets = ctx.sheetsOf(chap)
    const now = t
    live.hits.forEach((at, el) => {
      if (now - at > 0.5) {
        el.classList.remove('is-hit')
        live.hits.delete(el)
      }
    })

    /* =============================================== READ (one layout) */
    const ar = ctx.anchor.getBoundingClientRect()
    for (const c of all) {
      const P = c.pose
      const active = (P.state !== 'placed' && c.chapter === chap) || P.ball > 0
      if (!active || P.op <= 0 && P.ball <= 0) continue
      const r = c.alive.getBoundingClientRect()
      c.scx = r.left + r.width / 2
      c.scy = r.top + r.height / 2
    }
    readEyes()
    const sheetZ = sheets.map((sh) => ({ el: sh, z: Number(sh.dataset.z) * ((gsap.getProperty(sh, 'opacity') as number) > 0.5 ? 1 : 0) }))

    /* ======================================== WRITE: organism + rest */
    // sheet hit-test: a falling component crossing a sheet's height
    for (const c of all) {
      if (c.chapter !== chap || c.pose.state !== 'leaping') continue
      const zNow = c.pose.z
      const zPrev = c.pz
      c.pz = zNow
      for (const s2 of sheetZ) {
        if (!s2.z) continue
        if ((zPrev > s2.z && zNow <= s2.z) || (zPrev < s2.z && zNow >= s2.z)) {
          s2.el.classList.remove('is-hit')
          void s2.el.offsetWidth
          s2.el.classList.add('is-hit')
          live.hits.set(s2.el, now)
        }
      }
    }

    const sc = (ar.width + ar.height) / 200
    const ox = ar.left + ar.width / 2
    const oy = ar.top + ar.height / 2
    const Rs = R * sc
    live.bubScreen.x = ox
    live.bubScreen.y = oy
    live.bubScreen.r = Rs
    const alpha = 1 - bub.swap
    if (ctx.organism && alpha > 0.002 && Rs > 1 && ar.width > 0) {
      let n = 0
      let x0 = ox - Rs * 1.8
      let x1 = ox + Rs * 1.8
      let y0 = oy - Rs * 1.6
      let y1 = oy + Rs * 1.8
      let idx = 0
      for (const c of all) {
        const P = c.pose
        if (P.ball <= 0 && !P.inside) continue
        if (n >= MAX_BALLS) break
        const pb = prevBall.get(c.id) ?? 0
        const wNow = P.inside ? 1 : P.ball
        if (pb < 0.97 && wNow >= 0.97) wobV += 2.2
        if (pb > 0.5 && wNow <= 0.5 && c.t.q > 0) wobV -= 1.6
        prevBall.set(c.id, wNow)
        const th = idx * 2.399 + t * (0.5 + (idx % 3) * 0.17) * (idx % 2 ? 1 : -1) + bt * 6
        const orR = Rs * 0.42 * (1 + 0.12 * Math.sin(t * 0.9 + idx))
        const qx = ox + Math.cos(th) * orR
        const qy = oy + Math.sin(th) * orR * 0.8
        let bxs = qx
        let bys = qy
        let br = Rs * 0.44
        if (!P.inside) {
          const a = P.ball
          const ex = c.scx || qx
          const ey = c.scy || qy
          bxs = ex + (qx - ex) * a * a
          bys = ey + (qy - ey) * a * a
          br = Rs * 0.44 * a
        }
        br *= 1 - bub.home
        const o = n * 4
        fbuf.balls[o] = bxs
        fbuf.balls[o + 1] = bys
        fbuf.balls[o + 2] = br
        fbuf.cols.set(col(c.tone), n * 3)
        if (br > 0.5) {
          x0 = Math.min(x0, bxs - br)
          x1 = Math.max(x1, bxs + br)
          y0 = Math.min(y0, bys - br)
          y1 = Math.max(y1, bys + br)
        }
        n++
        idx++
      }
      // marbled memory: everything the bubble has carried tints it from inside
      let mem = 0
      for (let j = all.length - 1; j >= 0 && n < MAX_BALLS && mem < 9; j--) {
        const c = all[j]
        if (!c.src || c.t.q < 1) continue
        const th = mem * 2.1 + t * 0.35 * (mem % 2 ? 1 : -1)
        const o = n * 4
        fbuf.balls[o] = ox + Math.cos(th) * Rs * 0.32
        fbuf.balls[o + 1] = oy + Math.sin(th) * Rs * 0.26
        fbuf.balls[o + 2] = Rs * 0.36 * (1 - bub.home)
        fbuf.cols.set(col(c.tone), n * 3)
        n++
        mem++
      }
      for (let i = n; i < MAX_BALLS; i++) fbuf.balls[i * 4 + 2] = 0
      wobV += (-140 * wob - 6.5 * wobV) * dt
      wob += wobV * dt
      fbuf.count = n
      fbuf.core[0] = ox
      fbuf.core[1] = oy
      fbuf.core[2] = Rs
      fbuf.core[3] = 0
      fbuf.wobble = wob
      fbuf.alpha = alpha
      fbuf.bbox[0] = x0
      fbuf.bbox[1] = y0
      fbuf.bbox[2] = x1
      fbuf.bbox[3] = y1 + 30
      ctx.organism.render(fbuf, t)
      const ps = Math.max(0.001, Rs / 100)
      ctx.bubEyes.style.transform = `translate3d(${(ox - 100).toFixed(1)}px, ${(oy - 100).toFixed(1)}px, 0) scale(${ps.toFixed(4)}, ${(ps * (1 - 0.06 * wob)).toFixed(4)})`
      ctx.bubEyes.style.opacity = Rs > 5 ? alpha.toFixed(3) : '0'
      orgShown = true
    } else if (orgShown) {
      orgShown = false
      ctx.organism?.clear()
      ctx.bubEyes.style.opacity = '0'
    }

    updateEyes(t, dt, lookX, lookY)
    updateCursors(t, dt)
    updateRuler(p)

    /* ------------------------------------------------ chrome sinks */
    chapterCh.set(chap)
    if (sig !== placedSig) {
      placedSig = sig
      placedVer.set(placedVer.get() + 1)
    }
    const selId = hover.get() ?? live.travelling ?? lastPlacedIn(chap)
    inspSel.set(selId)
    const sel = selId ? comps.get(selId) : null
    if (sel) inspState.set(sel.pose.state === 'inside' ? 'leaping' : sel.pose.state)
    if (sel && frame % 2 === 0) {
      const f = g.frames[sel.src && sel.t.q <= 0 ? sel.chapter - 1 : sel.chapter]
      const P = sel.pose
      const vals: Record<string, string> = {
        x: String(Math.round(sel.sx - f.x + P.x)),
        y: String(Math.round(sel.sy - f.y + P.y)),
        z: String(Math.round(P.z + Math.max(0, sel.hz))),
        r: `${(P.rot + (P.b > 0 ? -rz * P.b : 0)).toFixed(1)}°`,
        w: String(Math.round(sel.w * P.sx)),
        h: String(Math.round(sel.h * P.sy)),
      }
      for (const key in vals) {
        const sink = bsinks[key as keyof typeof bsinks]
        if (sink && inspCache[key] !== vals[key]) {
          inspCache[key] = vals[key]
          sink.textContent = vals[key]
        }
      }
    }
    const zoom = `${Math.round(s * 100)}%`
    if (ui.zoom && zoom !== lastZoom) {
      lastZoom = zoom
      ui.zoom.textContent = zoom
    }
  }

  function lastPlacedIn(ch: number): string | null {
    let best: Comp | null = null
    for (const c of all) {
      if (c.chapter !== ch || c.pose.state !== 'placed' || c.pose.op <= 0) continue
      if (!best || c.land > best.land) best = c
    }
    return best ? best.id : null
  }

  gsap.ticker.add(tick)
  return () => {
    gsap.ticker.remove(tick)
  }
}
