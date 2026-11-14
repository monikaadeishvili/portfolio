/**
 * 03 How I think — the scroll driver. Region 1's build progress becomes a
 * station coordinate s (0..4, soft detents at each stop) that slides the
 * panel track and the giant outline words (parallax), reveals each panel as
 * it nears centre, moves the rail, and feeds the 3-D kit (lazy-loaded,
 * rendering only while the section is on screen). Also wires "take it apart"
 * (press and hold the model, or the button). No layout reads in update.
 */
import { live } from '../../loop'
import { clamp01, registerFx, smooth } from '../../runtime'
import type { KitScene } from '../../three/KitScene'
import { HERO_PILL, START } from '../../three/kitForms'

const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** station coordinate with soft detents: never fully stalls, exactly reversible */
const detent = (T: number) => {
  const x = T * 4
  const k = Math.min(3, Math.floor(x))
  const f = x - k
  return k + 0.3 * f + 0.7 * inOut(f)
}

export function mountKit(root: HTMLElement, narrow: boolean) {
  const q1 = <E extends Element = HTMLElement>(s: string) => root.querySelector<E>(s)
  const clip = q1('.hk-clip')
  const track = q1('.hk-track')
  const backT = q1('.hk-back-track')
  const back = q1('.hk-back')
  const gl = q1('.hk-gl')
  const canvas = q1<HTMLCanvasElement>('.hk-cv')
  const hit = q1('.hk-hit')
  const thumb = q1('.hk-thumb')
  const ovf = q1('.hk-ovf')
  const apart = q1<HTMLButtonElement>('.hk-apart')
  if (!clip || !track || !gl || !canvas || !hit) return () => {}
  const panels = Array.from(track.querySelectorAll<HTMLElement>('.hk-panel')).map((el) => ({
    letters: Array.from(el.querySelectorAll<HTMLElement>('.hk-vl-in')),
    fades: Array.from(el.querySelectorAll<HTMLElement>('.hk-sub, .hk-body, .hk-makes')),
    cache: [] as string[],
  }))
  const ticks = Array.from(root.querySelectorAll<HTMLElement>('.hk-tick'))
  const redl = Array.from(root.querySelectorAll<HTMLElement>('.hk-redl'))
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  let PW = 1
  let tickGap = 1
  let tick0 = 0
  let glW = 1
  let glH = 1
  let glX = 0
  let glY = 0
  let pr = 1
  let scene: KitScene | null = null
  let loading = false
  let dead = false
  let ready = false
  let shown = ''
  let frame = 0
  let sPrev = 0
  let vel = 0
  const cache = { track: '', back: '', thumb: '', ovf: '', redl: ['', '', ''] }

  const pixelRatio = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    return narrow ? dpr * 0.75 : Math.min(1.5, Math.max(0.8, live.cam.s * dpr * 1.1))
  }
  const measure = () => {
    PW = clip.offsetWidth || 1
    if (ticks.length > 1) {
      tick0 = ticks[0].offsetLeft + ticks[0].offsetWidth / 2
      tickGap = ticks[1].offsetLeft + ticks[1].offsetWidth / 2 - tick0
    }
    glW = gl.offsetWidth
    glH = gl.offsetHeight
    glX = gl.offsetLeft - hit.offsetLeft
    glY = gl.offsetTop - hit.offsetTop
    pr = pixelRatio()
    scene?.resize(glW, glH, pr)
    cache.track = cache.back = cache.thumb = ''
    panels.forEach((p) => (p.cache = []))
  }

  const load = () => {
    if (loading || reduced) return
    loading = true
    import('../../three/KitScene')
      .then(async ({ KitScene }) => {
        if (dead) return
        const s = new KitScene(canvas, narrow)
        if (!s.ok) {
          gl.dataset.gl = '0'
          return
        }
        scene = s
        scene.resize(glW, glH, pr)
        await scene.warm()
        if (dead) return
        ready = true
        gl.dataset.gl = '1'
      })
      .catch(() => (gl.dataset.gl = '0'))
  }

  /* ---- pointer: tilt, nudge, take it apart */
  const onMove = (e: PointerEvent) => scene?.setPointer(e.offsetX + glX, e.offsetY + glY, true)
  const onLeave = () => {
    scene?.setPointer(0, 0, false)
    if (!pressed) scene?.setExplode(0)
  }
  let pressed = false
  let pulse = 0
  const onDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') {
      // touch: a tap plays a short out-and-back pulse
      scene?.setExplode(1)
      window.clearTimeout(pulse)
      pulse = window.setTimeout(() => !pressed && scene?.setExplode(0), 600)
      return
    }
    scene?.setExplode(1)
  }
  const onUp = () => {
    if (!pressed) scene?.setExplode(0)
  }
  const onApart = () => {
    pressed = !pressed
    apart?.setAttribute('aria-pressed', String(pressed))
    const l = apart?.querySelector('.hk-apart-l')
    if (l) l.textContent = pressed ? 'Put it back' : 'Take it apart'
    scene?.setExplode(pressed ? 1 : 0)
  }
  hit.addEventListener('pointermove', onMove, { passive: true })
  hit.addEventListener('pointerleave', onLeave)
  hit.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  apart?.addEventListener('click', onApart)

  const anchor: [number, number] = [0, 0]
  const RED_PARTS = [START.dot + 0, START.card + 0, HERO_PILL]
  const RED_OFF: [number, number][] = [
    [-34, -6],
    [-44, -38],
    [-150, -40],
  ]

  const off = registerFx({
    id: 'craft-kit',
    section: 2,
    measure: () => measure(),
    update: (e) => {
      if (!e.near) {
        if (shown !== 'h') {
          shown = 'h'
          gl.style.visibility = 'hidden'
        }
        return
      }
      if (!loading) load()
      // the pan: region 1's progress → station coordinate s (0..4)
      const q = e.reg[1] ?? 0
      const T = clamp01((q - 0.05) / 0.85)
      const s = e.reduced ? 0 : detent(T)
      const [w0, w1] = e.win(1)
      const L = Math.max(1e-4, w1 - w0)
      const pre = clamp01((e.p - (w0 - 0.1 * L)) / (0.12 * L))
      const dt = Math.max(1e-3, e.dt)
      vel += ((s - sPrev) / dt - vel) * 0.12
      sPrev = s

      const tk = `translateX(${(-s * PW).toFixed(1)}px)`
      if (tk !== cache.track) {
        cache.track = tk
        track.style.transform = tk
      }
      if (backT) {
        const bk = `translateX(${(-s * 0.62 * PW).toFixed(1)}px) skewX(${Math.max(-6, Math.min(6, vel * -4)).toFixed(2)}deg)`
        if (bk !== cache.back) {
          cache.back = bk
          backT.style.transform = bk
        }
      }
      if (thumb) {
        const th = `translateX(${(tick0 + s * tickGap).toFixed(1)}px)`
        if (th !== cache.thumb) {
          cache.thumb = th
          thumb.style.transform = th
        }
      }
      const ov = pre.toFixed(2)
      if (ov !== cache.ovf) {
        cache.ovf = ov
        if (ovf) ovf.style.opacity = ov
        if (back) back.style.opacity = ov
      }
      // each panel reveals as it nears the centre (d = signed distance in panels)
      panels.forEach((p, k) => {
        const d = s - k
        const ad = Math.abs(d)
        p.letters.forEach((l, j) => {
          // staggered on the way in/out, all landed at the stop
          const v = 1 - smooth(0.12, 0.48, ad * (1 + j * 0.08))
          const key = v >= 0.999 ? '' : `translateY(${((1 - v) * 110).toFixed(1)}%)`
          if (key !== p.cache[j]) {
            p.cache[j] = key
            l.style.transform = key
          }
        })
        p.fades.forEach((el, j) => {
          // gone before it crosses the stage (the copy never shows through the parts)
          const a = 1 - smooth(0.1, 0.38, ad + j * 0.04)
          const key = `${a.toFixed(3)}|${(d * 60).toFixed(1)}`
          const n = p.letters.length + j
          if (key === p.cache[n]) return
          p.cache[n] = key
          el.style.opacity = a.toFixed(3)
          el.style.transform = a >= 0.999 ? '' : `translateX(${(d * 60).toFixed(1)}px)`
        })
      })

      // the 3-D: render only while this section is on screen
      const on = ready && e.u > -0.02 && e.u < 0.97 && !document.hidden
      const sh = on ? 'v' : 'h'
      if (sh !== shown) {
        shown = sh
        gl.style.visibility = on ? '' : 'hidden'
      }
      if (!on || !scene) return
      // the intro (only loose parts on screen): 30fps is plenty
      frame++
      if (q <= 0 && pre <= 0 && frame % 2) return
      const want = pixelRatio()
      if (Math.abs(want - pr) / pr > 0.15) {
        pr = want
        scene.resize(glW, glH, pr)
      }
      scene.render({ pre, s, t: e.t, dt: e.dt * (q <= 0 && pre <= 0 ? 2 : 1), vel })
      // handoff redline labels follow their parts (wide only)
      if (!narrow) {
        const red = smooth(2.72, 2.95, s) * (1 - smooth(3.05, 3.3, s))
        redl.forEach((el, i) => {
          let key = 'h'
          if (red > 0.01) {
            scene!.anchorPx(RED_PARTS[i], anchor)
            key = `${red.toFixed(2)}|${(anchor[0] + RED_OFF[i][0]).toFixed(0)}|${(anchor[1] + RED_OFF[i][1]).toFixed(0)}`
          }
          if (key === cache.redl[i]) return
          cache.redl[i] = key
          if (key === 'h') el.style.opacity = '0'
          else {
            const [o, x, y] = key.split('|')
            el.style.opacity = o
            el.style.transform = `translate(${x}px, ${y}px)`
          }
        })
      }
    },
  })

  return () => {
    dead = true
    off()
    window.clearTimeout(pulse)
    hit.removeEventListener('pointermove', onMove)
    hit.removeEventListener('pointerleave', onLeave)
    hit.removeEventListener('pointerdown', onDown)
    window.removeEventListener('pointerup', onUp)
    apart?.removeEventListener('click', onApart)
    scene?.dispose()
    scene = null
    track.style.transform = ''
    if (backT) backT.style.transform = ''
  }
}
