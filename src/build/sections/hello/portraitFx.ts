/**
 * Drives the Hello portrait from the scroll and the pointer (see ./portrait.ts
 * for the shader). Everything that decides *what* she looks like is a pure
 * function of the progress (arrival burns, the taste front); only the pointer
 * trail and the rim flicker are time-based, and they heal back to the rest
 * state, so scrubbing stays exact. Frames are drawn only while something is
 * changing and the portrait is on screen.
 */
import { offsetIn } from '../../../scene/layout'
import { scene } from '../../../scene/store'
import { project, unproject, type Geo, type Proj } from '../../camera'
import { live } from '../../loop'
import { range, registerFx, type FxEnv } from '../../runtime'
import { PortraitGL, MODES, type PortraitFrame } from './portrait'
import { taste, tasteFx } from './taste'

const SRC = '/monika-cut.webp'
const FIELD = '/monika-field.webp'
/** trail stamp radius, fraction of the canvas height */
const RAD = 0.09
const HEAL_S = 2.6
const IDLE_S = 6
const EIGHT_S = 3.2

export function mountPortrait(board: HTMLElement) {
  const fig = board.querySelector<HTMLElement>('.h-port')
  const host = board.querySelector<HTMLElement>('.h-port-gl')
  const img = board.querySelector<HTMLImageElement>('.h-port-img')
  const twin = board.querySelector<HTMLElement>('.hd-img')
  const cue = board.querySelector<HTMLElement>('.h-cue')
  if (!fig || !host || !img) return () => {}

  const canvas = document.createElement('canvas')
  canvas.className = 'h-port-cv'
  host.appendChild(canvas)
  let geo: Geo | null = null
  let dirty = true
  const gl = new PortraitGL(canvas, SRC, FIELD, () => {
    dirty = true
    fig.dataset.gl = gl.ok ? '1' : '0'
  })
  fig.dataset.gl = gl.ok ? 'wait' : '0'
  const mode = new URLSearchParams(location.search).get('construct') === 'mesh' ? MODES.mesh : MODES.iso

  /* ---- pointer (mouse: hover; touch/pen: while pressed) */
  const ptr = { x: 0, y: 0, t: -1, touch: false, down: false }
  const onMove = (e: PointerEvent) => {
    ptr.x = e.clientX
    ptr.y = e.clientY
    ptr.t = performance.now()
    ptr.touch = e.pointerType !== 'mouse'
  }
  const onDown = (e: PointerEvent) => {
    onMove(e)
    if (e.pointerType !== 'mouse') ptr.down = true
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') ptr.down = false
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('pointerup', onUp, { passive: true })
  window.addEventListener('pointercancel', onUp, { passive: true })

  /* ---- geometry (board px) */
  const box: [number, number, number, number] = [0, 0, 1, 1]
  const ph: [number, number, number, number] = [0, 0.38, 1, 1]
  let reachA = 0
  let reachB = 0
  const corners = [0, 0, 0, 0, 0, 0, 0, 0]

  const measure = (g: Geo) => {
    geo = g
    const o = offsetIn(fig, board)
    box[0] = o.x
    box[1] = o.y
    box[2] = Math.max(1, o.w)
    box[3] = Math.max(1, o.h)
    if (twin) {
      const t = offsetIn(twin, board)
      ph[0] = (t.x - o.x) / box[2]
      ph[1] = (t.y - o.y) / box[3]
      ph[2] = (t.x + t.w - o.x) / box[2]
      ph[3] = (t.y + t.h - o.y) / box[3]
    }
    // the largest scale the camera shows her at: the flat hold
    let sMax = 0.5
    g.keys[0].forEach((k) => (sMax = Math.max(sMax, k.c.s)))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const k = Math.min(1, 2048 / Math.max(box[2], box[3]) / (sMax * dpr))
    gl.size(box[2] * sMax * dpr * k, box[3] * sMax * dpr * k)
    const b = g.boards[0]
    corners[0] = b.x + box[0]
    corners[1] = b.y + box[1]
    corners[2] = b.x + box[0] + box[2]
    corners[3] = b.y + box[1]
    corners[4] = b.x + box[0]
    corners[5] = b.y + box[1] + box[3]
    corners[6] = b.x + box[0] + box[2]
    corners[7] = b.y + box[1] + box[3]
    dirty = true
  }

  /* ---- state */
  const F: PortraitFrame = { time: 0, dt: 0, box, sw: [0, 0], r: 0, ring: 0, arrA: 0, arrB: 0, ph, phOn: 1, man: 0, mode, hot: 1, seg: null, rad: RAD }
  const seg: [number, number, number, number] = [0, 0, 0, 0]
  const pr: Proj = { x: 0, y: 0, f: 1 }
  const wp = { x: 0, y: 0 }
  let prevU = -1
  let prevV = -1
  let lastPtrT = -1
  let lastStamp = -1e9
  let key = ''
  let wasOn = false
  let interacted = false
  let holdT = 0
  let eightT = -1
  let eightDone = false
  let cueK = ''
  let fbK = ''

  const toUV = (cx: number, cy: number) => {
    if (!geo) return false
    unproject(geo, live.cam, cx, cy, wp)
    const b = geo.boards[0]
    curU = (wp.x - b.x - box[0]) / box[2]
    curV = (wp.y - b.y - box[1]) / box[3]
    return true
  }
  let curU = 0
  let curV = 0

  const onScreen = () => {
    if (!geo) return false
    let x0 = 1e9
    let y0 = 1e9
    let x1 = -1e9
    let y1 = -1e9
    for (let i = 0; i < 8; i += 2) {
      project(geo, live.cam, corners[i], corners[i + 1], 0, pr)
      x0 = Math.min(x0, pr.x)
      x1 = Math.max(x1, pr.x)
      y0 = Math.min(y0, pr.y)
      y1 = Math.max(y1, pr.y)
    }
    return x1 > 0 && y1 > 0 && x0 < window.innerWidth && y0 < window.innerHeight
  }

  const update = (e: FxEnv) => {
    const now = performance.now()
    /* arrival: placeholder → construct as the front crosses her, then colour */
    const [A, B] = e.win(0)
    const L = B - A || 1
    const pF = tasteFx.pFlip
    const pW = tasteFx.pW1
    if (geo && tasteFx.reachT) {
      const dN = Math.max(0, Math.hypot(Math.max(box[0] - tasteFx.sx, 0, tasteFx.sx - box[0] - box[2]), Math.max(box[1] - tasteFx.sy, 0, tasteFx.sy - box[1] - box[3])))
      const dF = Math.max(
        Math.hypot(box[0] - tasteFx.sx, box[1] - tasteFx.sy),
        Math.hypot(box[0] + box[2] - tasteFx.sx, box[1] - tasteFx.sy),
        Math.hypot(box[0] - tasteFx.sx, box[1] + box[3] - tasteFx.sy),
        Math.hypot(box[0] + box[2] - tasteFx.sx, box[1] + box[3] - tasteFx.sy),
      )
      reachA = pF + tasteFx.reachT(dN) * (pW - pF)
      reachB = pF + tasteFx.reachT(dF) * (pW - pF)
    }
    const aStart = Math.max(pF + 0.02 * L, reachA)
    const aEnd = Math.max(aStart + 0.12 * L, reachB)
    const bStart = aEnd + 0.05 * L
    const bEnd = Math.min(B - 0.03 * L, bStart + 0.2 * L)
    const arrA = e.reduced ? 1 : range(aStart, aEnd, e.p)
    const arrB = e.reduced ? 1 : range(bStart, Math.max(bStart + 0.01, bEnd), e.p)
    // the switch is being played (flat hold): the taste front itself burns her away / back
    // in over the grey placeholder (no construct, she is colour wherever the front has passed)
    const man = !e.reduced && tasteFx.manual && range(pF, pW, e.p) >= 1
    const T = tasteFx.T
    // she is on stage (and can be played with) only while taste is fully on
    const shown = arrA >= 1 && arrB >= 1 && T >= 1

    // no WebGL: the plain image takes the arrival (a cross-fade), the DOM twin leaves
    if (!gl.ok || !gl.ready) {
      const k = `${arrA.toFixed(3)}|${arrB.toFixed(3)}|${gl.ok ? 1 : 0}|${man ? T.toFixed(2) : 1}`
      if (k !== fbK) {
        fbK = k
        img.style.opacity = gl.ok ? '0' : (Math.min(arrA, arrB) * (man ? T : 1)).toFixed(3)
        if (twin) twin.style.opacity = (1 - arrA * (man ? T : 1)).toFixed(3)
      }
      return
    } else if (fbK !== 'gl') {
      fbK = 'gl'
      img.style.opacity = ''
      if (twin) twin.style.visibility = 'hidden'
    }

    const vis = e.near && e.u < 1.02 && onScreen()
    if (!vis) {
      if (wasOn) {
        wasOn = false
        gl.resetTrail()
        lastStamp = -1e9
        key = ''
      }
      holdT = 0
      eightT = -1
      return
    }

    /* pointer → a capsule segment in canvas uv */
    let haveSeg = false
    const playable = shown && !scene.reduced
    const fresh = ptr.t > 0 && ptr.t !== lastPtrT && (!ptr.touch || ptr.down)
    if (playable && fresh && toUV(ptr.x, ptr.y)) {
      lastPtrT = ptr.t
      const inside = curU > -0.08 && curU < 1.08 && curV > -0.05 && curV < 1.05
      if (inside) {
        const u0 = prevU < -0.5 ? curU : prevU
        const v0 = prevU < -0.5 ? curV : prevV
        seg[0] = u0
        seg[1] = v0
        seg[2] = curU
        seg[3] = curV
        const sp = Math.hypot((curU - u0) * box[2], (curV - v0) * box[3]) / Math.max(0.008, e.dt) // board px / s
        F.rad = RAD + Math.min(0.055, sp * 0.000022)
        haveSeg = true
        lastStamp = now
        if (!interacted) interacted = true
        prevU = curU
        prevV = curV
      } else prevU = -1
    } else if (!fresh && now - ptr.t > 120) prevU = -1

    /* idle in the hold: one slow figure-eight passes over her face and shoulder */
    const inHold = taste.can
    if (inHold && shown) holdT += e.dt
    else {
      holdT = 0
      eightT = -1
    }
    if (!haveSeg && inHold && !interacted && !eightDone && holdT > IDLE_S && eightT < 0) eightT = 0
    if (eightT >= 0 && !haveSeg) {
      const t0 = eightT
      eightT += e.dt
      const at = (t: number, o: { u: number; v: number }) => {
        const a = (t / EIGHT_S) * Math.PI * 2 - Math.PI / 2
        o.u = 0.5 + 0.2 * Math.cos(a)
        o.v = 0.36 + 0.11 * Math.sin(2 * a)
        return o
      }
      const p0 = at(t0, { u: 0, v: 0 })
      const p1 = at(Math.min(EIGHT_S, eightT), { u: 0, v: 0 })
      seg[0] = p0.u
      seg[1] = p0.v
      seg[2] = p1.u
      seg[3] = p1.v
      F.rad = RAD * 0.92
      haveSeg = true
      lastStamp = now
      if (eightT >= EIGHT_S) {
        eightT = -1
        eightDone = true
      }
    }
    if (interacted) eightT = -1
    // dev: `__momoBurn = true` holds the whole portrait burnt through (to judge the construct)
    if (import.meta.env.DEV && (window as unknown as { __momoBurn?: boolean }).__momoBurn) {
      seg[0] = 0.5
      seg[1] = -0.2
      seg[2] = 0.5
      seg[3] = 1.2
      F.rad = 0.9
      haveSeg = true
      lastStamp = now
    }

    /* the cue fades after the first interaction */
    const cueOn = shown && !interacted && e.u < 0.6 ? '1' : '0'
    if (cue && cueOn !== cueK) {
      cueK = cueOn
      cue.dataset.on = cueOn
    }

    // taste off (or being switched): no portrait, so no trail either
    if (!shown && lastStamp > -1e8) {
      gl.resetTrail()
      lastStamp = -1e9
      prevU = -1
      key = ''
    }

    /* draw only while something changes */
    const ring = T > 0 && T < 1 ? 1 : 0
    const moving = ring || (arrA > 0 && arrA < 1) || (arrB > 0 && arrB < 1)
    const trailLive = now - lastStamp < HEAL_S * 1000
    const k = `${arrA.toFixed(4)}|${arrB.toFixed(4)}|${tasteFx.r.toFixed(1)}|${box.map((v) => v.toFixed(1)).join(',')}`
    if (!dirty && !moving && !trailLive && !haveSeg && k === key) return
    key = k
    dirty = false
    wasOn = true
    F.time = e.t
    F.dt = Math.min(0.05, e.dt)
    F.sw[0] = tasteFx.sx
    F.sw[1] = tasteFx.sy
    F.man = man ? 1 : 0
    F.r = tasteFx.r
    F.ring = ring
    F.arrA = arrA
    F.arrB = arrB
    F.seg = haveSeg ? seg : null
    gl.render(F)
  }

  const off = registerFx({ id: 'hello-portrait', section: 0, measure, update })
  // dev: grab the canvas right after a draw (for inspecting the shader 1:1)
  const w = window as unknown as { __momoShot?: () => string; __momoBench?: (n: number) => string }
  if (import.meta.env.DEV) {
    w.__momoShot = () => (gl.render(F), canvas.toDataURL('image/png'))
    // dev: time n full frames (trail pass + main pass, with a live stamp and burning edges), GPU-synchronised
    w.__momoBench = (n: number) => {
      const s0: [number, number, number, number] = [0.3, 0.3, 0.7, 0.45]
      const f = { ...F, seg: s0, ring: 1, arrA: 0.6, arrB: 0.4, dt: 1 / 60 }
      gl.render(f)
      gl.sync()
      const ts: number[] = []
      for (let i = 0; i < n; i++) {
        const t0 = performance.now()
        f.time += 1 / 60
        gl.render(f)
        gl.sync()
        ts.push(performance.now() - t0)
      }
      ts.sort((a, b) => a - b)
      return `${canvas.width}×${canvas.height}: median ${ts[n >> 1].toFixed(2)}ms, p95 ${ts[Math.floor(n * 0.95)].toFixed(2)}ms`
    }
  }
  return () => {
    off()
    if (import.meta.env.DEV) {
      delete w.__momoShot
      delete w.__momoBench
    }
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    gl.dispose()
    canvas.remove()
    delete fig.dataset.gl
    img.style.opacity = ''
    if (twin) {
      twin.style.opacity = ''
      twin.style.visibility = ''
    }
  }
}

