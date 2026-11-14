/**
 * Dev-only composition check: for every moment a hero waits in its parking
 * spot, assert it overlaps no other parked hero, no placed piece or revealed
 * text, no chrome panel, the bubble, nor the viewport edge.
 * Run `await __momoOverlap()` in the console (resolves to a list of issues).
 */
import type { Geo } from '../camera'
import { gsap } from '../../scene/gsap'
import { live } from '../loop'
import { pieces, texts, type Piece } from '../runtime'
import { NS, SEC } from '../worlds'
import { taste } from '../sections/hello/taste'

interface Box {
  l: number
  t: number
  r: number
  b: number
}
const box = (r: DOMRect, pad = 0): Box => ({ l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad })
const hit = (a: Box, b: Box, tol = 2) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > tol && Math.min(a.b, b.b) - Math.max(a.t, b.t) > tol

export function installOverlapCheck(getGeo: () => Geo | null) {
  const run = async (opts: { section?: number } = {}) => {
    const g = getGeo()
    if (!g) return ['no geometry']
    const issues: string[] = []
    const vw = window.innerWidth
    const vh = window.innerHeight
    const heroes = [...pieces.values()].filter((c) => c.kind === 'hero' && (opts.section == null || c.section === opts.section))
    // sample just before each hero leaves its spot
    const samples = [...new Set(heroes.map((c) => Math.max(c.in1 + 0.0005, c.p0 - 0.0004)))].sort((a, b) => a - b)
    for (const p of samples) {
      pin(p)
      await Promise.resolve()
      const parked: { c: Piece; b: Box }[] = []
      for (const c of heroes) {
        if (p >= c.p0 || p < c.in1) continue
        if (Math.abs(c.section - sec(p)) > 0) continue
        parked.push({ c, b: box(c.alive.getBoundingClientRect(), 4) })
      }
      const obstacles: { name: string; b: Box }[] = []
      document.querySelectorAll('.topbar, .layers, .inspector, .dock').forEach((el) => obstacles.push({ name: el.className.split(' ')[0], b: box(el.getBoundingClientRect()) }))
      pieces.forEach((c) => {
        if (c.section !== sec(p) || p < c.p1) return
        obstacles.push({ name: `placed ${c.id}`, b: box(c.slot.getBoundingClientRect()) })
      })
      // dashed slots that are visible and still waiting for their piece
      pieces.forEach((c) => {
        if (c.section !== sec(p) || p >= c.p1) return
        const rg = c.slot.closest<HTMLElement>('.rg')
        if (rg?.dataset.on !== '1') return
        const ph = c.slot.querySelector<HTMLElement>(':scope > .slot-ph')
        if (!ph || getComputedStyle(ph).display === 'none') return
        obstacles.push({ name: `slot ${c.id}`, b: box(c.slot.getBoundingClientRect()) })
      })
      texts.forEach((t) => {
        if (t.section !== sec(p) || p < t.p0) return
        obstacles.push({ name: `text ${t.id}`, b: box(t.el.getBoundingClientRect()) })
      })
      const bs = live.bubScreen
      if (bs.r > 2) obstacles.push({ name: 'bubble', b: { l: bs.x - bs.r, t: bs.y - bs.r, r: bs.x + bs.r, b: bs.y + bs.r } })
      const at = `p=${p.toFixed(4)}`
      parked.forEach((a, i) => {
        if (a.b.l < 0 || a.b.t < 0 || a.b.r > vw || a.b.b > vh) issues.push(`${at} ${a.c.id} clipped by viewport (${Math.round(a.b.l)},${Math.round(a.b.t)},${Math.round(a.b.r)},${Math.round(a.b.b)})`)
        parked.slice(i + 1).forEach((b) => hit(a.b, b.b) && issues.push(`${at} ${a.c.id} overlaps hero ${b.c.id}`))
        obstacles.forEach((o) => o.name !== `slot ${a.c.id}` && hit(a.b, o.b) && issues.push(`${at} ${a.c.id} overlaps ${o.name}`))
      })
    }
    live.pOverride = null
    return issues
  }
  /** pin the progress and force a few synchronous ticks (rAF may be throttled) */
  const pin = (p: number | null, ticks = 3) => {
    live.pOverride = p
    for (let i = 0; i < ticks; i++) gsap.ticker.tick()
  }
  const w = window as unknown as { __momoOverlap?: typeof run; __momoP?: typeof pin; __momo?: unknown }
  w.__momoOverlap = run
  w.__momoP = pin
  w.__momo = { pieces, texts, live, getGeo, taste }
  return () => {
    if (w.__momoOverlap === run) delete w.__momoOverlap
    if (w.__momoP === pin) delete w.__momoP
  }
}

function sec(p: number) {
  let i = 0
  for (let k = 0; k < NS; k++) if (p >= SEC[k][0] - 1e-9) i = k
  return i
}
