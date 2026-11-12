/**
 * Page 2's ONE per-frame loop on gsap.ticker (which also drives Lenis and
 * ScrollTrigger). Everything is evaluated from the scroll progress; screen
 * positions come from our own projection of the CSS camera, so the only
 * layout reads are the eye rigs' (batched).
 */
import { gsap } from '../scene/gsap'
import { readEyes, updateEyes } from '../scene/Eyes'
import { hover, pointer, scene, ui } from '../scene/store'
import { bots, updateCursors } from '../canvas/Cursors'
import { updateRuler } from '../chrome/ChapterRuler'
import { camAt, chargeOf, project, regionProgress, type CamPose, type Geo, type Proj } from './camera'
import { bubbleAt, makeState, type BubState } from './bubble/choreo'
import { Bubble, MAX_BALLS, MAX_CORES, type BubbleFrame } from './bubble/organism2'
import { clamp01, evalPose, fxs, outBack, pieces, rnd, smooth, texts, type FxEnv, type Piece, type TextBlock } from './runtime'
import { hex, SEC, sectionAt, secU, type RGB } from './worlds'
import { bsinks, chapterCh, inspSel, inspState, moodCh, placedVer, regionCh, type InspState } from './bstore'

export interface LoopCtx {
  stage: HTMLElement
  world: HTMLElement
  paper: HTMLElement
  boards: HTMLElement[]
  worldBg: HTMLElement[]
  paperBg: HTMLElement[]
  speed: HTMLElement | null
  eyes: HTMLElement[]
  mascot: HTMLElement | null
  confetti: HTMLElement | null
  bubble: Bubble | null
  getProgress: () => number
  getGeo: () => Geo | null
}

export const live = {
  /** dev / overlap checks: pin the progress */
  pOverride: null as number | null,
  travelling: null as string | null,
  bubScreen: { x: 0, y: 0, r: 0 },
  cam: { x: 0, y: 0, s: 1, rx: 0, rz: 0 } as CamPose,
  intro: 1,
  state: null as BubState | null,
}

/** reaction impulses from pointer events */
export function nudge(c: Piece, kind: 'hover' | 'poke') {
  if (scene.reduced || c.kind !== 'hero') return
  if (c.pose.state === 'placed') return
  c.hv += kind === 'poke' ? 300 : 210
  c.wave = 1
}

const EYE_SCALE: Record<string, string> = { normal: 'none', wide: 'scale(1.22)', squint: 'scale(1.06, 0.34)', dizzy: 'none' }

export function startLoop(ctx: LoopCtx) {
  const S = makeState()
  live.state = S
  const cam: CamPose = { x: 0, y: 0, s: 1, rx: 0, rz: 0 }
  const pr: Proj = { x: 0, y: 0, f: 1 }
  let lastCam = ''
  let lastPaper = ''
  let pw = 0
  let ph = 0
  let frame = 0
  let wob = 0
  let wobV = 0
  let lastImpact = 0
  let lastTr = -1
  let lastZoom = ''
  let placedSig = ''
  let shown = false
  let prevSX = 0
  let prevSY = 0
  let speedOp = 0
  let lastSpeed = ''
  const worldOp = ['', '', '', '', '']
  const boardNear = ['', '', '', '', '']
  const eyeKey = ['', '', '']
  const eyeMood = ['', '', '']
  let lastMascot = ''
  let lastConf = ''
  let lastMood: string | null = '?'
  const inspCache: Record<string, string> = {}
  const colCache = new Map<string, RGB>()
  const col = (h: string) => {
    let c = colCache.get(h)
    if (!c) colCache.set(h, (c = hex(h)))
    return c
  }
  const fb: BubbleFrame = {
    count: 0,
    balls: new Float32Array(MAX_BALLS * 4),
    cols: new Float32Array(MAX_BALLS * 3),
    coreN: 1,
    cores: new Float32Array(MAX_CORES * 4),
    coreCols: new Float32Array(MAX_CORES * 3),
    pal: new Float32Array(9),
    split: 0,
    dir: 0,
    rot: 0,
    wobble: 0,
    alpha: 1,
    flash: 0,
    shadow: 0.2,
    bbox: [0, 0, 0, 0],
  }
  const confEls = ctx.confetti ? Array.from(ctx.confetti.children) as HTMLElement[] : []
  let all: Piece[] = []
  let allSize = -1
  let tAll: TextBlock[] = []
  let tSize = -1
  const env: FxEnv = {
    p: 0,
    u: 0,
    t: 0,
    dt: 0,
    section: 0,
    near: false,
    reg: [0, 0, 0, 0],
    win: () => [0, 0],
    piece: (id) => pieces.get(id),
    reduced: false,
    narrow: false,
  }

  const tick = (time: number, deltaMs: number) => {
    const t = time
    const dt = Math.min(Math.max(deltaMs, 1) / 1000, 0.05)
    frame++
    const g = ctx.getGeo()
    if (!g) return
    const p = live.pOverride ?? ctx.getProgress()
    scene.p = p
    const sec = sectionAt(p)
    const peak = g.peak
    if (pieces.size !== allSize) {
      all = [...pieces.values()]
      allSize = pieces.size
    }
    if (texts.size !== tSize) {
      tAll = [...texts.values()]
      tSize = texts.size
    }

    /* --------------------------------------------- bubble (pure) */
    bubbleAt(g, p, S)

    /* ---------------------------------------------- WRITE: camera */
    camAt(g, p, cam)
    if (live.intro < 1) {
      // intro: swing down onto the first artboard
      const e = live.intro
      cam.s *= 0.78 + 0.22 * e
      cam.rx -= (1 - e) * 16
      cam.rz += (1 - e) * 12
    }
    if (S.tr >= 0 && !scene.reduced) {
      const ch = chargeOf(S.tr, S.tu)
      if (ch > 0.01) {
        const a = (ch * ch * 6) / cam.s
        cam.x += Math.sin(t * 61) * a
        cam.y += Math.cos(t * 47) * a * 0.7
      }
    }
    Object.assign(live.cam, cam)
    const { rx, rz, s } = cam
    const cx = g.view.x + g.view.w / 2
    const cy = g.view.y + g.view.h / 2
    const camKey = `${cam.x.toFixed(1)}|${cam.y.toFixed(1)}|${s.toFixed(4)}|${rx.toFixed(2)}|${rz.toFixed(2)}`
    if (camKey !== lastCam) {
      lastCam = camKey
      if (!pw) {
        pw = ctx.paper.offsetWidth
        ph = ctx.paper.offsetHeight
      }
      const snap = (v: number) => Math.round(v / 26) * 26
      const pk = `${snap(cam.x - pw / 2)}|${snap(cam.y - ph / 2)}`
      if (pk !== lastPaper) {
        lastPaper = pk
        ctx.paper.style.transform = `translate3d(${snap(cam.x - pw / 2)}px, ${snap(cam.y - ph / 2)}px, 0)`
      }
      ctx.world.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale3d(${s.toFixed(4)}, ${s.toFixed(4)}, ${s.toFixed(4)}) translate3d(${(-cam.x).toFixed(1)}px, ${(-cam.y).toFixed(1)}px, 0)`
    }
    // speed streaks while the camera travels between worlds
    project(g, cam, cam.x, cam.y, 0, pr)
    const vx = (cam.x - prevSX) * s
    const vy = (cam.y - prevSY) * s
    prevSX = cam.x
    prevSY = cam.y
    const v = Math.hypot(vx, vy) / dt
    const target = S.tr >= 0 ? clamp01((v - 500) / 2600) * 0.6 : 0
    speedOp += (target - speedOp) * Math.min(1, dt * 8)
    if (ctx.speed) {
      const ang = (Math.atan2(vy, vx) * 180) / Math.PI
      const sk = speedOp < 0.01 ? 'off' : `${speedOp.toFixed(2)}|${ang.toFixed(0)}`
      if (sk !== lastSpeed) {
        lastSpeed = sk
        ctx.speed.style.opacity = speedOp < 0.01 ? '0' : speedOp.toFixed(2)
        if (speedOp >= 0.01) ctx.speed.style.transform = `rotate(${ang.toFixed(0)}deg)`
      }
    }

    /* -------------------------------------------- WRITE: worlds */
    for (let k = 0; k < 5; k++) {
      const w = S.world[k]
      const ws = w < 0.005 ? '0' : w > 0.995 ? '1' : w.toFixed(3)
      if (ws !== worldOp[k]) {
        worldOp[k] = ws
        for (const el of [ctx.worldBg[k], ctx.paperBg[k]]) {
          if (!el) continue
          el.style.opacity = ws
          el.style.visibility = ws === '0' ? 'hidden' : ''
        }
      }
      // each world is sealed: only its own artboard shows, neighbours cross-fade
      // in and out within the transition (opacity flattens 3-D, so only then)
      let bo = 0
      if (S.tr < 0) bo = k === sec ? 1 : 0
      else if (k === S.tr) bo = 1 - smooth(0.12, 0.55, S.tu)
      else if (k === S.tr + 1) bo = smooth(0.62, 0.92, S.tu)
      const bk = bo < 0.005 ? '0' : bo > 0.995 ? '1' : bo.toFixed(3)
      const el = ctx.boards[k]
      if (el && bk !== boardNear[k]) {
        boardNear[k] = bk
        el.dataset.near = bk === '0' ? '0' : '1'
        el.style.opacity = bk === '1' || bk === '0' ? '' : bk
      }
    }
    // dashed slots only show for regions that are building (or built)
    if (frame % 3 === 0) {
      for (let i = Math.max(0, sec - 1); i <= Math.min(4, sec + 1); i++) {
        const regs = g.regs[i]
        for (let r = 0; r < regs.length; r++) {
          const w = g.wins[i][r]
          const on = w && p >= (r === 0 ? SEC[i][0] - 0.02 : w[0]) ? '1' : '0'
          if (regs[r].el.dataset.on !== on) regs[r].el.dataset.on = on
        }
      }
    }
    const domWorld = S.world.indexOf(Math.max(...S.world))
    if (ctx.stage.dataset.world !== String(domWorld)) ctx.stage.dataset.world = String(domWorld)

    /* ---------------------------------------- WRITE: pieces */
    const fine = scene.fine
    const lookX = fine && pointer.inCanvas ? pointer.x : bots.monika.x
    const lookY = fine && pointer.inCanvas ? pointer.y : bots.monika.y
    let travelling: Piece | null = null
    let sig = ''
    for (const c of all) {
      const near = Math.abs(c.section - sec) <= 1
      const P = evalPose(c, p, peak)
      const k = c.p1 > c.p0 ? (p - c.p0) / (c.p1 - c.p0) : 0
      const moving = k > 0 && k < 1
      if (moving && (!travelling || c.p0 > travelling.p0)) travelling = c
      const placed = P.state === 'placed'
      sig += placed ? '1' : '0'

      // gulp: the bubble squashes as it spits a piece out
      if (c.lastSt !== P.state) {
        if (c.kind === 'bubble' && c.lastSt === 'inside' && P.state === 'leaping') wobV -= 2.4
        if (P.state === 'placed' && c.lastSt === 'leaping') c.wv += c.kind === 'hero' ? 9 : 5
        c.lastSt = P.state
        c.slot.dataset.st = P.state
        c.last = ''
      }
      if (!near && c.last && !moving) continue

      // idle life for heroes
      if (!scene.reduced && near && c.kind === 'hero') {
        if (P.state === 'roaming' && k <= 0 && c.section === sec && t > c.nextHop) {
          c.hv += 170 + Math.random() * 120
          c.nextHop = t + 6 + Math.random() * 9
        }
        c.hv += (-c.hz * 110 - c.hv * 8.5) * dt
        c.hz += c.hv * dt
        c.wave *= Math.exp(-2.6 * dt)
      }
      if (!scene.reduced && near) {
        c.wv += (-c.wob * 300 - c.wv * 10) * dt
        c.wob += c.wv * dt
        if (Math.abs(c.wob) < 0.0005 && Math.abs(c.wv) < 0.001) c.wob = c.wv = 0
      }

      let { x, y, z, rot, sx, sy } = P
      let op = P.op
      if (c.kind === 'hero' && P.state !== 'placed' && !scene.reduced) {
        const idle = k <= 0 ? 1 : 0
        const br = Math.sin(t * 1.9 + c.ph)
        sy *= 1 + 0.024 * br * idle
        sx *= 1 - 0.012 * br * idle
        if (idle && c.scx) rot += Math.max(-1, Math.min(1, (lookX - c.scx) / 520)) * 4
        z += Math.max(0, c.hz)
        rot += Math.sin(t * 17) * 6 * c.wave
        const hopSq = Math.max(0, -c.hz) * 0.004
        sx *= 1 + hopSq
        sy *= 1 - hopSq
      }
      // drop in when the section / region arrives
      if (c.in1 > c.in0) {
        const a = clamp01((p - c.in0) / (c.in1 - c.in0))
        if (a < 1) {
          z += (1 - a) * 380 * peak
          op *= Math.min(1, a * 3)
          const sq = Math.sin(Math.PI * Math.min(1, a * 1.4)) * (a > 0.7 ? 1 : 0)
          sx *= 1 + 0.08 * sq
          sy *= 1 - 0.08 * sq
        }
      }
      if (c.kind === 'hero' && c.section === 0 && live.intro < 1) {
        const a = live.intro
        z += (1 - a) * 380 * peak
        op *= Math.min(1, a * 3)
      }
      if (c.wob) {
        sx *= 1 + 0.05 * c.wob
        sy *= 1 - 0.05 * c.wob
      }
      const b = P.b
      const bill = b > 0.001 ? ` rotateZ(${(-rz * b).toFixed(2)}deg) rotateX(${(-rx * b).toFixed(2)}deg)` : ''
      const tr = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px)${bill} rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`
      if (tr !== c.last) {
        c.last = tr
        c.alive.style.transform = tr
      }
      const opS = op < 0.01 ? 'h' : op > 0.995 ? '1' : op.toFixed(2)
      if (opS !== c.lastOp) {
        c.lastOp = opS
        c.alive.style.opacity = op < 0.01 ? '0' : opS
        c.alive.style.visibility = op < 0.01 ? 'hidden' : ''
      }
      // screen centre (for the cursor look + the goo)
      if (near && (P.state !== 'placed' || P.ball > 0)) {
        project(g, cam, c.sx + c.w / 2 + x, c.sy + c.h / 2 + y, z, pr)
        c.scx = pr.x
        c.scy = pr.y
      }
      // contact shadow under the feet
      const height = Math.max(0, z)
      const shOp = (c.kind === 'hero' ? b : 0.6 * Math.min(1, op)) * op * (0.5 / (1 + height / 110)) * (P.state === 'placed' ? 0 : 1)
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
      // coloured trail behind a spat piece
      if (c.trail.length) {
        const on = c.kind === 'bubble' && moving && k > 0.04 && k < 0.94
        if (on) {
          let key = ''
          for (let j = 0; j < c.trail.length; j++) {
            const lag = (j + 1) * 0.045
            const pk = (p - (c.p1 - c.p0) * lag)
            const Q = evalPose(c, Math.max(c.p0 + 1e-6, pk), peak)
            const sc = (0.75 - j * 0.18) * Math.min(1, k * 5)
            const trS = `translate3d(${(Q.x + c.w / 2).toFixed(1)}px, ${(Q.y + c.h / 2).toFixed(1)}px, ${Q.z.toFixed(1)}px) scale(${sc.toFixed(2)})`
            key += trS
            c.trail[j].style.transform = trS
          }
          // restore the pose cache we just borrowed
          evalPose(c, p, peak)
          if (c.lastTrail === 'off') c.slot.classList.add('is-trail')
          c.lastTrail = key
        } else if (c.lastTrail !== 'off') {
          c.lastTrail = 'off'
          c.slot.classList.remove('is-trail')
        }
      }
    }
    live.travelling = travelling ? travelling.id : null

    /* ------------------------------------------- WRITE: text reveals */
    for (const tb of tAll) {
      if (tb.section === sec) sig += p >= tb.p1 ? 't' : 'u'
      if (Math.abs(tb.section - sec) > 1) continue
      const q = tb.p1 > tb.p0 ? clamp01((p - tb.p0) / (tb.p1 - tb.p0)) : p >= tb.p1 ? 1 : 0
      const n = tb.words.length
      const typing = tb.mode === 'type' && q > 0 && q < 1
      if (tb.el.classList.contains('is-typing') !== typing) tb.el.classList.toggle('is-typing', typing)
      for (let j = 0; j < n; j++) {
        let wq: number
        if (tb.mode === 'type') wq = clamp01((q * n - j) * 1.4)
        else wq = clamp01((q - (0.55 * j) / Math.max(1, n)) / 0.45)
        const qi = Math.round(wq * 40)
        if (qi === tb.last[j]) continue
        tb.last[j] = qi
        const el = tb.words[j]
        const w = qi / 40
        if (tb.mode === 'type') {
          el.style.opacity = w >= 1 ? '' : w.toFixed(2)
          el.style.transform = w >= 1 ? '' : `translateY(${((1 - w) * 0.25).toFixed(3)}em)`
        } else if (scene.reduced) {
          el.style.opacity = w.toFixed(2)
        } else {
          const e = outBack(w, 1.5)
          el.style.transform = w >= 1 ? '' : `translateY(${((1 - e) * 112).toFixed(1)}%) rotate(${((1 - w) * 7).toFixed(2)}deg)`
        }
      }
    }

    /* ----------------------------------------------- fx hooks */
    env.p = p
    env.t = t
    env.dt = dt
    env.reduced = scene.reduced
    env.narrow = g.narrow
    fxs.forEach((f) => {
      const i = f.section
      env.section = i
      env.near = Math.abs(i - sec) <= 1
      env.u = secU(i, p)
      for (let r = 0; r < 4; r++) env.reg[r] = regionProgress(g, i, r, p)
      env.win = (r: number) => g.wins[i]?.[r] ?? [0, 0]
      f.update(env)
    })

    /* ===================================== READ (eyes, batched) */
    readEyes()

    /* ===================================== WRITE: bubble + rest */
    if (S.impact !== lastImpact) {
      if (S.impact > lastImpact) wobV += 3.2
      lastImpact = S.impact
    }
    if (S.tr !== lastTr) lastTr = S.tr
    wobV += (-140 * wob - 6.5 * wobV) * dt
    wob += wobV * dt
    const intro = live.intro
    const alpha = S.vis * Math.min(1, intro * 1.5)
    if (ctx.bubble && alpha > 0.002) {
      let x0 = 1e9
      let y0 = 1e9
      let x1 = -1e9
      let y1 = -1e9
      const shake = scene.reduced ? 0 : S.shake
      fb.coreN = S.n
      let maxR = 0
      for (let i = 0; i < MAX_CORES; i++) {
        const o = i * 4
        if (i >= S.n) {
          fb.cores[o + 2] = 0
          continue
        }
        const C = S.cores[i]
        const jx = shake ? Math.sin(t * 53 + i * 1.7) * shake + Math.sin(t * 31) * shake * 0.4 : 0
        const jy = shake ? Math.cos(t * 47 + i) * shake * 0.8 : 0
        project(g, cam, C.x + jx, C.y + jy, C.z, pr)
        const Rs = C.R * pr.f * intro * (1 + 0.04 * Math.max(0, -wob))
        fb.cores[o] = pr.x
        fb.cores[o + 1] = pr.y
        fb.cores[o + 2] = Rs
        fb.cores[o + 3] = C.st
        fb.coreCols.set(C.col, i * 3)
        maxR = Math.max(maxR, Rs)
        x0 = Math.min(x0, pr.x - Rs * 2.4)
        x1 = Math.max(x1, pr.x + Rs * 2.4)
        y0 = Math.min(y0, pr.y - Rs * 2.2)
        y1 = Math.max(y1, pr.y + Rs * 2.2)
        // eyes ride each core
        const el = ctx.eyes[i]
        if (el) {
          const sc = Math.max(0.001, Rs / 100)
          const ek = `${pr.x.toFixed(1)}|${pr.y.toFixed(1)}|${sc.toFixed(3)}|${(1 - 0.06 * wob).toFixed(3)}`
          if (ek !== eyeKey[i]) {
            eyeKey[i] = ek
            el.style.transform = `translate3d(${(pr.x - 100).toFixed(1)}px, ${(pr.y - 100).toFixed(1)}px, 0) scale(${sc.toFixed(4)}, ${(sc * (1 - 0.06 * wob)).toFixed(4)})`
            el.style.opacity = Rs > 5 ? alpha.toFixed(2) : '0'
          }
          if (eyeMood[i] !== C.eyes) {
            eyeMood[i] = C.eyes
            el.dataset.eye = C.eyes
            const face = el.firstElementChild as HTMLElement | null
            if (face) face.style.transform = EYE_SCALE[C.eyes]
          }
        }
      }
      for (let i = S.n; i < 3; i++) {
        const el = ctx.eyes[i]
        if (el && eyeKey[i] !== 'off') {
          eyeKey[i] = 'off'
          el.style.opacity = '0'
        }
      }
      if (ctx.eyes[0]) {
        live.bubScreen.x = fb.cores[0]
        live.bubScreen.y = fb.cores[1]
        live.bubScreen.r = fb.cores[2]
      }
      // balls: passengers + pieces still leaving the goo
      let n = 0
      for (const b of S.balls) {
        if (n >= MAX_BALLS) break
        project(g, cam, b.x, b.y, b.z, pr)
        const o = n * 4
        fb.balls[o] = pr.x
        fb.balls[o + 1] = pr.y
        fb.balls[o + 2] = b.r * pr.f * intro
        fb.cols.set(b.col, n * 3)
        n++
      }
      for (const c of all) {
        if (n >= MAX_BALLS) break
        const P = c.pose
        if (P.ball <= 0 || c.section !== sec) continue
        const a = P.ball
        const o = n * 4
        fb.balls[o] = c.scx
        fb.balls[o + 1] = c.scy
        fb.balls[o + 2] = maxR * 0.42 * a
        fb.cols.set(col(c.tone), n * 3)
        x0 = Math.min(x0, c.scx - 40)
        x1 = Math.max(x1, c.scx + 40)
        y0 = Math.min(y0, c.scy - 40)
        y1 = Math.max(y1, c.scy + 40)
        n++
      }
      for (let i = n; i < MAX_BALLS; i++) fb.balls[i * 4 + 2] = 0
      for (let i = 0; i < n; i++) {
        const o = i * 4
        const r = fb.balls[o + 2]
        x0 = Math.min(x0, fb.balls[o] - r)
        x1 = Math.max(x1, fb.balls[o] + r)
        y0 = Math.min(y0, fb.balls[o + 1] - r)
        y1 = Math.max(y1, fb.balls[o + 1] + r)
      }
      fb.count = n
      fb.pal.set(S.pal[0], 0)
      fb.pal.set(S.pal[1], 3)
      fb.pal.set(S.pal[2], 6)
      fb.split = S.split
      fb.dir = -(S.dir + (rz * Math.PI) / 180)
      fb.rot = S.rot
      fb.wobble = wob
      fb.alpha = alpha
      fb.flash = S.flash
      fb.shadow = S.shadow
      fb.bbox[0] = x0
      fb.bbox[1] = y0
      fb.bbox[2] = x1
      fb.bbox[3] = y1 + 30
      ctx.bubble.render(fb, t)
      shown = true
    } else if (shown) {
      shown = false
      ctx.bubble?.clear()
      ctx.eyes.forEach((el, i) => {
        el.style.opacity = '0'
        eyeKey[i] = 'off'
      })
      live.bubScreen.r = 0
    }

    /* ------------------------------------------ mascot + confetti */
    if (ctx.mascot) {
      const m = S.mascot
      const landed = sec === 4 && secU(4, p) >= 0.9
      const bob = landed || scene.reduced ? 0 : Math.sin(t * 2.2) * 8
      const bill = landed ? '' : ` rotateZ(${(-rz).toFixed(2)}deg) rotateX(${(-rx).toFixed(2)}deg)`
      const mk = m.vis ? `translate3d(${(m.x - 40).toFixed(1)}px, ${(m.y - 40).toFixed(1)}px, ${(m.z + bob).toFixed(1)}px)${bill} scale(${m.s.toFixed(3)})` : 'off'
      if (mk !== lastMascot) {
        lastMascot = mk
        if (mk === 'off') ctx.mascot.style.opacity = '0'
        else {
          ctx.mascot.style.opacity = '1'
          ctx.mascot.style.transform = mk
        }
        ctx.mascot.dataset.landed = landed ? '1' : '0'
      }
    }
    if (ctx.confetti) {
      const c = S.pop
      const ck = c < 0 || c >= 1 ? 'off' : c.toFixed(3) + camKey
      if (ck !== lastConf) {
        lastConf = ck
        if (ck === 'off') ctx.confetti.style.opacity = '0'
        else {
          ctx.confetti.style.opacity = '1'
          const P = S.popAt
          ctx.confetti.style.transform = `translate3d(${P.x.toFixed(1)}px, ${P.y.toFixed(1)}px, ${P.z.toFixed(1)}px) rotateZ(${(-rz).toFixed(2)}deg) rotateX(${(-rx).toFixed(2)}deg)`
          const tau = c
          confEls.forEach((el, k) => {
            const a = rnd('conf', k) * Math.PI * 2
            const sp = 260 + rnd('conf', k + 40) * 420
            const x = Math.cos(a) * sp * Math.min(1, tau * 2.2) * peak
            const y = (Math.sin(a) * sp * 0.6 * Math.min(1, tau * 2.2) + 1300 * tau * tau) * peak
            const r = (rnd('conf', k + 80) - 0.5) * 900 * tau
            const o = 1 - smooth(0.7, 1, tau)
            el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(0)}deg)`
            el.style.opacity = o.toFixed(2)
          })
        }
      }
    }

    updateEyes(t, dt, lookX, lookY)
    updateCursors(t, dt)
    updateRuler(p)

    /* ------------------------------------------------ chrome sinks */
    chapterCh.set(sec)
    let curReg = 0
    for (let r = 0; r < (g.wins[sec]?.length ?? 1); r++) if (p >= g.wins[sec][r][0] - 0.002) curReg = r
    regionCh.set(curReg)
    if (sig !== placedSig) {
      placedSig = sig
      placedVer.set(placedVer.get() + 1)
    }
    const mood = S.tr >= 0 ? S.mood : null
    if (mood !== lastMood) {
      lastMood = mood
      moodCh.set(mood)
    }
    const hov = hover.get()
    const selId = hov ?? (S.tr >= 0 ? 'bubble' : live.travelling ?? lastPlacedIn(sec, p))
    inspSel.set(selId)
    const sel = selId && selId !== 'bubble' ? pieces.get(selId) : null
    let st: InspState = 'waiting'
    if (sel) st = sel.pose.state === 'placed' ? 'placed' : sel.pose.state === 'leaping' ? 'flying' : sel.pose.state === 'inside' ? 'inside' : 'waiting'
    inspState.set(st)
    if (frame % 2 === 0) {
      let vals: Record<string, string> | null = null
      if (sel) {
        const b = g.boards[sel.section]
        const P = sel.pose
        vals = {
          x: String(Math.round(sel.sx - b.x + P.x)),
          y: String(Math.round(sel.sy - b.y + P.y)),
          z: String(Math.round(P.z + Math.max(0, sel.hz))),
          r: `${P.rot.toFixed(1)}°`,
          w: String(Math.round(sel.w * P.sx)),
          h: String(Math.round(sel.h * P.sy)),
        }
      } else if (selId === 'bubble') {
        const C = S.cores[0]
        vals = {
          x: String(Math.round(C.x)),
          y: String(Math.round(C.y)),
          z: String(Math.round(C.z)),
          r: `${((S.rot * 180) / Math.PI % 360).toFixed(0)}°`,
          w: String(Math.round(C.R * 2 * (1 + Math.max(0, C.st)))),
          h: String(Math.round(C.R * 2 * (1 - Math.max(0, C.st) * 0.26))),
        }
      }
      if (vals) {
        for (const key in vals) {
          const sink = bsinks[key as keyof typeof bsinks]
          if (sink && inspCache[key] !== vals[key]) {
            inspCache[key] = vals[key]
            sink.textContent = vals[key]
          }
        }
      }
      if (selId === 'bubble' && bsinks.fill) {
        const c = S.pal[0]
        const h = '#' + c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
        if (inspCache.hex !== h) {
          inspCache.hex = h
          bsinks.fill.style.background = h
          if (bsinks.hex) bsinks.hex.textContent = h.slice(1)
        }
      } else if (inspCache.hex) inspCache.hex = ''
    }
    const zoom = `${Math.round(s * 100)}%`
    if (ui.zoom && zoom !== lastZoom) {
      lastZoom = zoom
      ui.zoom.textContent = zoom
    }
  }

  function lastPlacedIn(sec: number, p: number): string | null {
    let best: Piece | null = null
    for (const c of all) {
      if (c.section !== sec || c.p1 > p) continue
      if (!best || c.p1 > best.p1) best = c
    }
    return best ? best.id : null
  }

  gsap.ticker.add(tick)
  return () => {
    gsap.ticker.remove(tick)
    live.state = null
  }
}

