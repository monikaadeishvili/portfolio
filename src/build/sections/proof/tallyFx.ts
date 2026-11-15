/**
 * 03 Proof, part one — drives the running total (./Tally.tsx). The stickers
 * and chips are alive pieces (they wait, walk, leap and pop on their own, see
 * the Piece scheduler); this counts what has landed and runs the fold, from the
 * tally region's progress q (the camera holds flat on it):
 *   headline     the grid draws itself while the stickers stand waiting
 *   0.09–0.46    the thirteen stickers walk / leap into their cells; the
 *                counters roll with every client product that lands
 *   0.48–0.62    the 26 chips pop out of the bubble; the count runs to 32
 *   0.70–0.86    everything folds onto a slowly turning ring around "your
 *                product" (scrubbed): the cards on an inner ring, the chips as
 *                dots on an outer one
 *   0.86         one card drops out below: one designer, all of the above
 *   0.90–1       the bubble jumps back out (bubble/choreo.ts)
 * Layout is read only in `measure`.
 */
import { TALLY } from '../../../content/story'
import { clamp01, registerFx } from '../../runtime'

const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** how much of the fold the farthest piece waits before it sets off */
const SPREAD = 0.3
/** the rings turn this many radians per second once folded (about 90 s a turn) */
const SPIN = (Math.PI * 2) / 90

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
  /** everything that folds: the cards onto the inner ring, the chips onto the outer */
  const flys = [...cards.map((el, i) => ({ el, i, n: cards.length, chip: false })), ...chips.map((el, i) => ({ el, i, n: chips.length, chip: true }))].map((f) => ({
    ...f,
    x: 0,
    y: 0,
    s: 0,
    key: '',
  }))
  const workIds = TALLY.cards.filter((c) => c.kind === 'work').map((c) => `t-${c.id}`)
  const chipIds = TALLY.chips.map((_, i) => `t-chip-${i}`)
  const total = workIds.length + chipIds.length

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

  // the ring the fold lands on: its centre (where the bubble perches) and radii
  const ring = { x: 0, y: 0, rx: 300, ry: 150, ox: 380, oy: 190 }
  const cache = { counts: '', orbit: '' }
  const on = (el: Element | null, c: string, v: boolean) => el?.classList.toggle(c, v)

  const measure = (g: { perch?: { x: number; y: number; s: number; hop: number }; R: number; narrow: boolean }) => {
    // the board's place in the world: offsets up to and including the artboard
    let bx = 0
    let by = 0
    for (let n: HTMLElement | null = board; n; n = n.offsetParent as HTMLElement | null) {
      bx += n.offsetLeft
      by += n.offsetTop
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
    ring.x = tx
    ring.y = ty
    // a flat ellipse: it clears the designer card that drops in below
    Object.assign(ring, g.narrow ? { rx: 140, ry: 96, ox: 162, oy: 122 } : { rx: 300, ry: 150, ox: 380, oy: 190 })
    // the bubble perches in the middle once everything has folded
    g.perch = { x: bx + tx, y: by + ty, s: g.narrow ? 0.55 : 0.5, hop: g.narrow ? 16 : 22 }
    let far = 1
    flys.forEach((f) => {
      ;[f.x, f.y] = at(f.el)
      far = Math.max(far, Math.hypot(tx - f.x, ty - f.y))
    })
    // the farthest pieces set off last, so the fold reads as a pull inward
    flys.forEach((f) => {
      f.s = (Math.hypot(tx - f.x, ty - f.y) / far) * SPREAD
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
          labs.forEach((el) => el.classList.add('is-on'))
          stage.classList.add('is-grid', 'is-count', 'is-full', 'is-blob', 'is-me')
          setRoll(0, total)
          setRoll(1, TALLY.industries)
        }
        return
      }
      const q = e.reg[region] ?? 0

      // the grid draws itself while the headline is still up: the empty board
      // fills with lines as the stickers stand waiting
      on(stage, 'is-grid', (e.reg[0] ?? 0) > 0.6 || q > 0.005)
      on(stage, 'is-count', (e.reg[0] ?? 0) > 0.8 || q > 0.005)

      // the counts follow what has actually landed
      const down = (id: string) => {
        const c = e.piece(id)
        return !!c && e.p >= c.p1
      }
      const work = workIds.filter(down).length
      const chipsIn = chipIds.filter(down).length
      const products = work + chipsIn
      setRoll(0, products)
      setRoll(1, Math.min(TALLY.industries, work + Math.floor((chipsIn * (TALLY.industries - workIds.length)) / chipIds.length)))
      on(stage, 'is-full', products >= total)

      // the fold: onto a slowly turning ring around "your product"
      const c = easeIO(clamp01((q - 0.7) / 0.16))
      const turn = e.t * SPIN
      flys.forEach((f) => {
        const t = clamp01((c - f.s) / (1 - SPREAD))
        let k = ''
        if (t > 0) {
          const a = (f.i / f.n) * Math.PI * 2 - Math.PI / 2 + (f.chip ? -turn * 0.6 : turn)
          const tx = ring.x + Math.cos(a) * (f.chip ? ring.ox : ring.rx)
          const ty = ring.y + Math.sin(a) * (f.chip ? ring.oy : ring.ry)
          const sc = 1 - (1 - (f.chip ? 0.08 : 0.3)) * t
          k = `${((tx - f.x) * t).toFixed(1)},${((ty - f.y) * t).toFixed(1)},${sc.toFixed(3)}`
        }
        if (k === f.key) return
        f.key = k
        if (!k) {
          f.el.style.transform = ''
          return
        }
        const [x, y, s] = k.split(',')
        f.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${s})`
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
      // a skill pops onto the ring as the pieces arrive
      labs.forEach((l, i) => on(l, 'is-on', c >= (i + 1.5) / (labs.length + 1)))
      on(stage, 'is-blob', c > 0.3)
      on(stage, 'is-me', q >= 0.86)
    },
  })

  return () => {
    off()
    flys.forEach((f) => (f.el.style.transform = ''))
    for (const el of [counts, orbit]) if (el) el.style.transform = el.style.opacity = ''
    stage.classList.remove('is-grid', 'is-count', 'is-full', 'is-blob', 'is-me')
    labs.forEach((el) => el.classList.remove('is-on'))
  }
}
