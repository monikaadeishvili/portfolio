import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '../scene/gsap'
import { Eyes } from '../scene/Eyes'
import { Organism } from '../scene/organism'
import { offsetIn } from '../scene/layout'
import { hover, pointer, scene, tool, ui, type Breakpoint } from '../scene/store'
import { Cursors, cursorConfig, type BotKey, type Region, type Story } from '../canvas/Cursors'
import type { Rect } from './timeline'
import { jumpTo } from '../chrome/ChapterRuler'
import { Frames } from './frames'
import { frameDims, viewFor } from './layout2'
import { comps, registerComp } from './runtime'
import { bub, buildTimeline, cam, chapterAt, holdOf, isoPose, placeWaiting, R0, segAt, SEG, type Geo } from './timeline'
import { live, nudge, startLoop } from './loop'
import { chapterCh } from './bstore'

/* -------------------------------------------------------- cursor story */

function storyFor(getGeo: () => Geo | null) {
  return (key: BotKey, p: number): Story => {
    const i = chapterAt(p)
    const u = (p - SEG[i]) / (SEG[i + 1] - SEG[i])
    const g = getGeo()
    if (!g) return null
    const tr = (fx: number, fy: number) => (r: DOMRect) => [r.left + r.width * fx, r.top + r.height * fy] as [number, number]
    const travelRect = () => {
      const id = live.travelling
      const c = id ? comps.get(id) : null
      return c ? c.alive.getBoundingClientRect() : null
    }
    const bubRect = () => {
      const b = live.bubScreen
      return b.r > 2 ? new DOMRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2) : null
    }
    const spot = (k: BotKey) => () => {
      const r = freeSpots(g.view)[k]
      return new DOMRect(r.x0, r.y0, Math.max(1, r.x1 - r.x0), Math.max(1, r.y1 - r.y0))
    }
    if (key === 'monika' && u > 0.2 && u < 0.47 && live.travelling) return { id: `travel-${i}`, at: tr(1.02, -0.1), line: i % 2 ? 'that goes there' : 'ooh, nice', rect: travelRect }
    if (key === 'pm' && u > 0.82 && u < 0.9) return { id: `bubble-${i}`, at: tr(1.05, 0.1), line: 'ooh', rect: bubRect }
    if (key === 'pm' && i === 0 && u > 0.04 && u < 0.18) return { id: `bubble-0`, at: tr(1.08, 0.3), line: 'is that… alive?', rect: bubRect }
    if (key === 'dev' && u > 0.62 && u < 0.8 && i !== 4) return { id: `resolve-${i}`, at: tr(0.3, 0.4), line: i === 2 ? 'that toggle is so me' : 'nudge 2px left', rect: spot('dev') }
    if (key === 'dev' && i === 4 && u > 0.66) return { id: 'ship', at: tr(0.3, 0.4), line: 'ship it', rect: spot('dev') }
    if (key === 'monika' && i === 4 && u > 0.7) return { id: 'hi', at: tr(0.3, 0.4), line: 'say hi! 👋', rect: spot('monika') }
    return null
  }
}

/** purposeful resting spots in the free canvas around the frame (no content) */
function freeSpots(v: Rect): Record<BotKey, Region> {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const lay = document.querySelector('.layers')?.getBoundingClientRect()
  const insp = document.querySelector('.inspector')?.getBoundingClientRect()
  const dockTop = document.querySelector('.dock')?.getBoundingClientRect().top ?? vh - 80
  const bottom = dockTop - 56
  const top: Region = { x0: v.x + v.w * 0.3, y0: v.y - 36, x1: v.x + v.w * 0.6, y1: v.y - 22 }
  const right: Region | null = insp && bottom - insp.bottom > 90 ? { x0: insp.left + 6, y0: insp.bottom + 22, x1: vw - 170, y1: Math.min(bottom, insp.bottom + 110) } : null
  const left: Region | null = lay && bottom - lay.bottom > 100 && v.x > 200 ? { x0: 22, y0: lay.bottom + 22, x1: v.x - 170, y1: bottom } : null
  if (left && right) {
    const mid = (left.y0 + left.y1) / 2
    return { monika: { ...left, y1: mid }, dev: { ...left, y0: Math.min(mid + 30, left.y1) }, pm: right }
  }
  if (right) {
    const mid = (right.y0 + right.y1) / 2
    return { monika: { ...right, y1: mid }, dev: { ...right, y0: mid }, pm: top }
  }
  return { monika: top, dev: { ...top, x0: v.x + v.w * 0.1, x1: v.x + v.w * 0.3 }, pm: { ...top, x0: v.x + v.w * 0.65, x1: v.x + v.w * 0.85 } }
}

/* --------------------------------------------------------------- stage */

export function Stage2({ bp, reduced }: { bp: Breakpoint; reduced: boolean }) {
  const rootRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const eyesRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const { view, lay } = viewFor(bp)
  const dims = frameDims(lay, view)

  const onJump = useCallback((i: number) => jumpTo(holdOf(i), 1.8), [])
  const onNav = useCallback((to: 'work' | 'about' | 'contact') => jumpTo(holdOf(to === 'work' ? 3 : to === 'about' ? 1 : 4), 1.8), [])

  useEffect(() => {
    const root = rootRef.current!
    const world = worldRef.current!
    const frames = Array.from(world.querySelectorAll<HTMLElement>('.bf'))
    const sheets = frames.map((f) => Array.from(f.querySelectorAll<HTMLElement>('.bf-sheet')))
    const mascot = world.querySelector<HTMLElement>('.f5-mascot')
    let geo: Geo | null = null
    let tl: gsap.core.Timeline | null = null
    let st: ScrollTrigger | null = null
    let lenis: Lenis | null = null
    let organism: Organism | null = null
    let intro: gsap.core.Timeline | null = null
    let lenisTick: ((t: number) => void) | null = null
    scene.introDone = false

    const measure = (): Geo => {
      const { view: v, lay: l } = viewFor(bp)
      const d = frameDims(l, v)
      root.style.setProperty('--FW', `${d.fw}px`)
      root.style.setProperty('--FH', `${d.fh}px`)
      root.style.setProperty('--GAP', `${Math.round(d.fw * (l === 'narrow' ? 0.6 : 1))}px`)
      root.style.setProperty('--cx', `${v.x + v.w / 2}px`)
      root.style.setProperty('--cy', `${v.y + v.h / 2}px`)
      scene.frame = { x: v.x, y: v.y, w: v.w, h: v.h, bh: v.h }
      const narrow = l === 'narrow'
      const fr = frames.map((f) => ({ x: f.offsetLeft, y: f.offsetTop, w: f.offsetWidth, h: f.offsetHeight }))
      frames.forEach((f, i) => {
        const b = f.querySelector('.bf-size')
        if (b) b.textContent = `${fr[i].w} × ${fr[i].h}`
      })
      const fits = fr.map((f) => Math.min(1.3, (v.w * 0.95) / f.w, (v.h * 0.95) / f.h))
      // the bubble parks in free canvas: under the inspector column, above the dock
      const vw = document.documentElement.clientWidth
      const psx = narrow ? v.x + v.w - 44 : bp === 'desk' || bp === 'tab' ? vw - 12 - 124 : v.x + v.w - 60
      const psy = narrow ? v.y + v.h - 28 : v.y + v.h - 96
      const parks = fr.map((f, i) => ({ x: f.x + f.w / 2 + (psx - (v.x + v.w / 2)) / fits[i], y: f.y + f.h / 2 + (psy - (v.y + v.h / 2)) / fits[i], z: R0 * 0.75 }))
      let m = { x: 0, y: 0, z: 0 }
      let mR = 26
      if (mascot) {
        const o = offsetIn(mascot, world)
        m = { x: o.x + o.w / 2, y: o.y + o.h * 0.55, z: 16 }
        mR = Math.max(16, o.w * 0.48)
      }
      comps.forEach((c) => {
        const o = offsetIn(c.slot, world)
        c.sx = o.x
        c.sy = o.y
        c.w = o.w
        c.h = o.h
        if (c.sizeEl) c.sizeEl.textContent = `${Math.round(o.w)} × ${Math.round(o.h)}`
      })
      const g: Geo = {
        lay: l,
        view: v,
        frames: fr,
        fits,
        parks,
        mascot: m,
        mascotR: mR,
        tilt: narrow ? { rx: 36, rz: -10, iso: 0.7 } : { rx: 50, rz: -18, iso: 0.96 },
      }
      placeWaiting(g)
      return g
    }

    const build = () => {
      if (reduced) return
      const prev = tl ? tl.progress() : 0
      st?.kill()
      tl?.progress(0).kill()
      geo = measure()
      tl = buildTimeline(geo, { frames, mascot })
      st = ScrollTrigger.create({ trigger: spacerRef.current, start: 'top top', end: 'bottom bottom', scrub: 0.85, animation: tl })
      tl.progress(st.progress || prev)
    }

    root.classList.add('no-anim')
    const unAnim = window.setTimeout(() => root.classList.remove('no-anim'), 400)

    if (!reduced) {
      lenis = new Lenis({ autoRaf: false, lerp: 0.1, wheelMultiplier: 0.85 })
      lenisRef.current = lenis
      lenis.on('scroll', ScrollTrigger.update)
      lenisTick = (t: number) => lenis?.raf(t * 1000)
      gsap.ticker.add(lenisTick)
      gsap.ticker.lagSmoothing(0)
      if (canvasRef.current) {
        organism = new Organism(canvasRef.current)
        if (!organism.ok) organism = null
      }
      build()
    } else {
      geo = measure()
    }
    ui.scrollTo = (y, duration) => {
      if (lenis) lenis.scrollTo(y, duration > 0 ? { duration, easing: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) } : { immediate: true })
      else window.scrollTo({ top: y, behavior: duration > 0 ? 'smooth' : 'auto' })
    }

    // cursor behaviour for this page
    const prevCfg = { ...cursorConfig }
    cursorConfig.story = storyFor(() => geo)
    cursorConfig.idleWindow = () => false
    cursorConfig.lines = { monika: ['hmm, more air?', 'love that', 'ooh'], pm: ['ooh', 'love this', 'ship it'], dev: ["wait, it's alive?", 'is that a div?', 'ship it'] }
    cursorConfig.regions = (key) => (geo ? [freeSpots(geo.view)[key]] : [])

    const stopLoop = reduced
      ? () => {}
      : startLoop({
      world,
      paper: world.querySelector<HTMLElement>('.bpaper')!,
      anchor: anchorRef.current!,
      bubEyes: eyesRef.current!,
      organism,
      getTimeline: () => tl,
      getGeo: () => geo,
      sheetsOf: (i) => sheets[i] ?? [],
    })

    /* ---------- intro (skippable by scrolling) */
    if (!reduced && window.scrollY < 10 && geo) {
      const g = geo
      const iso = isoPose(g, 0)
      Object.assign(cam, { ...iso, s: iso.s * 0.78, rx: iso.rx - 16, rz: iso.rz + 12 })
      const near = [...comps.values()].filter((c) => c.chapter <= 1 && !c.src).sort((a, b) => a.order - b.order)
      near.forEach((c) => (c.t.in = 0))
      bub.intro = 0
      intro = gsap.timeline({
        defaults: { ease: 'expo.out' },
        onComplete: () => {
          scene.introDone = true
        },
      })
      const chrome = ['.topbar', '.layers', '.inspector', '.dock']
      chrome.forEach((s, k) => {
        const el = document.querySelector(s)
        if (!el) return
        const from = s === '.topbar' ? { y: -26 } : s === '.layers' ? { x: -30 } : s === '.inspector' ? { x: 30 } : { y: 30 }
        intro!.from(el, { ...from, opacity: 0, duration: 0.8 }, k * 0.06)
      })
      intro.to(cam, { ...iso, duration: 1.6, ease: 'expo.inOut' }, 0)
      intro.from(sheets[0], { z: 0, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out' }, 0.25)
      near.forEach((c, k) => intro!.to(c.t, { in: 1, duration: 1.1, ease: 'elastic.out(1, 0.55)' }, 0.35 + k * 0.045))
      const words = comps.get('f1-head')?.slot.querySelectorAll('.w-in')
      if (words) intro.from(words, { yPercent: 118, rotation: 7, duration: 1, stagger: 0.08, ease: 'back.out(1.5)' }, 0.7)
      intro.to(bub, { intro: 1, duration: 0.9, ease: 'back.out(2.2)' }, 1.0)
    } else {
      scene.introDone = true
    }
    const skip = () => {
      if (intro && intro.progress() < 1 && window.scrollY > 4) intro.progress(1)
    }
    window.addEventListener('scroll', skip, { passive: true })

    /* ---------- reduced motion: static frames fade in */
    let io: IntersectionObserver | null = null
    if (reduced) {
      io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.12 })
      frames.forEach((f) => io!.observe(f))
    }

    /* ---------- keyboard focus inside another chapter jumps there */
    const onFocus = (e: FocusEvent) => {
      if (reduced || !lenis) return
      const sec = (e.target as HTMLElement).closest<HTMLElement>('.bf')
      if (!sec) return
      const i = Number(sec.dataset.frame)
      if (i !== chapterCh.get() || scene.p < segAt(i, 0.6)) {
        const max = document.documentElement.scrollHeight - window.innerHeight
        lenis.scrollTo(holdOf(i) * max, { immediate: true })
      }
    }
    root.addEventListener('focusin', onFocus)

    /* ---------- resize */
    let rz = 0
    const onResize = () => {
      window.clearTimeout(rz)
      rz = window.setTimeout(() => {
        organism?.resize()
        if (reduced) geo = measure()
        else build()
        ScrollTrigger.refresh()
      }, 160)
    }
    window.addEventListener('resize', onResize)
    let alive = true
    document.fonts?.ready.then(() => {
      if (!alive) return
      if (reduced) geo = measure()
      else if (!intro || intro.progress() === 1) build()
      else intro.then(() => alive && build())
    })

    return () => {
      alive = false
      ui.scrollTo = null
      Object.assign(cursorConfig, prevCfg)
      stopLoop()
      intro?.progress(1).kill()
      st?.kill()
      tl?.progress(0).kill()
      io?.disconnect()
      if (lenisTick) gsap.ticker.remove(lenisTick)
      lenis?.destroy()
      lenisRef.current = null
      organism?.dispose()
      window.removeEventListener('scroll', skip)
      window.removeEventListener('resize', onResize)
      root.removeEventListener('focusin', onFocus)
      window.clearTimeout(rz)
      window.clearTimeout(unAnim)
      scene.introDone = false
    }
  }, [bp, reduced])

  /* ------------------------------------------- pointer, hover, tools */
  useEffect(() => {
    const root = rootRef.current!
    let handY = -1
    const slotOf = (el: EventTarget | null) => (el instanceof Element ? el.closest<HTMLElement>('.slot[data-cid]') : null)
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      const target = e.target as Element | null
      pointer.inCanvas = !!target && root.contains(target) && e.pointerType === 'mouse'
      if (handY >= 0 && lenisRef.current) {
        const dy = e.clientY - handY
        handY = e.clientY
        lenisRef.current.scrollTo(window.scrollY - dy * 2.6, { immediate: true })
      }
    }
    const onOver = (e: PointerEvent) => {
      const s = slotOf(e.target)
      const id = s?.dataset.cid ?? null
      if (id && hover.get() !== id) {
        hover.set(id)
        const c = comps.get(id)
        if (c) nudge(c, 'hover')
      }
    }
    const onOut = (e: PointerEvent) => {
      const from = slotOf(e.target)
      const to = slotOf(e.relatedTarget)
      if (from && from !== to && hover.get() === from.dataset.cid) hover.set(null)
    }
    const pokeTimers = new Set<number>()
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (tool.get() === 'hand') {
        handY = e.clientY
        root.classList.add('is-panning')
        return
      }
      // a live deck owns its press: it reports a tap (no drag) via `decktap`
      if (e.target instanceof Element && e.target.closest('.u-pdeck.is-press')) return
      poke(slotOf(e.target))
    }
    const poke = (s: HTMLElement | null) => {
      const c = s ? comps.get(s.dataset.cid!) : null
      if (!s || !c) return
      if (c.pose.state === 'placed') {
        s.classList.remove('is-poke')
        void s.offsetWidth
        s.classList.add('is-poke')
        const id = window.setTimeout(() => {
          s.classList.remove('is-poke')
          pokeTimers.delete(id)
        }, 1000)
        pokeTimers.add(id)
      } else nudge(c, 'poke')
    }
    const onDeckTap = (e: Event) => poke(slotOf(e.target))
    const onUp = () => {
      handY = -1
      root.classList.remove('is-panning')
    }
    const onLeave = () => (pointer.inCanvas = false)
    window.addEventListener('pointermove', onMove, { passive: true })
    root.addEventListener('pointerover', onOver)
    root.addEventListener('pointerout', onOut)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('decktap', onDeckTap)
    window.addEventListener('pointerup', onUp)
    document.documentElement.addEventListener('pointerleave', onLeave)
    const unTool = tool.sub((v) => root.setAttribute('data-tool', v))
    root.setAttribute('data-tool', tool.get())
    return () => {
      window.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerover', onOver)
      root.removeEventListener('pointerout', onOut)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('decktap', onDeckTap)
      window.removeEventListener('pointerup', onUp)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      pokeTimers.forEach((id) => window.clearTimeout(id))
      unTool()
    }
  }, [])

  // canvas hover outline follows the shared hover channel (layers ↔ canvas)
  useLayoutEffect(() => {
    let prev: Element | null = null
    return hover.sub((id) => {
      prev?.classList.remove('is-hover')
      prev = id ? (rootRef.current?.querySelector(`.slot[data-cid="${id}"]`) ?? null) : null
      prev?.classList.add('is-hover')
    })
  }, [])

  const style = {
    '--FW': `${dims.fw}px`,
    '--FH': `${dims.fh}px`,
    '--GAP': `${Math.round(dims.fw * (lay === 'narrow' ? 0.6 : 1))}px`,
    '--cx': `${view.x + view.w / 2}px`,
    '--cy': `${view.y + view.h / 2}px`,
  } as CSSProperties

  return (
    <>
      <main ref={rootRef} className={`bstage${reduced ? ' is-static' : ''}`} data-bp={bp} data-lay={lay} style={style} data-deck-layer="" aria-label="Canvas — five chapters">
        <div className="bviewport">
          <div className="bworld" ref={worldRef}>
            <div className="bpaper" aria-hidden="true" />
            <Frames lay={lay} register={reduced ? null : registerComp} onNav={onNav} onJump={onJump} />
            <div className="bub-anchor" ref={anchorRef} aria-hidden="true" />
          </div>
        </div>
        {!reduced && <canvas className="bub-canvas" ref={canvasRef} aria-hidden="true" />}
        {!reduced && (
          <div className="bub-eyes" ref={eyesRef} aria-hidden="true">
            <Eyes x={50} y={40} size={44} gap={0.36} />
          </div>
        )}
        {!reduced && <Cursors />}
      </main>
      {!reduced && <div className="scroll-spacer" ref={spacerRef} aria-hidden="true" style={{ '--len': '1100vh' } as CSSProperties} />}
    </>
  )
}
