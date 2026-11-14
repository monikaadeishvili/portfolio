/**
 * Colour under a screen point, for the dock's Color picker. Browsers have no
 * "read the screen" call for hover, so the page is sampled layer by layer:
 *
 *   1. chrome and pieces on top (panels, dock, nav, pill, captions, switch):
 *      the glyph under the point (tested against the real letter shape),
 *      an SVG shape's paint, an image's pixel, or the element's fill;
 *   2. the Hello headline's line 2 (in front of the portrait), the portrait's
 *      own WebGL pixel, then line 1 (behind her) — tested by hand, since the
 *      headline and the canvas take no pointer events;
 *   3. the artboard / section fills under all of it, and finally the colour
 *      world's base.
 */

export type RGB = [number, number, number]

/** a WebGL (or other) surface that can report its own pixel */
export interface PickSource {
  el: HTMLElement
  /** straight RGBA 0–255 at the client point (may be a frame old), or null */
  read(x: number, y: number): [number, number, number, number] | null
}
const sources = new Set<PickSource>()
export function registerPickSource(s: PickSource) {
  sources.add(s)
  return () => void sources.delete(s)
}

/* ------------------------------------------------------------ colours */

/** 'rgb(…)' / 'rgba(…)' / 'color(srgb …)' → [r, g, b, a] (0–255, a 0–1) */
function parse(s: string): [number, number, number, number] | null {
  let m = s.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/)
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]]
  m = s.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/)
  if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255, m[4] == null ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]]
  return null
}
const solid = (s: string, min = 0.35): RGB | null => {
  const c = parse(s)
  return c && c[3] >= min ? [c[0], c[1], c[2]] : null
}

/* ------------------------------------------------------------- glyphs */

const gcv = document.createElement('canvas')
const gctx = gcv.getContext('2d', { willReadFrequently: true })!

/**
 * Is the client point on the painted part of `ch`, drawn in `el`'s font into a
 * box whose client rect is `r`? `inline` boxes (Range rects) start at the
 * font's ascent; inline-block boxes (the headline letters) are line-height
 * tall, with the content area centred in them.
 */
function onGlyph(el: Element, ch: string, r: DOMRect, x: number, y: number, inline: boolean) {
  const cs = getComputedStyle(el)
  const size = parseFloat(cs.fontSize)
  if (!size || !ch.trim()) return false
  if (cs.textTransform === 'uppercase') ch = ch.toUpperCase()
  gctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`
  const m = gctx.measureText(ch)
  const adv = m.width || size * 0.5
  const k = r.width / adv // client px per layout px (camera zoom)
  if (!(k > 0)) return false
  const asc = m.fontBoundingBoxAscent
  const desc = m.fontBoundingBoxDescent
  const lh = parseFloat(cs.lineHeight) || size * 1.2
  const top = inline ? 0 : (lh - (asc + desc)) / 2 // content-area top inside the box
  const lx = (x - r.left) / k
  const ly = (y - r.top) / k - top
  const pad = Math.ceil(size * 0.25)
  const W = Math.ceil(adv + pad * 2)
  const H = Math.ceil(asc + desc + pad * 2)
  if (gcv.width < W) gcv.width = W
  if (gcv.height < H) gcv.height = H
  gctx.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`
  gctx.clearRect(0, 0, gcv.width, gcv.height)
  gctx.fillStyle = '#000'
  gctx.textBaseline = 'alphabetic'
  gctx.fillText(ch, pad, pad + asc)
  // the heft stroke some text carries (see .h-ch) thickens the letter slightly
  const sw = parseFloat(cs.webkitTextStrokeWidth) || 0
  if (sw > 0) {
    gctx.lineWidth = sw
    gctx.strokeText(ch, pad, pad + asc)
  }
  const px = Math.round(pad + lx)
  const py = Math.round(pad + ly)
  if (px < 0 || py < 0 || px >= W || py >= H) return false
  return gctx.getImageData(px, py, 1, 1).data[3] > 110
}
const textColour = (el: Element): RGB | null => {
  const cs = getComputedStyle(el)
  return solid(cs.webkitTextFillColor || cs.color, 0.2) ?? solid(cs.color, 0.2)
}
const visible = (el: Element) => {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e)
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.3) return false
  }
  return true
}

/** the text glyph under the point, via the caret APIs (respects pointer events) */
function caretText(x: number, y: number): { el: Element; c: RGB } | null {
  const d = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  let node: Node | null = null
  let off = 0
  const pos = d.caretPositionFromPoint?.(x, y)
  if (pos) {
    node = pos.offsetNode
    off = pos.offset
  } else {
    const rg = document.caretRangeFromPoint?.(x, y)
    if (rg) {
      node = rg.startContainer
      off = rg.startOffset
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || !node.parentElement) return null
  const text = node.textContent ?? ''
  const range = document.createRange()
  for (const i of [off, off - 1]) {
    if (i < 0 || i >= text.length) continue
    range.setStart(node, i)
    range.setEnd(node, i + 1)
    const r = range.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
    const el = node.parentElement
    if (!visible(el)) return null
    if (onGlyph(el, text[i], r, x, y, true)) {
      const c = textColour(el)
      if (c) return { el, c }
    }
    return null
  }
  return null
}

/* ------------------------------------------------------------- images */

const icv = document.createElement('canvas')
icv.width = icv.height = 1
const ictx = icv.getContext('2d', { willReadFrequently: true })!
function imagePixel(img: HTMLImageElement, x: number, y: number): RGB | null {
  if (!img.complete || !img.naturalWidth) return null
  const r = img.getBoundingClientRect()
  const cs = getComputedStyle(img)
  // object-fit: contain / cover / fill, positioned by object-position (centre or bottom)
  const iw = img.naturalWidth
  const ih = img.naturalHeight
  let s = 1
  let dw = r.width
  let dh = r.height
  if (cs.objectFit === 'contain' || cs.objectFit === 'cover') {
    s = cs.objectFit === 'contain' ? Math.min(r.width / iw, r.height / ih) : Math.max(r.width / iw, r.height / ih)
    dw = iw * s
    dh = ih * s
  }
  const [ox, oy] = cs.objectPosition.split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5))
  const left = r.left + (r.width - dw) * ox
  const top = r.top + (r.height - dh) * oy
  const u = (x - left) / dw
  const v = (y - top) / dh
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return null
  try {
    ictx.clearRect(0, 0, 1, 1)
    ictx.drawImage(img, u * iw, v * ih, 1, 1, 0, 0, 1, 1)
    const d = ictx.getImageData(0, 0, 1, 1).data
    return d[3] > 90 ? [d[0], d[1], d[2]] : null
  } catch {
    return null // cross-origin
  }
}

/* ------------------------------------------------- the Hello headline */

function headline(sel: string, x: number, y: number): RGB | null {
  for (const s of document.querySelectorAll<HTMLElement>(sel)) {
    const r = s.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
    if (!visible(s)) return null
    return onGlyph(s, s.textContent ?? '', r, x, y, false) ? textColour(s) : null
  }
  return null
}
function portrait(x: number, y: number): RGB | null {
  for (const s of sources) {
    const p = s.read(x, y)
    if (p && p[3] > 150) return [p[0], p[1], p[2]]
  }
  return null
}

/* -------------------------------------------------------- board fills */

/** fill layers that take no pointer events (boards, the plain canvas, the wipe disc) */
const FILLS = '.h-cv, .bf-bg, .h-plainbg, .h-disc'
function fills(x: number, y: number): RGB | null {
  let top: RGB | null = null
  // later in the document paints on top
  for (const el of document.querySelectorAll<HTMLElement>(FILLS)) {
    const r = el.getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue
    if (!visible(el)) continue
    const c = solid(getComputedStyle(el).backgroundColor)
    if (c) top = c
  }
  return top
}

/* -------------------------------------------------------------- world */

function worldBase(): RGB {
  let best: RGB | null = null
  let op = 0
  for (const w of document.querySelectorAll<HTMLElement>('.wbg')) {
    const cs = getComputedStyle(w)
    const o = parseFloat(cs.opacity)
    const c = solid(cs.backgroundColor)
    if (c && o > op) {
      op = o
      best = c
    }
  }
  return best ?? solid(getComputedStyle(document.body).backgroundColor) ?? [241, 241, 238]
}

/* ------------------------------------------------------------- sample */

/** chrome / pieces: what sits above the stage art */
const ABOVE = '.chrome, .slot, .cur, .h-addtaste, .bubble, button, a, input'
/** the page itself: its fill is the colour world, read separately */
const ROOT = 'html, body, .app, .bstage, .bviewport'

export function sampleAt(x: number, y: number): RGB {
  const stack = document.elementsFromPoint(x, y)
  const caret = caretText(x, y)
  let stageDone = false
  for (const el of stack) {
    if (el.matches(ROOT)) break
    const above = !!el.closest(ABOVE)
    // reaching the stage art: the headline + portrait sit over the board fills
    if (!above && !stageDone) {
      stageDone = true
      const c = headline('.h-l2 .h-ch', x, y) ?? portrait(x, y) ?? headline('.h-l1 .h-ch', x, y)
      if (c) return c
    }
    if (caret && (caret.el === el || el.contains(caret.el))) return caret.c
    if (el instanceof SVGGeometryElement || el instanceof SVGTextElement) {
      const cs = getComputedStyle(el)
      const c = solid(cs.fill, 0.2) ?? solid(cs.stroke, 0.2)
      if (c) return c
      continue
    }
    if (el instanceof HTMLImageElement) {
      const c = imagePixel(el, x, y)
      if (c) return c
      continue
    }
    if (el instanceof HTMLCanvasElement) continue
    const c = solid(getComputedStyle(el).backgroundColor)
    if (c) return c
  }
  if (!stageDone) {
    const c = headline('.h-l2 .h-ch', x, y) ?? portrait(x, y) ?? headline('.h-l1 .h-ch', x, y)
    if (c) return c
  }
  return fills(x, y) ?? worldBase()
}

export const hex = (c: RGB) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
