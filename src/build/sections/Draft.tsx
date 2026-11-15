/**
 * Every section after Hello arrives the way Hello opens: as the competent-but-
 * forgettable default. An "Untitled" white board with a stock badge, a centred
 * headline, grey placeholder content and a generic blue button. As the camera
 * settles, a thin ring sweeps out from the bubble's side of the board: inside it
 * the board takes its designed colour, the draft's pieces dissolve as the front
 * reaches them, the section's own content shows up behind it, and the frame
 * label re-types Untitled → its real name. Then the bubble builds the rest.
 *
 * No switch here (that stays Hello's): the sweep is a pure function of the top
 * region's build progress, so scrolling back un-applies it exactly.
 */
import type { CSSProperties } from 'react'
import { CHAPTERS, type Seg } from '../../content/story'
import { clamp01, inOut, range, registerFx } from '../runtime'
import { phOf } from '../worlds'
import './draft.css'

const plain = (segs: Seg[]) => segs.map((s) => (typeof s === 'string' ? s : s.em)).join('')

const Img = () => (
  <svg viewBox="0 0 84 70" aria-hidden="true">
    <rect x="3" y="3" width="78" height="64" rx="8" />
    <circle cx="27" cy="25" r="7" />
    <path d="M3 56 30 36l16 12 12-9 23 17" />
  </svg>
)

/** the bland twin of each section's top: what a generator would have made */
function Body({ idx }: { idx: number }) {
  const ch = CHAPTERS[idx]
  if (idx === 1)
    return (
      <>
        <div className="dr-row" data-dr="">
          {['Research', 'Design', 'Deliver'].map((t) => (
            <span key={t} className="dr-card">
              <i className="dr-ico" />
              <b>{t}</b>
              <i className="dr-ln" />
              <i className="dr-ln dr-ln-s" />
            </span>
          ))}
        </div>
        <span className="dr-btn" data-dr="">
          Learn more
        </span>
      </>
    )
  if (idx === 2)
    return (
      <>
        <div className="dr-row" data-dr="">
          {['DAZN', 'Nota', 'toeic.pal'].map((t) => (
            <span key={t} className="dr-card dr-shot">
              <span className="dr-img">
                <Img />
              </span>
              <b>{t}</b>
              <i className="dr-ln dr-ln-s" />
            </span>
          ))}
        </div>
        <span className="dr-btn" data-dr="">
          View all projects
        </span>
      </>
    )
  return (
    <>
      <div className="dr-form" data-dr="">
        <span className="dr-in">Name</span>
        <span className="dr-in">Email</span>
        <span className="dr-in dr-area">{ch.id === 'contact' ? 'Tell us about your project' : 'Message'}</span>
      </div>
      <span className="dr-btn" data-dr="">
        Send message
      </span>
    </>
  )
}

const BADGE = ['', 'Our process', 'Portfolio', 'Contact us']

/** the plain white board, with the designed colour spreading inside it */
export function DraftBg({ idx }: { idx: number }) {
  return (
    <div className="dr-bg" data-k={idx} aria-hidden="true">
      <span className="dr-disc" />
    </div>
  )
}

/** the draft's content and the sweep's ring, above the section's own body */
export function DraftDef({ idx }: { idx: number }) {
  const ch = CHAPTERS[idx]
  return (
    <div className="dr-def" data-k={idx} aria-hidden="true">
      <div className="dr-top">
        <span className="dr-badge" data-dr="">
          <i /> {BADGE[idx]}
        </span>
        <span className="dr-h" data-dr="">
          {plain(ch.headline)}
        </span>
        <span className="dr-p" data-dr="">
          {ch.body}
        </span>
        <Body idx={idx} />
      </div>
      <span className="dr-ring" style={{ '--k': idx } as CSSProperties} />
    </div>
  )
}

const FROM = 'Untitled'
function labelAt(to: string, L: number) {
  if (L <= 0) return FROM
  if (L >= 1) return to
  if (L < 0.42) return FROM.slice(0, Math.round(FROM.length * (1 - L / 0.42)))
  if (L < 0.52) return ''
  return to.slice(0, Math.round((to.length * (L - 0.52)) / 0.48))
}

/** wire one artboard's draft to the scroll; returns the unregister fn */
export function mountDraft(board: HTMLElement, idx: number) {
  const bg = board.querySelector<HTMLElement>('.dr-bg')
  const def = board.querySelector<HTMLElement>('.dr-def')
  const disc = board.querySelector<HTMLElement>('.dr-disc')
  const ring = board.querySelector<HTMLElement>('.dr-ring')
  const lbl = board.querySelector<HTMLElement>('.bf-lbl-t')
  if (!bg || !def || !disc || !ring) return () => {}
  const ch = CHAPTERS[idx]
  const to = `${ch.num} ${ch.frame}`
  // the draft's pieces, and the section's own top-region content (texts, chips;
  // the bubble's pieces bring themselves): both switch where the front passes
  const drafts = Array.from(def.querySelectorAll<HTMLElement>('[data-dr]')).map((el) => ({ el, d: 0, on: true }))
  const r0 = board.querySelector<HTMLElement>('.bf-body .rg[data-region="0"]')
  const owns = r0 ? Array.from(r0.children).filter((el): el is HTMLElement => el instanceof HTMLElement && !el.classList.contains('slot')).map((el) => ({ el, d: 0, on: false })) : []

  let ox = 0
  let oy = 0
  let far = 1
  const cache = { disc: '', ring: '', lbl: '', st: '' }

  const at = (el: HTMLElement) => {
    let x = el.offsetWidth / 2
    let y = el.offsetHeight / 2
    for (let n: HTMLElement | null = el; n && n !== board; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft
      y += n.offsetTop
    }
    return [x, y]
  }

  const measure = () => {
    const W = board.offsetWidth
    // the sweep starts just outside the board's top-right edge, where the bubble waits
    ox = W + 30
    oy = 110
    // it has done its job once it covers the top of the board (the camera's view)
    const H = Math.min(board.offsetHeight, (r0 ? r0.offsetTop + r0.offsetHeight : 900) + 420)
    far = Math.hypot(ox, H - oy) + 60
    disc.style.left = `${ox - far}px`
    disc.style.top = `${oy - far}px`
    disc.style.width = disc.style.height = `${far * 2}px`
    ;[...drafts, ...owns].forEach((o) => {
      const [x, y] = at(o.el)
      o.d = Math.hypot(x - ox, y - oy)
    })
    cache.disc = cache.ring = cache.lbl = cache.st = ''
  }

  const off = registerFx({
    id: `draft-${idx}`,
    section: idx,
    measure: () => measure(),
    update: (e) => {
      if (!e.near) return
      if (e.reduced) {
        if (cache.st !== 'done') {
          cache.st = 'done'
          board.classList.remove('is-draft', 'is-sweep')
          owns.forEach((o) => o.el.classList.remove('dr-wait'))
        }
        return
      }
      // the draft shows while the board travels in; the sweep starts the moment the
      // section begins (no dead scroll on a white board) and is done well before
      // the top region has finished building
      const w = inOut(range(0, Math.max(0.04, phOf(idx).topEnd * 0.6), e.u))
      const r = w * far
      const st = w <= 0 ? 'draft' : w >= 1 ? 'done' : 'sweep'
      if (st !== cache.st) {
        cache.st = st
        board.classList.toggle('is-draft', st !== 'done')
        board.classList.toggle('is-sweep', st === 'sweep')
      }
      const dk = (r / far).toFixed(4)
      if (dk !== cache.disc) {
        cache.disc = dk
        disc.style.transform = `scale(${dk})`
      }
      const rk = st === 'sweep' ? r.toFixed(1) : ''
      if (rk !== cache.ring) {
        cache.ring = rk
        if (!rk) ring.style.visibility = 'hidden'
        else {
          ring.style.visibility = 'visible'
          ring.style.left = `${(ox - r).toFixed(1)}px`
          ring.style.top = `${(oy - r).toFixed(1)}px`
          ring.style.width = ring.style.height = `${(2 * r).toFixed(1)}px`
        }
      }
      drafts.forEach((o) => {
        const on = o.d > r
        if (on === o.on) return
        o.on = on
        o.el.classList.toggle('is-gone', !on)
      })
      owns.forEach((o) => {
        const wait = o.d > r && w < 1
        if (wait === o.on) return
        o.on = wait
        o.el.classList.toggle('dr-wait', wait)
      })
      if (lbl) {
        const t = labelAt(to, clamp01((w - 0.2) / 0.7))
        if (t !== cache.lbl) {
          cache.lbl = t
          lbl.textContent = t
        }
      }
    },
  })

  return () => {
    off()
    board.classList.remove('is-draft', 'is-sweep')
    owns.forEach((o) => o.el.classList.remove('dr-wait'))
    drafts.forEach((o) => o.el.classList.remove('is-gone'))
    if (lbl) lbl.textContent = to
  }
}
