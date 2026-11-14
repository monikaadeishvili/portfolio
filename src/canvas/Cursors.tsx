import { useLayoutEffect, useRef } from 'react'
import { pointer, rectCache, registry, scene, tool } from '../scene/store'

/* ------------------------------------------------------------- glyphs */

function Arrow({ color }: { color: string }) {
  return (
    <svg className="cur-arrow" viewBox="0 0 22 24" aria-hidden="true">
      <path d="M2.5 2.2 19 10.4c.9.4.8 1.7-.2 2l-6.6 1.9-3 6.2c-.4.9-1.7.9-2-.1L2 3.4c-.3-.8.6-1.6 1.4-1.2Z" fill={color} stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}

/* -------------------------------------------------------------- state */

interface Bot {
  key: 'monika' | 'pm' | 'dev'
  el: HTMLElement | null
  bubble: HTMLElement | null
  x: number
  y: number
  vx: number
  vy: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  t0: number
  dur: number
  bend: number
  nextBubble: number
  bubbleUntil: number
  story: string | null
  override: { x: number; y: number } | null
  extW: number
  extH: number
}

function makeBot(key: Bot['key'], x: number, y: number): Bot {
  return { key, el: null, bubble: null, x, y, vx: 0, vy: 0, fromX: x, fromY: y, toX: x, toY: y, t0: 0, dur: 1, bend: 0, nextBubble: 6 + Math.random() * 6, bubbleUntil: 0, story: null, override: null, extW: 90, extH: 44 }
}

export const bots: Record<Bot['key'], Bot> = {
  monika: makeBot('monika', 0, 0),
  pm: makeBot('pm', 0, 0),
  dev: makeBot('dev', 0, 0),
}

const you = { el: null as HTMLElement | null, x: -100, y: -100, vx: 0, vy: 0, shown: false }
/** the visitor's drawn cursor (smoothed position, and whether it is showing) — the pen trail starts here */
export const youAt = (): [number, number, boolean] => [you.x, you.y, you.shown]

const IDLE_LINES: Record<Bot['key'], string[]> = {
  monika: ['nudge 2px left', 'hmm, more air?', 'ooh'],
  pm: ['ooh', 'love this', 'ship it'],
  dev: ['ship it', 'wait, it\'s alive?', 'is that a div?'],
}

function sayBubble(key: Bot['key'], text: string, t: number, dur = 2.6) {
  const b = bots[key]
  if (!b.bubble) return
  b.bubble.textContent = text
  b.bubble.classList.add('is-on')
  b.bubbleUntil = t + dur
  measureExtent(b)
}

/** right/bottom extent of arrow + tag (+ bubble when shown), for viewport clamping */
function measureExtent(b: Bot) {
  if (!b.el) return
  const tag = b.el.querySelector<HTMLElement>('.cur-tag')
  let w = tag ? tag.offsetLeft + tag.offsetWidth : 80
  let h = tag ? tag.offsetTop + tag.offsetHeight : 40
  if (b.bubble && b.bubbleUntil) {
    w = Math.max(w, b.bubble.offsetLeft + b.bubble.offsetWidth)
    h = Math.max(h, b.bubble.offsetTop + b.bubble.offsetHeight)
  }
  b.extW = w
  b.extH = h
}

/* ------------------------------------------------------------- story */

function rectOf(id: string): DOMRect | null {
  const cached = rectCache.get(id)
  if (cached) return cached
  const info = registry.get(id)
  if (!info?.el) return null
  return info.el.getBoundingClientRect()
}

export type BotKey = Bot['key']
export type Story = { id: string; at: (r: DOMRect) => [number, number]; line?: string; rect?: () => DOMRect | null } | null
export interface Region {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** per-page cursor behaviour; Page 2 swaps these in and restores them on unmount */
export const cursorConfig = {
  story: null as null | ((key: BotKey, p: number) => Story),
  idleWindow: (p: number) => p < 0.06 || p > 0.9,
  lines: null as null | Record<BotKey, string[]>,
  regions: null as null | ((key: BotKey) => Region[]),
}

function storyFor(key: Bot['key'], p: number): Story {
  const tr = (fx: number, fy: number) => (r: DOMRect) => [r.left + r.width * fx, r.top + r.height * fy] as [number, number]
  if (key === 'monika') {
    if (p > 0.07 && p < 0.26) return { id: 'sticky', at: tr(0.82, 0.22) }
    if (p > 0.56 && p < 0.84) return { id: 'organism', at: tr(1.05, 0.2), line: 'nudge 2px left' }
    if (p >= 0.86) return { id: 'cta', at: tr(0.8, 0.15) }
  }
  if (key === 'dev') {
    if (p > 0.14 && p < 0.3) return { id: 'c-blob', at: tr(0.1, 0.9), line: "wait, it's alive?" }
    if (p > 0.34 && p < 0.52) return { id: 'organism', at: tr(0.1, 0.85) }
    if (p >= 0.88) return { id: 'cta', at: tr(0.97, 0.9), line: 'ship it' }
  }
  if (key === 'pm') {
    if (p > 0.36 && p < 0.54) return { id: 'organism', at: tr(0.95, 0.75), line: 'ooh' }
    if (p >= 0.86) return { id: 'cta', at: tr(0.62, 1.12), line: 'say hi!' }
  }
  return null
}

const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)

function pickWaypoint(b: Bot, t: number) {
  if (cursorConfig.regions) {
    const regs = cursorConfig.regions(b.key).filter((r) => r.x1 - r.x0 > b.extW * 0.5 && r.y1 - r.y0 > 10)
    if (regs.length) {
      const r = regs[Math.floor(Math.random() * regs.length)]
      b.fromX = b.x
      b.fromY = b.y
      b.toX = r.x0 + Math.random() * Math.max(1, r.x1 - r.x0 - b.extW * 0.5)
      b.toY = r.y0 + Math.random() * Math.max(1, r.y1 - r.y0)
      b.t0 = t
      b.dur = 1.6 + Math.random() * 2.2
      b.bend = (Math.random() - 0.5) * 0.5
      return
    }
  }
  const f = scene.frame
  const vw = window.innerWidth
  const vh = window.innerHeight
  const x0 = Math.max(16, f.x - 20)
  const x1 = Math.min(vw - 16 - b.extW, f.x + f.w + 20)
  const y0 = Math.max(70, f.y)
  const y1 = Math.min(vh - 90 - b.extH, f.y + f.h)
  // keep resting cursors off creatures, copy and chrome
  const avoid: DOMRect[] = []
  registry.forEach((info) => {
    if (!info.el || info.kind === 'organism') return
    const r = info.el.getBoundingClientRect()
    if (r.width > 0 && r.width < vw * 0.8) avoid.push(r)
  })
  document.querySelectorAll('.chrome').forEach((el) => avoid.push(el.getBoundingClientRect()))
  const hits = (x: number, y: number) =>
    avoid.some((r) => x - 8 < r.right + 10 && x + b.extW > r.left - 10 && y - 8 < r.bottom + 10 && y + b.extH > r.top - 10)
  let tx = b.x
  let ty = b.y
  for (let k = 0; k < 14; k++) {
    const cx = x0 + Math.random() * Math.max(1, x1 - x0)
    const cy = y0 + Math.random() * Math.max(1, y1 - y0)
    if (!hits(cx, cy)) {
      tx = cx
      ty = cy
      break
    }
  }
  b.fromX = b.x
  b.fromY = b.y
  b.toX = tx
  b.toY = ty
  b.t0 = t
  b.dur = 1.6 + Math.random() * 2.2
  b.bend = (Math.random() - 0.5) * 0.5
}

/** called once per frame from the ticker loop */
export function updateCursors(t: number, dt: number) {
  const p = scene.p
  const intro = !scene.introDone

  for (const b of Object.values(bots)) {
    if (!b.el) continue
    let tx: number
    let ty: number
    if (b.override) {
      tx = b.override.x
      ty = b.override.y
    } else {
      const story = intro ? null : (cursorConfig.story ?? storyFor)(b.key, p)
      const storyKey = story ? `${story.id}:${story.line ?? ''}:${Math.round(p * 10)}` : null
      const r = story ? (story.rect ? story.rect() : rectOf(story.id)) : null
      if (story && r && r.width > 0) {
        ;[tx, ty] = story.at(r)
        if (story.line && b.story?.split(':')[1] !== story.line) sayBubble(b.key, story.line, t)
        b.story = storyKey
        b.t0 = t
        b.fromX = b.x
        b.fromY = b.y
      } else {
        if (b.story) {
          b.story = null
          pickWaypoint(b, t)
        }
        const k = Math.min(1, (t - b.t0) / b.dur)
        if (k >= 1) pickWaypoint(b, t + Math.random() * 0.6)
        const e = easeInOut(Math.max(0, k))
        const dx = b.toX - b.fromX
        const dy = b.toY - b.fromY
        const s = Math.sin(e * Math.PI) * b.bend
        tx = b.fromX + dx * e - dy * s
        ty = b.fromY + dy * e + dx * s
        if (!intro && t > b.nextBubble && cursorConfig.idleWindow(p)) {
          const lines = (cursorConfig.lines ?? IDLE_LINES)[b.key]
          sayBubble(b.key, lines[Math.floor(Math.random() * lines.length)], t)
          b.nextBubble = t + 9 + Math.random() * 9
        }
      }
    }
    // stay inside the viewport (12px), tag and bubble included
    const vw = window.innerWidth
    const vh = window.innerHeight
    tx = Math.min(Math.max(tx, 14), vw - 12 - b.extW)
    ty = Math.min(Math.max(ty, 12), vh - 12 - b.extH)
    // critically-damped-ish spring, slightly under-damped for a human wobble
    const k = 70
    const c = 2 * Math.sqrt(k) * 0.92
    const h = Math.min(dt, 1 / 30)
    b.vx += ((tx - b.x) * k - b.vx * c) * h
    b.vy += ((ty - b.y) * k - b.vy * c) * h
    b.x = Math.min(Math.max(b.x + b.vx * h, 14), vw - 12 - b.extW)
    b.y = Math.min(Math.max(b.y + b.vy * h, 12), vh - 12 - b.extH)
    b.el.style.transform = `translate3d(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px, 0)`
    if (b.bubbleUntil && t > b.bubbleUntil) {
      b.bubble?.classList.remove('is-on')
      b.bubbleUntil = 0
      measureExtent(b)
    }
  }

  // the visitor's own cursor
  if (you.el) {
    const show = pointer.inCanvas && scene.fine
    if (show !== you.shown) {
      you.shown = show
      you.el.classList.toggle('is-on', show)
      if (show && you.x < 0) {
        you.x = pointer.x
        you.y = pointer.y
      }
    }
    const k = 900
    const c = 2 * Math.sqrt(k) * 0.78
    const h = Math.min(dt, 1 / 30)
    you.vx += ((pointer.x - you.x) * k - you.vx * c) * h
    you.vy += ((pointer.y - you.y) * k - you.vy * c) * h
    you.x += you.vx * h
    you.y += you.vy * h
    you.el.style.transform = `translate3d(${you.x.toFixed(1)}px, ${you.y.toFixed(1)}px, 0)`
  }
}

/* --------------------------------------------------------- component */

const BOTS: { key: Bot['key']; name: string; color: string }[] = [
  { key: 'monika', name: 'Monika', color: '#5B4BFF' },
  { key: 'pm', name: 'PM', color: '#19D3A2' },
  { key: 'dev', name: 'Dev', color: '#2DB8FF' },
]

export function Cursors() {
  const youRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const starts: Record<Bot['key'], [number, number]> = {
      monika: [scene.frame.x + 20, scene.frame.y + 20],
      pm: [vw * 0.72, vh * 0.78],
      dev: [vw * 0.3, vh * 0.86],
    }
    for (const { key } of BOTS) {
      const b = bots[key]
      b.el = root.querySelector(`[data-bot="${key}"]`)
      b.bubble = b.el?.querySelector('.cur-bubble') ?? null
      ;[b.x, b.y] = starts[key]
      b.fromX = b.toX = b.x
      b.fromY = b.toY = b.y
      b.t0 = performance.now() / 1000
      measureExtent(b)
    }
    you.el = youRef.current
    const unTool = tool.sub((v) => youRef.current?.setAttribute('data-tool', v))
    return () => {
      unTool()
      for (const b of Object.values(bots)) {
        b.el = null
        b.bubble = null
      }
      you.el = null
      you.shown = false
    }
  }, [])

  return (
    <div className="cursors" ref={rootRef} aria-hidden="true">
      {BOTS.map((b) => (
        <div key={b.key} className={`cur cur-bot cur-${b.key}`} data-bot={b.key} style={{ color: b.color }}>
          <Arrow color={b.color} />
          <span className="cur-tag" style={{ background: b.color }}>
            {b.name}
          </span>
          <span className="cur-bubble" style={{ borderColor: b.color }} />
        </div>
      ))}
      <div className="cur cur-you" ref={youRef} data-tool="move">
        <Arrow color="#16131D" />
        <svg className="cur-cross" viewBox="0 0 24 24">
          <path d="M12 3v18M3 12h18" />
        </svg>
        <svg className="cur-hand" viewBox="0 0 24 24">
          <path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V12m0-3a1.5 1.5 0 0 1 3 0v5c0 4-2.5 7-6.5 7-3 0-4.6-1.3-6-3.4L4.4 13.9a1.6 1.6 0 0 1 2.5-2L8 13" />
        </svg>
        <svg className="cur-pen" viewBox="0 0 24 24">
          <g transform="translate(3 21) rotate(45) scale(1.3)">
            <path d="M0 0-4.5-7.5Q-4.5-10-2-10.5H2Q4.5-10 4.5-7.5Z" />
            <path className="cur-pen-cap" d="M-2.6-10.5V-13H2.6V-10.5" />
            <path className="cur-pen-slit" d="M0 0V-5.4" />
            <circle className="cur-pen-hole" cx="0" cy="-6.4" r="1.05" />
          </g>
        </svg>
        <svg className="cur-picker" viewBox="0 0 24 24">
          <g transform="translate(3 21) rotate(45) scale(1.3)">
            <path d="M-1.3-1.9V-9.6H1.3V-1.9L0 0.2Z" />
            <rect x="-3" y="-10.4" width="6" height="1.6" rx="0.8" />
            <rect x="-2.3" y="-15.2" width="4.6" height="5.2" rx="1.6" />
          </g>
        </svg>
        <span className="cur-pick" aria-hidden="true">
          <i className="cur-pick-sw" />
          <b className="cur-pick-hex">#000000</b>
        </span>
        <svg className="cur-comment" viewBox="0 0 24 24">
          <path d="M4 20V8a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H9l-5 5Z" />
        </svg>
        <span className="cur-tag">You</span>
      </div>
    </div>
  )
}
