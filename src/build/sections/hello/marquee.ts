/**
 * A seamless JS marquee: `rail` holds the same `set` twice and is moved by
 * one set's width per loop. 2-D transform on purpose: a composited layer
 * would be rasterised once and then scaled by the 3-D camera (soft text);
 * repainting the strip keeps it crisp. Runs only while `win` is on screen.
 * Reduced motion: does nothing (the CSS shows a still strip).
 */
export function runMarquee({ win, rail, set, speed, beforeMeasure }: {
  win: HTMLElement
  rail: HTMLElement
  set: HTMLElement
  /** layout px per second; positive drifts left, negative drifts right */
  speed: number
  /** runs before each measure (e.g. to lock item widths) */
  beforeMeasure?: () => void
}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  let width = 0
  const measure = () => {
    beforeMeasure?.()
    width = set.offsetWidth
  }
  measure()
  document.fonts?.ready.then(measure)
  window.addEventListener('resize', measure)

  let x = 0
  let raf = 0
  let prev = 0
  let seen = false
  const tick = (now: number) => {
    raf = 0
    if (!seen) return
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now
    if (width > 0) {
      x = (((x + speed * dt) % width) + width) % width
      rail.style.transform = `translateX(${(-x).toFixed(2)}px)`
    }
    raf = requestAnimationFrame(tick)
  }
  const io = new IntersectionObserver((es) => {
    seen = es.some((e) => e.isIntersecting)
    if (seen && !raf) {
      prev = performance.now()
      raf = requestAnimationFrame(tick)
    }
  })
  io.observe(win)

  return () => {
    cancelAnimationFrame(raf)
    io.disconnect()
    window.removeEventListener('resize', measure)
    rail.style.transform = ''
  }
}
