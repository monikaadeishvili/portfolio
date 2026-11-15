/**
 * 03 Proof — the work strip's driver. Region 1's build progress slides the
 * track sideways (the camera holds still on the region, like How I think's
 * pan). Frames with several screens change page while in view, like
 * changing pages in an app; screen recordings play only while their frame is in
 * view. The bottom timeline's dot follows the strip and names the project in view.
 * Layout is read only in `measure`; `update` writes cached transforms.
 */
import { WORK } from '../../../content/story'
import { clamp01, registerFx } from '../../runtime'

const pad = (n: number) => String(n).padStart(2, '0')

export function mountWork(root: HTMLElement) {
  const q1 = <E extends Element = HTMLElement>(s: string) => root.querySelector<E>(s)
  const clip = q1('.pw-clip')
  const track = q1('.pw-track')
  const rule = q1('.pw-rule')
  const line = q1('.pw-line')
  const dot = q1('.pw-dot')
  const nowN = q1('.pw-now b')
  const nowName = q1('.pw-now em')
  if (!clip || !track) return () => {}
  const projs = Array.from(track.querySelectorAll<HTMLElement>('.pw-proj'))
  const ticks = Array.from(root.querySelectorAll<HTMLElement>('.pw-tick'))
  /** frames with several screens: they change page while in view, like an app */
  const decks = Array.from(track.querySelectorAll<HTMLElement>('.pw-m.is-deck')).map((el, k) => ({
    el,
    imgs: Array.from(el.querySelectorAll<HTMLImageElement>('.pw-shot img')),
    i: 0,
    mid: 0,
    w: 0,
    // decks start out of step, so neighbours don't all change at once
    next: 1.4 + (k % 3) * 0.8,
  }))
  /** screen recordings: they play while their frame is in view */
  const vids = Array.from(track.querySelectorAll<HTMLVideoElement>('.pw-shot video')).map((v) => {
    v.muted = true // autoplay without a gesture needs the property, not just the attribute
    return { v, el: v.closest<HTMLElement>('.pw-m') ?? v, on: false, mid: 0, w: 0 }
  })
  const play = (o: (typeof vids)[number], on: boolean) => {
    if (o.on === on) return
    o.on = on
    if (on) o.v.play().catch(() => (o.on = false))
    else o.v.pause()
  }
  const HOLD = 2.3 // seconds on each page

  let clipW = 1
  let travel = 0
  let lineW = 1
  let starts: number[] = []
  let shown = -1
  const cache = { track: '', dot: '', fade: '' }

  const measure = () => {
    clipW = clip.offsetWidth || 1
    travel = Math.max(0, track.scrollWidth - clipW)
    // layout offsets inside the track, in board px: screen rects would be
    // skewed by the camera's tilt (and the track's own slide)
    const left = (el: HTMLElement) => {
      let x = 0
      for (let n: HTMLElement | null = el; n && n !== clip; n = n.offsetParent as HTMLElement | null) x += n.offsetLeft
      return x - track.offsetLeft
    }
    starts = projs.map(left)
    ;[...decks, ...vids].forEach((d) => {
      d.w = d.el.offsetWidth
      d.mid = left(d.el) + d.w / 2
    })
    lineW = line?.offsetWidth || 1
    // a tick where each project starts arriving in frame
    ticks.forEach((t, i) => {
      const at = travel > 0 ? clamp01((starts[i] - clipW * 0.35) / travel) : 0
      t.style.left = `${(at * 100).toFixed(2)}%`
    })
    cache.track = cache.dot = cache.fade = ''
  }

  const setNow = (i: number) => {
    if (i === shown) return
    shown = i
    if (nowN) nowN.textContent = pad(i + 1)
    if (nowName) nowName.textContent = WORK[i].name
    ticks.forEach((t, k) => t.classList.toggle('is-past', k <= i))
  }
  setNow(0)

  const off = registerFx({
    id: 'proof-work',
    section: 2,
    measure: () => measure(),
    update: (e) => {
      if (!e.near || e.reduced) {
        vids.forEach((o) => play(o, false))
        return
      }
      const q = e.reg[1] ?? 0
      const T = clamp01((q - 0.03) / 0.92)
      const x = -T * travel

      const tk = `translateX(${x.toFixed(1)}px)`
      if (tk !== cache.track) {
        cache.track = tk
        track.style.transform = tk
      }

      // decks in view change page: the next page fades in over the current one
      decks.forEach((d) => {
        const seen = Math.abs(d.mid + x - clipW / 2) < clipW / 2 - d.w * 0.15
        if (!seen) {
          d.next = Math.max(d.next, e.t + 0.6)
          return
        }
        if (e.t < d.next) return
        d.next = e.t + HOLD
        const j = (d.i + 1) % d.imgs.length
        d.imgs.forEach((img, n) => (img.dataset.s = n === j ? 'on' : n === d.i ? 'prev' : 'park'))
        d.i = j
      })

      // a recording plays while any of its frame is on screen
      vids.forEach((o) => play(o, Math.abs(o.mid + x - clipW / 2) < clipW / 2 + o.w / 2))

      // the project in view: the last one whose text has crossed 40% of the frame
      const edge = -x + clipW * 0.4
      let now = 0
      for (let i = 0; i < starts.length; i++) if (starts[i] <= edge) now = i
      setNow(now)

      if (dot) {
        const dk = `translateX(${(T * lineW).toFixed(1)}px)`
        if (dk !== cache.dot) {
          cache.dot = dk
          dot.style.transform = dk
        }
      }
      // the timeline arrives with the strip
      const [w0, w1] = e.win(1)
      const L = Math.max(1e-4, w1 - w0)
      const pre = clamp01((e.p - (w0 - 0.1 * L)) / (0.12 * L))
      const fd = Math.max(0.002, pre).toFixed(3)
      if (rule && fd !== cache.fade) {
        cache.fade = fd
        rule.style.opacity = fd
      }
    },
  })

  return () => {
    off()
    track.style.transform = ''
    if (dot) dot.style.transform = ''
    if (rule) rule.style.opacity = ''
    decks.forEach((d) => d.imgs.forEach((img, n) => (img.dataset.s = n === 0 ? 'on' : 'park')))
    vids.forEach((o) => play(o, false))
  }
}
