/**
 * The headline's hover wake: letters near the cursor lighten from Black (900),
 * most right under the cursor and less the further away they are, linger a
 * moment after the cursor moves on, then ease back. Each letter is its own
 * span (see Words in ./Hello.tsx); the face is a variable font so the weight
 * interpolates. Mouse only, and off for reduced motion.
 */
import { tasteFx } from './taste'

const W_HI = 900
/** the thinnest a letter gets, right under the cursor */
const W_LO = 700
/** easing time constants (s) to lighten / to recover, and how long a lightened letter lingers */
const TAU_IN = 0.06
const TAU_OUT = 0.16
const LINGER = 0.3

export function mountHeadWake(board: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {}
  const lines = Array.from(board.querySelectorAll<HTMLElement>('.h-title .h-l1, .h-l2'))
  const chars = Array.from(board.querySelectorAll<HTMLElement>('.h-l1 .h-ch, .h-l2 .h-ch'))
  const n = chars.length
  if (!n) return () => {}
  const thin = new Float32Array(n)
  const goal = new Float32Array(n)
  const hold = new Float32Array(n)
  const last = new Int16Array(n).fill(W_HI)
  const cx = new Float32Array(n)
  const cy = new Float32Array(n)
  const ch = new Float32Array(n)
  // each headline row keeps its alignment at rest; while letters are lighter (and
  // narrower) the row is nudged so it gives up the width evenly from both ends
  const rows = Array.from(board.querySelectorAll<HTMLElement>('.h-l1 .h-row, .h-l2 .h-row')).map((el) => ({
    el,
    side: getComputedStyle(el).justifyContent === 'flex-end' ? -1 : 1,
    rest: 0,
    last: '',
  }))
  const rowW = (el: HTMLElement) => {
    const a = el.firstElementChild as HTMLElement | null
    const b = el.lastElementChild as HTMLElement | null
    return a && b ? b.offsetLeft + b.offsetWidth - a.offsetLeft : 0
  }

  let px = 0
  let py = 0
  let has = false
  let raf = 0
  let prev = 0

  const kick = () => {
    if (!raf) {
      prev = performance.now()
      raf = requestAnimationFrame(tick)
    }
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    px = e.clientX
    py = e.clientY
    has = true
    kick()
  }
  const onLeave = () => {
    has = false
    kick()
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    // only on the finished, designed headline (not mid-wipe or while the switch plays)
    const active = has && tasteFx.T >= 1 && !tasteFx.manual
    let near = false
    if (active) {
      // is the cursor anywhere near either line? (one rect per line, cheap)
      for (const l of lines) {
        const r = l.getBoundingClientRect()
        const m = r.height * 0.6
        if (px > r.left - m && px < r.right + m && py > r.top - m && py < r.bottom + m) near = true
      }
    }
    // all at full weight: (re)measure each row's resting width
    let allHeavy = true
    for (let i = 0; i < n; i++) if (last[i] !== W_HI) allHeavy = false
    if (allHeavy) for (const r of rows) r.rest = rowW(r.el)
    // current row widths (they reflect last frame's weights)
    const cur = allHeavy ? null : rows.map((r) => rowW(r.el))
    if (near) {
      // read every letter before writing any weight (one layout per frame)
      for (let i = 0; i < n; i++) {
        const r = chars[i].getBoundingClientRect()
        cx[i] = r.left + r.width / 2
        cy[i] = r.top + r.height / 2
        ch[i] = r.height
      }
    }
    let busy = false
    for (let i = 0; i < n; i++) {
      let target = 0
      if (near) {
        // a soft bell: full at the cursor, fading smoothly with distance
        const sig = ch[i] * 0.85
        const d = Math.hypot(px - cx[i], (py - cy[i]) * 1.15) / sig
        target = d > 3 ? 0 : Math.exp(-0.5 * d * d)
      }
      // the goal holds its peak for a beat, then follows the cursor's falloff
      // (still "under" the cursor while within 10% of the peak: the row's own
      // nudge moves letters a little, which must not run the linger clock down)
      if (target > 0.01 && target >= goal[i] * 0.9) {
        goal[i] = Math.max(target, goal[i] * 0.9)
        hold[i] = LINGER
      } else if (hold[i] > 0) {
        hold[i] -= dt
      } else {
        goal[i] = target
      }
      // the weight eases toward it exponentially (no linear ramps, no snapping)
      const tau = goal[i] > thin[i] ? TAU_IN : TAU_OUT
      thin[i] += (goal[i] - thin[i]) * (1 - Math.exp(-dt / tau))
      if (goal[i] === 0 && thin[i] < 0.004) thin[i] = 0
      if (thin[i] > 0 || hold[i] > 0) busy = true
      const e = thin[i]
      const w = Math.round((W_HI - (W_HI - W_LO) * e) / 2) * 2
      if (w !== last[i]) {
        last[i] = w
        chars[i].style.fontWeight = w === W_HI ? '' : String(w)
        // the heft stroke (see .h-ch) fades with the weight
        if (w === W_HI) chars[i].style.removeProperty('--hs')
        else chars[i].style.setProperty('--hs', `${(0.024 * (1 - e)).toFixed(4)}em`)
      }
    }
    // split the lost width between both ends of each row
    rows.forEach((r, k) => {
      const dx = cur && r.rest ? (r.side * (r.rest - cur[k])) / 2 : 0
      const key = Math.abs(dx) < 0.25 ? '' : `translate3d(${dx.toFixed(1)}px, 0, 0)`
      if (key !== r.last) {
        r.last = key
        r.el.style.transform = key
      }
    })
    raf = busy || near ? requestAnimationFrame(tick) : 0
  }

  window.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  window.addEventListener('scroll', kick, { passive: true })
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('scroll', kick)
    chars.forEach((c) => {
      c.style.fontWeight = ''
      c.style.removeProperty('--hs')
    })
    rows.forEach((r) => (r.el.style.transform = ''))
  }
}
