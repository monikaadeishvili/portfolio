/**
 * 01 Hello — the closing line plays what it says.
 *
 * "This page builds itself." — swipe through it and the letters scatter, then
 * spring straight back into place.
 * "Your product won't." — knock a letter and it tumbles and stays crooked where
 * it lands; only after a few quiet seconds do they shuffle back, sheepishly.
 *
 * Letters move with 2-D transforms (crisp inside the camera's 3-D world). The
 * pointer is matched in screen space; layout is read once per hover, and the
 * physics only runs while something is moving or out of place.
 */
import { live } from '../../loop'

interface L {
  el: HTMLElement
  b: boolean // second line: it won't fix itself
  k: boolean // knocked (a "won't" letter that has been hit)
  ox: number // layout centre inside the paragraph (board px)
  oy: number
  x: number
  y: number
  r: number
  vx: number
  vy: number
  vr: number
  // where a knocked "won't" letter has come to rest
  rx: number
  ry: number
  rr: number
  key: string
}

const RADIUS = 0.75 // in letter heights
const QUIET = 3.6 // s before the second line gets itself back together

export function mountClose(board: HTMLElement) {
  const p = board.querySelector<HTMLElement>('.h-hint-p')
  if (!p) return () => {}
  const letters: L[] = Array.from(p.querySelectorAll<HTMLElement>('.h-cl')).map((el) => ({
    el,
    b: !!el.closest('.h-hint-b'),
    k: false,
    ox: 0,
    oy: 0,
    x: 0,
    y: 0,
    r: 0,
    vx: 0,
    vy: 0,
    vr: 0,
    rx: 0,
    ry: 0,
    rr: 0,
    key: '',
  }))
  if (!letters.length) return () => {}

  let em = 70
  let measured = false
  let raf = 0
  let last = 0
  let lastHit = -1e9
  let px = -1e4
  let py = -1e4
  let pvx = 0
  let pvy = 0
  let pt = 0

  /** layout centres (unaffected by the transforms we write) */
  const measure = () => {
    em = parseFloat(getComputedStyle(p).fontSize) || 70
    // layout offsets up the offsetParent chain (transforms don't count), relative to the paragraph
    const off = (el: HTMLElement) => {
      let x = 0
      let y = 0
      let n: HTMLElement | null = el
      while (n) {
        x += n.offsetLeft
        y += n.offsetTop
        n = n.offsetParent as HTMLElement | null
      }
      return [x, y]
    }
    const [px0, py0] = off(p)
    letters.forEach((l) => {
      const [x, y] = off(l.el)
      l.ox = x - px0 + l.el.offsetWidth / 2
      l.oy = y - py0 + l.el.offsetHeight / 2
    })
    measured = true
  }

  /** board px → screen: the paragraph's projected box gives scale and offset */
  let rect: DOMRect | null = null
  let sx = 1
  let sy = 1
  const project = () => {
    rect = p.getBoundingClientRect()
    sx = rect.width / Math.max(1, p.offsetWidth)
    sy = rect.height / Math.max(1, p.offsetHeight)
  }

  const hit = (x: number, y: number, vx: number, vy: number, tap: boolean) => {
    // only while Hello is on screen (no layout reads anywhere else on the page)
    if (board.dataset.near !== '1') return
    if (!measured) measure()
    project()
    if (!rect) return
    const pad = em * sy
    if (x < rect.left - pad || x > rect.right + pad || y < rect.top - pad || y > rect.bottom + pad) return
    const R = em * RADIUS
    const speed = Math.min(1, Math.hypot(vx, vy) / 2400)
    const rz = (-(live.cam.rz || 0) * Math.PI) / 180
    const cs = Math.cos(rz)
    const sn = Math.sin(rz)
    const now = performance.now() / 1000
    let any = false
    letters.forEach((l) => {
      // the letter's current centre on screen, back in board px
      const lx = rect!.left + (l.ox + l.x) * sx
      const ly = rect!.top + (l.oy + l.y) * sy
      const dxs = (lx - x) / sx
      const dys = (ly - y) / sy
      // an ellipse, flatter than tall: a swipe stays on the line it crosses
      const d = Math.hypot(dxs, dys * 1.9)
      if (d > R) return
      any = true
      const f = 1 - d / R
      const nx = d > 0.01 ? dxs / d : Math.random() - 0.5
      const ny = d > 0.01 ? dys / d : -1
      // the pointer's own motion carries the letters along (rotated into the board)
      const mvx = (vx * cs - vy * sn) / sx
      const mvy = (vx * sn + vy * cs) / sy
      const push = (tap ? 420 : 110 + 460 * speed) * f
      l.vx += nx * push + mvx * 0.08 * f
      l.vy += ny * push + mvy * 0.08 * f - (l.b ? 60 * f : 0)
      l.vr += (nx * 0.6 + (Math.random() - 0.5)) * (tap ? 200 : 80 + 240 * speed) * f
      if (l.b) {
        l.k = true
        lastHit = now
      }
    })
    if (any) start()
  }

  const step = (t: number) => {
    raf = 0
    const dt = Math.min(0.033, Math.max(0.001, (t - last) / 1000))
    last = t
    const now = t / 1000
    const fix = now - lastHit > QUIET // the second line finally gets itself together
    let moving = false
    letters.forEach((l) => {
      if (!l.b) {
        // builds itself: a stiff, slightly bouncy spring home
        l.vx += (-260 * l.x - 15 * l.vx) * dt
        l.vy += (-260 * l.y - 15 * l.vy) * dt
        l.vr += (-220 * l.r - 13 * l.vr) * dt
      } else if (!l.k) {
        // untouched: stays put
      } else if (!fix) {
        // won't: it tumbles, drops a little and settles where it lands
        l.vy += 900 * dt * (l.y < em * 0.32 ? 1 : 0)
        const fr = Math.exp(-5.5 * dt)
        l.vx *= fr
        l.vy *= fr
        l.vr *= Math.exp(-4.5 * dt)
        if (l.y > em * 0.32) {
          l.y = em * 0.32
          l.vy *= -0.25
        }
        l.rx = l.x
        l.ry = l.y
        l.rr = l.r
      } else {
        // ...a few seconds later, back in line with a sheepish wobble
        l.vx += (-36 * l.x - 9 * l.vx) * dt
        l.vy += (-36 * l.y - 9 * l.vy) * dt
        l.vr += (-30 * l.r - 6 * l.vr) * dt
      }
      l.x += l.vx * dt
      l.y += l.vy * dt
      l.r += l.vr * dt
      // a nudge, not a demolition: letters stay near their place
      const mx = em * (l.b ? 0.45 : 0.7)
      const my = em * (l.b ? 0.5 : 0.6)
      const mr = l.b ? 28 : 40
      if (Math.abs(l.x) > mx) {
        l.x = Math.sign(l.x) * mx
        l.vx *= -0.3
      }
      if (l.y < -my) {
        l.y = -my
        l.vy *= -0.3
      }
      if (!l.b && l.y > my) {
        l.y = my
        l.vy *= -0.3
      }
      if (Math.abs(l.r) > mr) {
        l.r = Math.sign(l.r) * mr
        l.vr *= -0.3
      }
      const off = Math.abs(l.x) > 0.3 || Math.abs(l.y) > 0.3 || Math.abs(l.r) > 0.3
      const vel = Math.abs(l.vx) > 2 || Math.abs(l.vy) > 2 || Math.abs(l.vr) > 2
      if (!off && !vel) {
        l.x = l.y = l.r = l.vx = l.vy = l.vr = 0
        if (fix) l.k = false
      }
      if (off || vel) moving = true
      // the "won't" letters resting crooked still count: they wait for the fix
      const key = !off ? 'translate(0px, 0px)' : `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) rotate(${l.r.toFixed(1)}deg)`
      if (key !== l.key) {
        l.key = key
        l.el.style.transform = key
      }
    })
    if (moving) raf = requestAnimationFrame(step)
  }
  const start = () => {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(step)
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const t = e.timeStamp / 1000
    const dt = Math.max(0.004, t - pt)
    if (pt) {
      pvx = (e.clientX - px) / dt
      pvy = (e.clientY - py) / dt
    }
    px = e.clientX
    py = e.clientY
    pt = t
    hit(px, py, pvx, pvy, false)
  }
  const onDown = (e: PointerEvent) => hit(e.clientX, e.clientY, 0, 0, true)
  const onResize = () => (measured = false)

  // keep the letters' resting transform from the start (no layer pop when one first moves)
  letters.forEach((l) => {
    l.key = 'translate(0px, 0px)'
    l.el.style.transform = l.key
  })
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('resize', onResize)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onDown)
    window.removeEventListener('resize', onResize)
    letters.forEach((l) => (l.el.style.transform = ''))
  }
}
