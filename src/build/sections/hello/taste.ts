/**
 * 01 Hello — "same tools → taste".
 *
 * The section opens as the competent-but-forgettable default (the "Default"
 * layer of bland twins, a plain white board on a grey canvas). Once the hero
 * Taste switch docks into the nav and flips on, a radial wipe expands from it:
 * an ink ring leads the colour across the board and the canvas, and as the
 * front passes each element its bland twin glides into the designed layout
 * (FLIP, transforms only) and is then replaced by the real component.
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
  toggle() {
    if (!this.can) return false
    this.target = this.target > 0.5 ? 0 : 1
    this.used = true
    this.nag = false
    return true
  },
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

type Kind = 'pop' | 'tumble' | 'squash' | 'text'
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
  const cv = q('.h-cv')
  const ring = q('.h-ring')
  const def = q('.h-def')
  const label = q('.bf-label')
  const lblT = q('.h-lbl-t')
  const sw = q<HTMLButtonElement>('.h-sw')
  const swWrap = q('.h-sw-wrap')
  const shards = Array.from(board.querySelectorAll<HTMLElement>('.hd-shard'))
  const hint = q('.h-hint')
  const tipSwap = q('[data-cid="h-tip"] .h-swap')
  let cTip = ''
  const plainFar = document.querySelector<HTMLElement>('.wbg-plain')
  const addTaste = document.querySelector<HTMLElement>('.h-addtaste')

  const spec: { key: string; kind: Kind; target: string; piece?: string }[] = [
    { key: 'nav', kind: 'pop', target: '[data-cid="h-nav"]', piece: 'h-nav' },
    { key: 'badge', kind: 'pop', target: '[data-cid="h-badge"]', piece: 'h-badge' },
    { key: 'l1', kind: 'text', target: '.h-l1' },
    { key: 'l2', kind: 'text', target: '.h-l2' },
    { key: 'lead', kind: 'text', target: '.h-lead' },
    { key: 'intro', kind: 'text', target: '.h-intro' },
    { key: 'btn', kind: 'tumble', target: '[data-cid="h-btn"]', piece: 'h-btn' },
    { key: 'ghost', kind: 'pop', target: '[data-cid="h-ghost"]', piece: 'h-ghost' },
    { key: 'img', kind: 'squash', target: '[data-cid="h-deck"]', piece: 'h-deck' },
  ]
  const twins: Twin[] = spec.map((s, i) => {
    const target = q(s.target)
    const words = s.kind === 'text' ? Array.from(target.querySelectorAll<HTMLElement>('.rw-in')) : undefined
    return {
      key: s.key,
      kind: s.kind,
      el: q(`[data-tw="${s.key}"]`),
      target,
      pieceId: s.piece,
      swap: s.piece ? target.querySelector<HTMLElement>('.h-swap') : null,
      words,
      mark: s.key === 'lead' ? target.querySelector<SVGPathElement>('.h-mark path') : null,
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
      lastM: '',
    }
  })

  // geometry (board px)
  let sx = 0
  let sy = 0
  let Rmax = 3000
  let cvPad = 2400
  let geoKey = ''
  // manual multiplier + label follower + idle
  let mRaw = 1
  let lm = 1
  let idle = 0
  let lastP = -1
  // write caches
  let cBg = ''
  let cCv = ''
  let cRing = ''
  let cFar = ''
  let cLbl = ''
  let cCaret = ''
  let cOn = ''
  let cNag = ''
  let cDef = ''
  let cSh = ''
  let cAdd = ''

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
    const corners = [
      [0, 0],
      [b.w, 0],
      [0, b.h],
      [b.w, b.h],
    ]
    const far = Math.max(...corners.map(([x, y]) => Math.hypot(x - sx, y - sy)))
    Rmax = far + (g.narrow ? 700 : 1300)
    cvPad = g.narrow ? 1600 : 2600
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
      t.k = t.kind === 'text' ? Math.min(t.hw / t.tw, t.hh / t.th) : Math.min(2, Math.max(0.5, Math.min(t.tw / t.hw, t.th / t.hh)))
      t.last = t.lastT = t.lastS = t.lastM = ''
      t.lastW.fill(-1)
    })
    // squash shards burst from the placeholder's landing spot
    const img = twins.find((t) => t.key === 'img')!
    shards.forEach((el) => {
      el.style.left = `${img.tx}px`
      el.style.top = `${img.ty}px`
    })
    cSh = ''
    // the bubble waits beside the scroll hint in the final hold
    if (hint) {
      const o = offsetIn(hint, board)
      g.hint0 = g.narrow
        ? { x: b.x + b.w - 74, y: b.y + o.y + o.h + 58 }
        : { x: b.x + Math.min(b.w - 120, o.x + o.w + 150), y: b.y + o.y + o.h * 0.5 }
    }
    geoKey = ''
    cBg = cCv = cRing = cFar = cDef = ''
  }

  const hideFar = () => {
    if (plainFar && cFar !== '0') {
      cFar = '0'
      plainFar.style.opacity = '0'
      plainFar.style.visibility = 'hidden'
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
      const tw = (k: string) => twins.find((t) => t.key === k)!
      set('h-title', tw('l1').d - 60, tw('l2').d + 460)
      set('h-lead', tw('lead').d - 60, tw('lead').d + 460)
      set('h-intro', tw('intro').d - 60, tw('intro').d + 460)
    }

    /* ---- taste amount */
    const Ts = range(pFlip, pW1, p)
    const inHold = !e.reduced && Ts >= 1 && u >= ph.flat - 0.012 && u <= ph.descStart + 0.004
    taste.can = inHold
    if (!inHold) taste.target = 1
    const goal = taste.target > 0.5 ? 1 : 0
    if (mRaw !== goal) mRaw = goal > mRaw ? Math.min(goal, mRaw + e.dt / (MANUAL_S * taste.slow)) : Math.max(goal, mRaw - e.dt / (MANUAL_S * taste.slow))
    const M = inOutQuad(mRaw)
    const manual = M < 0.999
    const T = Ts * M
    const r = radius(T)

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
    taste.nag = idle > 8
    const nag = taste.nag ? '1' : '0'
    if (nag !== cNag) {
      cNag = nag
      swWrap.dataset.nag = nag
    }

    /* ---- the wipe: board colour (clip), ink ring, canvas (mask), far field */
    const bgK = T >= 1 ? 'none' : `circle(${r.toFixed(1)}px at ${sx.toFixed(1)}px ${sy.toFixed(1)}px)`
    if (bgK !== cBg) {
      cBg = bgK
      bg.style.clipPath = bgK
    }
    const cvK = T >= 1 ? 'off' : r < 1 ? 'full' : r.toFixed(1)
    if (cvK !== cCv) {
      if (cvK === 'off') cv.style.visibility = 'hidden'
      else {
        if (cCv === 'off' || cCv === '') cv.style.visibility = ''
        const m = cvK === 'full' ? 'none' : `radial-gradient(circle at ${(sx + cvPad).toFixed(1)}px ${(sy + cvPad).toFixed(1)}px, transparent ${r.toFixed(1)}px, #000 ${(r + 1).toFixed(1)}px)`
        cv.style.maskImage = m
        cv.style.webkitMaskImage = m
      }
      cCv = cvK
    }
    const ringK = T <= 0 || T >= 1 || r < 3 ? 'off' : r.toFixed(1)
    if (ringK !== cRing) {
      if (ringK === 'off') ring.style.visibility = 'hidden'
      else {
        if (cRing === 'off' || cRing === '') ring.style.visibility = 'visible'
        const D = r * 2
        ring.style.width = `${D.toFixed(1)}px`
        ring.style.height = `${D.toFixed(1)}px`
        ring.style.transform = `translate3d(${(sx - r).toFixed(1)}px, ${(sy - r).toFixed(1)}px, 0)`
      }
      cRing = ringK
    }
    if (plainFar) {
      const fo = 1 - smooth(0.5, 0.95, T)
      const fk = fo < 0.005 ? '0' : fo.toFixed(3)
      if (fk !== cFar) {
        cFar = fk
        plainFar.style.opacity = fk
        plainFar.style.visibility = fk === '0' ? 'hidden' : ''
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

    /* ---- twins: glide into the designed layout, then get replaced */
    let allGone = true
    const hd = Math.min(twins[2].d, twins[3].d)
    const n1 = twins[2].words?.length ?? 1
    const n2 = twins[3].words?.length ?? 1
    for (const t of twins) {
      const dx = t.tx - t.hx
      const dy = t.ty - t.hy
      if (t.kind === 'text') {
        // the two headline lines re-set as one block (one clock, own paths)
        const dq = t.key === 'l1' || t.key === 'l2' ? hd : t.d
        const qt = clamp01((r - dq + 60) / 560)
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
        // headline words rise through their masks
        const W = t.words
        if (W && W.length && (t.key === 'l1' || t.key === 'l2')) {
          const n = W.length
          const off = t.key === 'l2' ? n1 : 0
          const nn = n1 + n2
          for (let j = 0; j < n; j++) {
            const wq = e.reduced ? 1 : clamp01((qt - 0.24 - (0.42 * (j + off)) / nn) / 0.3)
            const qi = Math.round(wq * 40)
            if (qi === t.lastW[j]) continue
            t.lastW[j] = qi
            const w = qi / 40
            const eb = outBack(w, 1.5)
            W[j].style.transform = w >= 1 ? '' : `translateY(${((1 - eb) * 112).toFixed(1)}%) rotate(${((1 - w) * 7).toFixed(2)}deg)`
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
        } else if (t.kind === 'squash') {
          // squashed flat under the deck, then gone in a puff of shards
          const kn = range(c.p0 + 0.88 * D, c.p1 + 0.5 * D, p)
          if (kn > 0) {
            const sq = Math.sin((Math.PI / 2) * Math.min(1, kn / 0.32))
            scx *= 1 + 0.22 * sq
            scy *= 1 - 0.5 * sq
            op = 1 - smooth(0.28, 0.5, kn)
          }
          const sk = kn <= 0.2 || kn >= 1 ? 'off' : kn.toFixed(3)
          if (sk !== cSh) {
            cSh = sk
            const v = clamp01((kn - 0.2) / 0.8)
            shards.forEach((el, i) => {
              if (sk === 'off') {
                el.style.visibility = 'hidden'
                return
              }
              el.style.visibility = 'visible'
              const a = (-0.85 + i * 0.58) * Math.PI
              const dist = (t.tw * 0.55 + 60 + i * 18) * outCubic(v)
              const zz = 220 * Math.sin(Math.PI * Math.min(1, v * 1.1))
              el.style.transform = `translate3d(${(Math.cos(a) * dist).toFixed(1)}px, ${(Math.sin(a) * dist * 0.8 + 260 * v * v).toFixed(1)}px, ${zz.toFixed(1)}px) rotate(${((i % 2 ? 1 : -1) * (120 + i * 40) * v).toFixed(1)}deg)`
              el.style.opacity = (1 - smooth(0.6, 1, v)).toFixed(3)
            })
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
      // the deck's tooltip leaves and returns with it
      if (t.key === 'img' && tipSwap) {
        const tk2 = sm >= 1 ? '' : sm.toFixed(3)
        if (tk2 !== cTip) {
          cTip = tk2
          tipSwap.style.opacity = tk2 === '' ? '' : smooth(0.4, 1, sm).toFixed(3)
          tipSwap.style.visibility = sm < 0.4 ? 'hidden' : ''
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
      def.style.visibility = allGone ? 'hidden' : ''
    }
  }

  return registerFx({ id: 'hello-taste', section: 0, measure, update })
}
