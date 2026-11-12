/**
 * <PortraitDeck> — the portrait as the top card of a deck of colourful cards.
 *
 * Rest: a neat, breathing deck (CSS only). Press: the photo lifts and tilts
 * toward the pointer. Drag: the photo follows 1:1 and the coloured cards
 * stream out behind it as a spring chain. Release: the photo springs home,
 * the chain claps shut after it, then a colour wipe flourishes across the
 * photo once.
 *
 * While dragging, the deck is lifted into a fixed overlay layer (the nearest
 * `[data-deck-layer]`, else <body>) built from one getBoundingClientRect at
 * press, so it is never clipped and works inside CSS-3D transformed worlds
 * (as long as the world is flat while `canDrag()` is true).
 *
 * Host hooks (all optional):
 *  - `canDrag()`  polled at press, every frame while dragging, and every 250ms
 *                 for the idle hint; returning false mid-drag snaps home.
 *  - `[data-deck-scope]` ancestor: receives `data-deck="press|drag"` and
 *                 `data-deck-hint="1"` so siblings (a tooltip) can react.
 *  - a press without movement > 4px dispatches a bubbling `decktap` event.
 */
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { gsap } from '../scene/gsap'

const DECK_TONES = ['coral', 'pink', 'yellow', 'lime', 'sky', 'violet'] as const
const N: number = DECK_TONES.length
/** per-frame (60fps) chase factor of card i toward card i-1 */
const CHASE = [0.35, 0.3, 0.25, 0.2, 0.16, 0.12]
const DRAG_PX = 4
const FIRST_HINT = 6000
const NEXT_HINT = 14000

interface Fan {
  dx: number
  dy: number
  r: number
}

interface Body {
  el: HTMLElement | null
  x: number
  y: number
  px: number
  py: number
  r: number
  sc: number
  sx: number
  sy: number
  /** perspective tilt (top card only) */
  tx: number
  ty: number
  /** under a return tween: physics hands off */
  held: boolean
  landed: boolean
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
const smoothstep = (a: number, b: number, v: number) => {
  const x = clamp((v - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}
/** frame-rate independent lerp factor */
const ease = (k: number, f: number) => 1 - Math.pow(1 - k, f)

function makeFan(): Fan[] {
  const out: Fan[] = []
  for (let i = 1; i <= N; i++) {
    const j = () => Math.random() - 0.5
    // mostly clockwise, every third one leans back: stripes along bottom + right
    const lean = i % 3 === 2 ? -0.7 : 1
    out.push({
      dx: i * 2.6 + j() * 1.4,
      dy: i * 3.9 + j() * 1.2,
      r: clamp((0.9 + i * 0.28 + Math.random() * 0.6) * lean, -3, 3),
    })
  }
  return out
}

function mountDeck(root: HTMLElement, can: () => boolean): () => void {
  const top = root.querySelector<HTMLElement>('.u-deck-top')!
  const stack = Array.from(root.querySelectorAll<HTMLElement>('.u-deck-stack .u-deck-card')).sort((a, b) => Number(a.dataset.i) - Number(b.dataset.i))
  const wipe = root.querySelector<HTMLElement>('.u-deck-wipe')
  const scope = root.closest<HTMLElement>('[data-deck-scope]')
  const html = document.documentElement
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')

  let fan = makeFan()
  const applyFan = () =>
    stack.forEach((el, i) => {
      el.style.setProperty('--dx', `${fan[i].dx.toFixed(2)}px`)
      el.style.setProperty('--dy', `${fan[i].dy.toFixed(2)}px`)
      el.style.setProperty('--r', `${fan[i].r.toFixed(2)}deg`)
    })
  applyFan()

  type Phase = 'idle' | 'press' | 'drag' | 'glide' | 'return'
  let phase: Phase = 'idle'
  let pid = -1
  let x0 = 0
  let y0 = 0
  let ptrX = 0
  let ptrY = 0
  let rect: DOMRect | null = null
  let W = 0
  let H = 0
  let S = 1
  let hx = 0
  let hy = 0
  let offX = 0
  let offY = 0
  let reduced = false
  let pressTilt = { x: 0, y: 0 }
  let layer: HTMLElement | null = null
  let ticking = false
  let glideT = 0
  let gvx = 0
  let gvy = 0
  let wipeIdx = 0
  let wipeAnim: Animation | null = null
  /** last time the deck was touched / became available */
  let idle = performance.now()
  let nextHint = FIRST_HINT
  let armed = ''
  const samples: { t: number; x: number; y: number }[] = []
  const tweens: gsap.core.Animation[] = []
  const timers = new Set<number>()
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
  }
  const body = (): Body => ({ el: null, x: 0, y: 0, px: 0, py: 0, r: 0, sc: 1, sx: 1, sy: 1, tx: 0, ty: 0, held: false, landed: false })
  const bodies: Body[] = Array.from({ length: N + 1 }, body)

  const setScope = (v: string | null) => {
    if (!scope) return
    if (v) scope.setAttribute('data-deck', v)
    else scope.removeAttribute('data-deck')
  }
  const setArmed = (v: boolean) => {
    const s = v ? '1' : '0'
    if (s !== armed) {
      armed = s
      root.dataset.armed = s
    }
  }

  /* --------------------------------------------------- overlay layer */
  const buildLayer = () => {
    removeLayer()
    const host = root.closest<HTMLElement>('[data-deck-layer]') ?? document.body
    layer = document.createElement('div')
    layer.className = 'u-deck-layer'
    layer.setAttribute('aria-hidden', 'true')
    layer.style.visibility = 'hidden'
    // bottom → top so the photo paints last
    for (let i = N; i >= 1; i--) {
      const el = document.createElement('span')
      el.className = 'u-deck-card'
      el.style.setProperty('--tone', `var(--${DECK_TONES[i - 1]})`)
      bodies[i].el = el
      layer.appendChild(el)
    }
    const clone = top.cloneNode(true) as HTMLElement
    clone.classList.remove('is-press')
    clone.style.transform = ''
    clone.querySelector('figcaption')?.removeAttribute('id')
    bodies[0].el = clone
    layer.appendChild(clone)
    host.appendChild(layer)
  }
  function removeLayer() {
    layer?.remove()
    layer = null
    bodies.forEach((b) => (b.el = null))
  }

  const write = () => {
    for (let i = N; i >= 0; i--) {
      const b = bodies[i]
      if (!b.el) continue
      const sx = (S * b.sc * b.sx).toFixed(4)
      const sy = (S * b.sc * b.sy).toFixed(4)
      const tilt = i === 0 && (b.tx || b.ty) ? ` perspective(900px) rotateX(${b.tx.toFixed(2)}deg) rotateY(${b.ty.toFixed(2)}deg)` : ''
      b.el.style.transform = `translate3d(${(b.x - W / 2).toFixed(2)}px, ${(b.y - H / 2).toFixed(2)}px, 0) rotate(${b.r.toFixed(2)}deg)${tilt} scale(${sx}, ${sy})`
    }
  }

  /* ------------------------------------------------------ the chain */
  const tick = (_t: number, deltaMs: number) => {
    if (!can()) {
      cancel()
      return
    }
    const f = clamp(deltaMs / 16.667, 0.25, 4)
    const T = bodies[0]
    if (phase === 'drag') {
      T.x = ptrX - offX
      T.y = ptrY - offY
    } else if (phase === 'glide') {
      glideT += deltaMs
      const k = Math.exp(-deltaMs / 90)
      gvx *= k
      gvy *= k
      T.x += gvx * deltaMs
      T.y += gvy * deltaMs
      if (glideT >= 150) startReturn()
    }
    if (phase === 'drag' || phase === 'glide') {
      const vx = (T.x - T.px) / f
      T.tx += -T.tx * ease(0.14, f)
      T.ty += -T.ty * ease(0.14, f)
      T.r += ((reduced ? 0 : clamp(vx * 0.45, -10, 10)) - T.r) * ease(0.2, f)
    }
    T.px = T.x
    T.py = T.y

    if (!reduced) {
      const maxL = 0.56 * H * S
      for (let i = 1; i <= N; i++) {
        const c = bodies[i]
        if (c.held) {
          c.px = c.x
          c.py = c.y
          continue
        }
        const L = bodies[i - 1]
        const F = fan[i - 1]
        const P = i > 1 ? fan[i - 2] : { dx: 0, dy: 0 }
        // bunch: sit a step behind the leader, like the resting fan
        let tx = L.x + (F.dx - P.dx) * S
        let ty = L.y + (F.dy - P.dy) * S
        if (i === N) {
          // the tail stays loosely anchored at home until the chain pulls it
          const ax = hx + F.dx * S
          const ay = hy + F.dy * S
          const teth = 0.72 * (1 - smoothstep(0, 2.4 * H * S, Math.hypot(L.x - ax, L.y - ay)))
          tx += (ax - tx) * teth
          ty += (ay - ty) * teth
        }
        const a = ease(CHASE[i - 1], f)
        c.x += (tx - c.x) * a
        c.y += (ty - c.y) * a
        // links never let go: always overlapping, a paper chain not confetti
        const dx = c.x - L.x
        const dy = c.y - L.y
        const d = Math.hypot(dx, dy)
        if (d > maxL) {
          c.x = L.x + (dx / d) * maxL
          c.y = L.y + (dy / d) * maxL
        }
        const vx = (c.x - c.px) / f
        const vy = (c.y - c.py) / f
        c.px = c.x
        c.py = c.y
        // swing with the direction of travel; vertical motion adds a little lean
        const rt = clamp(vx * 0.8 + vy * 0.15 * Math.sign(vx || 1), -18, 18) + F.r * 0.5
        c.r += (rt - c.r) * ease(0.2, f)
      }
    }
    write()
  }
  const startTick = () => {
    if (ticking) return
    ticking = true
    gsap.ticker.add(tick)
  }
  const stopTick = () => {
    if (!ticking) return
    ticking = false
    gsap.ticker.remove(tick)
  }
  const killTweens = () => {
    tweens.forEach((t) => t.kill())
    tweens.length = 0
  }

  /* ------------------------------------------------------ listeners */
  const blockWheel = (e: WheelEvent) => {
    // Lenis listens on window in the bubble phase; stop it here
    e.preventDefault()
    e.stopImmediatePropagation()
  }
  const addWin = () => {
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('blur', onBlur)
    window.addEventListener('wheel', blockWheel, { capture: true, passive: false })
  }
  const removePtr = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    window.removeEventListener('blur', onBlur)
  }
  const removeWin = () => {
    removePtr()
    window.removeEventListener('wheel', blockWheel, { capture: true })
  }

  const sample = (e: PointerEvent) => {
    const t = e.timeStamp
    samples.push({ t, x: e.clientX, y: e.clientY })
    while (samples.length > 2 && t - samples[0].t > 90) samples.shift()
  }
  const velocity = () => {
    if (samples.length < 2) return { x: 0, y: 0 }
    const a = samples[0]
    const b = samples[samples.length - 1]
    if (performance.now() - b.t > 70) return { x: 0, y: 0 }
    const dt = Math.max(8, b.t - a.t)
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt }
  }

  const onDown = (e: PointerEvent) => {
    idle = performance.now()
    if (e.button !== 0 || !e.isPrimary || phase !== 'idle') return
    const ok = can()
    setArmed(ok)
    if (!ok) return
    if (e.pointerType === 'mouse') e.preventDefault()
    pid = e.pointerId
    x0 = ptrX = e.clientX
    y0 = ptrY = e.clientY
    samples.length = 0
    sample(e)
    reduced = mq.matches
    rect = root.getBoundingClientRect()
    const nx = clamp((e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2), -1, 1)
    const ny = clamp((e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2), -1, 1)
    // the grabbed point lifts toward you
    pressTilt = reduced ? { x: 0, y: 0 } : { x: ny * 5, y: -nx * 5 }
    top.style.transform = `perspective(900px) rotateX(${pressTilt.x.toFixed(2)}deg) rotateY(${pressTilt.y.toFixed(2)}deg) scale(${reduced ? 1.02 : 1.04})`
    root.classList.add('is-press')
    setScope('press')
    phase = 'press'
    addWin()
    buildLayer()
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pid) return
    ptrX = e.clientX
    ptrY = e.clientY
    sample(e)
    if (phase === 'press' && Math.hypot(ptrX - x0, ptrY - y0) > DRAG_PX) {
      if (can()) startDrag()
      else unpress()
    }
  }

  const startDrag = () => {
    if (!rect || !layer) return
    phase = 'drag'
    W = root.offsetWidth
    H = root.offsetHeight
    S = W > 0 ? rect.width / W : 1
    hx = rect.left + rect.width / 2
    hy = rect.top + rect.height / 2
    offX = x0 - hx
    offY = y0 - hy
    const T = bodies[0]
    Object.assign(T, { x: hx, y: hy, px: hx, py: hy, r: 0, sc: reduced ? 1.02 : 1.04, sx: 1, sy: 1, tx: pressTilt.x, ty: pressTilt.y, held: false, landed: false })
    for (let i = 1; i <= N; i++) {
      const F = fan[i - 1]
      const x = hx + F.dx * S
      const y = hy + F.dy * S
      // rest size first; they shrink toward the tail as the chain wakes
      Object.assign(bodies[i], { x, y, px: x, py: y, r: F.r, sc: 1, sx: 1, sy: 1, held: false, landed: false })
    }
    bodies.forEach((b) => {
      if (!b.el) return
      b.el.style.width = `${W}px`
      b.el.style.height = `${H}px`
    })
    write()
    layer.style.visibility = ''
    root.classList.add('is-lifted', 'is-drag')
    root.classList.remove('is-press')
    top.style.transform = ''
    setScope('drag')
    html.classList.add('is-deck-drag')
    if (!reduced) {
      // scale toward the tail: 1 → 0.9
      for (let i = 1; i <= N; i++) tweens.push(gsap.to(bodies[i], { sc: 1 - (0.1 * i) / N, duration: 0.3, ease: 'power2.out' }))
    }
    startTick()
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pid) return
    release()
  }
  const onBlur = () => release()

  const release = () => {
    if (phase === 'press') {
      unpress()
      root.dispatchEvent(new CustomEvent('decktap', { bubbles: true }))
      return
    }
    if (phase !== 'drag') return
    removePtr()
    setScope(null)
    html.classList.remove('is-deck-drag')
    root.classList.remove('is-drag')
    const v = velocity()
    const sp = Math.hypot(v.x, v.y)
    if (!reduced && sp > 0.45) {
      const cap = Math.min(1, 2.6 / sp)
      gvx = v.x * cap
      gvy = v.y * cap
      glideT = 0
      phase = 'glide'
    } else startReturn()
  }

  const squash = (b: Body) => {
    const tl = gsap.timeline()
    tl.to(b, { sx: 1.05, sy: 0.94, duration: 0.07, ease: 'power2.out' }).to(b, { sx: 1, sy: 1, duration: 0.26, ease: 'back.out(2.6)' })
    tweens.push(tl)
  }

  function startReturn() {
    phase = 'return'
    // the slot may have shifted (hover lift settling); one read
    const r = root.getBoundingClientRect()
    hx = r.left + r.width / 2
    hy = r.top + r.height / 2
    fan = makeFan()
    const T = bodies[0]
    killTweens()
    if (reduced) {
      tweens.push(gsap.to(T, { x: hx, y: hy, r: 0, sc: 1, tx: 0, ty: 0, duration: 0.22, ease: 'power2.out', onComplete: finish }))
      return
    }
    const tt: gsap.core.Tween = gsap.to(T, {
      x: hx,
      y: hy,
      r: 0,
      sc: 1,
      tx: 0,
      ty: 0,
      duration: 0.65,
      ease: 'back.out(1.5)',
      onUpdate: () => {
        if (!T.landed && tt.progress() > 0.42) {
          T.landed = true
          squash(T)
        }
      },
    })
    tweens.push(tt)
    for (let i = 1; i <= N; i++) {
      const c = bodies[i]
      const F = fan[i - 1]
      const ct: gsap.core.Tween = gsap.to(c, {
        x: hx + F.dx * S,
        y: hy + F.dy * S,
        r: F.r,
        sc: 1,
        duration: 0.5,
        ease: 'back.out(1.6)',
        delay: 0.1 + i * 0.045,
        onStart: () => {
          c.held = true
        },
        onUpdate: () => {
          if (!c.landed && ct.progress() > 0.42) {
            c.landed = true
            squash(c)
          }
        },
        onComplete: i === N ? () => later(finish, 300) : undefined,
      })
      tweens.push(ct)
    }
  }

  function finish() {
    const wasReduced = reduced
    teardown()
    applyFan()
    if (!wasReduced) later(flourish, 40)
  }

  /** drop everything instantly: overlay gone, deck back in place */
  function teardown() {
    killTweens()
    stopTick()
    removeWin()
    removeLayer()
    root.classList.remove('is-lifted', 'is-drag', 'is-press')
    html.classList.remove('is-deck-drag')
    top.style.transform = ''
    setScope(null)
    phase = 'idle'
    pid = -1
    idle = performance.now()
  }
  function cancel() {
    teardown()
  }
  function unpress() {
    teardown()
  }

  /* ------------------------------------------------------ flourish */
  const flourish = () => {
    if (!wipe || mq.matches) return
    wipe.style.setProperty('--tone', `var(--${DECK_TONES[wipeIdx % N]})`)
    wipeIdx++
    wipeAnim?.cancel()
    wipeAnim = wipe.animate(
      [
        { opacity: 1, transform: 'translate(-50%, -50%) translate(-64%, 80%)' },
        { opacity: 1, transform: 'translate(-50%, -50%) translate(64%, -80%)' },
      ],
      { duration: 560, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
    )
  }

  /* --------------------------------------------------- idle hint */
  const hint = () => {
    root.classList.add('is-shuffle')
    later(() => root.classList.remove('is-shuffle'), 900)
    scope?.setAttribute('data-deck-hint', '1')
    later(() => scope?.removeAttribute('data-deck-hint'), 1900)
  }
  const iv = window.setInterval(() => {
    if (phase !== 'idle') {
      if (phase === 'press' && !can()) unpress()
      idle = performance.now()
      return
    }
    const ok = can()
    setArmed(ok)
    if (!ok || document.hidden) {
      idle = performance.now()
      if (!ok) nextHint = FIRST_HINT
      return
    }
    if (performance.now() - idle >= nextHint && !mq.matches) {
      idle = performance.now()
      nextHint = NEXT_HINT
      hint()
    }
  }, 250)

  const onEnter = () => {
    idle = performance.now()
    setArmed(can())
  }
  const noDrag = (e: Event) => e.preventDefault()
  top.addEventListener('pointerdown', onDown)
  top.addEventListener('pointerenter', onEnter)
  root.addEventListener('dragstart', noDrag)
  setArmed(can())

  return () => {
    teardown()
    window.clearInterval(iv)
    timers.forEach((id) => window.clearTimeout(id))
    timers.clear()
    wipeAnim?.cancel()
    scope?.removeAttribute('data-deck-hint')
    root.classList.remove('is-shuffle')
    top.removeEventListener('pointerdown', onDown)
    top.removeEventListener('pointerenter', onEnter)
    root.removeEventListener('dragstart', noDrag)
  }
}

interface DeckProps {
  name?: string
  note?: string
  src?: string
  alt?: string
  /** gate for the interaction (see file header); defaults to always on */
  canDrag?: () => boolean
}

export function PortraitDeck({ name = 'Monika', note, src = '/monika.jpg', alt = 'Portrait of Monika Adeishvili', canDrag }: DeckProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canRef = useRef(canDrag)
  useLayoutEffect(() => {
    canRef.current = canDrag
  }, [canDrag])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    return mountDeck(root, () => (canRef.current ? canRef.current() : true))
  }, [])

  return (
    <div className="u-pdeck" ref={rootRef} data-armed="0">
      <div className="u-deck-stack" aria-hidden="true">
        {DECK_TONES.map((t, k) => {
          const i = N - k
          return <span key={t} className="u-deck-card" data-i={i} style={{ '--tone': `var(--${DECK_TONES[i - 1]})`, '--i': i } as CSSProperties} />
        })}
      </div>
      <figure className="u-portrait u-deck-top">
        <div className="u-portrait-card">
          <img src={src} alt={alt} width={1200} height={1200} decoding="async" draggable={false} />
          <span className="u-deck-wipe" aria-hidden="true" />
        </div>
        <figcaption className="u-portrait-tag">
          {name} <span aria-hidden="true">◆</span>
          {note && <em>{note}</em>}
        </figcaption>
      </figure>
    </div>
  )
}
