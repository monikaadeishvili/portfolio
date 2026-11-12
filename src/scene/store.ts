/**
 * Shared, framework-free scene state. Everything that changes per frame lives
 * here as plain mutable objects (read by the single ticker loop), never in
 * React state. React only re-renders on discrete changes (phase, tool, hover).
 */

export type LayerKind = 'frame' | 'text' | 'component' | 'organism' | 'piece' | 'note'
export type Phase = 'hero' | 'organism' | 'about'
export type Tool = 'move' | 'frame' | 'shape' | 'pen' | 'text' | 'hand' | 'comment'
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

export interface BallState {
  /** absorption / emission amount 0..1 */
  a: number
  /** radius factor 0..1 */
  r: number
}

export const scene = {
  p: 0,
  /** 0..1 how "lifted" the world is (drives the hop wave) */
  lift: 0,
  cam: { rx: 0, rz: 0, s: 1, pan: 0, zoom: 1 },
  org: { vis: 0, stretch: 0, mass: 1, home: 0, swap: 0, park: 0 },
  creatureBalls: [] as BallState[],
  pieceBalls: [] as BallState[],
  landed: 0,
  introDone: false,
  reduced: false,
  bp: 'desk' as Breakpoint,
  fine: true,
  /** frame geometry in CSS px (layout coordinates, untransformed) */
  frame: { x: 0, y: 0, w: 0, h: 0, bh: 0 },
}

export function phaseFor(p: number): Phase {
  if (p < 0.4) return 'hero'
  if (p < 0.6) return 'organism'
  return 'about'
}

export function moodFor(p: number): string {
  if (p < 0.08) return 'curious'
  if (p < 0.3) return 'bouncy'
  if (p < 0.72) return 'merging…'
  return 'home'
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
/** id the story currently "selects" when nothing is hovered */
export const storySel = channel<string>('name')
export const phase = channel<Phase>('hero')
export const tool = channel<Tool>('move')
export const landedCount = channel<number>(0)
export const mood = channel<string>('curious')
export const hint = channel<{ text: string; id: number } | null>(null)

let hintId = 0
let hintTimer = 0
export function showHint(text: string) {
  window.clearTimeout(hintTimer)
  hint.set({ text, id: ++hintId })
  hintTimer = window.setTimeout(() => hint.set(null), 2600)
}

/* ------------------------------------------------------------- events */

/** fired when the last creature lands in the intro, or a creature is absorbed */
export const kicks = {
  organism: 0,
  ripple: [] as { x: number; y: number; t: number }[],
}

/* -------------------------------------------------- DOM sinks for the loop */

export interface InspectorSinks {
  x: HTMLElement | null
  y: HTMLElement | null
  w: HTMLElement | null
  h: HTMLElement | null
  r: HTMLElement | null
  z: HTMLElement | null
  hex: HTMLElement | null
  op: HTMLElement | null
  swatch: HTMLElement | null
}

export const ui = {
  zoom: null as HTMLElement | null,
  ring: null as SVGCircleElement | null,
  playPct: null as HTMLElement | null,
  scrollTo: null as null | ((y: number, duration: number) => void),
  insp: { x: null, y: null, w: null, h: null, r: null, z: null, hex: null, op: null, swatch: null } as InspectorSinks,
}

/** cached rects for the current frame (filled in the loop's read phase) */
export const rectCache = new Map<string, DOMRect>()
