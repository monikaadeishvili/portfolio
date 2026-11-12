import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '../scene/gsap'
import { HeroFrame } from './HeroFrame'
import { AboutFrame, PIECES } from './AboutFrame'
import { Cursors } from './Cursors'
import { GhostFrames } from './GhostFrames'
import { Creature, creatures, billboards, C, type CreatureDef, type CreatureKind } from '../scene/creatures'
import { Eyes } from '../scene/Eyes'
import { Organism } from '../scene/organism'
import { buildTimeline, heroClip, leapOrder, type Geometry, type SceneRefs } from '../scene/timeline'
import { playIntro } from '../scene/intro'
import { startLoop, ripple } from '../scene/loop'
import { screenToFrame } from '../scene/homography'
import { applyLayout } from '../scene/layout'
import { hover, mood, phase, pointer, register, scene, showHint, tool, ui, type Breakpoint } from '../scene/store'

interface Spawn {
  def: CreatureDef
  x: number
  y: number
  owner: 'hero' | 'about'
}
interface Pin {
  id: number
  x: number
  y: number
  text: string
  color: string
}

const NOTES = [
  'love the spacing here',
  'can we make it bouncier?',
  'approved — ship it',
  'who let the blobs out?',
  'this made me smile',
  '+1 on the coral',
  'tiny bit more air above?',
  'the toggle has opinions',
]
const PIN_COLORS = [C.coral, C.violet, C.mint, C.sky, C.pink]
const SPAWN_KINDS: CreatureKind[] = ['badge', 'tooltip', 'check', 'card', 'toggle', 'button']
const SPAWN_SIZE: Partial<Record<CreatureKind, [number, number]>> = {
  badge: [150, 36],
  tooltip: [124, 46],
  check: [150, 52],
  card: [128, 104],
  toggle: [88, 48],
  button: [134, 50],
}
const SPAWN_NAME: Partial<Record<CreatureKind, string>> = { badge: 'Badge', tooltip: 'Tooltip', check: 'Checkbox', card: 'Card', toggle: 'Toggle', button: 'Button' }
const SPAWN_COLORS = [C.yellow, C.coral, C.lime, C.sky, C.pink, C.violet, C.mint]

let spawnSeq = 0
let pinSeq = 0

function BillboardPin({ pin }: { pin: Pin }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    gsap.set(el, { transformOrigin: '0% 100%', rotation: -scene.cam.rz, rotationX: -scene.cam.rx })
    billboards.add(el)
    const bubble = el.querySelector('.pin-in')
    gsap.from(bubble, { scale: 0.5, opacity: 0, y: 10, duration: 0.6, ease: 'back.out(2.2)', transformOrigin: '0% 100%' })
    return () => {
      billboards.delete(el)
      gsap.killTweensOf(bubble)
    }
  }, [])
  return (
    <div className="pin" style={{ left: pin.x, top: pin.y }} aria-hidden="true">
      <div className="pin-lift" ref={ref}>
        <div className="pin-in">
          <span className="pin-avatar" style={{ background: pin.color }}>
            Y
          </span>
          <span className="pin-text">{pin.text}</span>
        </div>
      </div>
    </div>
  )
}

export function Stage({ bp, reduced }: { bp: Breakpoint; reduced: boolean }) {
  const rootRef = useRef<HTMLElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const fsRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const proxyRef = useRef<HTMLDivElement>(null)
  const spacerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<HTMLDivElement>(null)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [spawns, setSpawns] = useState<Spawn[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const lenisRef = useRef<Lenis | null>(null)

  /* ------------------------------------------------- the whole scene */
  useEffect(() => {
    const root = rootRef.current!
    const fs = fsRef.current!
    const world = worldRef.current!
    const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T
    const refs: SceneRefs = {
      frameSpace: fs,
      frameBg: q('.frame-bg'),
      labelHero: q('.frame-label-hero'),
      labelAbout: q('.frame-label-about'),
      nameBlock: q('.name-block'),
      nameSel: q('.name-sel'),
      roleRow: q('.role-row'),
      stickyLift: q('.sticky-lift'),
      scribble: q('.scribble'),
      aboutLayer: q('.about-layer'),
      ghostWork: q('.ghost-work'),
      ghostContact: q('.ghost-contact'),
      momoHome: q('.momo-home'),
      park: q('.org-park'),
      sheets: Array.from(root.querySelectorAll<HTMLElement>('.layer-sheet')),
    }
    const pieces = Array.from(root.querySelectorAll<HTMLElement>('.about-layer .piece'))
    const pieceColors = pieces.map((p) => PIECES.find((d) => d.id === p.dataset.piece)?.color ?? '#5B4BFF')
    const rootStyle = document.documentElement.style

    // organism proxy: inspector + cursors can "select" it
    const unOrg = register({ id: 'organism', name: 'Organism', kind: 'organism', color: '#5B4BFF', el: proxyRef.current })

    /* ---------- measure layout → CSS vars → geometry */
    const measure = (): Geometry => {
      const { w: fw, h: fh } = scene.frame
      const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1
      const mob = bp === 'mob'
      const pad = Math.round((mob ? 18 : 30) * Math.max(0.8, u))
      const nb = refs.nameBlock
      const nw = nb.offsetWidth
      const nh = nb.offsetHeight
      const targetH = mob ? 58 : Math.min(88, Math.max(56, fh * 0.1))
      const miniScale = targetH / Math.max(1, nh)
      const aboutTop = pad + nh * miniScale + (mob ? 20 : 26) * u
      const aboutW = bp === 'mob' ? fw : Math.min(fw, Math.max(fw * 0.91, 600))
      rootStyle.setProperty('--pad', `${pad}px`)
      rootStyle.setProperty('--about-top', `${aboutTop}px`)
      rootStyle.setProperty('--about-w', `${aboutW}px`)
      const layerH = refs.aboutLayer.offsetHeight
      const aboutH = Math.round(aboutTop + layerH + pad)
      const bh = reduced ? fh : Math.max(fh, aboutH)
      rootStyle.setProperty('--fbh', `${bh}px`)
      rootStyle.setProperty('--about-h', `${aboutH}px`)
      const fl = refs.labelHero.querySelector('b')
      if (fl) fl.textContent = `${Math.round(fw)} × ${Math.round(fh)}`
      const badge = nb.querySelector('.name-badge')
      if (badge) badge.textContent = `${Math.round(nw)} × ${Math.round(nh)}`
      pieces.forEach((p) => {
        const b = p.querySelector('.piece-badge')
        if (b) b.textContent = `${p.offsetWidth} × ${p.offsetHeight}`
      })
      const anchor = { x: fw * 0.5, y: fh * (mob ? 0.42 : 0.5) }
      if (anchorRef.current) {
        anchorRef.current.style.left = `${anchor.x}px`
        anchorRef.current.style.top = `${anchor.y}px`
      }
      return { fw, fh, bh, aboutW, aboutH, anchor, miniScale, pad }
    }

    let geo = measure()
    let tl: gsap.core.Timeline | null = null
    let st: ScrollTrigger | null = null
    let order = leapOrder(geo, fs)
    let organism: Organism | null = null
    let lenis: Lenis | null = null
    let intro: gsap.core.Timeline | null = null
    let lenisTick: ((t: number) => void) | null = null

    const build = () => {
      if (reduced) return
      const prev = tl ? tl.progress() : 0
      if (tl) {
        st?.kill()
        tl.progress(0).kill()
      }
      geo = measure()
      order = leapOrder(geo, fs)
      gsap.set(refs.frameBg, { clipPath: heroClip(geo) })
      tl = buildTimeline(refs, geo, bp, order)
      st = ScrollTrigger.create({
        trigger: spacerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.8,
        animation: tl,
      })
      tl.progress(st.progress || prev)
    }

    if (!reduced) {
      // smooth scroll wired to ScrollTrigger via the shared gsap ticker
      lenis = new Lenis({ autoRaf: false, lerp: 0.11, wheelMultiplier: 0.9 })
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
    }
    ui.scrollTo = (y, duration) => {
      if (lenis) lenis.scrollTo(y, duration > 0 ? { duration, easing: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) } : { immediate: true })
      else window.scrollTo({ top: y, behavior: duration > 0 ? "smooth" : "auto" })
    }

    const l1 = Array.from(root.querySelectorAll<HTMLElement>('.name .l1 .ch-in'))
    const l2 = Array.from(root.querySelectorAll<HTMLElement>('.name .l2 .ch'))
    const stopLoop = startLoop({
      organism,
      orgProxy: proxyRef.current!,
      orgAnchor: anchorRef.current!,
      momoHome: refs.momoHome,
      park: refs.park,
      frameBg: refs.frameBg,
      world,
      nameBlock: refs.nameBlock,
      l1,
      l2,
      getTimeline: () => tl,
      order: () => order,
      pieces: () => pieces,
      pieceColors: () => pieceColors,
      onMood: (m) => mood.set(m),
    })

    /* ---------- intro (skippable by scrolling) */
    const startedAt = window.scrollY
    if (!reduced && startedAt < 10) {
      intro = playIntro(
        {
          chrome: {
            top: document.querySelector('.topbar'),
            left: document.querySelector('.layers'),
            right: document.querySelector('.inspector'),
            bottom: document.querySelector('.toolbar'),
          },
          frameBg: refs.frameBg,
          labelHero: refs.labelHero,
          introBadge: q('.intro-badge'),
          root,
          stickyWrap: q('.sticky-wrap'),
          scribblePaths: Array.from(root.querySelectorAll<HTMLElement>('.scribble path')),
          roleIn: q('.role-in'),
        },
        geo,
        order,
      )
    } else {
      scene.introDone = true
    }
    const skip = () => {
      if (intro && intro.progress() < 1 && window.scrollY > 4) intro.progress(1)
    }
    window.addEventListener('scroll', skip, { passive: true })

    /* ---------- static (reduced motion) fades */
    let io: IntersectionObserver | null = null
    if (reduced) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
        { threshold: 0.15 },
      )
      root.querySelectorAll('[data-section]').forEach((el) => io!.observe(el))
    }

    /* ---------- phase → data attribute (pointer routing, no re-render) */
    const unPhase = phase.sub((v) => {
      root.setAttribute('data-phase', v)
      hover.set(null)
    })
    root.setAttribute('data-phase', phase.get())

    /* ---------- focus inside the (hidden) About frame jumps to the end */
    const onFocus = (e: FocusEvent) => {
      if (reduced || !lenis) return
      const target = e.target as HTMLElement
      if (target.closest('.about-layer') && scene.p < 0.84) lenis.scrollTo(document.documentElement.scrollHeight, { immediate: true })
      if (target.closest('.hero-layer') && scene.p > 0.3) lenis.scrollTo(0, { immediate: true })
    }
    root.addEventListener('focusin', onFocus)

    /* ---------- resize */
    let rz = 0
    const onResize = () => {
      window.clearTimeout(rz)
      rz = window.setTimeout(() => {
        applyLayout(bp)
        organism?.resize()
        if (reduced) measure()
        else build()
        ScrollTrigger.refresh()
      }, 160)
    }
    window.addEventListener('resize', onResize)
    let fontsAlive = true
    document.fonts?.ready.then(() => {
      if (!fontsAlive) return
      if (reduced) measure()
      else if (!intro || intro.progress() === 1) build()
      else intro.then(() => fontsAlive && build())
    })

    return () => {
      fontsAlive = false
      ui.scrollTo = null
      unOrg()
      unPhase()
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
      scene.introDone = false
    }
  }, [bp, reduced])

  /* ------------------------------------------------- pointer + tools */
  const addSpawn = useCallback((sx: number, sy: number) => {
    const markers = Array.from(markersRef.current?.children ?? []) as HTMLElement[]
    const pt = screenToFrame(markers, scene.frame.w, scene.frame.h, sx, sy)
    if (!pt) return
    const kind = SPAWN_KINDS[Math.floor(Math.random() * SPAWN_KINDS.length)]
    const color = SPAWN_COLORS[Math.floor(Math.random() * SPAWN_COLORS.length)]
    const [w, h] = SPAWN_SIZE[kind] ?? [120, 48]
    const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1
    const id = `s-${++spawnSeq}`
    const def: CreatureDef = {
      id,
      name: `${SPAWN_NAME[kind] ?? kind}/New ${spawnSeq}`,
      kind,
      color,
      x: 0,
      y: 0,
      w,
      h,
      m: { x: 0, y: 0 },
      z: 0,
      rot: Math.round((Math.random() - 0.5) * 10),
    }
    setSpawns((list) => {
      const next = [...list, { def, x: pt[0] - (w * u) / 2, y: pt[1] - h * u * 0.8, owner: (scene.p > 0.55 ? 'about' : 'hero') as Spawn['owner'] }]
      return next.slice(-8)
    })
    window.setTimeout(() => ripple(id), 120)
  }, [])

  const addPin = useCallback((sx: number, sy: number) => {
    const markers = Array.from(markersRef.current?.children ?? []) as HTMLElement[]
    const pt = screenToFrame(markers, scene.frame.w, scene.frame.h, sx, sy)
    if (!pt) return
    const pin: Pin = {
      id: ++pinSeq,
      x: pt[0],
      y: pt[1],
      text: NOTES[pinSeq % NOTES.length],
      color: PIN_COLORS[pinSeq % PIN_COLORS.length],
    }
    setPins((list) => [...list, pin].slice(-10))
  }, [])

  useEffect(() => {
    const root = rootRef.current!
    let handY = -1
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      const target = e.target as Element | null
      pointer.inCanvas = !!target && root.contains(target) && e.pointerType === 'mouse'
      if (handY >= 0 && lenisRef.current) {
        const dy = e.clientY - handY
        handY = e.clientY
        lenisRef.current.scrollTo(window.scrollY - dy * 2.2, { immediate: true })
      }
    }
    const onLeave = () => {
      pointer.inCanvas = false
    }
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('a, button')) return
      const t = tool.get()
      if (t === 'shape') addSpawn(e.clientX, e.clientY)
      else if (t === 'comment') addPin(e.clientX, e.clientY)
      else if (t === 'hand') {
        handY = e.clientY
        root.classList.add('is-panning')
      } else if (t === 'frame') showHint('Frames are locked in this file — try Shape (O)')
      else if (t === 'pen') showHint('The pen path draws itself — try Comment (C)')
      else if (t === 'text') showHint('Copy is final here — try Shape (O)')
    }
    const onUp = () => {
      handY = -1
      root.classList.remove('is-panning')
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    root.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    const unTool = tool.sub((v) => root.setAttribute('data-tool', v))
    root.setAttribute('data-tool', tool.get())
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      unTool()
    }
  }, [addSpawn, addPin])

  // canvas hover outline follows the shared hover channel (layers ↔ canvas)
  useEffect(() => {
    let prev: Element | null = null
    return hover.sub((id) => {
      prev?.classList.remove('is-hover')
      prev = id ? (rootRef.current?.querySelector(`[data-layer="${id}"]`) ?? null) : null
      prev?.classList.add('is-hover')
    })
  }, [])

  // keep spawned creatures billboarded the moment they mount
  useLayoutEffect(() => {
    creatures.forEach((c) => {
      if (c.spawned) gsap.set(c.lift, { rotation: -scene.cam.rz, rotationX: -scene.cam.rx })
    })
  }, [spawns])

  return (
    <>
      <main ref={rootRef} className="stage" data-bp={bp} aria-label="Canvas">
        <div className="viewport">
          <div className="world" ref={worldRef}>
            <div className="paper" aria-hidden="true" />
            <div className="frame-space" ref={fsRef}>
              <div className="frame-bg-wrap" aria-hidden="true">
                <div className="frame-bg" />
              </div>
              <div className="frame-label" aria-hidden="true">
                <span className="frame-label-hero">
                  <FrameIcon /> Hero <i>·</i> <b>{Math.round(scene.frame.w)} × {Math.round(scene.frame.h)}</b>
                </span>
                <span className="frame-label-about">
                  <FrameIcon /> About <i>·</i> <b>Auto layout</b>
                </span>
              </div>
              <span className="size-badge intro-badge" aria-hidden="true">
                0 × 0
              </span>
              <div className="markers" ref={markersRef} aria-hidden="true">
                <i style={{ left: 0, top: 0 }} />
                <i style={{ left: '100%', top: 0 }} />
                <i style={{ left: '100%', top: '100%' }} />
                <i style={{ left: 0, top: '100%' }} />
              </div>
              <div className="org-anchor" ref={anchorRef} aria-hidden="true" />
              <div className="layer-sheet" aria-hidden="true">
                <span>z 44</span>
              </div>
              <div className="layer-sheet" aria-hidden="true">
                <span>z 104</span>
              </div>
              <HeroFrame />
              <AboutFrame />
              <GhostFrames />
              <div className="spawn-layer">
                {spawns.map((s) => (
                  <Creature key={s.def.id} def={s.def} px={{ x: s.x, y: s.y }} spawned owner={s.owner} />
                ))}
                {pins.map((p) => (
                  <BillboardPin key={p.id} pin={p} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <canvas className="organism-canvas" ref={canvasRef} aria-hidden="true" />
        <div className="org-proxy" ref={proxyRef} aria-hidden="true" data-layer="organism">
          <Eyes x={50} y={40} size={30} gap={0.42} />
        </div>
        <Cursors />
      </main>
      {!reduced && <div className="scroll-spacer" ref={spacerRef} aria-hidden="true" style={{ '--len': '700vh' } as CSSProperties} />}
    </>
  )
}

export function FrameIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="ico-frame">
      <path d="M3.5 1v10M8.5 1v10M1 3.5h10M1 8.5h10" />
    </svg>
  )
}
