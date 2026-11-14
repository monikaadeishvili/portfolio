import { useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '../scene/gsap'
import { Eyes } from '../scene/Eyes'
import { hover, pointer, scene, storyMax, tool, ui, type Breakpoint } from '../scene/store'
import { Cursors, cursorConfig, type BotKey, type Region as CurRegion, type Story } from '../canvas/Cursors'
import { PenTrail } from '../canvas/PenTrail'
import { ColorPicker } from '../canvas/ColorPicker'
import { jumpTo } from '../chrome/ChapterRuler'
import { MomoGlyph } from '../ui/components'
import { Sections } from './sections'
import { measure, viewFor, type Geo, type Rect } from './camera'
import { Bubble } from './bubble/organism2'
import { pieces, texts } from './runtime'
import { live, nudge, startLoop } from './loop'
import { chapterCh, rulerSubs } from './bstore'
import { Fun, FUN_VH } from './sections/fun/Fun'
import { holdOf, LAST, topOf, SCROLL_VH, WORLDS, sectionAt, secP, secU, transitionAt } from './worlds'
import { installOverlapCheck } from './dev/overlap'
import { taste } from './sections/hello/taste'

/* -------------------------------------------------------- cursor story */

const LINES: { sec: number; key: BotKey; u0: number; u1: number; line: string }[] = [
  { sec: 0, key: 'pm', u0: 0.004, u1: 0.1, line: 'looks… fine?' },
  { sec: 0, key: 'dev', u0: 0.06, u1: 0.17, line: 'is that switch… alive?' },
  { sec: 0, key: 'pm', u0: 0.22, u1: 0.38, line: 'oh. OH.' },
  { sec: 0, key: 'monika', u0: 0.47, u1: 0.535, line: 'hey, that’s me!' },
  { sec: 0, key: 'dev', u0: 0.535, u1: 0.6, line: 'hover her. trust me 👀' },
  { sec: 0, key: 'pm', u0: 0.89, u1: 1.01, line: 'golden hour, nice' },
  { sec: 1, key: 'dev', u0: 0.08, u1: 0.26, line: 'lights off' },
  { sec: 1, key: 'monika', u0: 0.5, u1: 0.7, line: 'my whole route' },
  { sec: 1, key: 'pm', u0: 0.74, u1: 0.95, line: '3,900 km ✈︎' },
  { sec: 2, key: 'dev', u0: 0.36, u1: 0.62, line: 'wait, real 3-D?' },
  { sec: 2, key: 'monika', u0: 0.66, u1: 0.86, line: 'flip them all on' },
  { sec: 3, key: 'pm', u0: 0.2, u1: 0.42, line: 'love a Gantt' },
  { sec: 3, key: 'dev', u0: 0.66, u1: 0.92, line: 'ship the dashboard' },
  { sec: 4, key: 'pm', u0: 0.2, u1: 0.44, line: 'she replied!' },
  { sec: 4, key: 'monika', u0: 0.86, u1: 1.01, line: 'say hi! 👋' },
  { sec: 4, key: 'dev', u0: 0.9, u1: 1.01, line: 'ship it' },
]

function storyFor(getGeo: () => Geo | null) {
  return (key: BotKey, p: number): Story => {
    const g = getGeo()
    if (!g || transitionAt(p) >= 0) {
      if (key === 'pm' && transitionAt(p) >= 0 && live.bubScreen.r > 4) {
        const tr = transitionAt(p)
        const lines = ['bye, sunshine', 'boing!', 'there are three now??', 'pop!']
        return { id: `tr-${tr}`, at: (r) => [r.left + r.width * 1.1, r.top - 10], line: lines[tr], rect: () => new DOMRect(live.bubScreen.x - live.bubScreen.r, live.bubScreen.y - live.bubScreen.r, live.bubScreen.r * 2, live.bubScreen.r * 2) }
      }
      return null
    }
    const i = sectionAt(p)
    const u = secU(i, p)
    // idle in Hello's hold with the Taste switch untouched: a dare
    if (i === 0 && key === 'dev' && taste.nag) {
      return {
        id: '0-dev-dare',
        at: (r) => [r.left + r.width * 0.3, r.top + r.height * 0.4],
        line: 'turn it off, I dare you',
        rect: () => {
          const r = freeSpots(g.view)[key]
          return new DOMRect(r.x0, r.y0, Math.max(1, r.x1 - r.x0), Math.max(1, r.y1 - r.y0))
        },
      }
    }
    const hit = LINES.find((l) => l.sec === i && l.key === key && u >= l.u0 && u < l.u1)
    if (!hit) return null
    return {
      id: `${i}-${key}-${hit.line}`,
      at: (r) => [r.left + r.width * 0.3, r.top + r.height * 0.4],
      line: hit.line,
      rect: () => {
        const r = freeSpots(g.view)[key]
        return new DOMRect(r.x0, r.y0, Math.max(1, r.x1 - r.x0), Math.max(1, r.y1 - r.y0))
      },
    }
  }
}

/** resting spots in the free canvas beside the chrome (never over content) */
function freeSpots(v: Rect): Record<BotKey, CurRegion> {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const lay = document.querySelector('.layers')?.getBoundingClientRect()
  const insp = document.querySelector('.inspector')?.getBoundingClientRect()
  const dockTop = document.querySelector('.dock')?.getBoundingClientRect().top ?? vh - 80
  const bottom = dockTop - 70
  const top: CurRegion = { x0: v.x + v.w * 0.3, y0: v.y - 34, x1: v.x + v.w * 0.55, y1: v.y - 24 }
  const right: CurRegion | null = insp && bottom - insp.bottom > 90 ? { x0: insp.left + 6, y0: insp.bottom + 22, x1: vw - 170, y1: Math.min(bottom, insp.bottom + 120) } : null
  const left: CurRegion | null = lay && bottom - lay.bottom > 100 && v.x > 200 ? { x0: 22, y0: lay.bottom + 22, x1: v.x - 170, y1: bottom } : null
  if (left && right) {
    const mid = (left.y0 + left.y1) / 2
    return { monika: { ...left, y1: mid }, dev: { ...left, y0: Math.min(mid + 30, left.y1) }, pm: right }
  }
  if (right) {
    const h = (right.y1 - right.y0) / 3
    return { monika: { ...right, y1: right.y0 + h }, dev: { ...right, y0: right.y0 + h, y1: right.y0 + 2 * h }, pm: { ...right, y0: right.y0 + 2 * h } }
  }
  return { monika: top, dev: { ...top, x0: v.x + v.w * 0.05, x1: v.x + v.w * 0.25 }, pm: { ...top, x0: v.x + v.w * 0.6, x1: v.x + v.w * 0.8 } }
}

/* --------------------------------------------------------------- stage */

export function Stage2({ bp, reduced }: { bp: Breakpoint; reduced: boolean }) {
  const rootRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const { view, lay, fw } = viewFor(bp)

  const onJump = useCallback((i: number) => jumpTo(topOf(i), 1.8), [])
  const onNav = useCallback((to: 'work' | 'about' | 'contact') => jumpTo(to === 'contact' ? holdOf(LAST) : topOf(to === 'work' ? 2 : 1), 1.8), [])

  useEffect(() => {
    const root = rootRef.current!
    const world = worldRef.current!
    const boards = Array.from(world.querySelectorAll<HTMLElement>('.bf'))
    let geo: Geo | null = null
    let st: ScrollTrigger | null = null
    let lenis: Lenis | null = null
    let bubble: Bubble | null = null
    let intro: gsap.core.Timeline | null = null
    let lenisTick: ((t: number) => void) | null = null
    const proxy = { p: 0 }
    let tween: gsap.core.Tween | null = null
    scene.introDone = false

    const doMeasure = () => {
      geo = measure(world, boards, bp)
      const g = geo
      scene.frame = { x: g.view.x, y: g.view.y, w: g.view.w, h: g.view.h, bh: g.view.h }
      const subs: number[] = []
      g.wins.forEach((w) => w.forEach(([a], r) => r > 0 && subs.push(a)))
      rulerSubs.set(subs)
      return g
    }

    const build = () => {
      if (reduced) return
      const prev = proxy.p
      st?.kill()
      tween?.kill()
      doMeasure()
      tween = gsap.fromTo(proxy, { p: 0 }, { p: 1, ease: 'none', paused: true, immediateRender: false })
      st = ScrollTrigger.create({ trigger: spacerRef.current, start: 'top top', end: 'bottom bottom', scrub: 0.8, animation: tween })
      tween.progress(st.progress || prev)
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
        bubble = new Bubble(canvasRef.current)
        if (!bubble.ok) bubble = null
      }
      build()
    }
    ui.scrollTo = (y, duration, steady) => {
      // steady: constant speed with a short ease in and out (the dock's Play)
      const ease = steady ? (k: number) => (k < 0.04 ? (k * k) / 0.08 : k > 0.96 ? 1 - ((1 - k) * (1 - k)) / 0.08 : k) : (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
      if (lenis) lenis.scrollTo(y, duration > 0 ? { duration, easing: ease } : { immediate: true })
      else window.scrollTo({ top: y, behavior: duration > 0 ? 'smooth' : 'auto' })
    }

    // cursor behaviour for this page
    const prevCfg = { ...cursorConfig }
    cursorConfig.story = storyFor(() => geo)
    cursorConfig.idleWindow = () => false
    cursorConfig.lines = { monika: ['hmm, more air?', 'love that'], pm: ['ooh', 'love this'], dev: ['is that a div?', 'nudge 2px left'] }
    cursorConfig.regions = (key) => (geo ? [freeSpots(geo.view)[key]] : [])

    const stopLoop = reduced
      ? () => {}
      : startLoop({
          stage: root,
          world,
          paper: world.querySelector<HTMLElement>('.bpaper')!,
          boards,
          worldBg: Array.from(root.querySelectorAll<HTMLElement>('.wbg')),
          paperBg: Array.from(world.querySelectorAll<HTMLElement>('.wdot')),
          speed: root.querySelector<HTMLElement>('.bspeed'),
          eyes: Array.from(root.querySelectorAll<HTMLElement>('.bub-eyes')),
          mascot: world.querySelector<HTMLElement>('.b-mascot'),
          confetti: world.querySelector<HTMLElement>('.confetti'),
          bubble,
          getProgress: () => proxy.p,
          getGeo: () => geo,
        })
    const unCheck = import.meta.env.DEV && !reduced ? installOverlapCheck(() => geo) : () => {}

    /* ---------- intro (skippable by scrolling) */
    live.intro = 1
    if (!reduced && window.scrollY < 10) {
      live.intro = 0
      const o = { v: 0 }
      intro = gsap.timeline({ defaults: { ease: 'expo.out' }, onComplete: () => void (scene.introDone = true) })
      const chrome = ['.topbar', '.layers', '.inspector', '.dock']
      chrome.forEach((s, k) => {
        const el = document.querySelector(s)
        if (!el) return
        const from = s === '.topbar' ? { y: -26 } : s === '.layers' ? { x: -30 } : s === '.inspector' ? { x: 30 } : { y: 30 }
        intro!.from(el, { ...from, opacity: 0, duration: 0.8, clearProps: 'transform,opacity' }, k * 0.06)
      })
      intro.to(o, { v: 1, duration: 1.8, ease: 'expo.inOut', onUpdate: () => void (live.intro = o.v) }, 0)
      const words = texts.get('h-title')?.words
      if (words) intro.fromTo(words, { yPercent: 118, rotation: 7 }, { yPercent: 0, rotation: 0, duration: 1, stagger: 0.08, ease: 'back.out(1.5)', clearProps: 'transform' }, 0.7)
    } else {
      scene.introDone = true
    }
    const skip = () => {
      if (intro && intro.progress() < 1 && window.scrollY > 4) intro.progress(1)
    }
    window.addEventListener('scroll', skip, { passive: true })

    /* ---------- reduced motion: finished sections fade in */
    let io: IntersectionObserver | null = null
    if (reduced) {
      io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.06 })
      boards.forEach((f) => io!.observe(f))
    }

    /* ---------- keyboard focus inside another section jumps there */
    const onFocus = (e: FocusEvent) => {
      if (reduced || !lenis) return
      if (!(e.target instanceof Element)) return
      const sec = e.target.closest<HTMLElement>('.bf')
      if (!sec) return
      const i = Number(sec.dataset.frame)
      const max = storyMax()
      // a region with its own hold ("u,min,max"): stay if it is in view, else go there
      const hold = e.target.closest<HTMLElement>('[data-hold]')?.dataset.hold
      if (hold) {
        const [hu, lo, hi] = hold.split(',').map(Number)
        const u = secU(i, scene.p)
        if (i !== chapterCh.get() || u < lo || u > hi) lenis.scrollTo(secP(i, hu) * max, { immediate: true })
        return
      }
      if (i !== chapterCh.get() || secU(i, scene.p) < 0.86) {
        lenis.scrollTo(holdOf(i) * max, { immediate: true })
      }
    }
    root.addEventListener('focusin', onFocus)

    /* ---------- resize */
    let rz = 0
    const onResize = () => {
      window.clearTimeout(rz)
      rz = window.setTimeout(() => {
        bubble?.resize()
        build()
        ScrollTrigger.refresh()
      }, 160)
    }
    window.addEventListener('resize', onResize)
    let alive = true
    document.fonts?.ready.then(() => {
      if (!alive || reduced) return
      build()
    })

    return () => {
      alive = false
      ui.scrollTo = null
      Object.assign(cursorConfig, prevCfg)
      stopLoop()
      unCheck()
      intro?.progress(1).kill()
      st?.kill()
      tween?.kill()
      io?.disconnect()
      if (lenisTick) gsap.ticker.remove(lenisTick)
      lenis?.destroy()
      lenisRef.current = null
      bubble?.dispose()
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
      const target = e.target
      pointer.inCanvas = target instanceof Node && root.contains(target) && e.pointerType === 'mouse'
      if (handY >= 0 && lenisRef.current) {
        const dy = e.clientY - handY
        handY = e.clientY
        lenisRef.current.scrollTo(window.scrollY - dy * 2.6, { immediate: true })
      }
    }
    const onOver = (e: PointerEvent) => {
      const s = slotOf(e.target)
      const id = s?.dataset.cid ?? null
      if (id && hover.get() !== id && pieces.has(id)) {
        hover.set(id)
        const c = pieces.get(id)
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
      const c = s ? pieces.get(s.dataset.cid!) : null
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
    '--FW': `${fw}px`,
    '--GAP': `${Math.round(fw * (lay === 'narrow' ? 0.9 : 0.85))}px`,
    '--cx': `${view.x + view.w / 2}px`,
    '--cy': `${view.y + view.h / 2}px`,
  } as CSSProperties

  const worlds = WORLDS.map((w) => w.id)
  return (
    <>
      <main ref={rootRef} className={`bstage${reduced ? ' is-static' : ''}`} data-bp={bp} data-lay={lay} data-world="0" style={style} data-deck-layer="" aria-label="Canvas — four sections and an after-hours trip">
        {!reduced && (
          <div className="bworld-bg" aria-hidden="true">
            {worlds.map((w, i) => (
              <div key={w} className={`wbg wbg-${w}`} style={{ opacity: i === 0 ? 1 : 0 }}>
              </div>
            ))}
            {/* 01 Hello before taste: the neutral default canvas, far field */}
            <div className="wbg wbg-plain" />
            <div className="bspeed" />
          </div>
        )}
        <div className="bviewport">
          <div className="bworld" ref={worldRef}>
            {!reduced && (
              <div className="bpaper" aria-hidden="true">
                {worlds.map((w, i) => (
                  <i key={w} className={`wdot wdot-${w}`} style={{ opacity: i === 0 ? 1 : 0 }} />
                ))}
              </div>
            )}
            <Sections lay={lay} live={!reduced} onNav={onNav} onJump={onJump} />
            {!reduced && (
              <div className="b-mascot" aria-hidden="true">
                <MomoGlyph size={80} />
              </div>
            )}
            {!reduced && (
              <div className="confetti" aria-hidden="true">
                {Array.from({ length: 22 }, (_, k) => (
                  <i key={k} className={`cf cf-${k % 6}`} />
                ))}
              </div>
            )}
          </div>
        </div>
        {!reduced && <canvas className="bub-canvas" ref={canvasRef} aria-hidden="true" />}
        {!reduced &&
          [0, 1, 2].map((k) => (
            <div key={k} className="bub-eyes" aria-hidden="true">
              <div className="bub-face">
                <Eyes x={50} y={40} size={44} gap={0.36} />
                <span className="bub-dizzy">
                  <i />
                  <i />
                </span>
              </div>
            </div>
          ))}
        {!reduced && (
          <p className="h-addtaste" aria-hidden="true">
            scroll to add taste <span>↓</span>
          </p>
        )}
        {!reduced && <Fun narrow={lay === 'narrow'} />}
        {!reduced && <PenTrail />}
        {!reduced && <ColorPicker />}
        {!reduced && <Cursors />}
      </main>
      {!reduced && <div className="scroll-spacer" ref={spacerRef} aria-hidden="true" style={{ '--len': `${SCROLL_VH}vh` } as CSSProperties} />}
      {!reduced && <div className="fun-spacer" aria-hidden="true" style={{ '--len': `${FUN_VH}vh` } as CSSProperties} />}
    </>
  )
}

