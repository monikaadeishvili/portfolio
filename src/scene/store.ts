/**
 * Shared, framework-free scene state. Everything that changes per frame lives
 * here as plain mutable objects (read by the single ticker loop), never in
 * React state. React only re-renders on discrete changes (tool, hover).
 */

export type LayerKind = 'frame' | 'text' | 'component' | 'organism' | 'piece' | 'note'
export type Tool = 'move' | 'frame' | 'shape' | 'pen' | 'text' | 'hand' | 'comment' | 'picker'
export type Breakpoint = 'desk' | 'tab' | 'mob'

export interface LayerInfo {
  id: string
  name: string
  kind: LayerKind
  color: string
  /** element whose rect is measured for the inspector */
  el: HTMLElement | null
  /** element that receives the .is-hover class */
  hoverEl?: HTMLElement | null
  /** element carrying the GSAP transform (z, rotation) */
  liftEl?: HTMLElement | null
  baseRotation?: number
}

export const registry = new Map<string, LayerInfo>()

export function register(info: LayerInfo) {
  registry.set(info.id, info)
  return () => {
    if (registry.get(info.id) === info) registry.delete(info.id)
  }
}

/* ---------------------------------------------------------------- scene */

export const scene = {
  p: 0,
  introDone: false,
  reduced: false,
  bp: 'desk' as Breakpoint,
  fine: true,
  /** frame geometry in CSS px (layout coordinates, untransformed) */
  frame: { x: 0, y: 0, w: 0, h: 0, bh: 0 },
}

/* ------------------------------------------------------------ pointer */

export const pointer = {
  x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
  y: typeof window === 'undefined' ? 0 : window.innerHeight * 0.4,
  inCanvas: false,
  overLink: false,
  down: false,
  moved: false,
}

/* --------------------------------------------------------- tiny pubsub */

type Fn<T> = (v: T) => void

function channel<T>(initial: T) {
  let value = initial
  const subs = new Set<Fn<T>>()
  return {
    get: () => value,
    set(v: T) {
      if (Object.is(v, value)) return
      value = v
      subs.forEach((s) => s(v))
    },
    sub(fn: Fn<T>) {
      subs.add(fn)
      return () => {
        subs.delete(fn)
      }
    },
  }
}

/** id of the layer the visitor is hovering (canvas or layers panel) */
export const hover = channel<string | null>(null)
export const tool = channel<Tool>('move')

/* -------------------------------------------------- DOM sinks for the loop */

export const ui = {
  zoom: null as HTMLElement | null,
  /** scroll the page to y over `duration` s (0 = jump); `steady` = constant speed (the Play button) */
  scrollTo: null as null | ((y: number, duration: number, steady?: boolean) => void),
}

/** scroll length of the story itself (the five sections), excluding the
 *  After hours trip that hangs below it */
export function storyMax() {
  const sp = typeof document === 'undefined' ? null : document.querySelector<HTMLElement>('.scroll-spacer')
  const vh = window.innerHeight
  return sp ? Math.max(1, sp.offsetTop + sp.offsetHeight - vh) : Math.max(1, document.documentElement.scrollHeight - vh)
}

/** cached rects for the current frame (filled in the loop's read phase) */
export const rectCache = new Map<string, DOMRect>()
