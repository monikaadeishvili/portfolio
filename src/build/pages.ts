/* Pages: the site's navigation, like the Pages list of a Figma file.

   The story stays one scroll (everything is a function of one progress p).
   A page click travels there exactly like a click on the dock's timeline:
   a smooth scroll to the start of that board, the camera flying through.

   Each page has a hash (#work, #how-i-think, …): page clicks push history,
   scrolling across a board only replaces it (scrolling never fills the back
   stack), back/forward switch pages, and a link opens straight on its page. */
import { CHAPTERS } from '../content/story'
import './pages.css'
import { storyMax, ui } from '../scene/store'
import { chapterCh } from './bstore'
import { holdOf, LAST, phOf, secP, topOf, WORLDS } from './worlds'

export interface PageDef {
  /** board id (worlds.ts) */
  id: string
  label: string
  hash: string
  /** the board's place in the story */
  sec: number
  /** the world's accent: the page's colour square */
  color: string
}

const NAMES: Record<string, { label: string; hash: string }> = {
  hello: { label: 'Hello', hash: 'hello' },
  proof: { label: 'Work', hash: 'work' },
  craft: { label: 'How I think', hash: 'how-i-think' },
  contact: { label: 'Say hello', hash: 'say-hello' },
}

export const PAGES: PageDef[] = CHAPTERS.map((c, i) => ({ id: c.id, ...NAMES[c.id], sec: i, color: WORLDS[i].pal[0] }))

/** the page a hash names (no hash, or an unknown one: Hello) */
export function pageOfHash(h: string): number {
  const k = h.replace(/^#/, '').split('/')[0]
  const i = PAGES.findIndex((p) => p.hash === k)
  return i < 0 ? 0 : i
}

/** the stage can name a better landing from the measured layout (see Stage2) */
let measuredLand: ((i: number) => number | null) | null = null
export function setPageLand(fn: ((i: number) => number | null) | null) {
  measuredLand = fn
}

/** where a page opens: on its board with something finished to look at,
 *  never an empty frame (Hello from the very top; Work on its completed
 *  running total; How I think on its built top; Say hello on the finished page) */
export function pageLand(i: number) {
  if (i <= 0) return 0
  const m = measuredLand?.(i)
  if (m != null) return m
  if (i === LAST) return holdOf(LAST)
  return secP(i, phOf(i).flat)
}

const stage = () => document.querySelector<HTMLElement>('.bstage')
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function setHash(i: number, push: boolean) {
  const h = `#${PAGES[i].hash}`
  if (location.hash === h) return
  if (push) history.pushState(null, '', h)
  else history.replaceState(null, '', h)
}

/** open a page. push: add a history entry (a click). fly: travel there the way
 *  the dock's timeline does (a smooth scroll to the start of the board, the
 *  camera flying through); without it (a link opened cold): land at once on
 *  the board with something finished to look at */
export function goPage(i: number, { push = true, fly = true }: { push?: boolean; fly?: boolean } = {}) {
  const page = PAGES[i]
  if (!page) return
  if (push) setHash(i, true)
  // the panel highlights the page at once (the still page has no loop to tell it)
  window.dispatchEvent(new CustomEvent('pg:go', { detail: i }))
  const st = stage()
  // the still page (reduced motion): the boards are stacked, just scroll to it
  if (!st || st.classList.contains('is-static')) {
    document.getElementById(`ch-${page.id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
    return
  }
  const max = storyMax()
  if (fly && !reducedMotion()) ui.scrollTo?.(Math.max(0, Math.min(max, topOf(i) * max)), 1.6)
  else ui.scrollTo?.(Math.max(0, Math.min(max, pageLand(i) * max)), 0)
}

/** keep the hash on the board in view while scrolling, and follow back/forward.
 *  Returns the unsubscribe. */
export function syncPages() {
  let last = -1
  const offCh = chapterCh.sub((i) => {
    if (i === last) return
    last = i
    // the first section is the bare address (no #hello for a visitor who never navigated)
    if (i === 0 && !location.hash) return
    setHash(i, false)
  })
  const onPop = () => goPage(pageOfHash(location.hash), { push: false })
  window.addEventListener('popstate', onPop)
  return () => {
    offCh()
    window.removeEventListener('popstate', onPop)
  }
}
