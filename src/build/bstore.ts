/** discrete Page 2 state for React chrome (changes rarely; the loop sets it) */
import type { LifeState } from '../ui/Alive'

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

export const chapterCh = channel(0)
/** bumps whenever any component's placed flag changes */
export const placedVer = channel(0)
/** component the inspector shows: hovered, else the one travelling */
export const inspSel = channel<string | null>(null)
export const inspState = channel<LifeState>('roaming')

export const bsinks = {
  x: null as HTMLElement | null,
  y: null as HTMLElement | null,
  z: null as HTMLElement | null,
  r: null as HTMLElement | null,
  w: null as HTMLElement | null,
  h: null as HTMLElement | null,
}
