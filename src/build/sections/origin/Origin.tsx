/** 02 ORIGIN — "The night flight": one tall route map, Tbilisi → Alicante */
import { useLayoutEffect, useRef } from 'react'
import { CHAPTERS } from '../../../content/story'
import { TONE_HEX as T } from '../../../ui/components'
import { Piece, Region, Reveal } from '../../parts'
import { clamp01, pieces, registerFx } from '../../runtime'
import type { Geo } from '../../camera'
import { Artboard, type SectionProps } from '../Artboard'
import { BoardingPass, Odometer, Pin, Stamp, type StampShape } from './bits'
import './origin.css'

interface Stop {
  id: string
  year: string
  name: string
  what: string
  shape: StampShape
  tone: string
  hero: boolean
  region: 1 | 2
  park?: string
}
const STOPS: Stop[] = [
  { id: 'o-s0', year: '2020', name: 'Dinespace', what: 'food-tech startup', shape: 'round', tone: 'coral', hero: false, region: 1 },
  { id: 'o-s1', year: '2020', name: 'Burq', what: 'delivery platform', shape: 'rect', tone: 'yellow', hero: false, region: 1 },
  { id: 'o-s2', year: '2021', name: '4twiggers', what: 'product studio', shape: 'oval', tone: 'mint', hero: false, region: 1 },
  { id: 'o-s3', year: '2021', name: 'Forcoda', what: 'agency, lead designer', shape: 'round', tone: 'pink', hero: true, region: 1, park: '-250,560' },
  { id: 'o-s4', year: '2021', name: 'NOTA by M&T Bank', what: 'business banking', shape: 'rect', tone: 'sky', hero: true, region: 2, park: '-260,40' },
  { id: 'o-s5', year: '2024', name: 'DAZN', what: 'sports streaming', shape: 'oval', tone: 'yellow', hero: true, region: 2, park: '1150,440' },
  { id: 'o-s6', year: '2024', name: 'Contrast', what: 'UX consultancy', shape: 'round', tone: 'lime', hero: false, region: 2 },
]

/** Catmull-Rom → cubic Bézier through the points */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    const k = 0.2
    d += ` C${(p1[0] + (p2[0] - p0[0]) * k).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * k).toFixed(1)}, ${(p2[0] - (p3[0] - p1[0]) * k).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * k).toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

export function Origin({ lay, live }: SectionProps) {
  const narrow = lay === 'narrow'
  const svgRef = useRef<SVGSVGElement>(null)
  const odoRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const svg = svgRef.current
    const root = boardRef.current?.closest<HTMLElement>('.bf')
    if (!svg || !root) return
    const draw = svg.querySelector<SVGPathElement>('.o-path-draw')!
    const dots = svg.querySelector<SVGPathElement>('.o-path-dots')!
    const ghost = svg.querySelector<SVGPathElement>('.o-path-ghost')!
    const plane = svg.querySelector<SVGGElement>('.o-plane')!
    const clouds = Array.from(root.querySelectorAll<HTMLElement>('.o-cloud'))
    const wheels = odoRef.current ? Array.from(odoRef.current.querySelectorAll<HTMLElement>('.odo-wheel i')) : []
    let total = 1
    let samples: { x: number; y: number }[] = []
    // plane progress knots on the scroll axis
    let knots: [number, number][] = [
      [0, 0],
      [1, 1],
    ]
    let last = ''

    const anchor = (el: Element | null, fx: number, fy: number): [number, number] => {
      if (!el) return [0, 0]
      let x = 0
      let y = 0
      let n = el as HTMLElement
      while (n && n !== root) {
        x += n.offsetLeft
        y += n.offsetTop
        n = n.offsetParent as HTMLElement
      }
      const h = el as HTMLElement
      return [x + h.offsetWidth * fx, y + h.offsetHeight * fy]
    }

    const build = (g: Geo | null) => {
      const w = root.offsetWidth
      const h = root.offsetHeight
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
      const mid = w / 2
      const pts: [number, number][] = []
      pts.push(anchor(root.querySelector('.o-pin-a .pin-tip'), 0.5, 0.5))
      STOPS.forEach((s) => {
        const el = root.querySelector(`[data-cid="${s.id}"]`)
        const [cx, cy] = anchor(el, 0.5, 0.5)
        const sw = (el as HTMLElement | null)?.offsetWidth ?? 200
        const dir = cx < mid ? 1 : -1
        pts.push([cx + dir * sw * (narrow ? 0.38 : 0.72), cy])
      })
      pts.push(anchor(root.querySelector('.o-pin-b .pin-tip'), 0.5, 0.5))
      const d = smoothPath(pts)
      draw.setAttribute('d', d)
      dots.setAttribute('d', d)
      ghost.setAttribute('d', d)
      total = dots.getTotalLength() || 1
      samples = []
      for (let i = 0; i <= 240; i++) {
        const q = dots.getPointAtLength((total * i) / 240)
        samples.push({ x: q.x, y: q.y })
      }
      if (!g) return
      // the plane flies region 1 then region 2; it reaches region 2 at tB
      const r2 = root.querySelector<HTMLElement>('.rg[data-region="2"]')
      const yB = r2 ? r2.offsetTop : h * 0.6
      let tB = 0.5
      for (let i = 0; i < samples.length; i++)
        if (samples[i].y >= yB) {
          tB = i / 240
          break
        }
      const w1 = g.wins[1]?.[1]
      const w2 = g.wins[1]?.[2]
      if (!w1 || !w2) return
      knots = [
        [w1[0] + (w1[1] - w1[0]) * 0.02, 0],
        [w1[1], tB],
        [w2[1] - (w2[1] - w2[0]) * 0.04, 1],
      ]
      // each stamp lands as the plane passes it
      STOPS.forEach((s, k) => {
        const c = pieces.get(s.id)
        if (!c) return
        const [cx, cy] = pts[k + 1]
        let best = 0
        let bd = 1e9
        samples.forEach((q, i) => {
          const dd = (q.x - cx) ** 2 + (q.y - cy) ** 2
          if (dd < bd) {
            bd = dd
            best = i / 240
          }
        })
        const pl = tToP(best + 0.012)
        const win = s.region === 1 ? w1 : w2
        c.at = clamp01((pl - win[0]) / (win[1] - win[0]))
      })
    }
    const tToP = (t: number) => {
      for (let i = 1; i < knots.length; i++) {
        const [pa, ta] = knots[i - 1]
        const [pb, tb] = knots[i]
        if (t <= tb) return pa + ((t - ta) / (tb - ta || 1)) * (pb - pa)
      }
      return knots[knots.length - 1][0]
    }
    const pToT = (p: number) => {
      if (p <= knots[0][0]) return 0
      for (let i = 1; i < knots.length; i++) {
        const [pa, ta] = knots[i - 1]
        const [pb, tb] = knots[i]
        if (p <= pb) return ta + ((p - pa) / (pb - pa || 1)) * (tb - ta)
      }
      return 1
    }
    build(null)
    const unFx = live
      ? registerFx({
          id: 'origin-route',
          section: 1,
          measure: (g) => build(g),
          update: (e) => {
            if (!e.near) return
            const t = e.reduced ? 1 : pToT(e.p)
            const key = t.toFixed(4)
            if (key === last) return
            last = key
            draw.style.strokeDashoffset = String(1 - t)
            const L = total * t
            const a = dots.getPointAtLength(Math.max(0, L - 0.5))
            const b = dots.getPointAtLength(Math.min(total, L + 0.5))
            const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
            const q = dots.getPointAtLength(L)
            const bob = t <= 0 ? -10 : 0
            plane.setAttribute('transform', `translate(${q.x.toFixed(1)} ${(q.y + bob).toFixed(1)}) rotate(${(t <= 0 ? -24 : ang).toFixed(1)})`)
            plane.classList.toggle('is-flying', t > 0 && t < 1)
            // odometer
            const km = 3900 * t
            wheels.forEach((wh, i) => {
              const pow = Math.pow(10, wheels.length - 1 - i)
              let d = (km / pow) % 10
              if (pow > 1) {
                const frac = (km % pow) / pow
                d = Math.floor(d) + Math.max(0, (frac - 0.9) / 0.1)
              }
              wh.style.transform = `translateY(${((-d * 100) / 11).toFixed(2)}%)`
            })
            clouds.forEach((cl, i) => {
              cl.style.transform = `translate3d(${((e.u - 0.5) * (i % 2 ? -260 : 200)).toFixed(1)}px, 0, 0)`
            })
          },
        })
      : () => {}
    return unFx
  }, [live, narrow])

  return (
    <Artboard idx={1} live={live} lay={lay}>
      <div className="o-sky" aria-hidden="true">
        <i className="o-moon" />
        <i className="o-cloud c1" />
        <i className="o-cloud c2" />
        <i className="o-cloud c3" />
      </div>
      <svg className="o-route" ref={svgRef} aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <mask id="o-route-mask" maskUnits="userSpaceOnUse">
            <path className="o-path-draw" pathLength={1} />
          </mask>
        </defs>
        <path className="o-path-ghost" />
        <path className="o-path-dots" mask="url(#o-route-mask)" />
        <g className="o-plane">
          <g className="o-plane-body">
            <path d="M-26 -3 L14 -3 Q26 0 14 3 L-26 3 Z" />
            <path className="o-wing" d="M-6 -2 L-16 -22 L-4 -22 L8 -2 Z" />
            <path className="o-wing" d="M-6 2 L-16 22 L-4 22 L8 2 Z" />
            <path className="o-wing" d="M-24 -2 L-30 -11 L-24 -11 L-18 -2 Z" />
            <circle className="o-eye" cx="6" cy="-6.5" r="4.5" />
            <circle className="o-eye" cx="6" cy="6.5" r="4.5" />
            <circle className="o-pupil" cx="7.6" cy="-6.5" r="2" />
            <circle className="o-pupil" cx="7.6" cy="6.5" r="2" />
          </g>
        </g>
      </svg>
      <div ref={boardRef} className="o-board">
        <Region index={0} label="Departure" className="o-r0">
          <Piece id="o-chip" name="Chip / Flight log" kind="bubble" tone={T.coral} order={0} className="o-chip">
            <span className="o-log">
              <i aria-hidden="true" /> Flight log · 2020 → today
            </span>
          </Piece>
          <div className="o-top">
            <div className="o-copy">
              <Reveal id="o-title" as="h2" hid="h-origin" segs={CHAPTERS[1].headline} className="rv-title o-title" />
              <Reveal id="o-para" mode="type" segs={[CHAPTERS[1].body]} className="rv-para o-para" order={1} />
            </div>
            <Piece id="o-pass" name="Boarding pass" kind="hero" tone={T.coral} travel="leap" order={1} park="560,-360" className="o-pass" eyes={{ x: 86, y: 0, s: 22 }}>
              <BoardingPass />
            </Piece>
          </div>
          <div className="o-dep">
            <Piece id="o-pin-a" name="Pin / Tbilisi" kind="hero" tone={T.yellow} travel="crawl" order={2} park="-250,420" className="o-pin-a" eyes={{ x: 50, y: 18, s: 16 }}>
              <Pin city="Tbilisi" when="2020" tone="yellow" />
            </Piece>
            <Piece id="o-odo" name="Odometer" kind="bubble" tone={T.sky} order={3} className="o-odo">
              <Odometer ref={odoRef} />
            </Piece>
          </div>
        </Region>
        <Region index={1} label="Route" className="o-r1" weight={1.5} style={{ ['--h' as string]: narrow ? '760px' : '980px' }}>
          <ol className="o-stops" aria-label="Where I've worked, in order">
            {STOPS.filter((s) => s.region === 1).map((s, k) => (
              <li key={s.id} className={`o-stop ${s.id}`}>
                <Piece id={s.id} name={`Stamp / ${s.name}`} kind={s.hero ? 'hero' : 'bubble'} tone={T[s.tone as keyof typeof T]} travel="stamp" order={k} park={s.park} eyes={{ x: 50, y: 18, s: 18 }} legs={false}>
                  <Stamp year={s.year} name={s.name} what={s.what} shape={s.shape} tone={s.tone} />
                </Piece>
              </li>
            ))}
          </ol>
        </Region>
        <Region index={2} label="Arrival" className="o-r2" weight={1.3} style={{ ['--h' as string]: narrow ? '760px' : '880px' }}>
          <ol className="o-stops" aria-label="Where I've worked, continued" start={5}>
            {STOPS.filter((s) => s.region === 2).map((s, k) => (
              <li key={s.id} className={`o-stop ${s.id}`}>
                <Piece id={s.id} name={`Stamp / ${s.name}`} kind={s.hero ? 'hero' : 'bubble'} tone={T[s.tone as keyof typeof T]} travel="stamp" order={k} park={s.park} eyes={{ x: 50, y: 18, s: 18 }} legs={false}>
                  <Stamp year={s.year} name={s.name} what={s.what} shape={s.shape} tone={s.tone} />
                </Piece>
              </li>
            ))}
          </ol>
          <Piece id="o-pin-b" name="Pin / Alicante" kind="hero" tone={T.coral} travel="crawl" order={9} at={0.99} park="720,b+70" parkN="110,540" className="o-pin-b" eyes={{ x: 50, y: 18, s: 16 }}>
            <Pin city="Alicante" when="today" tone="coral" />
          </Piece>
        </Region>
      </div>
    </Artboard>
  )
}
