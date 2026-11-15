/**
 * 03 Proof — the work strip's driver. The strip region's build progress slides
 * the track sideways (the camera holds still on the region, like How I think's
 * pan). On top of the slide:
 *   · frames are dealt in as they enter from the right (rise, tilt, settle) and
 *     sink back a little as they leave on the left;
 *   · a project's text column rises in when it arrives and trails the frames by
 *     a touch of parallax;
 *   · the screens lean with the strip's speed and straighten at rest;
 *   · phones change page like a tap on an app's tab bar, web and TV frames like
 *     a route change; recordings play only in view;
 *   · the strip washes faintly in the colour of the project in view, and the
 *     timeline fills, pops its ticks and rolls the project's name.
 * Layout is read only in `measure`; `update` writes cached transforms.
 */
import { WORK } from '../../../content/story'
import { clamp01, registerFx } from '../../runtime'

const pad = (n: number) => String(n).padStart(2, '0')
const HOLD = 2.6 // seconds on each page

export function mountWork(root: HTMLElement, region: number) {
  const q1 = <E extends Element = HTMLElement>(s: string) => root.querySelector<E>(s)
  const clip = q1('.pw-clip')
  const track = q1('.pw-track')
  const rule = q1('.pw-rule')
  const line = q1('.pw-line')
  const dot = q1('.pw-dot')
  const fill = q1('.pw-fill')
  const nowN = q1('.pw-now b')
  const names = Array.from(root.querySelectorAll<HTMLElement>('.pw-now em span'))
  const washes = Array.from(root.querySelectorAll<HTMLElement>('.pw-wash i'))
  if (!clip || !track) return () => {}
  const projs = Array.from(track.querySelectorAll<HTMLElement>('.pw-proj')).map((el) => ({
    el,
    ghost: el.querySelector<HTMLElement>('.pw-ghost'),
    kg: '',
    txt: el.querySelector<HTMLElement>('.pw-txt'),
    shots: el.querySelector<HTMLElement>('.pw-shots'),
    start: 0,
    tw: 0,
    on: false,
    kt: '',
    ks: '',
  }))
  const ticks = Array.from(root.querySelectorAll<HTMLElement>('.pw-tick'))
  /** every frame: dealt in on arrival */
  const frames = Array.from(track.querySelectorAll<HTMLElement>('.pw-m')).map((el, k) => ({ el, k, mid: 0, w: 0, key: '' }))
  /** frames with several screens: they change page while in view, like an app */
  const decks = Array.from(track.querySelectorAll<HTMLElement>('.pw-m.is-deck')).map((el, k) => ({
    el,
    shot: el.querySelector<HTMLElement>('.pw-shot'),
    imgs: Array.from(el.querySelectorAll<HTMLImageElement>('.pw-shot img')),
    i: 0,
    mid: 0,
    w: 0,
    // decks start out of step, so neighbours don't all change at once
    next: 1.4 + (k % 3) * 0.8,
  }))
  // decode every page up front, so a page change never waits on (or stutters
  // over) decoding the image that slides in
  decks.forEach((d) => d.imgs.forEach((img) => img.decode?.().catch(() => {})))
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

  let clipW = 1
  let travel = 0
  let lineW = 1
  let shown = -1
  let flip = 0
  // the strip's speed, smoothed, for the lean
  let lastX = 0
  let lastT = -1
  let vel = 0
  const cache = { track: '', dot: '', fill: '', fade: '', walk: '' }

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
    projs.forEach((p) => {
      p.start = left(p.el)
      p.tw = p.txt?.offsetWidth ?? 0
      p.kt = p.ks = p.kg = '-'
    })
    ;[...decks, ...vids, ...frames].forEach((d) => {
      d.w = d.el.offsetWidth
      d.mid = left(d.el) + d.w / 2
    })
    // the strip stops with the last project centred in the frame (its text and
    // screens), not slid on into the empty paper after it; when it is wider than
    // the frame, it stops once its last screen is fully in
    const last = projs[projs.length - 1]
    const lastFrames = frames.filter((f) => last && last.el.contains(f.el))
    if (last && lastFrames.length) {
      const right = Math.max(...lastFrames.map((f) => f.mid + f.w / 2))
      const span = right - last.start
      const stop = span <= clipW - 48 ? last.start + span / 2 - clipW / 2 : right + 24 - clipW
      travel = Math.max(0, Math.min(travel, stop))
    }
    frames.forEach((f) => (f.key = '-'))
    lineW = line?.offsetWidth || 1
    // a tick where each project starts arriving in frame
    ticks.forEach((t, i) => {
      const at = travel > 0 ? clamp01((projs[i].start - clipW * 0.35) / travel) : 0
      t.style.left = `${(at * 100).toFixed(2)}%`
    })
    cache.track = cache.dot = cache.fill = cache.fade = ''
  }

  const setNow = (i: number) => {
    if (i === shown) return
    const first = shown < 0
    shown = i
    if (nowN) nowN.textContent = pad(i + 1)
    // the name rolls: the new one comes up from below as the old one leaves
    if (names.length === 2 && !first) {
      flip = 1 - flip
      const inn = names[flip]
      const out = names[1 - flip]
      inn.textContent = WORK[i].name
      inn.className = 'is-on'
      out.className = 'is-out'
    }
    ticks.forEach((t, k) => t.classList.toggle('is-past', k <= i))
    washes.forEach((w, k) => w.classList.toggle('is-on', k === i))
    rule?.style.setProperty('--tint', WORK[i].tint)
  }
  setNow(0)

  const off = registerFx({
    id: 'proof-work',
    section: 2,
    measure: () => measure(),
    update: (e) => {
      if (!e.near || e.reduced) {
        vids.forEach((o) => play(o, false))
        if (e.reduced) projs.forEach((p) => p.el.classList.add('is-in'))
        return
      }
      const q = e.reg[region] ?? 0
      const T = clamp01((q - 0.03) / 0.92)
      const x = -T * travel

      const tk = `translateX(${x.toFixed(1)}px)`
      if (tk !== cache.track) {
        cache.track = tk
        track.style.transform = tk
      }

      // speed, in board px per second, eased so the lean breathes
      const dt = lastT < 0 ? 0 : Math.min(0.1, e.t - lastT)
      if (dt > 0) vel += ((x - lastX) / dt - vel) * Math.min(1, dt * 7)
      lastX = x
      lastT = e.t
      const lean = Math.max(-2.5, Math.min(2.5, vel * 0.0011))
      const leanK = Math.abs(lean) < 0.05 ? '' : lean.toFixed(2)

      // frames dealt in: they rise, tilt and settle as they come in from the
      // right, and sink back a little on their way out on the left
      frames.forEach((f) => {
        const pos = f.mid + x
        const u = clamp01((clipW - (pos - f.w / 2)) / (clipW * 0.32))
        const gone = clamp01((clipW * 0.12 - (pos + f.w / 2 - clipW * 0.06)) / (clipW * 0.18))
        const tilt = (f.k % 2 ? 2.5 : -2.5) * (1 - u)
        const sc = (0.92 + 0.08 * u) * (1 - 0.03 * gone)
        const op = Math.min(1, u * 2) * (1 - 0.6 * gone)
        const k = u >= 1 && gone <= 0 ? '' : `${(36 * (1 - u)).toFixed(1)}|${tilt.toFixed(2)}|${sc.toFixed(3)}|${op.toFixed(3)}`
        if (k === f.key) return
        f.key = k
        if (!k) {
          f.el.style.transform = ''
          f.el.style.opacity = ''
          return
        }
        const [ty, r, s, o] = k.split('|')
        f.el.style.transform = `translate3d(0, ${ty}px, 0) rotate(${r}deg) scale(${s})`
        f.el.style.opacity = o
      })

      projs.forEach((p) => {
        const pos = p.start + x
        // the text rises in once it's well inside the frame; it hides again
        // only when scrolled back out past the right edge
        if (!p.on && pos < clipW * 0.8) p.on = true
        else if (p.on && pos > clipW) p.on = false
        p.el.classList.toggle('is-in', p.on)
        // and trails the frames a little (parallax)
        if (p.txt) {
          const d = pos + p.tw / 2 - clipW / 2
          const kt = (-0.06 * d).toFixed(1)
          if (kt !== p.kt) {
            p.kt = kt
            p.txt.style.transform = `translate3d(${kt}px, 0, 0)`
          }
        }
        // its ghost name drifts at about half the strip's speed
        if (p.ghost) {
          const kg = (-0.55 * (pos - clipW * 0.3)).toFixed(1)
          if (kg !== p.kg) {
            p.kg = kg
            p.ghost.style.transform = `translate3d(${kg}px, 0, 0)`
          }
        }
        if (p.shots && leanK !== p.ks) {
          p.ks = leanK
          p.shots.style.transform = leanK ? `skewX(${leanK}deg)` : ''
        }
      })

      // decks in view change page: phones like a tab-bar tap (the next page fades
      // in, settling from a touch smaller), web and TV frames rise into the next view
      decks.forEach((d) => {
        const seen = Math.abs(d.mid + x - clipW / 2) < clipW / 2 - d.w * 0.15
        if (!seen) {
          d.next = Math.max(d.next, e.t + 0.6)
          return
        }
        if (e.t < d.next) return
        d.next = e.t + HOLD
        const j = (d.i + 1) % d.imgs.length
        if (d.shot) d.shot.dataset.dir = j === 0 ? 'back' : 'fwd'
        d.imgs.forEach((img, n) => (img.dataset.s = n === j ? 'on' : n === d.i ? 'prev' : 'park'))
        d.i = j
      })

      // a recording plays while any of its frame is on screen
      vids.forEach((o) => play(o, Math.abs(o.mid + x - clipW / 2) < clipW / 2 + o.w / 2))

      // the project in view: the last one whose text has crossed 40% of the frame
      const edge = -x + clipW * 0.4
      let now = 0
      for (let i = 0; i < projs.length; i++) if (projs[i].start <= edge) now = i
      setNow(now)

      if (dot) {
        const dk = `translateX(${(T * lineW).toFixed(1)}px)`
        if (dk !== cache.dot) {
          cache.dot = dk
          dot.style.transform = dk
        }
        // the walker's legs move while the strip does, and it faces its way
        const walking = Math.abs(vel) > 40
        const wk = walking ? (vel < 0 ? 'f' : 'b') : ''
        if (wk !== cache.walk) {
          cache.walk = wk
          if (wk) dot.dataset.walk = wk
          else delete dot.dataset.walk
        }
      }
      if (fill) {
        const fk = `scaleX(${T.toFixed(4)})`
        if (fk !== cache.fill) {
          cache.fill = fk
          fill.style.transform = fk
        }
      }
      // the timeline arrives with the strip
      const [w0, w1] = e.win(region)
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
    if (fill) fill.style.transform = ''
    if (rule) rule.style.opacity = ''
    frames.forEach((f) => (f.el.style.transform = f.el.style.opacity = ''))
    projs.forEach((p) => {
      p.el.classList.remove('is-in')
      if (p.ghost) p.ghost.style.transform = ''
      if (p.txt) p.txt.style.transform = ''
      if (p.shots) p.shots.style.transform = ''
    })
    decks.forEach((d) => {
      if (d.shot) delete d.shot.dataset.dir
      d.imgs.forEach((img, n) => (img.dataset.s = n === 0 ? 'on' : 'park'))
    })
    vids.forEach((o) => play(o, false))
  }
}
