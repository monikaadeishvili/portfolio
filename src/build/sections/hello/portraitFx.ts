/**
 * Drives the Hello portrait from the scroll and the pointer (see ./portrait3d.ts
 * for the renderer). What she looks like is a pure function of the progress
 * (arrival burns, the taste front); only the hover reveal, the tilt and the rim
 * flicker are time-based, and they settle back to rest, so scrubbing stays
 * exact. three.js is loaded on demand, so it never weighs on the first paint.
 *
 * Experiment: she is a 3-D relief model (a clay statue) at rest; hovering her
 * reveals the original photo through a burning-edged circle grown from the
 * cursor. The model tilts toward the pointer and sways gently.
 */
import { registerPickSource } from '../../../canvas/colorSample'
import { offsetIn } from '../../../scene/layout'
import { scene } from '../../../scene/store'
import { project, unproject, type Geo, type Proj } from '../../camera'
import { live } from '../../loop'
import { range, registerFx, type FxEnv } from '../../runtime'
import type { Portrait3DFrame } from './portrait3d'

import { taste, tasteFx } from './taste'

const SRC = '/monika-new.webp'
const DEPTH = '/monika-new-depth.png'
/** hover reveal: grow / close times (s) */
const HV_IN = 0.8
const HV_OUT = 0.45
/** tilt toward the pointer, radians at the screen edge (yaw, pitch) */
const TILT_Y = 0.3
const TILT_X = 0.1
const IDLE_S = 6
const PEEK_S = 1.7

interface Renderer {
  ok: boolean
  ready: boolean
  size(w: number, h: number): void
  render(f: Portrait3DFrame): void
  hit?(u: number, v: number): boolean
  pickReq?: [number, number] | null
  picked?: [number, number, number, number] | null
  setFrame?(cx: number, cy: number, fh: number): void
  resetTrail(): void
  sync(): void
  dispose(): void
}
const pending = (): Renderer => ({ ok: true, ready: false, size() {}, render() {}, resetTrail() {}, sync() {}, dispose() {} })

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
  let disposed = false
  let gl: Renderer = pending()
  const sized: [number, number] = [0, 0]
  fig.dataset.gl = 'wait'
  import('./portrait3d').then(
    (m) => {
      if (disposed) return
      const r = new m.Portrait3D(canvas, SRC, DEPTH, () => {
        dirty = true
        fig.dataset.gl = r.ok ? '1' : '0'
      })
      gl = r
      if (!r.ok) fig.dataset.gl = '0'
      if (sized[0]) r.size(sized[0], sized[1])
      r.setFrame(frame[0], frame[1], frame[2])
      dirty = true
    },
    () => {
      gl.ok = false
      fig.dataset.gl = '0'
    },
  )

  // the dock's Color picker reads her pixel from the composite (a frame late)
  const unPick = registerPickSource({
    el: canvas,
    read(x, y) {
      const r = canvas.getBoundingClientRect()
      if (!gl.ready || x < r.left || y < r.top || x >= r.right || y >= r.bottom) return null
      gl.pickReq = [Math.floor(((x - r.left) / r.width) * canvas.width), Math.floor(((y - r.top) / r.height) * canvas.height)]
      return gl.picked ?? null
    },
  })

  /* ---- pointer (mouse: hover; touch/pen: while pressed) */
  const ptr = { x: 0, y: 0, t: -1, touch: false, down: false, out: true }
  const onMove = (e: PointerEvent) => {
    ptr.x = e.clientX
    ptr.y = e.clientY
    ptr.t = performance.now()
    ptr.touch = e.pointerType !== 'mouse'
    ptr.out = false
  }
  const onDown = (e: PointerEvent) => {
    onMove(e)
    if (e.pointerType !== 'mouse') ptr.down = true
  }
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') ptr.down = false
  }
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) ptr.out = true
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('pointerup', onUp, { passive: true })
  window.addEventListener('pointercancel', onUp, { passive: true })
  document.addEventListener('pointerout', onOut, { passive: true })

  /* ---- geometry (board px) */
  const box: [number, number, number, number] = [0, 0, 1, 1]
  const cbox: [number, number, number, number] = [0, 0, 1, 1]
  const frame: [number, number, number] = [0.5, 0.5, 1]
  /** her box uv → canvas uv */
  const cu = (u: number) => (box[0] + u * box[2] - cbox[0]) / cbox[2]
  const cv = (v: number) => (box[1] + v * box[3] - cbox[1]) / cbox[3]
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
    // the canvas reaches past the board on both sides and below her feet: the
    // dust flies freely across the whole width (it fades out softly long before
    // any canvas edge, so it never reads as a rectangle); she stays where the
    // layout puts her
    const bw = g.boards[0].w
    const ex = g.narrow ? bw * 0.45 : 320
    const ey = box[3] * 0.2
    cbox[0] = -ex
    cbox[1] = -ey * 0.5
    cbox[2] = Math.max(box[2], bw) + ex * 2
    cbox[3] = box[1] + box[3] + ey * 1.5
    host.style.left = `${cbox[0] - box[0]}px`
    host.style.top = `${cbox[1] - box[1]}px`
    host.style.width = `${cbox[2]}px`
    host.style.height = `${cbox[3]}px`
    frame[0] = cu(0.5)
    frame[1] = cv(0.5)
    frame[2] = box[3] / cbox[3]
    gl.setFrame?.(frame[0], frame[1], frame[2])
    if (twin) {
      const t = offsetIn(twin, board)
      ph[0] = (t.x - cbox[0]) / cbox[2]
      ph[1] = (t.y - cbox[1]) / cbox[3]
      ph[2] = (t.x + t.w - cbox[0]) / cbox[2]
      ph[3] = (t.y + t.h - cbox[1]) / cbox[3]
    }
    // the largest scale the camera shows her at: the flat hold
    let sMax = 0.5
    g.keys[0].forEach((k) => (sMax = Math.max(sMax, k.c.s)))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const k = Math.min(1, 2400 / Math.max(cbox[2], cbox[3]) / (sMax * dpr))
    sized[0] = cbox[2] * sMax * dpr * k
    sized[1] = cbox[3] * sMax * dpr * k
    gl.size(sized[0], sized[1])
    const b = g.boards[0]
    corners[0] = b.x + cbox[0]
    corners[1] = b.y + cbox[1]
    corners[2] = b.x + cbox[0] + cbox[2]
    corners[3] = b.y + cbox[1]
    corners[4] = b.x + cbox[0]
    corners[5] = b.y + cbox[1] + cbox[3]
    corners[6] = b.x + cbox[0] + cbox[2]
    corners[7] = b.y + cbox[1] + cbox[3]
    dirty = true
  }

  /* ---- state */
  const F: Portrait3DFrame = { time: 0, dt: 0, box: cbox, sw: [0, 0], r: 0, ring: 0, arrA: 0, arrB: 0, ph, phOn: 1, man: 0, hot: 1, tilt: [0, 0], hv: [0.5, 0.3, 0], pt: [0.5, 0.5, 0] }
  const pr: Proj = { x: 0, y: 0, f: 1 }
  const wp = { x: 0, y: 0 }
  let key = ''
  let wasOn = false
  let interacted = false
  let holdT = 0
  let peekT = -1
  let peekDone = false
  let cueK = ''
  let fbK = ''
  let hvRaw = 0
  let ptRaw = 0
  let curU = 0
  let curV = 0

  const toUV = (cx: number, cy: number) => {
    if (!geo) return false
    unproject(geo, live.cam, cx, cy, wp)
    const b = geo.boards[0]
    curU = (wp.x - b.x - box[0]) / box[2]
    curV = (wp.y - b.y - box[1]) / box[3]
    return true
  }

  /** the portrait's on-screen rect (and whether it is visible at all) */
  const scr = { x0: 0, y0: 0, x1: 0, y1: 0 }
  const onScreen = () => {
    if (!geo) return false
    scr.x0 = scr.y0 = 1e9
    scr.x1 = scr.y1 = -1e9
    for (let i = 0; i < 8; i += 2) {
      project(geo, live.cam, corners[i], corners[i + 1], 0, pr)
      scr.x0 = Math.min(scr.x0, pr.x)
      scr.x1 = Math.max(scr.x1, pr.x)
      scr.y0 = Math.min(scr.y0, pr.y)
      scr.y1 = Math.max(scr.y1, pr.y)
    }
    return scr.x1 > 0 && scr.y1 > 0 && scr.x0 < window.innerWidth && scr.y0 < window.innerHeight
  }

  const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

  const update = (e: FxEnv) => {
    /* arrival: placeholder → construct as the front crosses her, then the statue */
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
    const man = !e.reduced && tasteFx.manual && range(pF, pW, e.p) >= 1
    const T = tasteFx.T
    const shown = arrA >= 1 && arrB >= 1 && T >= 1

    // no WebGL (or still loading three.js): the plain image takes the arrival
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
        key = ''
      }
      hvRaw = 0
      F.hv[2] = 0
      holdT = 0
      peekT = -1
      return
    }

    const playable = shown && !scene.reduced
    const dt = Math.min(0.05, e.dt)

    /* hover: is the pointer over her? */
    let inside = false
    let near = false
    const live1 = !ptr.out && ptr.t > 0 && (!ptr.touch || ptr.down)
    if (playable && live1 && toUV(ptr.x, ptr.y)) {
      // near: the dust parts around the pointer; inside (over her, not the empty box): the photo
      near = curU > -0.15 && curU < 1.15 && curV > -0.08 && curV < 1.05
      inside = curU > 0.02 && curU < 0.98 && curV > 0.02 && curV < 1 && (gl.hit ? gl.hit(curU, curV) : true)
      if (near) {
        F.pt[0] = cu(curU)
        F.pt[1] = cv(curV)
      }
      if (inside) {
        const k = 1 - Math.exp(-dt * 12)
        F.hv[0] += (cu(curU) - F.hv[0]) * (hvRaw <= 0 ? 1 : k)
        F.hv[1] += (cv(curV) - F.hv[1]) * (hvRaw <= 0 ? 1 : k)
        if (!interacted) interacted = true
      }
    }

    /* idle in the hold: one slow peek at the photo, from her face */
    const inHold = taste.can
    if (inHold && shown) holdT += dt
    else {
      holdT = 0
      peekT = -1
    }
    if (!inside && inHold && !interacted && !peekDone && holdT > IDLE_S && peekT < 0) peekT = 0
    let peek = false
    if (peekT >= 0 && !inside) {
      peekT += dt
      if (peekT < PEEK_S * 0.55) {
        peek = true
        F.hv[0] = cu(0.4)
        F.hv[1] = cv(0.16)
      }
      if (peekT >= PEEK_S) {
        peekT = -1
        peekDone = true
      }
    }
    if (interacted) peekT = -1
    const want = (inside || peek) && playable
    hvRaw = want ? Math.min(1, hvRaw + dt / HV_IN) : Math.max(0, hvRaw - dt / HV_OUT)
    if (!playable) hvRaw = 0
    F.hv[2] = ease(hvRaw)
    ptRaw = near && playable ? Math.min(1, ptRaw + dt / 0.25) : Math.max(0, ptRaw - dt / 0.6)
    F.pt[2] = ease(ptRaw)

    /* tilt toward the pointer (+ a gentle sway), back to rest when she is not on stage */
    let ty = 0
    let tx = 0
    if (playable) {
      const cx = (scr.x0 + scr.x1) / 2
      const cy = (scr.y0 + scr.y1) / 2
      if (live1 && !ptr.touch) {
        ty = Math.max(-1, Math.min(1, (ptr.x - cx) / (window.innerWidth * 0.5))) * TILT_Y
        tx = Math.max(-1, Math.min(1, (ptr.y - cy) / (window.innerHeight * 0.5))) * TILT_X
      }
      ty += Math.sin(e.t * 0.55) * 0.06
      tx += Math.sin(e.t * 0.41 + 1.3) * 0.02
    }
    const tk = 1 - Math.exp(-dt * 4.5)
    F.tilt[0] += (tx - F.tilt[0]) * tk
    F.tilt[1] += (ty - F.tilt[1]) * tk
    const tiltLive = playable || Math.abs(F.tilt[0]) + Math.abs(F.tilt[1]) > 1e-4
    if (!tiltLive) F.tilt[0] = F.tilt[1] = 0

    /* the cue fades after the first interaction */
    const cueOn = shown && !interacted && e.u < 0.6 ? '1' : '0'
    if (cue && cueOn !== cueK) {
      cueK = cueOn
      cue.dataset.on = cueOn
    }

    /* draw only while something changes */
    const ring = T > 0 && T < 1 ? 1 : 0
    const moving = ring || (arrA > 0 && arrA < 1) || (arrB > 0 && arrB < 1) || (hvRaw > 0 && hvRaw < 1) || inside || tiltLive
    const k = `${arrA.toFixed(4)}|${arrB.toFixed(4)}|${tasteFx.r.toFixed(1)}|${cbox.map((v) => v.toFixed(1)).join(',')}|${hvRaw.toFixed(3)}`
    if (!dirty && !moving && k === key) return
    key = k
    dirty = false
    wasOn = true
    F.time = e.t
    F.dt = dt
    F.sw[0] = tasteFx.sx
    F.sw[1] = tasteFx.sy
    F.man = man ? 1 : 0
    F.r = tasteFx.r
    F.ring = ring
    F.arrA = arrA
    F.arrB = arrB
    gl.render(F)
  }

  const off = registerFx({ id: 'hello-portrait', section: 0, measure, update })
  const w = window as unknown as { __momoShot?: () => string; __momoBench?: (n: number) => string }
  if (import.meta.env.DEV) {
    w.__momoShot = () => (gl.render(F), canvas.toDataURL('image/png'))
    // dev: time n full frames (both relief passes + composite, a live hover edge), GPU-synchronised
    w.__momoBench = (n: number) => {
      const f: Portrait3DFrame = { ...F, tilt: [0, 0], hv: [0.5, 0.3, 0.4], pt: [0.5, 0.3, 1], ring: 1, arrA: 1, arrB: 1, dt: 1 / 60 }
      gl.render(f)
      gl.sync()
      const ts: number[] = []
      for (let i = 0; i < n; i++) {
        const t0 = performance.now()
        f.time += 1 / 60
        f.tilt = [Math.sin(i * 0.1) * 0.1, Math.cos(i * 0.1) * 0.2]
        gl.render(f)
        gl.sync()
        ts.push(performance.now() - t0)
      }
      ts.sort((a, b) => a - b)
      return `${canvas.width}×${canvas.height}: median ${ts[n >> 1].toFixed(2)}ms, p95 ${ts[Math.floor(n * 0.95)].toFixed(2)}ms`
    }
  }
  return () => {
    disposed = true
    unPick()
    off()
    if (import.meta.env.DEV) {
      delete w.__momoShot
      delete w.__momoBench
    }
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    document.removeEventListener('pointerout', onOut)
    gl.dispose()
    canvas.remove()
    host.style.left = host.style.top = host.style.width = host.style.height = ''
    delete fig.dataset.gl
    img.style.opacity = ''
    if (twin) {
      twin.style.opacity = ''
      twin.style.visibility = ''
    }
  }
}
