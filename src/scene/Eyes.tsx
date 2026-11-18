import { useLayoutEffect, useRef, type CSSProperties } from 'react'

export interface EyeRig {
  el: HTMLElement
  eyes: HTMLElement[]
  pupils: HTMLElement[]
  /** next blink timestamp (s) */
  next: number
  /** blink start (s), -1 when idle */
  blinkAt: number
  px: number
  py: number
  max: number
  /** cached screen centre, refreshed in the batched read phase */
  cx: number
  cy: number
  visible: boolean
  /** Alive slot hosting these eyes (skipped while it is placed and not poked) */
  host: HTMLElement | null
}

export const eyeRigs = new Set<EyeRig>()

interface EyesProps {
  /** centre position inside the parent, in % */
  x?: number
  y?: number
  /** eye height in px (multiplied by --u) */
  size?: number
  gap?: number
  className?: string
  style?: CSSProperties
}

export function Eyes({ x = 50, y = 42, size = 16, gap = 0.5, className = '', style }: EyesProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const eyes = Array.from(el.querySelectorAll<HTMLElement>('.eye'))
    const pupils = Array.from(el.querySelectorAll<HTMLElement>('.pupil'))
    const rig: EyeRig = {
      el,
      eyes,
      pupils,
      next: performance.now() / 1000 + 1 + Math.random() * 4,
      blinkAt: -1,
      px: 0,
      py: 0,
      max: Math.max(1.5, (eyes[0]?.offsetHeight ?? 12) * 0.2),
      cx: 0,
      cy: 0,
      visible: true,
      host: el.closest<HTMLElement>('.slot'),
    }
    eyeRigs.add(rig)
    return () => {
      eyeRigs.delete(rig)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`eyes ${className}`}
      aria-hidden="true"
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          '--eye': `calc(var(--u) * ${size}px)`,
          '--eye-gap': `calc(var(--u) * ${size * gap}px)`,
          ...style,
        } as CSSProperties
      }
    >
      <span className="eye">
        <span className="pupil" />
      </span>
      <span className="eye">
        <span className="pupil" />
      </span>
    </div>
  )
}

/* ---------------------------------------------------- shared per-frame work */

/** batched READ phase: cache every visible rig's screen centre. Measuring
 *  forces a style + layout pass whenever anything has written since the last
 *  frame, so the rigs are measured together at most every READ_MS; the pupils
 *  ease towards their target, so a centre a few frames old never shows */
const READ_MS = 200
let readAt = -1e9
export function readEyes() {
  const now = performance.now()
  if (now - readAt < READ_MS) return
  readAt = now
  const vw = window.innerWidth
  const vh = window.innerHeight
  eyeRigs.forEach((rig) => {
    const h = rig.host
    if (h && h.dataset.st === 'placed' && !h.classList.contains('is-poke')) {
      rig.visible = false
      return
    }
    const r = rig.el.getBoundingClientRect()
    rig.visible = (r.width > 0 || r.height > 0) && r.right > -40 && r.left < vw + 40 && r.bottom > -40 && r.top < vh + 40
    rig.cx = r.left + r.width / 2
    rig.cy = r.top + r.height / 2
  })
}

/** WRITE phase: pupils follow (lookX, lookY), blinks on a random clock */
export function updateEyes(t: number, dt: number, lookX: number, lookY: number) {
  const s = 1 - Math.exp(-16 * dt)
  eyeRigs.forEach((rig) => {
    if (!rig.visible) return
    const dx = lookX - rig.cx
    const dy = lookY - rig.cy
    const d = Math.hypot(dx, dy) || 1
    const reach = Math.min(1, d / 220)
    const tpx = (dx / d) * rig.max * reach
    const tpy = (dy / d) * rig.max * reach * 0.85
    rig.px += (tpx - rig.px) * s
    rig.py += (tpy - rig.py) * s
    const tr = `translate(${rig.px.toFixed(2)}px, ${rig.py.toFixed(2)}px)`
    for (const pu of rig.pupils) pu.style.transform = tr
    if (rig.blinkAt < 0 && t > rig.next) rig.blinkAt = t
    if (rig.blinkAt >= 0) {
      const bt = (t - rig.blinkAt) / 0.17
      let sc = 1
      if (bt < 0.45) sc = 1 - (bt / 0.45) * 0.92
      else if (bt < 1) sc = 0.08 + ((bt - 0.45) / 0.55) * 0.92
      else {
        rig.blinkAt = -1
        rig.next = t + (Math.random() < 0.18 ? 0.22 : 1.6 + Math.random() * 4.6)
      }
      const str = `scaleY(${sc.toFixed(3)})`
      for (const e of rig.eyes) e.style.transform = str
    }
  })
}
