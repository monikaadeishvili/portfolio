/**
 * 01 Hello — "same tools → taste".
 *
 * The section opens as the competent-but-forgettable default (the "Default"
 * layer of bland twins, a plain white board on a grey canvas). Once the hero
 * Taste switch docks into its slot in headline line 2 and flips on, a radial
 * wipe expands from it: a thin electric-blue ring leads the porcelain across
 * the board and the canvas, the contours, ghost name and hairline guides
 * appear behind the front, the headline re-sets word by word in the condensed
 * face, and every other bland twin glides into the designed layout (FLIP,
 * transforms only) and is replaced by the real component. The portrait canvas
 * reads `tasteFx` and burns its own edge along the same front.
 *
 * Everything is a pure function of the taste amount T = Tscroll(p) · M, where
 * M is the manual multiplier the switch animates in the flat hold, so
 * scrubbing backwards un-applies taste exactly.
 */
import { offsetIn } from '../../../scene/layout'
import { helloName, helloTaste } from '../../bstore'
import type { Geo } from '../../camera'
import { clamp01, inOut, inOutQuad, lerp, outBack, outCubic, pieces, range, registerFx, smooth, texts, type FxEnv } from '../../runtime'
import { live } from '../../loop'
import { phOf, secU } from '../../worlds'

/** shared with the switch (clicks), the cursors (the dare) and nothing else */
export const taste = {
  /** manual target: 1 = taste on */
  target: 1,
  /** the switch may be played with right now (flat hold, wipe done) */
  can: false,
  /** the visitor has flipped it at least once */
  used: false,
  /** idle in the hold long enough to be nudged */
  nag: false,
  /** dev: stretch the manual toggle for inspection */
  slow: 1,
  /** dev: freeze the manual sweep at this amount (0 = off … 1 = on) */
  devM: null as number | null,
  toggle() {
    if (!this.can) return false
    this.target = this.target > 0.5 ? 0 : 1
    this.used = true
    this.nag = false
    return true
  },
}

/** the live front, read by the portrait (board px) */
export const tasteFx = {
  /** taste amount 0..1 (scroll × manual) */
  T: 1,
  /** front radius and origin */
  r: 1e5,
  sx: 0,
  sy: 0,
  /** the switch is being played (manual sweep) */
  manual: false,
  /** [pFlip, pWipeEnd] on the global progress */
  pFlip: 0,
  pW1: 0,
  /** distance from the origin at which the front reaches a point */
  reachT: (_d: number) => 0,
}

/* --------------------------------------------------------- timeline */

/** region-0 local times (fractions of the region's build window) */
export const T0 = {
  /** the switch has landed; it flips on and the wipe starts */
  flip: 0.2,
  /** the wipe has covered the board and the visible canvas */
  wipeEnd: 0.68,
  /** frame label re-types Untitled → 01 Hello */
  labelEnd: 0.82,
}
const GAM = 1.7
const MANUAL_S = 0.7

type Kind = 'pop' | 'tumble' | 'text' | 'head' | 'fade'
interface Twin {
  key: string
  kind: Kind
  el: HTMLElement
  /** designed counterpart (a slot for pieces, the text block for texts) */
  target: HTMLElement
  pieceId?: string
  swap?: HTMLElement | null
  words?: HTMLElement[]
  mark?: SVGPathElement | null
  /** home (default layout) and target centres + sizes, board px */
  hx: number
  hy: number
  hw: number
  hh: number
  tx: number
  ty: number
  tw: number
  th: number
  /** distance of the home / target centre from the switch */
  d: number
  dT: number
  k: number
  dir: number
  last: string
  lastT: string
  lastS: string
  lastW: Int16Array
  /** headline words: distance of each word from the switch, and of the farthest twin corner */
  wd?: Float32Array
  wFar: number
  lastM: string
}

const LBL_FROM = 'Untitled'
const LBL_TO = '01 Hello'

function labelAt(L: number) {
  if (L <= 0) return LBL_FROM
  if (L >= 1) return LBL_TO
  if (L < 0.42) return LBL_FROM.slice(0, Math.round(LBL_FROM.length * (1 - L / 0.42)))
  if (L < 0.52) return ''
  return LBL_TO.slice(0, Math.round((LBL_TO.length * (L - 0.52)) / 0.48))
}

/**
 * Wire the taste engine to a live Hello artboard. Returns the unregister fn.
 */
export function mountTaste(board: HTMLElement) {
  const q = <T extends Element = HTMLElement>(s: string) => board.querySelector<T>(s) as T
  const bg = q('.bf-bg')
  const plainBg = q('.h-plainbg')
  const disc = board.querySelector<HTMLElement>('.h-disc')
  const cv = q('.h-cv')
  const ring = q('.h-ring')
  const def = q('.h-def')
  const label = q('.bf-label')
  const lblT = q('.h-lbl-t')
  const sw = q<HTMLButtonElement>('.h-sw')
  const swWrap = q('.h-sw-wrap')
  const hint = q('.h-hint-p')
  const hdH = q('.hd-h')
  // the stage (contours, guides, ghost name) and the blue band appear inside the front
  const bgfx = q('.h-bgfx')
  const blue = q('.h-blue')
  const bandDef = q('.h-band-def')
  const band = q('.h-band')
  let cBand = ''
  let cDisc = ''
  let cBgO = ''
  let blNear = 0
  let blSpan = 1
  let cBgfx = ''
  let cBlue = ''
  // hairline guides (draw in behind the front)
  const guides = Array.from(board.querySelectorAll<HTMLElement>('.h-grid .hg')).map((el) => ({ el, v: false, a: 0, b: 0, c: 0, n: 0, d: 0, last: '' }))
  // heroes with no bland twin: they leave with the front when taste is off
  const extras = ([] as string[])
    .map((id) => board.querySelector<HTMLElement>(`[data-cid="${id}"]`))
    .filter((el): el is HTMLElement => !!el)
    .map((slot) => ({ slot, swap: slot.querySelector<HTMLElement>('.h-swap'), d: 0, last: '' }))
  const plainFar = document.querySelector<HTMLElement>('.wbg-plain')
  const addTaste = document.querySelector<HTMLElement>('.h-addtaste')

  const spec: { key: string; kind: Kind; target: string; piece?: string }[] = [
    { key: 'nav', kind: 'pop', target: '[data-cid="h-nav"]', piece: 'h-nav' },
    { key: 'ghost', kind: 'pop', target: '[data-cid="h-nav"] .h-navcta', piece: 'h-nav' },
    { key: 'badge', kind: 'pop', target: '[data-cid="h-meta"]', piece: 'h-meta' },
    { key: 'l1', kind: 'head', target: '.h-l1' },
    { key: 'l2', kind: 'head', target: '.h-l2' },
    { key: 'lead', kind: 'pop', target: '[data-cid="h-cap"]', piece: 'h-cap' },
    { key: 'cap', kind: 'pop', target: '[data-cid="h-note"]', piece: 'h-note' },
    { key: 'btn', kind: 'tumble', target: '[data-cid="h-pill"]', piece: 'h-pill' },
  ]
  // a twin whose designed counterpart is not on this layout (the phone drops two
  // captions) simply dissolves where the front passes it
  const twins: Twin[] = spec.filter((s) => board.querySelector(`[data-tw="${s.key}"]`)).map((s, i) => {
    if (!board.querySelector(s.target)) s = { key: s.key, kind: 'fade', target: `[data-tw="${s.key}"]` }
    const target = q(s.target)
    const words = s.kind === 'head' ? Array.from(target.querySelectorAll<HTMLElement>('.rw')) : undefined
    return {
      key: s.key,
      kind: s.kind,
      el: q(`[data-tw="${s.key}"]`),
      target,
      pieceId: s.piece,
      swap: s.piece ? target.querySelector<HTMLElement>(':scope > .alive > .alive-in > .h-swap') : null,
      words,
      mark: null,
      hx: 0,
      hy: 0,
      hw: 1,
      hh: 1,
      tx: 0,
      ty: 0,
      tw: 1,
      th: 1,
      d: 0,
      dT: 0,
      k: 1,
      dir: i % 2 ? 1 : -1,
      last: '',
      lastT: '',
      lastS: '',
      lastW: new Int16Array(words?.length ?? 0).fill(-1),
      wd: words ? new Float32Array(words.length) : undefined,
      wFar: 0,
      lastM: '',
    }
  })

  // geometry (board px)
  let sx = 0
  let sy = 0
  let Rmax = 3000
  /** farthest board corner from the switch: the played front covers exactly this */
  let Rvis = 1600
  let cvPad = 2400
  let geoKey = ''
  // manual multiplier + label follower + idle
  let mRaw = 1
  let lm = 1
  let idle = 0
  let landed = 0
  let lastP = -1
  // write caches
  let cCv = ''
  let cRing = ''
  let cFar = ''
  let cLbl = ''
  let cCaret = ''
  let cOn = ''
  let cNag = ''
  let cDef = ''
  let cAdd = ''
  let cHd = ''
  let hdX = 0
  let hdY = 0

  const radius = (T: number) => (T <= 0 ? 0 : Rmax * Math.pow(T, GAM))
  const reachT = (d: number) => Math.pow(clamp01(Math.max(0, d) / Rmax), 1 / GAM)

  const measure = (g: Geo) => {
    const b = g.boards[0]
    const s = pieces.get('h-switch')
    if (s) {
      const o = offsetIn(s.slot, board)
      sx = o.x + o.w / 2
      sy = o.y + o.h / 2
    }
    if (blue) {
      const o = offsetIn(blue, board)
      const ny = Math.max(o.y - sy, 0, sy - o.y - o.h)
      const nx = Math.max(o.x - sx, 0, sx - o.x - o.w)
      blNear = Math.hypot(nx, ny)
      const fy = Math.max(Math.abs(o.y - sy), Math.abs(o.y + o.h - sy))
      const fx = Math.max(Math.abs(o.x - sx), Math.abs(o.x + o.w - sx))
      blSpan = Math.max(1, Math.hypot(fx, fy) - blNear)
    }
    cBgfx = cBlue = ''
    const corners = [
      [0, 0],
      [b.w, 0],
      [0, b.h],
      [b.w, b.h],
    ]
    const far = Math.max(...corners.map(([x, y]) => Math.hypot(x - sx, y - sy)))
    Rmax = far + (g.narrow ? 700 : 1300)
    Rvis = far + 24
    if (disc) {
      disc.style.width = disc.style.height = `${(Rvis * 2).toFixed(0)}px`
      disc.style.left = `${(sx - Rvis).toFixed(1)}px`
      disc.style.top = `${(sy - Rvis).toFixed(1)}px`
    }
    cDisc = cBgO = ''
    // the near canvas only has to cover what the camera sees around the board;
    // the far field (.wbg-plain) covers the rest. Kept small: it is a GPU layer.
    cvPad = g.narrow ? 900 : 1400
    cv.style.left = `${-cvPad}px`
    cv.style.top = `${-cvPad}px`
    cv.style.width = `${b.w + cvPad * 2}px`
    cv.style.height = `${b.h + cvPad * 2}px`
    twins.forEach((t) => {
      const h = offsetIn(t.el, board)
      const o = offsetIn(t.target, board)
      t.hw = Math.max(1, h.w)
      t.hh = Math.max(1, h.h)
      t.hx = h.x + h.w / 2
      t.hy = h.y + h.h / 2
      t.tw = Math.max(1, o.w)
      t.th = Math.max(1, o.h)
      t.tx = o.x + o.w / 2
      t.ty = o.y + o.h / 2
      t.d = Math.hypot(t.hx - sx, t.hy - sy)
      t.dT = Math.hypot(t.tx - sx, t.ty - sy)
      // pieces: grow the twin to fit its slot; texts: designed → twin ratio
      t.k = t.kind === 'text' || t.kind === 'head' ? Math.min(t.hw / t.tw, t.hh / t.th) : Math.min(2, Math.max(0.5, Math.min(t.tw / t.hw, t.th / t.hh)))
      t.last = t.lastT = t.lastS = t.lastM = ''
      t.lastW.fill(-1)
      if (t.kind === 'head') {
        t.words?.forEach((w, j) => {
          const ow = offsetIn(w, board)
          t.wd![j] = Math.hypot(ow.x + ow.w / 2 - sx, ow.y + ow.h / 2 - sy)
        })
        t.wFar = Math.max(...[[h.x, h.y], [h.x + h.w, h.y], [h.x, h.y + h.h], [h.x + h.w, h.y + h.h]].map(([x, y]) => Math.hypot(x - sx, y - sy))) + 4
      }
    })
    if (hdH) {
      const oh = offsetIn(hdH, board)
      hdX = oh.x
      hdY = oh.y
    }
    cHd = ''
    // guides: where the front first touches each hairline, and its span
    guides.forEach((g) => {
      const o = offsetIn(g.el, board)
      g.v = o.h > o.w
      g.a = g.v ? o.y : o.x
      g.b = g.v ? o.y + o.h : o.x + o.w
      const across = g.v ? o.x + o.w / 2 : o.y + o.h / 2
      g.c = Math.min(g.b, Math.max(g.a, g.v ? sy : sx))
      g.n = Math.abs(across - (g.v ? sx : sy))
      g.d = g.n
      g.last = ''
    })
    extras.forEach((x) => {
      const o = offsetIn(x.slot, board)
      x.d = Math.hypot(o.x + o.w / 2 - sx, o.y + o.h / 2 - sy)
      x.last = ''
    })
    // the bubble waits beside the scroll hint in the final hold
    if (hint) {
      const p = hint.querySelector<HTMLElement>('.h-hint-p') ?? hint
      const op = offsetIn(p, board)
      g.hint0 = g.narrow
        ? { x: b.x + b.w - 64, y: b.y + op.y - 62 }
        : { x: b.x + Math.min(b.w + 150, op.x + op.w + 190), y: b.y + op.y + op.h * 0.5 }
    }
    geoKey = ''
    cCv = cRing = cFar = cDef = ''
  }

  const hideFar = () => {
    if (plainFar && cFar !== '0') {
      cFar = '0'
      plainFar.style.opacity = '0'
    }
    if (addTaste && cAdd !== '0') {
      cAdd = '0'
      addTaste.style.opacity = '0'
    }
  }

  const update = (e: FxEnv) => {
    if (!e.near) return hideFar()
    const p = e.p
    const [A, B] = e.win(0)
    const L = B - A || 1
    const pFlip = A + T0.flip * L
    const pW1 = A + T0.wipeEnd * L
    const ph = phOf(0)
    const u = secU(0, p)

    // texts: tell the layers panel (and the overlap check) when each is re-set
    const gk = `${A}|${B}|${Rmax}`
    if (gk !== geoKey) {
      geoKey = gk
      const at = (d: number) => pFlip + reachT(d) * (pW1 - pFlip)
      const set = (id: string, d0: number, d1: number) => {
        const t = texts.get(id)
        if (!t) return
        t.p0 = at(d0)
        t.p1 = at(d1)
      }
      const tw = (k: string) => twins.find((t) => t.key === k)
      const dl = Math.min(tw('l1')?.d ?? 0, tw('l2')?.d ?? 0)
      set('h-title', dl - 60, dl + 500)
    }

    /* ---- taste amount */
    const Ts = range(pFlip, pW1, p)
    const inHold = !e.reduced && Ts >= 1 && u >= ph.flat - 0.012 && u <= ph.descStart + 0.004
    taste.can = inHold
    if (!inHold) taste.target = 1
    const goal = taste.target > 0.5 ? 1 : 0
    if (mRaw !== goal) mRaw = goal > mRaw ? Math.min(goal, mRaw + e.dt / (MANUAL_S * taste.slow)) : Math.max(goal, mRaw - e.dt / (MANUAL_S * taste.slow))
    if (import.meta.env.DEV && taste.devM != null) mRaw = taste.devM
    const M = inOutQuad(mRaw)
    const manual = M < 0.999
    const T = Ts * M
    // scrolled: the front accelerates out past the board (scrub feel). Played:
    // the front starts moving on the very first frame and decelerates into
    // place, covering only the board, so the visitor sees it react instantly.
    const r = manual ? Rvis * (goal === 1 ? outCubic(mRaw) : 1 - outCubic(1 - mRaw)) : radius(T)
    /** how far the front has crossed the board (0 = at the switch, 1 = past the far corner) */
    const frac = T >= 1 ? 1 : clamp01(r / Rvis)
    tasteFx.T = T
    tasteFx.r = T >= 1 ? 1e5 : r
    tasteFx.sx = sx
    tasteFx.sy = sy
    tasteFx.manual = manual
    // the blue band rises as a fill at the very end of the hero's build (hidden in the arrive view)
    const bv = e.reduced ? 1 : smooth(A + 0.86 * L, B, p)
    const bk = bv >= 1 ? 'none' : bv <= 0 ? 'h' : `inset(${((1 - bv) * 100).toFixed(2)}% 0 0 0)`
    if (band && bk !== cBand) {
      cBand = bk
      band.style.clipPath = bk === 'none' ? 'inset(0 0 0 0)' : bk === 'h' ? 'inset(100% 0 0 0)' : bk
    }
    tasteFx.pFlip = pFlip
    tasteFx.pW1 = pW1
    tasteFx.reachT = reachT

    /* ---- switch + idle nudge */
    const on = p >= pFlip && goal === 1 ? '1' : '0'
    if (on !== cOn) {
      cOn = on
      sw.dataset.on = on
      sw.setAttribute('aria-checked', on === '1' ? 'true' : 'false')
    }
    if (inHold && !taste.used && M >= 1 && Math.abs(p - lastP) < 1e-6) idle += e.dt
    else idle = 0
    lastP = p
    // the cursor's dare waits for a real pause; the switch's own "try me"
    // + shake starts as soon as taste has landed (scrolling or not)
    taste.nag = idle > 8
    if (inHold && !taste.used && M >= 1) landed += e.dt
    else landed = 0
    const nag = landed > 0.45 ? '1' : '0'
    if (nag !== cNag) {
      cNag = nag
      swWrap.dataset.nag = nag
    }

    /* ---- the wipe: board colour (clip), ink ring, canvas (fade), far field
       Nothing here is ever switched off with `visibility` or `clip-path: none`:
       either one makes the browser destroy the layer (or its clip mask) and
       rebuild + re-rasterise it the next time it is needed, and that rebuild is
       a visible blink of the whole board at the start and end of every sweep.
       "Fully on" is a clip far larger than the board; "off" is opacity 0. */
    // board colour: a disc scaled from the switch (compositor only). Once the
    // sweep is complete the real designed board (its own edge + shadow) is
    // shown and the plain board under it is faded out, in the same frame.
    const discK = T >= 1 ? 'on' : frac.toFixed(4)
    if (disc && discK !== cDisc) {
      cDisc = discK
      disc.style.transform = `scale(${discK === 'on' ? 1 : frac.toFixed(4)})`
    }
    const bo = T >= 1 ? '1' : '0'
    if (bo !== cBgO) {
      cBgO = bo
      bg.style.opacity = bo
      // the plain board's corners/shadow must not peek out from under the designed one
      plainBg.style.opacity = bo === '1' ? '0' : ''
    }
    // the stage dressing (contours, ghost name) surfaces behind the front
    const fxO = T >= 1 ? 1 : smooth(0.12, 0.7, frac)
    const fxK = fxO.toFixed(3)
    if (bgfx && fxK !== cBgfx) {
      cBgfx = fxK
      bgfx.style.opacity = fxK
    }
    // the blue band fills in as the front crosses it
    const blO = T >= 1 ? 1 : smooth(0, 1, (r - blNear) / Math.min(blSpan, 520))
    const blK = blO.toFixed(3)
    if (blue && blK !== cBlue) {
      cBlue = blK
      blue.style.setProperty('--blue-a', blK)
      if (bandDef) bandDef.style.opacity = blO >= 1 ? '0' : (1 - blO).toFixed(3)
    }
    // the near canvas fades out behind the front (opacity only: animating a
    // radial mask here repainted a multi-megapixel layer every frame)
    const cvO = T >= 1 ? 0 : 1 - smooth(0.35, 1, frac)
    const cvK = cvO < 0.004 ? '0' : cvO.toFixed(3)
    if (cvK !== cCv) {
      cCv = cvK
      cv.style.opacity = cvK
    }
    const ringK = T <= 0 || T >= 1 || r < 3 ? 'off' : r.toFixed(1)
    if (ringK !== cRing) {
      if (cRing === '') ring.style.visibility = 'visible'
      if (ringK === 'off') ring.style.opacity = '0'
      else {
        ring.style.opacity = '1'
        const D = r * 2
        ring.style.width = `${D.toFixed(1)}px`
        ring.style.height = `${D.toFixed(1)}px`
        ring.style.transform = `translate3d(${(sx - r).toFixed(1)}px, ${(sy - r).toFixed(1)}px, 0)`
      }
      cRing = ringK
    }
    if (plainFar) {
      const fo = T >= 1 ? 0 : 1 - smooth(0.5, 1, frac)
      const fk = fo < 0.005 ? '0' : fo.toFixed(3)
      if (fk !== cFar) {
        cFar = fk
        plainFar.style.opacity = fk
      }
    }

    // "scroll to add taste" until the visitor starts scrolling
    if (addTaste) {
      const ao = (1 - range(A * 0.4, A + 0.1 * L, p)) * (live.intro >= 1 ? 1 : live.intro)
      const ak = ao < 0.005 ? '0' : ao.toFixed(2)
      if (ak !== cAdd) {
        cAdd = ak
        addTaste.style.opacity = ak
      }
    }

    /* ---- frame label: Untitled → 01 Hello, typed when the wipe completes */
    const lpS = range(pW1, A + T0.labelEnd * L, p)
    const lmGoal = goal === 1 && !manual ? 1 : 0
    if (lm !== lmGoal) lm = lmGoal > lm ? Math.min(1, lm + e.dt / 0.45) : Math.max(0, lm - e.dt / 0.3)
    const Lb = lpS * lm
    const txt = labelAt(Lb)
    if (txt !== cLbl) {
      cLbl = txt
      lblT.textContent = txt
      label.dataset.untitled = Lb < 0.5 ? '1' : '0'
      helloName.set(txt || ' ')
    }
    const caret = Lb > 0 && Lb < 1 ? '1' : '0'
    if (caret !== cCaret) {
      cCaret = caret
      label.dataset.typing = caret
    }
    helloTaste.set(Lb >= 0.5)

    /* ---- hairline guides draw along the front (a touch behind it) */
    for (const gd of guides) {
      const e2 = r * 0.94
      const ext = e2 > gd.n ? Math.sqrt(e2 * e2 - gd.n * gd.n) : -1
      const k = T >= 1 ? 'full' : ext < 0 ? 'none' : `${Math.max(0, gd.c - ext - gd.a).toFixed(1)}|${Math.max(0, gd.b - (gd.c + ext)).toFixed(1)}`
      if (k === gd.last) continue
      gd.last = k
      if (k === 'none') gd.el.style.visibility = 'hidden'
      else {
        gd.el.style.visibility = 'visible'
        if (k === 'full') gd.el.style.clipPath = 'none'
        else {
          const [i0, i1] = k.split('|')
          gd.el.style.clipPath = gd.v ? `inset(${i0}px 0 ${i1}px 0)` : `inset(0 ${i1}px 0 ${i0}px)`
        }
      }
    }

    /* ---- twinless heroes (tools pill, label chips) follow the front when played */
    for (const x of extras) {
      const sm = manual ? clamp01((r - x.d + 70) / 180) : 1
      const k = sm >= 1 ? '' : sm.toFixed(3)
      if (k === x.last || !x.swap) continue
      x.last = k
      x.swap.style.opacity = k === '' ? '' : smooth(0.1, 1, sm).toFixed(3)
      x.swap.style.transform = k === '' ? '' : `scale(${lerp(0.9, 1, sm).toFixed(3)})`
      x.swap.style.visibility = sm < 0.005 ? 'hidden' : ''
    }

    /* ---- twins: glide into the designed layout, then get replaced */
    let allGone = true
    // the bland headline block is erased by the front
    const hk = T >= 1 ? 'off' : r < 1 ? 'full' : r.toFixed(1)
    if (hdH && hk !== cHd) {
      cHd = hk
      const m = hk === 'full' ? 'linear-gradient(#000, #000)' : hk === 'off' ? 'linear-gradient(transparent, transparent)' : `radial-gradient(circle at ${(sx - hdX).toFixed(1)}px ${(sy - hdY).toFixed(1)}px, transparent ${(r * 0.985).toFixed(1)}px, #000 ${(r * 0.985 + 1).toFixed(1)}px)`
      hdH.style.maskImage = m
      hdH.style.webkitMaskImage = m
    }
    for (const t of twins) {
      const dx = t.tx - t.hx
      const dy = t.ty - t.hy
      if (t.kind === 'head') {
        // the headline re-sets exactly where the front passes: the bland line
        // is erased by the front (mask on its block), the designed words rise
        // through their masks just behind it (the inline heroes never move)
        const gone = r > t.wFar
        if (!gone) allGone = false
        const tk = gone ? 'h' : 'v'
        if (tk !== t.last) {
          t.last = tk
          t.el.style.visibility = gone ? 'hidden' : ''
        }
        const W = t.words
        if (W && W.length && t.wd) {
          for (let j = 0; j < W.length; j++) {
            const wq = e.reduced ? (r > t.wd[j] ? 1 : 0) : clamp01((r * 0.92 - t.wd[j] + 10) / 220)
            const qi = Math.round(wq * 48)
            if (qi === t.lastW[j]) continue
            t.lastW[j] = qi
            const w = qi / 48
            const eb = outBack(w, 1.1)
            const inner = W[j].firstElementChild as HTMLElement | null
            W[j].style.opacity = w >= 1 ? '1' : smooth(0, 0.5, w).toFixed(3)
            if (inner) inner.style.transform = w >= 1 ? '' : `translate3d(0, ${((1 - eb) * 100).toFixed(1)}%, 0)`
          }
        }
        continue
      }
      if (t.kind === 'fade') {
        const qf = clamp01((r - t.d + 40) / 260)
        const fk = qf >= 1 ? 'h' : qf.toFixed(3)
        if (fk !== t.last) {
          t.last = fk
          t.el.style.visibility = fk === 'h' ? 'hidden' : ''
          t.el.style.opacity = fk === 'h' ? '0' : (1 - smooth(0, 1, qf)).toFixed(3)
        }
        if (qf < 1) allGone = false
        continue
      }
      if (t.kind === 'text') {
        const qt = clamp01((r - t.d + 60) / 560)
        // hand-off: the bland twin dissolves while drifting a third of the way
        // toward the designed spot; the designed block takes over from there
        // (no moment where both are legible)
        const HO = 0.34
        const e1 = outCubic(clamp01(qt / 0.5)) * HO
        const tOp = 1 - smooth(0.02, 0.3, qt)
        const tS = lerp(1, 1.08, e1 / HO)
        const tk = tOp < 0.005 ? 'h' : `${(dx * e1).toFixed(1)}|${(dy * e1).toFixed(1)}|${tS.toFixed(3)}|${tOp.toFixed(3)}`
        if (tk !== t.last) {
          t.last = tk
          if (tk === 'h') t.el.style.opacity = '0'
          else {
            t.el.style.opacity = tOp.toFixed(3)
            t.el.style.transform = `translate3d(${(dx * e1).toFixed(1)}px, ${(dy * e1).toFixed(1)}px, 0) scale(${tS.toFixed(3)})`
          }
        }
        if (tOp > 0.005) allGone = false
        const e2 = inOut(range(0.18, 1, qt))
        const rem = (1 - HO) * (1 - e2)
        const dS = lerp(Math.max(t.k, 0.72), 1, e2)
        const dOp = smooth(0.2, 0.42, qt)
        const dk = qt >= 1 ? 'done' : `${(-dx * rem).toFixed(1)}|${(-dy * rem).toFixed(1)}|${dS.toFixed(3)}|${dOp.toFixed(3)}`
        if (dk !== t.lastT) {
          t.lastT = dk
          if (dk === 'done') {
            t.target.style.opacity = '1'
            t.target.style.transform = 'none'
          } else {
            t.target.style.opacity = dOp.toFixed(3)
            t.target.style.transform = `translate3d(${(-dx * rem).toFixed(1)}px, ${(-dy * rem).toFixed(1)}px, 0) scale(${dS.toFixed(3)})`
          }
        }
        // "7+ years" gets its marker stroke once the line has landed
        if (t.mark) {
          const md = outCubic(range(0.55, 1, qt))
          const mk = md.toFixed(3)
          if (mk !== t.lastM) {
            t.lastM = mk
            t.mark.style.strokeDashoffset = (1 - md).toFixed(3)
          }
        }
        continue
      }

      // pieces: glide while the front passes the twin's home
      const qg = clamp01((r - t.d + 80) / 420)
      const eg = inOut(qg)
      let x = dx * eg
      let y = dy * eg
      let z = 0
      let rot = 0
      let scx = lerp(1, t.k, eg)
      let scy = scx
      let op = 1
      const c = t.pieceId ? pieces.get(t.pieceId) : undefined
      const D = c ? c.p1 - c.p0 : 0
      let sm = 1
      if (manual) {
        // the switch plays it back and forth: the front swaps twin ↔ component
        sm = clamp01((r - t.dT + 70) / 180)
        op = 1 - sm
        const ps = lerp(1, 0.94, sm)
        scx *= ps
        scy *= ps
      } else if (c) {
        if (t.kind === 'tumble') {
          // knocked off the artboard by the hero landing on it
          const kn = range(c.p0 + 0.9 * D, c.p1 + 0.55 * D, p)
          if (kn > 0) {
            x += t.dir * 340 * kn
            y += -150 * kn + 560 * kn * kn
            z += 170 * Math.sin(Math.PI * Math.min(1, kn))
            rot += t.dir * 220 * kn
            op = 1 - smooth(0.55, 1, kn)
          }
        } else {
          // replaced by the bubble-born component: a quick pop
          const kn = range(c.p0 + 0.8 * D, c.p1 + 0.12 * D, p)
          if (kn > 0) {
            scx *= 1 - 0.14 * kn
            scy *= 1 - 0.14 * kn
            op = 1 - smooth(0, 0.85, kn)
          }
        }
      }
      if (op > 0.005) allGone = false
      const tk = op < 0.005 ? 'h' : `${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}|${rot.toFixed(1)}|${scx.toFixed(3)}|${scy.toFixed(3)}|${op.toFixed(3)}`
      if (tk !== t.last) {
        t.last = tk
        if (tk === 'h') t.el.style.visibility = 'hidden'
        else {
          t.el.style.visibility = ''
          t.el.style.opacity = op >= 0.995 ? '' : op.toFixed(3)
          t.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${scx.toFixed(3)}, ${scy.toFixed(3)})`
        }
      }
      // the designed component swaps back and forth with it (manual only)
      if (t.swap) {
        const sk = sm >= 1 ? '' : sm.toFixed(3)
        if (sk !== t.lastS) {
          t.lastS = sk
          t.swap.style.opacity = sk === '' ? '' : sm.toFixed(3)
          t.swap.style.transform = sk === '' ? '' : `scale(${lerp(0.94, 1, sm).toFixed(3)})`
          t.swap.style.visibility = sm < 0.005 ? 'hidden' : ''
        }
      }
    }
    const dk = allGone ? 'h' : ''
    if (dk !== cDef) {
      cDef = dk
      def.style.opacity = allGone ? '0' : ''
    }
  }

  return registerFx({ id: 'hello-taste', section: 0, measure, update })
}
