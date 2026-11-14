/**
 * The headline's hover wake: letters near the cursor lighten from Black (900),
 * most right under the cursor and less the further away they are, linger a
 * moment after the cursor moves on, then ease back. Each letter is its own
 * span (see Words in ./Hello.tsx); the face is a variable font so the weight
 * interpolates. Mouse only, and off for reduced motion.
 *
 * Performance: the only per-frame DOM work is writing the weights that
 * changed (plus one 2-D nudge per row). Nothing is read back per frame:
 * letter centres are cached (re-measured on scroll / resize / every few
 * hundred ms), and row widths are derived from each letter's measured width at
 * 900 and 700. Weights snap to a few levels, warmed up front, so the browser
 * reuses font instances and glyph caches instead of building new ones.
 */
import { tasteFx } from './taste'

const W_HI = 900
/** the thinnest a letter gets, right under the cursor */
const W_LO = 700
/** weight levels (the browser builds a font instance per distinct weight) */
const STEP = 10
/** easing time constants (s) to lighten / to recover, and how long a lightened letter lingers */
const TAU_IN = 0.06
const TAU_OUT = 0.16
const LINGER = 0.3
/** heft stroke at full weight (see .h-ch in hello.css) */
const STROKE = 0.024
/** re-measure cached letter centres at most this often while hovering (ms) */
const REMEASURE = 350

export interface WakeOpts {
  /** one span per letter */
  chars: HTMLElement[]
  /** rows that keep their alignment and give lost width up evenly from both ends */
  rowEls?: HTMLElement[]
  /** cheap proximity test: letters are only measured while the cursor is near these */
  zones: HTMLElement[]
  /** re-measure cadence for the letter centres (ms; lower for moving letters) */
  remeasure?: number
}

/** the headline: both lines, rows centred-shrinking */
export function mountHeadWake(board: HTMLElement) {
  return mountWake({
    chars: Array.from(board.querySelectorAll<HTMLElement>('.h-l1 .h-ch, .h-l2 .h-ch')),
    rowEls: Array.from(board.querySelectorAll<HTMLElement>('.h-l1 .h-row, .h-l2 .h-row')),
    zones: Array.from(board.querySelectorAll<HTMLElement>('.h-title .h-l1, .h-l2')),
  })
}

export function mountWake({ chars, rowEls = [], zones, remeasure = REMEASURE }: WakeOpts) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return () => {}
  const n = chars.length
  if (!n) return () => {}
  const thin = new Float32Array(n)
  const goal = new Float32Array(n)
  const hold = new Float32Array(n)
  const last = new Int16Array(n).fill(W_HI)
  // cached screen-space centres + heights
  const cx = new Float32Array(n)
  const cy = new Float32Array(n)
  const ch = new Float32Array(n)
  // layout widths at 900 and 700 (local px) and the row each letter sits in
  const w9 = new Float32Array(n)
  const w7 = new Float32Array(n)
  const rowOf = new Int16Array(n)
  // each headline row keeps its alignment at rest; while letters are lighter (and
  // narrower) the row is nudged so it gives up the width evenly from both ends
  const rows = rowEls.map((el) => ({ el, side: getComputedStyle(el).justifyContent === 'flex-end' ? -1 : 1, last: '' }))
  chars.forEach((c, i) => (rowOf[i] = rowEls.findIndex((r) => r.contains(c))))
  const lost = new Float32Array(rows.length)

  let measured = false
  /** widths at both ends of the range (two forced layouts, once; also warms the 700 instance) */
  const measureWidths = () => {
    for (let i = 0; i < n; i++) w9[i] = chars[i].offsetWidth
    for (let i = 0; i < n; i++) chars[i].style.fontWeight = String(W_LO)
    for (let i = 0; i < n; i++) w7[i] = chars[i].offsetWidth
    for (let i = 0; i < n; i++) chars[i].style.fontWeight = last[i] === W_HI ? '' : String(last[i])
    measured = true
  }
  /** warm every weight level once, off-screen, with the headline's own letters */
  const warm = document.createElement('div')
  warm.setAttribute('aria-hidden', 'true')
  warm.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden;pointer-events:none;white-space:nowrap;text-transform:uppercase;'
  warm.style.fontFamily = getComputedStyle(chars[0]).fontFamily
  warm.style.fontSize = getComputedStyle(chars[0]).fontSize
  const glyphs = Array.from(new Set(chars.map((c) => c.textContent ?? ''))).join('')
  for (let w = W_LO; w < W_HI; w += STEP) {
    const s = document.createElement('span')
    s.style.fontWeight = String(w)
    s.textContent = glyphs
    warm.appendChild(s)
  }
  document.body.appendChild(warm)

  let px = 0
  let py = 0
  let has = false
  let raf = 0
  let prev = 0
  let stamp = -1e9
  let dirty = true

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
  const onShift = () => {
    dirty = true
    kick()
  }

  function tick(now: number) {
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    // only on the finished, designed headline (not mid-wipe or while the switch plays)
    const active = has && tasteFx.T >= 1 && !tasteFx.manual
    let near = false
    // cheap first: is the cursor near any zone at all? (one rect per zone)
    let zoned = false
    if (active) {
      for (const z of zones) {
        const r = z.getBoundingClientRect()
        const m = Math.max(40, r.height * 0.6)
        if (px > r.left - m && px < r.right + m && py > r.top - m && py < r.bottom + m) {
          zoned = true
          break
        }
      }
    }
    if (zoned) {
      if (!measured) measureWidths()
      // cached centres: refresh after scroll/resize, or every so often
      if (dirty || now - stamp > remeasure) {
        for (let i = 0; i < n; i++) {
          const r = chars[i].getBoundingClientRect()
          cx[i] = r.left + r.width / 2
          cy[i] = r.top + r.height / 2
          ch[i] = r.height
        }
        stamp = now
        dirty = false
      }
      // is the cursor anywhere near either line? (from the cached centres)
      for (let i = 0; i < n && !near; i++) {
        const m = ch[i] * 2.2
        if (Math.abs(px - cx[i]) < m && Math.abs(py - cy[i]) < m) near = true
      }
    }
    lost.fill(0)
    let busy = false
    for (let i = 0; i < n; i++) {
      let target = 0
      if (near) {
        // a soft bell: full at the cursor, fading smoothly to exactly 0 by ~2.4 sigma
        const sig = ch[i] * 0.85
        const d = Math.hypot(px - cx[i], (py - cy[i]) * 1.15) / sig
        target = d > 2.45 ? 0 : Math.max(0, (Math.exp(-0.5 * d * d) - 0.05) / 0.95)
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
      // the weight eases toward it exponentially
      const tau = goal[i] > thin[i] ? TAU_IN : TAU_OUT
      thin[i] += (goal[i] - thin[i]) * (1 - Math.exp(-dt / tau))
      if (goal[i] === 0 && thin[i] < 0.02) thin[i] = 0
      if (thin[i] > 0 || hold[i] > 0) busy = true
      const w = Math.round((W_HI - (W_HI - W_LO) * thin[i]) / STEP) * STEP
      if (w !== last[i]) {
        last[i] = w
        const c = chars[i].style
        c.fontWeight = w === W_HI ? '' : String(w)
        // the heft stroke fades with the weight
        if (w === W_HI) c.removeProperty('--hs')
        else c.setProperty('--hs', `${((STROKE * (w - W_LO)) / (W_HI - W_LO)).toFixed(4)}em`)
      }
      // width this letter gives up (width is near-linear in weight across 700–900)
      if (w !== W_HI && rowOf[i] >= 0) lost[rowOf[i]] += ((w9[i] - w7[i]) * (W_HI - w)) / (W_HI - W_LO)
    }
    // split the lost width between both ends of each row (2-D: no compositing layer)
    rows.forEach((r, k) => {
      const dx = (r.side * lost[k]) / 2
      const key = Math.abs(dx) < 0.25 ? '' : `${dx.toFixed(1)}px 0`
      if (key !== r.last) {
        r.last = key
        r.el.style.translate = key
      }
    })
    raf = busy || near ? requestAnimationFrame(tick) : 0
  }

  window.addEventListener('pointermove', onMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onLeave)
  window.addEventListener('scroll', onShift, { passive: true })
  window.addEventListener('resize', onShift)
  // widths change once the variable face has loaded
  document.fonts?.ready.then(() => (measured = false))
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    document.documentElement.removeEventListener('pointerleave', onLeave)
    window.removeEventListener('scroll', onShift)
    window.removeEventListener('resize', onShift)
    warm.remove()
    chars.forEach((c) => {
      c.style.fontWeight = ''
      c.style.removeProperty('--hs')
    })
    rows.forEach((r) => (r.el.style.translate = ''))
  }
}
