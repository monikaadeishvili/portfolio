/**
 * 06 After hours — the driver. Trip progress f comes straight from the
 * page's (Lenis-smoothed) scroll below the story's own length, eased once
 * more so scrubbing stays liquid. It slides the Figma panels off, opens the
 * portal over momo, runs the lazy-loaded TripScene, and sets the captions.
 * Layout is read only on resize and once when the portal opens.
 */
import gsap from 'gsap'
import { scene as stageScene, storyMax, ui } from '../../../scene/store'
import type { TripScene } from '../../three/TripScene'

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
/** f at which the portal covers the screen */
const OPEN = 0.075

export function mountFun(root: HTMLElement, narrow: boolean) {
  const canvas = root.querySelector<HTMLCanvasElement>('.fun-cv')
  const stage = root.closest<HTMLElement>('.bstage')
  const spacer = document.querySelector<HTMLElement>('.fun-spacer')
  if (!canvas || !stage || !spacer) return () => {}
  const poke = root.querySelector<HTMLElement>('.fun-poke')
  const end = root.querySelector<HTMLElement>('.fun-end')
  const caps = Array.from(root.querySelectorAll<HTMLElement>('.fun-cap[data-a]')).map((el) => ({ el, a: Number(el.dataset.a), b: Number(el.dataset.b), key: '' }))
  const chrome = [
    { sel: '.layers', x: -135, y: 8, r: -13, fade: false },
    { sel: '.inspector', x: 135, y: 10, r: 12, fade: false },
    { sel: '.dock', x: 0, y: 260, r: 6, fade: false },
    // phones: the file bar lifts off the top and goes, so the trip is full-screen
    { sel: '.filebar', x: 0, y: -220, r: -3, fade: true },
  ].map((c) => ({ ...c, el: document.querySelector<HTMLElement>(c.sel), key: '' }))

  let trip: TripScene | null = null
  let loading = false
  let ready = false
  /** no WebGL: skip the dreams, keep the ending */
  let failed = false
  let dead = false
  let max = 1
  let len = 1
  let W = 1
  let H = 1
  let f = 0
  let fT = 0
  let on = false
  let inside = false
  let hideStage = false
  let endKey = ''
  let pokeOn = false
  const hole = { x: 0, y: 0, r: 40 }
  let holeFresh = false

  const pixelRatio = () => {
    const dpr = window.devicePixelRatio || 1
    return narrow ? Math.min(1.4, dpr * 0.7) : Math.min(1.25, dpr)
  }
  const measure = () => {
    max = storyMax()
    len = Math.max(1, spacer.offsetHeight)
    W = root.offsetWidth || window.innerWidth
    H = root.offsetHeight || window.innerHeight
    trip?.resize(W, H, pixelRatio())
    holeFresh = false
  }
  measure()

  const load = () => {
    if (loading) return
    loading = true
    import('../../three/TripScene')
      .then(({ TripScene }) => {
        const go = async () => {
          if (dead) return
          const s = new TripScene(canvas, narrow)
          if (!s.ok) {
            failed = true
            return
          }
          trip = s
          trip.resize(W, H, pixelRatio())
          await trip.warm()
          if (!dead) ready = true
        }
        const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
        if (ric) ric(() => void go(), { timeout: 1200 })
        else window.setTimeout(() => void go(), 60)
      })
      .catch(() => (failed = true))
  }

  /** the portal opens where momo sits on the page (read once per entry) */
  const findHole = () => {
    const m = document.querySelector<HTMLElement>('.b-mascot')
    const r = m?.getBoundingClientRect()
    if (r && r.width > 4 && r.bottom > 0 && r.top < H) {
      hole.x = r.left + r.width / 2
      hole.y = r.top + r.height * 0.48
      hole.r = Math.max(18, r.width * 0.42)
    } else {
      hole.x = W / 2
      hole.y = H * 0.6
      hole.r = 30
    }
    holeFresh = true
  }

  const onMove = (e: PointerEvent) => trip?.setPointer((e.clientX / W) * 2 - 1, -((e.clientY / H) * 2 - 1))
  const onClick = (e: PointerEvent) => {
    if (!inside) return
    trip?.poke(e.clientX, e.clientY, f)
  }
  const onAct = (e: MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-act="top"]')
    if (b) ui.scrollTo?.(0, 3.2)
  }
  // the scroll position, cached on scroll: reading window.scrollY inside the
  // frame (after other writes) forced a style + layout pass every frame
  let sy = window.scrollY
  const onScroll = () => (sy = window.scrollY)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('pointermove', onMove, { passive: true })
  canvas.addEventListener('pointerdown', onClick)
  root.addEventListener('click', onAct)
  let rz = 0
  const onResize = () => {
    window.clearTimeout(rz)
    rz = window.setTimeout(measure, 120)
  }
  window.addEventListener('resize', onResize)

  const tick = (time: number, deltaMs: number) => {
    const dt = Math.min(Math.max(deltaMs, 1) / 1000, 0.05)
    const p = stageScene.p
    fT = clamp01((sy - max) / len)
    if ((p > 0.72 || fT > 0) && !loading) load()
    f += (fT - f) * (1 - Math.exp(-dt * 9))
    if (Math.abs(fT - f) < 1e-5) f = fT

    // the Figma panels wobble and slide off
    const e = smooth(0.0, 0.055, f)
    chrome.forEach((c) => {
      if (!c.el) return
      const wob = Math.sin(e * Math.PI * 3) * (1 - e) * 7 * Math.min(1, e * 6)
      const key = e <= 0 ? '' : `translate(${(c.x * e).toFixed(1)}%, ${(c.y * e).toFixed(1)}%) rotate(${(c.r * e + wob).toFixed(2)}deg)`
      if (key === c.key) return
      c.key = key
      c.el.style.transform = key
      // the top nav bar simply goes: lifted, faded, then gone for the trip
      if (c.fade) {
        c.el.style.opacity = e <= 0 ? '' : (1 - smooth(0, 0.5, e)).toFixed(3)
        c.el.style.visibility = e >= 0.5 ? 'hidden' : ''
      }
    })

    const wantOn = ready && f > 0.0006
    if (wantOn !== on) {
      on = wantOn
      root.classList.toggle('is-on', on)
      if (!on) {
        trip?.clear()
        holeFresh = false
      }
    }
    const inNow = on && f > OPEN
    if (inNow !== inside) {
      inside = inNow
      root.classList.toggle('is-in', inside)
    }
    // once the portal covers everything, the page underneath can rest
    const hs = on && f > OPEN + 0.01
    if (hs !== hideStage) {
      hideStage = hs
      stage.classList.toggle('is-tripping', hs)
    }

    if (on && trip) {
      if (!holeFresh && f < OPEN) findHole()
      trip.render({ f, t: time, dt, hole })
    }

    // captions
    caps.forEach((c) => {
      const v = on ? smooth(c.a, c.a + 0.03, f) * (1 - smooth(c.b - 0.035, c.b, f)) : 0
      const key = v <= 0.001 ? 'off' : v.toFixed(2)
      if (key === c.key) return
      const was = c.key
      c.key = key
      if (key === 'off') c.el.classList.remove('is-v')
      else {
        if (was === 'off' || was === '') c.el.classList.add('is-v')
        c.el.style.setProperty('--v', key)
      }
    })
    const pk = inside && f > 0.12 && f < 0.3
    if (pk !== pokeOn) {
      pokeOn = pk
      poke?.classList.toggle('is-v', pk)
    }
    if (end) {
      const v = on || failed ? smooth(0.87, 0.94, f) : 0
      const key = v <= 0.001 ? 'off' : v.toFixed(2)
      if (key !== endKey) {
        const was = endKey
        endKey = key
        if (key === 'off') end.classList.remove('is-v', 'is-live')
        else {
          if (was === 'off' || was === '') end.classList.add('is-v')
          end.classList.toggle('is-live', v > 0.6)
          end.style.setProperty('--v', key)
        }
      }
    }
  }
  gsap.ticker.add(tick)

  return () => {
    dead = true
    gsap.ticker.remove(tick)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('scroll', onScroll)
    canvas.removeEventListener('pointerdown', onClick)
    root.removeEventListener('click', onAct)
    window.removeEventListener('resize', onResize)
    window.clearTimeout(rz)
    chrome.forEach((c) => {
      if (!c.el) return
      c.el.style.transform = ''
      c.el.style.opacity = ''
      c.el.style.visibility = ''
    })
    stage.classList.remove('is-tripping')
    trip?.dispose()
    trip = null
  }
}
