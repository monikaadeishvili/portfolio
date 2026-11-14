/**
 * Worked with: the client names drift left in a slow, seamless loop
 * (./marquee.ts), faded out at both edges. Under the cursor the letters take
 * the headline's hover wake (./headWake.ts) and nothing else moves: each name
 * keeps its resting width (a lighter name shrinks inside its own box), so its
 * neighbours never shift.
 */
import { mountWake } from './headWake'
import { runMarquee } from './marquee'

/** drift speed, layout px per second */
const SPEED = 46

export function mountWw(board: HTMLElement) {
  const mq = board.querySelector<HTMLElement>('.h-ww-mq')
  const rail = board.querySelector<HTMLElement>('.h-ww-rail')
  const set = board.querySelector<HTMLElement>('.h-ww-set')
  if (!mq || !rail || !set) return () => {}
  const names = Array.from(rail.querySelectorAll<HTMLElement>('.h-ww-n'))
  const offMq = runMarquee({
    win: mq,
    rail,
    set,
    speed: SPEED,
    // each name locked to its resting width (read all, then write)
    beforeMeasure: () => {
      names.forEach((n) => (n.style.width = ''))
      const w = names.map((n) => getComputedStyle(n).width)
      names.forEach((n, i) => (n.style.width = w[i]))
    },
  })
  // the letters lighten under the cursor like the headline (re-measured often: they drift)
  const offWake = mountWake({ chars: Array.from(rail.querySelectorAll<HTMLElement>('.h-ch')), zones: [mq], remeasure: 90 })
  return () => {
    offMq()
    offWake()
    names.forEach((n) => (n.style.width = ''))
  }
}

/** the statement + process ribbons: two crossing tapes drifting opposite ways */
export function mountRibbons(board: HTMLElement) {
  const offs = Array.from(board.querySelectorAll<HTMLElement>('.h-rib')).map((rib) => {
    const rail = rib.querySelector<HTMLElement>('.h-rib-rail')
    const set = rib.querySelector<HTMLElement>('.h-rib-set')
    if (!rail || !set) return () => {}
    return runMarquee({ win: rib, rail, set, speed: Number(rib.dataset.speed) || 40 })
  })
  return () => offs.forEach((f) => f())
}
