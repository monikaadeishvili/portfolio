/**
 * 03 Proof, part one — drives the running total (./Tally.tsx) from its
 * region's progress q (the camera holds flat on it):
 *   0.08–0.44  twelve stickers land one by one; the counters roll up with the
 *              client products among them
 *   0.44–0.62  the other 26 products arrive in four waves; the count runs to 32
 *   0.70–0.86  everything folds into the orbit around "your product" (scrubbed)
 *   0.86       one card drops out below it: one designer, all of the above
 *   0.90–1     the bubble jumps back out of the orbit (bubble/choreo.ts)
 * Landings are class toggles (CSS does the springs and they reverse on the way
 * back); only the fold is scrubbed. Layout is read only in `measure`.
 */
import { TALLY } from '../../../content/story'
import { live } from '../../loop'
import { clamp01, registerFx } from '../../runtime'

const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** how much of the fold the farthest piece waits before it sets off */
const SPREAD = 0.3

export function mountTally(root: HTMLElement, region: number) {
  const stage = root.querySelector<HTMLElement>('.pt-stage')
  const board = root.querySelector<HTMLElement>('.pt-board')
  if (!stage || !board) return () => {}
  const q1 = <E extends HTMLElement = HTMLElement>(s: string) => board.querySelector<E>(s)
  const cards = Array.from(board.querySelectorAll<HTMLElement>('.pt-cardslot'))
  const chips = Array.from(board.querySelectorAll<HTMLElement>('.pt-chipslot'))
  const counts = q1('.pt-counts')
  const orbit = q1('.pt-orbit')
  const blob = q1('.pt-blob')
  const labs = Array.from(board.querySelectorAll<HTMLElement>('.pt-lab'))
  const rolls = Array.from(board.querySelectorAll<HTMLElement>('.pt-count')).map((el) => Array.from(el.querySelectorAll<HTMLElement>('.pt-col')))
  const flys = [...cards, ...chips].map((el) => ({ el, dx: 0, dy: 0, s: 0, key: '' }))
  /** where each thing lands (board px), so it can be spat out of the bubble */
  const spits = [...cards, ...chips, ...(counts ? [counts] : [])].map((el) => ({ el, x: 0, y: 0, key: '' }))
  /** the board's top-left in world px: the bubble lives in world space */
  const bw = { x: 0, y: 0 }
  let gulps = 0
  const waves = [0, 1, 2, 3].map((w) => chips.filter((c) => c.dataset.w === String(w)))
  const nCards = TALLY.cards.length
  /** how many client products have landed once the first i stickers are down */
  const workBy = TALLY.cards.reduce<number[]>((acc, c) => [...acc, acc[acc.length - 1] + (c.kind === 'work' ? 1 : 0)], [0])
  const nWork = workBy[nCards]
  const total = nWork + TALLY.chips.length

  const shown = [-1, -1]
  const setRoll = (k: number, v: number) => {
    if (shown[k] === v) return
    shown[k] = v
    const cols = rolls[k]
    const s = String(v).padStart(cols.length, '0')
    cols.forEach((c, i) => {
      const d = Number(s[i])
      ;(c.firstElementChild as HTMLElement).style.transform = `translate3d(0, ${-d * 10}%, 0)`
      // no leading zero: the tens column steps aside below 10
      c.classList.toggle('is-off', i < cols.length - 1 && s.slice(0, i + 1).split('').every((ch) => ch === '0'))
    })
  }
  // (the still page sets its final count in CSS)
  setRoll(0, 0)
  setRoll(1, 0)

  const cache = { counts: '', orbit: '' }
  const on = (el: Element | null, c: string, v: boolean) => el?.classList.toggle(c, v)

  const measure = (g: { perch?: { x: number; y: number; s: number; hop: number }; R: number; narrow: boolean }) => {
    // the board's place in the world: offsets up to and including the artboard
    bw.x = bw.y = 0
    for (let n: HTMLElement | null = board; n; n = n.offsetParent as HTMLElement | null) {
      bw.x += n.offsetLeft
      bw.y += n.offsetTop
      if (n.classList.contains('bf')) break
    }
    // layout offsets inside the board (transforms don't count)
    const at = (el: HTMLElement) => {
      let x = el.offsetWidth / 2
      let y = el.offsetHeight / 2
      for (let n: HTMLElement | null = el; n && n !== board; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft
        y += n.offsetTop
      }
      return [x, y]
    }
    const [tx, ty] = blob ? at(blob) : [board.offsetWidth / 2, board.offsetHeight / 3]
    // the bubble perches here once everything has folded into the orbit
    g.perch = { x: bw.x + tx, y: bw.y + ty, s: g.narrow ? 0.55 : 0.5, hop: g.narrow ? 16 : 22 }
    spits.forEach((sp) => {
      ;[sp.x, sp.y] = at(sp.el)
      sp.key = '-'
    })
    let far = 1
    flys.forEach((f) => {
      const [x, y] = at(f.el)
      f.dx = tx - x
      f.dy = ty - y
      far = Math.max(far, Math.hypot(f.dx, f.dy))
    })
    // the farthest pieces set off last, so the fold reads as a pull to the centre
    flys.forEach((f) => {
      f.s = (Math.hypot(f.dx, f.dy) / far) * SPREAD
      f.key = '-'
    })
    cache.counts = cache.orbit = '-'
  }

  const off = registerFx({
    id: 'proof-tally',
    section: 2,
    measure: (g) => measure(g),
    update: (e) => {
      if (!e.near) return
      if (e.reduced) {
        // one still page: everything landed, the counts final, nothing folds
        if (!stage.classList.contains('is-full')) {
          ;[...cards, ...chips, ...labs].forEach((el) => el.classList.add('is-in', 'is-on'))
          stage.classList.add('is-grid', 'is-count', 'is-full', 'is-blob', 'is-me')
          setRoll(0, total)
          setRoll(1, TALLY.industries)
        }
        return
      }
      const q = e.reg[region] ?? 0

      on(stage, 'is-grid', q > 0.005)
      // everything is spat out of the bubble: until it lands, each thing waits
      // (as a vector) at the bubble's current spot, so that's where it flies from
      const b = live.state?.cores[0]
      if (b && q < 0.7) {
        spits.forEach((sp) => {
          if (sp.el.classList.contains('is-in') || (sp.el === counts && stage.classList.contains('is-count'))) return
          const k = `${Math.round(b.x - bw.x - sp.x)},${Math.round(b.y - bw.y - sp.y)}`
          if (k === sp.key) return
          sp.key = k
          const [x, y] = k.split(',')
          sp.el.style.setProperty('--fx', `${x}px`)
          sp.el.style.setProperty('--fy', `${y}px`)
        })
      }
      const landed = q < 0.08 ? 0 : Math.min(nCards, Math.floor((q - 0.08) / (0.36 / nCards)) + 1)
      cards.forEach((c, i) => on(c, 'is-in', i < landed))
      on(stage, 'is-count', landed > 0)
      let started = 0
      waves.forEach((w, k) => {
        const inn = q >= 0.44 + k * 0.045
        if (inn) started++
        w.forEach((c) => on(c, 'is-in', inn))
      })
      // the bubble gulps each time it spits something out
      const spat = landed + started
      if (spat > gulps) live.gulp++
      gulps = spat
      const products = q < 0.44 ? workBy[landed] : Math.min(total, nWork + Math.round(clamp01((q - 0.44) / 0.18) * (total - nWork)))
      setRoll(0, products)
      setRoll(1, Math.min(TALLY.industries, workBy[landed] + started))
      on(stage, 'is-full', products >= total)

      // the fold
      const c = easeIO(clamp01((q - 0.7) / 0.16))
      flys.forEach((f) => {
        const t = clamp01((c - f.s) / (1 - SPREAD))
        const k = t <= 0 ? '' : `${(f.dx * t).toFixed(1)},${(f.dy * t).toFixed(1)},${(1 - 0.75 * t).toFixed(3)},${t < 0.7 ? 1 : (1 - (t - 0.7) / 0.3).toFixed(3)}`
        if (k === f.key) return
        f.key = k
        if (!k) {
          f.el.style.transform = ''
          f.el.style.opacity = ''
          return
        }
        const [x, y, s, o] = k.split(',')
        f.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
        f.el.style.opacity = o
      })
      const ck = c.toFixed(3)
      if (counts && ck !== cache.counts) {
        cache.counts = ck
        counts.style.transform = c > 0 ? `translate3d(${(40 * c).toFixed(1)}px, 0, 0)` : ''
        counts.style.opacity = c > 0 ? (1 - Math.min(1, c * 1.6)).toFixed(3) : ''
      }
      if (orbit && ck !== cache.orbit) {
        cache.orbit = ck
        orbit.style.opacity = c > 0 ? c.toFixed(3) : '0'
        orbit.style.transform = `scale(${(0.6 + 0.4 * c).toFixed(3)})`
      }
      // a skill pops onto the ring as each wave of pieces arrives
      labs.forEach((l, i) => on(l, 'is-on', c >= (i + 1.5) / (labs.length + 1)))
      on(stage, 'is-blob', c > 0.3)
      on(stage, 'is-me', q >= 0.86)
    },
  })

  return () => {
    off()
    flys.forEach((f) => {
      f.el.style.transform = ''
      f.el.style.opacity = ''
    })
    for (const el of [counts, orbit]) if (el) el.style.transform = el.style.opacity = ''
    stage.classList.remove('is-grid', 'is-count', 'is-full', 'is-blob', 'is-me')
    ;[...cards, ...chips, ...labs].forEach((el) => el.classList.remove('is-in', 'is-on'))
  }
}
