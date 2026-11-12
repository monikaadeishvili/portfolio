import { scene, type Breakpoint } from './store'

export function breakpointFor(w: number): Breakpoint {
  if (w < 768) return 'mob'
  if (w < 1024) return 'tab'
  return 'desk'
}

/**
 * Computes the Hero frame rectangle that sits between the floating chrome and
 * writes it to CSS custom properties on :root (only on resize, never per frame).
 */
export function applyLayout(bp: Breakpoint) {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  let left: number, right: number, top: number, bottom: number
  if (bp === 'desk') {
    left = 12 + 240 + 28
    right = 12 + 248 + 28
    top = 12 + 48 + 40
    bottom = 92 + 48
  } else if (bp === 'tab') {
    left = 28
    right = 12 + 248 + 28
    top = 12 + 48 + 40
    bottom = 92 + 48
  } else {
    left = 12
    right = 12
    top = 10 + 44 + 34
    bottom = 84 + 46
  }
  const fw = Math.max(300, vw - left - right)
  const fh = Math.max(420, vh - top - bottom)
  const u = bp === 'mob' ? Math.min(1, fw / 380) * 0.82 : Math.min(1.25, Math.max(0.62, Math.min(fw / 920, fh / 700)))
  const nameSize = bp === 'mob' ? fw * 0.205 : Math.min(fw * 0.158, fh * 0.25, vw * 0.15)

  const root = document.documentElement.style
  root.setProperty('--fx', `${left}px`)
  root.setProperty('--fy', `${top}px`)
  root.setProperty('--fw', `${fw}px`)
  root.setProperty('--fh', `${fh}px`)
  root.setProperty('--u', `${u}`)
  root.setProperty('--name-size', `${nameSize}px`)
  root.setProperty('--ox', `${left + fw / 2}px`)
  root.setProperty('--oy', `${top + fh / 2}px`)
  scene.frame.x = left
  scene.frame.y = top
  scene.frame.w = fw
  scene.frame.h = fh
  return { fw, fh, u }
}

/** Sum offsets up to `ancestor` (layout position, ignores transforms). */
export function offsetIn(el: HTMLElement, ancestor: HTMLElement) {
  let x = 0
  let y = 0
  let node: HTMLElement | null = el
  while (node && node !== ancestor) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return { x, y, w: el.offsetWidth, h: el.offsetHeight }
}
