import type { Breakpoint } from '../scene/store'
import type { Lay } from './frames'
import type { Rect } from './timeline'

/* ------------------------------------------------------------ layout */

export function viewFor(bp: Breakpoint): { view: Rect; lay: Lay } {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  let l: number, r: number, t: number, b: number
  if (bp === 'desk') [l, r, t, b] = [12 + 240 + 28, 12 + 248 + 28, 12 + 48 + 34, 112]
  else if (bp === 'tab') [l, r, t, b] = [24, 12 + 248 + 24, 12 + 48 + 30, 108]
  else [l, r, t, b] = [12, 12, 10 + 44 + 26, 92]
  const view = { x: l, y: t, w: Math.max(240, vw - l - r), h: Math.max(320, vh - t - b) }
  const lay: Lay = bp === 'mob' ? 'narrow' : view.w / view.h > 1.12 ? 'wide' : 'tall'
  return { view, lay }
}

export function frameDims(lay: Lay, view: Rect) {
  if (lay === 'wide') return { fw: 1120, fh: 720 }
  if (lay === 'tall') return { fw: 760, fh: 1000 }
  return { fw: 380, fh: Math.max(640, Math.round((view.h / view.w) * 380)) }
}

