/**
 * Worked with: the client names drift left in a slow, seamless loop
 * (./marquee.ts), faded out at both edges.
 */
import { runMarquee } from './marquee'

/** drift speed, layout px per second */
const SPEED = 28

export function mountWw(board: HTMLElement) {
  const mq = board.querySelector<HTMLElement>('.h-ww-mq')
  const rail = board.querySelector<HTMLElement>('.h-ww-rail')
  const set = board.querySelector<HTMLElement>('.h-ww-set')
  if (!mq || !rail || !set) return () => {}
  return runMarquee({ win: mq, rail, set, speed: SPEED })
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
