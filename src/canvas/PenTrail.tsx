/**
 * The Pen tool's live path: with Pen picked in the dock, the nib leaves a
 * thin, smooth vector line behind it, studded with square anchors (and the
 * newest anchor's two handle dots), that fades from the nib back and draws
 * itself in when the cursor rests. A click sends two rings out from the tip.
 *
 * One full-screen 2-D canvas; it only animates while there is something to
 * draw. Ink with a soft white halo, so it reads on the light and dark worlds.
 */
import { useEffect, useRef } from 'react'
import { tool } from '../scene/store'
import { youAt } from './Cursors'

/** seconds a stretch of path stays before it has faded out */
const LIFE = 0.8
/** px of path between anchors */
const SPACING = 70
/** px the nib must travel before a new point is kept */
const STEP = 3
/** click rings: lifetime (s) and final radii (px) */
const RING_LIFE = 0.85
const RINGS = [96, 168]
const INK = '22, 19, 29'

type Pt = { x: number; y: number; t: number; anchor: boolean }
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3)

export function PenTrail() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    let dpr = 1
    const size = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.round(window.innerWidth * dpr)
      cv.height = Math.round(window.innerHeight * dpr)
    }
    size()

    const pts: Pt[] = []
    const rings: { x: number; y: number; t: number }[] = []
    let acc = 0
    let raf = 0
    let on = tool.get() === 'pen'
    let drawn = false

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }
    const unTool = tool.sub((v) => {
      on = v === 'pen'
      kick()
    })
    const onMove = () => on && kick()
    const onDown = (e: PointerEvent) => {
      if (!on || e.button !== 0 || e.pointerType !== 'mouse') return
      rings.push({ x: e.clientX, y: e.clientY, t: performance.now() / 1000 })
      kick()
    }

    function frame(ms: number) {
      raf = 0
      const now = ms / 1000
      const [hx, hy, shown] = youAt()
      // keep a point each time the nib has travelled a few px; every ~70px of
      // path, that point is an anchor
      if (on && shown) {
        const l = pts[pts.length - 1]
        if (!l) {
          pts.push({ x: hx, y: hy, t: now, anchor: false })
          acc = SPACING * 0.5
        } else {
          const d = Math.hypot(hx - l.x, hy - l.y)
          if (d >= STEP) {
            acc += d
            const anchor = acc >= SPACING
            if (anchor) acc = 0
            pts.push({ x: hx, y: hy, t: now, anchor })
          }
        }
      }
      while (pts.length && now - pts[0].t > LIFE) pts.shift()
      while (rings.length && now - rings[0].t > RING_LIFE) rings.shift()

      if (pts.length > 1 || rings.length || drawn) draw(now, hx, hy, on && shown)
      if (pts.length > 1 || rings.length) kick()
    }

    function draw(now: number, hx: number, hy: number, live: boolean) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx!.clearRect(0, 0, cv!.width, cv!.height)
      ctx!.lineCap = 'round'
      ctx!.lineJoin = 'round'
      drawn = false
      const alphaOf = (t: number) => Math.pow(Math.max(0, 1 - (now - t) / LIFE), 1.3)

      // the path: quadratic curves through the midpoints (smooth), one segment
      // at a time so it can fade toward the tail; halo first, ink on top
      const n = pts.length
      if (n > 1) {
        const mid = (a: Pt, b: Pt): [number, number] => [(a.x + b.x) / 2, (a.y + b.y) / 2]
        for (const pass of [0, 1]) {
          ctx!.lineWidth = pass === 0 ? 3.6 : 1.3
          let [sx, sy] = [pts[0].x, pts[0].y]
          for (let i = 1; i < n; i++) {
            const a = alphaOf(pts[i].t)
            if (a <= 0.01) {
              ;[sx, sy] = mid(pts[i - 1], pts[i])
              continue
            }
            const last = i === n - 1
            const [ex, ey] = last ? (live ? [hx, hy] : [pts[i].x, pts[i].y]) : mid(pts[i], pts[i + 1])
            ctx!.strokeStyle = pass === 0 ? `rgba(255, 255, 255, ${(a * 0.45).toFixed(3)})` : `rgba(${INK}, ${(a * 0.82).toFixed(3)})`
            ctx!.beginPath()
            ctx!.moveTo(sx, sy)
            ctx!.quadraticCurveTo(pts[i].x, pts[i].y, ex, ey)
            ctx!.stroke()
            ;[sx, sy] = [ex, ey]
          }
        }
        drawn = true

        // the newest anchor's handles: two dots along the path's tangent
        let k = -1
        for (let i = n - 1; i >= 0; i--) if (pts[i].anchor) { k = i; break }
        if (k > 0 && k < n - 1) {
          const p = pts[k]
          const a = alphaOf(p.t)
          const q0 = pts[Math.max(0, k - 2)]
          const q1 = pts[Math.min(n - 1, k + 2)]
          const tl = Math.hypot(q1.x - q0.x, q1.y - q0.y) || 1
          const tx = (q1.x - q0.x) / tl
          const ty = (q1.y - q0.y) / tl
          const L = 20
          ctx!.lineWidth = 1
          ctx!.strokeStyle = `rgba(${INK}, ${(a * 0.4).toFixed(3)})`
          ctx!.beginPath()
          ctx!.moveTo(p.x - tx * L, p.y - ty * L)
          ctx!.lineTo(p.x + tx * L, p.y + ty * L)
          ctx!.stroke()
          ctx!.fillStyle = `rgba(${INK}, ${(a * 0.85).toFixed(3)})`
          for (const s of [-1, 1]) {
            ctx!.beginPath()
            ctx!.arc(p.x + tx * L * s, p.y + ty * L * s, 2.4, 0, Math.PI * 2)
            ctx!.fill()
          }
        }

        // anchors: small white squares with an ink keyline
        ctx!.lineWidth = 1.2
        for (let i = 0; i < n; i++) {
          if (!pts[i].anchor) continue
          const a = alphaOf(pts[i].t)
          if (a <= 0.02) continue
          ctx!.fillStyle = `rgba(255, 255, 255, ${a.toFixed(3)})`
          ctx!.strokeStyle = `rgba(${INK}, ${(a * 0.85).toFixed(3)})`
          ctx!.fillRect(pts[i].x - 3.5, pts[i].y - 3.5, 7, 7)
          ctx!.strokeRect(pts[i].x - 3.5, pts[i].y - 3.5, 7, 7)
        }
      }

      // click rings: two thin circles easing out from the tip, fading as they go
      for (const r of rings) {
        const u = Math.min(1, (now - r.t) / RING_LIFE)
        const a = Math.pow(1 - u, 1.6)
        const e = easeOut(u)
        for (let j = 0; j < RINGS.length; j++) {
          const rad = 10 + (RINGS[j] - 10) * e
          for (const pass of [0, 1]) {
            ctx!.lineWidth = pass === 0 ? 3.4 : 1.3
            ctx!.strokeStyle = pass === 0 ? `rgba(255, 255, 255, ${(a * 0.4).toFixed(3)})` : `rgba(${INK}, ${(a * (j === 0 ? 0.6 : 0.42)).toFixed(3)})`
            ctx!.beginPath()
            ctx!.arc(r.x, r.y, rad, 0, Math.PI * 2)
            ctx!.stroke()
          }
        }
        drawn = true
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('resize', size)
    return () => {
      cancelAnimationFrame(raf)
      unTool()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', size)
    }
  }, [])

  return <canvas className="pen-trail" ref={ref} aria-hidden="true" />
}
