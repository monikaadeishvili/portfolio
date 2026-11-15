/**
 * The five colour worlds and the scroll map of /build.
 * Sections and the four bubble transitions share one progress axis 0..1.
 */

export type RGB = [number, number, number]
export const hex = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

export interface World {
  id: string
  /** bubble marbling palette */
  pal: [string, string, string]
  /** soft drop shadow strength of the bubble on this canvas */
  shadow: number
}

export const WORLDS: World[] = [
  { id: 'hello', pal: ['#E8590C', '#1E1712', '#EBE2D4'], shadow: 0.16 },
  { id: 'craft', pal: ['#C6F135', '#1E1712', '#EBE2D4'], shadow: 0.4 },
  { id: 'proof', pal: ['#2DB8FF', '#16131D', '#E6F6FF'], shadow: 0.24 },
  { id: 'contact', pal: ['#FF7AD1', '#8B5CFF', '#FFD9F0'], shadow: 0.22 },
]
/** number of sections, and of transitions between them */
export const NS = WORLDS.length
export const NT = NS - 1
/** the last section (Say hello) */
export const LAST = NS - 1
/** the choreography each transition plays:
 *  0 nightfall roll · 1 slingshot (unused) · 2 split & race · 3 balloon */
export const TR_STYLE = [0, 2, 3]
export const TR_SHAPE_OF = (i: number) => TR_STYLE[i] ?? i
/** the three racers of the split */
export const SPLIT_PAL: [string, string, string] = ['#B6F03A', '#2DB8FF', '#FF7AD1']

/* ------------------------------------------------------------ scroll map */

/*
 * Raw lengths (in units of the original 2000vh page). 01 Hello grew by 0.03
 * for the "same tools → taste" beat; everything is normalised so the other
 * sections keep exactly the same absolute scroll length (SCROLL_VH grows).
 */
const RAW_W = [0.145, 0.34, 0.36, 0.098]
const RAW_TR = 0.068
const RAW_SUM = RAW_W.reduce((a, b) => a + b, 0) + RAW_TR * (RAW_W.length - 1)
export const TR_LEN = RAW_TR / RAW_SUM
const W = RAW_W.map((w) => w / RAW_SUM)
/** [start, end] of each section on the progress axis */
export const SEC: [number, number][] = []
/** [start, end] of each transition (i → i+1) */
export const TRN: [number, number][] = []
{
  let at = 0
  for (let i = 0; i < NS; i++) {
    SEC.push([at, at + W[i]])
    at += W[i]
    if (i < NT) {
      TRN.push([at, at + TR_LEN])
      at += TR_LEN
    }
  }
  // absorb rounding into the last section
  SEC[LAST][1] = 1
}

/** section-local phases */
export const PH = {
  arrive: 0.05,
  topEnd: 0.34,
  flat: 0.41,
  /** the finished top region holds flat, then the camera descends */
  descStart: 0.47,
  descEnd: 0.86,
}
export type Phases = typeof PH
/** 01 Hello: a longer top build (taste is applied piece by piece) and a real
 *  flat hold in which the Taste switch can be played with */
export const PH0: Phases = {
  arrive: 0.04,
  topEnd: 0.42,
  flat: 0.47,
  descStart: 0.57,
  descEnd: 0.87,
}
/** 02 How I think: a short top build, then a long descent whose middle region
 *  is the sideways pan through the five-step process */
export const PH2: Phases = {
  arrive: 0.04,
  topEnd: 0.2,
  flat: 0.245,
  descStart: 0.28,
  descEnd: 0.9,
}
/** 03 Proof: a short intro, then a long descent that is the sideways work strip */
export const PH3: Phases = {
  arrive: 0.04,
  topEnd: 0.17,
  flat: 0.21,
  descStart: 0.25,
  descEnd: 0.92,
}
export const phOf = (i: number): Phases => (i === 0 ? PH0 : i === 1 ? PH2 : i === 2 ? PH3 : PH)

export const secU = (i: number, p: number) => (p - SEC[i][0]) / (SEC[i][1] - SEC[i][0])
export const secP = (i: number, u: number) => SEC[i][0] + u * (SEC[i][1] - SEC[i][0])

/** which section the camera is in (transitions belong to the departing one until halfway) */
export function sectionAt(p: number) {
  for (let i = 0; i < NT; i++) {
    const mid = (TRN[i][0] + TRN[i][1]) / 2
    if (p < mid) return i
  }
  return LAST
}
/** -1 when not inside a transition */
export function transitionAt(p: number) {
  for (let i = 0; i < NT; i++) if (p >= TRN[i][0] && p <= TRN[i][1]) return i
  return -1
}

/** where a click on the ruler lands: the finished, resolved section */
export const holdOf = (i: number) => secP(i, i === LAST ? 0.96 : 0.93)
/** where a click in the navigation lands: the very start of the section */
export const topOf = (i: number) => (i === 0 ? 0 : secP(i, 0.012))

export const SCROLL_VH = Math.round(2000 * RAW_SUM)
