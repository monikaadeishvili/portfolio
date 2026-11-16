/**
 * 02 How I think — the sticker quote acts out what it says.
 * "People ignore design that ignores people.":
 *   · the "ignores" sticker ducks away from the cursor (try to catch it),
 *   · the last "people." sticker keeps its eyes on the visitor.
 * Runs only while the pointer is moving near the stickers; a tap makes
 * "ignores" hop aside once. When "ignores" lands it gives a little shake (and
 * once more a few seconds later if nobody has come near it), so the visitor
 * notices there's something to catch.
 */
const REACH = 150 // board px: how close the cursor gets before "ignores" moves
// how far it ducks (board px): further than half its own size, so it always gets clear
const FLEE_X = 172
const FLEE_Y = 88

export function mountQuote(root: HTMLElement) {
  const fig = root.querySelector<HTMLElement>('.hk-stk')
  const dodge = root.querySelector<HTMLElement>('.hk-st-4')
  const home = dodge?.closest<HTMLElement>('.slot') ?? null
  const eyes = root.querySelector<HTMLElement>('.hk-st-eyes')
  const pupils = Array.from(root.querySelectorAll<HTMLElement>('.hk-st-eyes b'))
  const board = root.closest<HTMLElement>('.bf')
  if (!fig || !dodge || !home || !board) return () => {}

  let px = -1e4
  let py = -1e4
  let until = 0 // keep running until this time (ms)
  let hop = 0 // touch: hop aside until this time
  let raf = 0
  let last = 0
  let x = 0
  let y = 0
  let dirX = -1
  let dirY = 0
  let key = ''
  let eyeKey = ''
  /** the visitor has come within reach since "ignores" landed */
  let met = false

  const step = (t: number) => {
    raf = 0
    const dt = Math.min(0.033, Math.max(0.001, (t - last) / 1000))
    last = t
    let tx = 0
    let ty = 0
    let ex = 0
    let ey = 0
    const live = t < until && board.dataset.near === '1'
    if (live) {
      // the sticker's resting box on screen (its slot never moves)
      const r = home.getBoundingClientRect()
      const k = r.width / Math.max(1, home.offsetWidth)
      const dx = (px - (r.left + r.width / 2)) / k
      const dy = (py - (r.top + r.height / 2)) / k
      // an ellipse around the pill: wide stickers are approached from the sides
      const d = Math.hypot(dx * 0.72, dy)
      if (d < REACH) met = true
      if (d < REACH || t < hop) {
        if (d > 6) {
          dirX = -dx / Math.hypot(dx, dy)
          dirY = -dy / Math.hypot(dx, dy)
        }
        const f = t < hop ? 1 : Math.pow(1 - d / REACH, 0.6)
        // it only ducks into free space: left (toward the paragraph) when the
        // cursor comes from the right or from below, otherwise down
        if (dirX < -0.35 || dirY < -0.35) {
          tx = -FLEE_X * f
          ty = FLEE_Y * 0.12 * f
        } else {
          tx = dirX * 36 * f
          ty = FLEE_Y * f
        }
      }
      if (eyes) {
        const e = eyes.getBoundingClientRect()
        const vx = px - (e.left + e.width / 2)
        const vy = py - (e.top + e.height / 2)
        const m = Math.hypot(vx, vy) || 1
        const reach = Math.min(1, m / 60) * 3.4
        ex = (vx / m) * reach
        ey = (vy / m) * reach
      }
    }
    const a = 1 - Math.exp(-dt * (tx || ty ? 16 : 9))
    x += (tx - x) * a
    y += (ty - y) * a
    const rest = Math.abs(x) < 0.3 && Math.abs(y) < 0.3 && !tx && !ty
    const k2 = rest ? '' : `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(x * 0.05 - y * 0.06).toFixed(1)}deg)`
    if (k2 !== key) {
      key = k2
      dodge.style.transform = k2
    }
    const ek = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px)`
    if (ek !== eyeKey) {
      eyeKey = ek
      pupils.forEach((p) => (p.style.transform = ek))
    }
    if (live || !rest) raf = requestAnimationFrame(step)
    else {
      x = y = 0
    }
  }
  const start = () => {
    if (raf) return
    last = performance.now()
    raf = requestAnimationFrame(step)
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || board.dataset.near !== '1') return
    px = e.clientX
    py = e.clientY
    until = performance.now() + 900
    start()
  }
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || board.dataset.near !== '1') return
    if (!(e.target instanceof Element) || !e.target.closest('.hk-st-dodge')) return
    px = e.clientX
    py = e.clientY
    const now = performance.now()
    hop = now + 650
    until = now + 900
    start()
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })

  /* a little "look at me" shake when it lands, and once more if ignored */
  const reduced = () => !!root.closest('.is-static') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const timers: number[] = []
  const nudge = () => {
    if (met || reduced() || board.dataset.near !== '1') return
    dodge.classList.remove('is-nudge')
    void dodge.offsetWidth
    dodge.classList.add('is-nudge')
  }
  const onEnd = (e: AnimationEvent) => {
    if (e.animationName === 'hk-nudge') dodge.classList.remove('is-nudge')
  }
  dodge.addEventListener('animationend', onEnd)
  let wasPlaced = home.dataset.st === 'placed'
  const watch = new MutationObserver(() => {
    const placed = home.dataset.st === 'placed'
    if (placed && !wasPlaced) {
      met = false
      timers.forEach((id) => window.clearTimeout(id))
      timers.length = 0
      timers.push(window.setTimeout(nudge, 650), window.setTimeout(nudge, 5200))
    }
    wasPlaced = placed
  })
  watch.observe(home, { attributes: true, attributeFilter: ['data-st'] })

  return () => {
    watch.disconnect()
    timers.forEach((id) => window.clearTimeout(id))
    dodge.removeEventListener('animationend', onEnd)
    dodge.classList.remove('is-nudge')
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerdown', onDown)
    dodge.style.transform = ''
    pupils.forEach((p) => (p.style.transform = ''))
  }
}
