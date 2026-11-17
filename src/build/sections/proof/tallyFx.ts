/**
 * 03 Proof, part one — drives the running total (./Tally.tsx) from the tally
 * region's progress q (the camera holds flat on it):
 *   0.12–0.42   the six cards about her land (alive pieces, born from the bubble)
 *   0.48–0.69   the 32 client names fill in one by one; the counters roll with them
 *   then        the count turns blue, and the line beneath fades in
 */
import { TALLY } from '../../../content/story'
import { registerFx } from '../../runtime'

/** when the first name shows, and the step between names (region progress) */
const CHIP_AT = 0.48
const CHIP_STEP = 0.0065

export function mountTally(root: HTMLElement, region: number) {
  const stage = root.querySelector<HTMLElement>('.pt-stage')
  const board = root.querySelector<HTMLElement>('.pt-board')
  if (!stage || !board) return () => {}
  const chips = Array.from(board.querySelectorAll<HTMLElement>('.pt-chip'))
  const more = board.querySelector<HTMLElement>('.pt-more')
  const rolls = Array.from(board.querySelectorAll<HTMLElement>('.pt-count')).map((el) => Array.from(el.querySelectorAll<HTMLElement>('.pt-col')))
  const total = chips.length

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

  const on = (el: Element | null, c: string, v: boolean) => el?.classList.toggle(c, v)
  let chipsShown = -1

  const off = registerFx({
    id: 'proof-tally',
    section: 2,
    update: (e) => {
      if (!e.near) return
      if (e.reduced) {
        // one still page: everything in, the counts final
        if (!stage.classList.contains('is-full')) {
          stage.classList.add('is-count', 'is-full')
          chips.forEach((c) => c.classList.add('is-on'))
          more?.classList.add('is-on')
          setRoll(0, total)
          setRoll(1, TALLY.industries)
        }
        return
      }
      const q = e.reg[region] ?? 0
      on(stage, 'is-count', (e.reg[0] ?? 0) > 0.8 || q > 0.005)

      // the counts follow the names as they fill in
      const chipsIn = Math.max(0, Math.min(chips.length, Math.floor((q - CHIP_AT) / CHIP_STEP) + 1))
      if (chipsIn !== chipsShown) {
        chipsShown = chipsIn
        chips.forEach((c, i) => on(c, 'is-on', i < chipsIn))
        on(more, 'is-on', chipsIn > 0)
      }
      setRoll(0, chipsIn)
      setRoll(1, Math.min(TALLY.industries, Math.ceil((chipsIn * TALLY.industries) / total)))
      on(stage, 'is-full', chipsIn >= total)
    },
  })

  return () => {
    off()
    stage.classList.remove('is-count', 'is-full')
    chips.forEach((c) => c.classList.remove('is-on'))
    more?.classList.remove('is-on')
  }
}
