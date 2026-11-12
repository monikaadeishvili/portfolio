/** discrete Page 2 state for React chrome (changes rarely; the loop sets it) */
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

export type InspState = 'waiting' | 'flying' | 'placed' | 'inside'

export const chapterCh = channel(0)
/** bumps whenever any piece's placed flag (or a region's progress) changes */
export const placedVer = channel(0)
/** what the inspector shows: a piece id, 'bubble', or null (the frame) */
export const inspSel = channel<string | null>(null)
export const inspState = channel<InspState>('waiting')
/** bubble mood during transitions (null while it hosts a section) */
export const moodCh = channel<string | null>(null)
/** region currently building in the active section */
export const regionCh = channel(0)

export const bsinks = {
  x: null as HTMLElement | null,
  y: null as HTMLElement | null,
  z: null as HTMLElement | null,
  r: null as HTMLElement | null,
  w: null as HTMLElement | null,
  h: null as HTMLElement | null,
  fill: null as HTMLElement | null,
  hex: null as HTMLElement | null,
}

/** sub-ticks on the chapter ruler: where each region starts building */
export const rulerSubs = channel<number[]>([])

/** 01 Hello: the frame's name ("Untitled" until taste is applied) and taste on/off */
export const helloName = channel('01 Hello')
export const helloTaste = channel(true)
