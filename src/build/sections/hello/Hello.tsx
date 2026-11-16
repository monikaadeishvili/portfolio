/**
 * 01 HELLO — "Everyone has the same tools now. Not the same taste."
 * The section proves its own headline: it opens as the default anyone gets
 * from the same tools, and scrolling applies taste (see ./taste.ts).
 *
 * Designed state: a porcelain stage with drifting topographic contours, a
 * giant pale MONIKA behind a bottom-anchored cut-out portrait (WebGL, with a
 * cursor-trail burn between colour and a construct drawing — ./portrait.ts),
 * the headline as architecture in a bold condensed face (line 1 behind her,
 * line 2 in electric blue in front of her, the Taste switch inline), tiny
 * uppercase editorial captions on a three-column hairline grid; then an
 * electric-blue statement band, ghost-word facts and a near-black close.
 */
import { Fragment, type RefObject, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Arrow } from '../../../ui/components'
import { EMAIL, HELLO, LINKS } from '../../../content/story'
import { Piece, Region, Reveal, useSection } from '../../parts'
import { outCubic, range, registerFx, registerText, smooth } from '../../runtime'
import { Artboard, type SectionProps } from '../Artboard'
import { TasteSwitch } from './TasteSwitch'
import { mountTaste, taste } from './taste'
import { mountPortrait } from './portraitFx'
import { mountHeadWake } from './headWake'
import { mountRibbons, mountWw } from './wwMarquee'
import { mountClose } from './closeFx'
import './hello.css'

/** designed fills (Layers / Inspector read these as the pieces' fills) */
const HC = {
  ink: '#1E1712',
  board: '#F3ECE1',
  canvas: '#EBE2D4',
  blue: '#BF400B',
  glow: '#FFB07A',
  green: '#1FA45A',
  white: '#FFFFFF',
}

const TITLE = `${HELLO.line1} ${HELLO.line2}`
const LINKEDIN = LINKS.find((l) => l.label === 'LinkedIn')!.href
const INSTAGRAM = 'https://www.instagram.com/monikaadeishvili/'
const LIST = ['Research', 'Flows', 'Design systems', 'Handoff', 'Launch']
const STATEMENT = 'From a blank Figma file to a product people use.'
/** the headline, set as architecture (explicit rows: no orphans at any size) */
const L1_ROWS = [['Everyone', 'has'], ['the', 'same'], ['tools', 'now.']]
const L2_ROW0 = ['Not', 'the', 'same']

/** a designed text block listed in the Layers panel (the taste engine moves it) */
function useLayerText(ref: RefObject<HTMLElement | null>, id: string, label: string) {
  const ctx = useSection()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ctx.live) return
    return registerText({ id, section: 0, region: 0, order: 0, mode: 'pre', el, words: [], label })
  }, [ctx.live, ref, id, label])
}

/** masked words (each one masked so it can rise through its own line), one span per letter for the hover wake */
function Words({ words }: { words: string[] }) {
  return (
    <>
      {words.map((w, i) => (
        <span key={i} className="rw" aria-hidden="true">
          <span className="rw-in">
            {Array.from(w).map((c, j) => (
              <span key={j} className="h-ch">
                {c}
              </span>
            ))}
          </span>
        </span>
      ))}
    </>
  )
}

/** small line icons between the ribbon items */
type RibKind = 'nib' | 'spark' | 'search' | 'flow' | 'grid' | 'code' | 'launch'
const RIB_ICONS: RibKind[] = ['search', 'flow', 'grid', 'code', 'launch']
function RibIcon({ kind }: { kind: RibKind }) {
  const d: Record<RibKind, React.ReactNode> = {
    nib: (
      <g transform="translate(5 19) rotate(45)">
        <path d="M0 0-4.5-7.5Q-4.5-10-2-10.5H2Q4.5-10 4.5-7.5Z" />
        <path d="M-2.5-10.5V-12.8H2.5V-10.5M0 0V-5.4" />
      </g>
    ),
    spark: <path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="M15 15l5 5" />
      </>
    ),
    flow: (
      <>
        <circle cx="5.5" cy="6" r="2.2" />
        <circle cx="18.5" cy="18" r="2.2" />
        <path d="M7.7 6H11a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h-.7" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
        <circle cx="16.75" cy="16.75" r="3.4" />
      </>
    ),
    code: <path d="M9 7 4 12l5 5M15 7l5 5-5 5" />,
    launch: <path d="M7 17 17 7M9.5 7H17v7.5" />,
  }
  return (
    <svg className="h-rib-ico" viewBox="0 0 24 24" aria-hidden="true">
      {d[kind]}
    </svg>
  )
}

/** the generic mountain-and-sun image placeholder */
function ImageIcon() {
  return (
    <svg viewBox="0 0 48 40" aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="37" rx="5" />
      <circle cx="33" cy="12.5" r="4.5" />
      <path d="M3 33 16 19l9 9 6-6 14 13" />
    </svg>
  )
}

/** irregular concentric contour loops (a topographic map), computed once */
function contourPaths(W: number, H: number, n: number) {
  const cx = W * 0.56
  const cy = H * 0.5
  const out: string[] = []
  for (let k = 0; k < n; k++) {
    const r0 = 120 + k * 118 + k * k * 9
    const pts: string[] = []
    const N = 120
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2
      const r =
        r0 *
        (1 +
          0.13 * Math.sin(2 * a + 0.7 + k * 0.21) +
          0.07 * Math.sin(3 * a + 2.1 - k * 0.37) +
          0.035 * Math.sin(5 * a + k * 0.9) +
          0.018 * Math.sin(9 * a + 1.3 + k))
      pts.push(`${(cx + Math.cos(a) * r * 1.18).toFixed(1)},${(cy + Math.sin(a) * r * 0.86).toFixed(1)}`)
    }
    out.push(`M${pts.join('L')}Z`)
  }
  return out
}

function Contours() {
  const paths = useMemo(() => contourPaths(1120, 880, 7), [])
  return (
    <svg className="h-topo" viewBox="0 0 1120 880" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} className={`tp tp${i}`} />
      ))}
    </svg>
  )
}

function Nav({ onNav }: { onNav: SectionProps['onNav'] }) {
  return (
    <nav className="h-navbar" aria-label="Site">
      <a className="h-brand" href="#ch-hello" onClick={(e) => (e.preventDefault(), onNav('about'))}>
        Monika<span className="h-brand-last"> Adeishvili</span>
      </a>
      <span className="h-navlinks">
        <a className="h-navcta" href={LINKEDIN} target="_blank" rel="noopener noreferrer">
          LinkedIn <span className="h-navcta-ar" aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a className="h-navcta" href={INSTAGRAM} target="_blank" rel="noopener noreferrer">
          Instagram <span className="h-navcta-ar" aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </span>
    </nav>
  )
}

function Stage({ narrow, live, onNav, plain, onToggle }: { narrow: boolean; live: boolean; onNav: SectionProps['onNav']; plain: boolean; onToggle: () => void }) {
  const h1Ref = useRef<HTMLHeadingElement>(null)
  useLayerText(h1Ref, 'h-title', 'Heading / H1')
  const [s0, s1, s2, s3] = HELLO.support
  return (
    <Region index={0} label="Hero" className={`h-r0${plain ? ' is-plain' : ''}`} hold="0.52,0.36,0.64">
      {/* State A: the competent-but-forgettable default (visual twins only) */}
      <div className="h-def" aria-hidden="true">
        <div className="hd-nav" data-tw="nav">
          <span className="hd-brand">Monika Adeishvili</span>
          {!narrow && (
            <span className="hd-links">
              <span>Work</span>
              <span>About</span>
              <span>Contact</span>
            </span>
          )}
        </div>
        <div className="hd-hero">
          <span className="hd-badge" data-tw="badge">
            <i />
            {HELLO.badge}
          </span>
          <div className="hd-h">
            <span className="hd-l1" data-tw="l1">
              {HELLO.line1}
            </span>
            <span className="hd-l2" data-tw="l2">
              {HELLO.line2}
            </span>
          </div>
          <p className="hd-p" data-tw="lead">
            {s0} {s1}
            {s2}
            {s3}
          </p>
          <div className="hd-side">
            <span className="hd-cap" data-tw="cap">
              {HELLO.intro}
            </span>
            <span className="hd-btn" data-tw="btn">
              {HELLO.ghost}
            </span>
          </div>
        </div>
        <span className="hd-img" data-tw="img">
          <ImageIcon />
        </span>
      </div>

      {/* the stage: contours, hairline guides, the ghost name */}
      <div className="h-bgfx" aria-hidden="true">
        <Contours />
        <div className="h-grid">
          <i className="hg hg-h hg-top" />
          <i className="hg hg-v hg-v1" />
          <i className="hg hg-v hg-v2" />
        </div>
        <span className="h-ghost">Monika</span>
      </div>

      {/* nav */}
      <Piece id="h-nav" name="Nav" kind="bubble" tone={HC.board} order={0} at={0.4} className="h-nav">
        <div className="h-swap">
          <Nav onNav={onNav} />
        </div>
      </Piece>

      {/* top-right caption + status badge */}
      <Piece id="h-meta" name="Caption / Role" kind="bubble" tone={HC.green} order={1} at={0.48} className="h-metaslot">
        <div className="h-swap">
          <div className="h-meta">
            <p className="h-cap h-role">
              Product designer <span className="h-dash">—</span> Alicante, ES
            </p>
            <span className="h-badge">
              <i aria-hidden="true" />
              {HELLO.badge}
            </span>
          </div>
        </div>
      </Piece>

      {/* headline line 1: huge, upper left, behind her */}
      <h1 className="h-title" id="h-hello" tabIndex={-1} ref={h1Ref} aria-labelledby="h-hello-name">
        <span className="sr-only" id="h-hello-name">
          {TITLE}
        </span>
        <span className="h-l1">
          {L1_ROWS.map((r, i) => (
            <span key={i} className="h-row">
              <Words words={r} />
            </span>
          ))}
        </span>
      </h1>

      {/* the portrait (WebGL canvas mounted by ./portraitFx; the img is the fallback + alt) */}
      <figure className="h-port" data-port="">
        <div className="h-port-gl" aria-hidden="true" />
        <img className="h-port-img" src="/monika-new.webp" alt="Monika Adeishvili" width={1052} height={1800} decoding="async" fetchPriority="high" />
      </figure>

      {/* headline line 2: electric blue, lower right, in front of her */}
      <div className="h-l2">
        <span className="h-row">
          <Words words={L2_ROW0} />
        </span>
        <span className="h-row h-row-sw">
          <Piece id="h-switch" name="Taste switch" kind="hero" tone={HC.blue} travel="leap" order={0} at={0.18} dur={0.17} park="1150,250" parkN="16,-128" className="h-gap-sw" eyes={{ x: 30, y: -8, s: 16 }}>
            <TasteSwitch checked={live ? undefined : !plain} onToggle={onToggle} />
          </Piece>
          <Words words={['taste.']} />
        </span>
      </div>

      {/* the floating pill */}
      <Piece id="h-pill" name="Nav / Pill" kind="hero" tone={HC.blue} travel="leap" order={2} at={0.9} dur={0.22} park="40,-236" parkN="176,-96" className="h-pillslot" eyes={{ x: 82, y: -8, s: 16 }}>
        <div className="h-swap">
          {/* the pill's labels are decoration: only Say hello is a link */}
          <div className="h-pill">
            <span className="h-pill-links" aria-hidden="true">
              <span>Work</span>
              <span>About</span>
              <span>Contact</span>
            </span>
            <a className="h-cta" href={`mailto:${EMAIL}`}>
              {HELLO.ghost}
              <span className="h-cta-ar" aria-hidden="true">
                <Arrow dir="right" />
              </span>
            </a>
          </div>
        </div>
      </Piece>
    </Region>
  )
}

/** a rolling odometer: each digit column spins up to its value */
function Odo({ value, suffix = '' }: { value: string; suffix?: string }) {
  return (
    <span className="h-odo" data-odo={value}>
      <span className="sr-only">
        {value}
        {suffix}
      </span>
      <span className="h-odo-vis" aria-hidden="true">
        {value.split('').map((d, i) => (
          <span key={i} className="h-odo-col">
            <span className="h-odo-strip" data-d={d} style={{ transform: `translate3d(0, ${-(Number(d) + 10) * 5}%, 0)` }}>
              {Array.from({ length: 20 }, (_, k) => (
                <span key={k}>{k % 10}</span>
              ))}
            </span>
          </span>
        ))}
        {suffix && <span className="h-odo-suf">{suffix}</span>}
      </span>
    </span>
  )
}

/** a line split into letters, words kept whole */
function CloseLetters({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((w, wi) => (
        <Fragment key={wi}>
          {wi > 0 && ' '}
          <span className="h-cw">
            {Array.from(w).map((c, ci) => (
              <span key={ci} className="h-cl">
                {c}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </>
  )
}

export function Hello({ lay, live, onNav }: SectionProps) {
  const narrow = lay === 'narrow'
  const boardRef = useRef<HTMLDivElement>(null)
  const r1Ref = useRef<HTMLDivElement>(null)
  // static / reduced motion: the switch is an instant crossfade
  const [plain, setPlain] = useState(false)
  const onToggle = () => {
    if (live) taste.toggle()
    else setPlain((v) => !v)
  }

  // the taste engine, then the portrait (same frame order: it reads the engine)
  useLayoutEffect(() => {
    const board = boardRef.current?.closest<HTMLElement>('.bf')
    if (!live || !board) return
    const a = mountTaste(board)
    const b = mountPortrait(board)
    const c = mountHeadWake(board)
    const d = mountWw(board)
    const r = mountRibbons(board)
    const cl = mountClose(board)
    return () => {
      cl()
      r()
      d()
      c()
      b()
      a()
    }
  }, [live, lay])

  // facts: hairlines draw in, ghost words surface, numerals roll, the dark base rises
  useLayoutEffect(() => {
    const r1 = r1Ref.current
    if (!live || !r1) return
    const lines = Array.from(r1.querySelectorAll<HTMLElement>('.hf-line'))
    const ghosts = Array.from(r1.querySelectorAll<HTMLElement>('.h-fghost'))
    const base = r1.querySelector<HTMLElement>('.h-base')!
    const strips = Array.from(r1.querySelectorAll<HTMLElement>('.h-odo-strip'))
    const odoPiece = strips.map((s) => s.closest<HTMLElement>('[data-cid]')?.dataset.cid ?? '')
    const cache = { l: '', b: '', g: ghosts.map(() => ''), o: strips.map(() => '') }
    return registerFx({
      id: 'hello-facts',
      section: 0,
      update: (e) => {
        if (!e.near) return
        const q = e.reg[1] ?? 0
        // the hairline frame of the facts draws in first
        const lq = outCubic(range(0.14, 0.38, q))
        const lk = lq.toFixed(3)
        if (lk !== cache.l) {
          cache.l = lk
          lines.forEach((l) => (l.style.transform = l.classList.contains('hf-v') ? `scaleY(${lk})` : `scaleX(${lk})`))
        }
        // ghost words surface behind each column, a beat before its numeral lands
        ghosts.forEach((g, i) => {
          const v = smooth(0.22 + i * 0.1, 0.5 + i * 0.1, q)
          const k = v.toFixed(3)
          if (k === cache.g[i]) return
          cache.g[i] = k
          g.style.opacity = k
          g.style.transform = `translate3d(${((1 - v) * -24).toFixed(1)}px, 0, 0)`
        })
        // the near-black close rises under its line
        const bq = outCubic(range(0.62, 0.86, q))
        const bk = bq >= 1 ? 'none' : `inset(${((1 - bq) * 100).toFixed(2)}% 0 0 0 round 0 0 var(--h-rad) var(--h-rad))`
        if (bk !== cache.b) {
          cache.b = bk
          base.style.clipPath = bk
          base.style.visibility = bq <= 0 ? 'hidden' : 'visible'
        }
        // odometers roll once their numeral has landed (waiting heroes show their real value)
        strips.forEach((s, i) => {
          const c = e.piece(odoPiece[i])
          let v = 1
          if (c && !e.reduced) {
            const D = Math.max(1e-4, c.p1 - c.p0)
            v = outCubic(range(c.p1 - 0.05 * D, c.p1 + 0.55 * D, e.p))
          }
          const d = Number(s.dataset.d)
          const idx = d + 10 * v
          const ok = idx.toFixed(3)
          if (ok === cache.o[i]) return
          cache.o[i] = ok
          s.style.transform = `translate3d(0, ${(-idx * 5).toFixed(3)}%, 0)`
        })
      },
    })
  }, [live, lay])

  return (
    <Artboard
      idx={0}
      live={live}
      lay={lay}
      under={
        <>
          {live && <div className="h-cv" aria-hidden="true" />}
          <div className="h-plainbg" aria-hidden="true">
            {live && <div className="h-disc" />}
          </div>
        </>
      }
      label={
        <span className="h-lbl">
          <span className="h-lbl-t">{plain ? 'Untitled' : '01 Hello'}</span>
          <span className="h-caret" />
        </span>
      }
    >
      <div ref={boardRef} className="h-ring" aria-hidden="true" />
      <Stage narrow={narrow} live={live} onNav={onNav} plain={plain} onToggle={onToggle} />

      <Region index={1} label="Facts" className="h-r1">
        <div ref={r1Ref} className="h-r1-in">
          {/* the electric-blue statement band (a bland grey twin waits under it while taste is off) */}
          <div className="h-band">
            <div className="h-band-def" aria-hidden="true">
              <span>{STATEMENT}</span>
            </div>
            {/* two crossing tapes drifting opposite ways (./wwMarquee.ts mountRibbons) */}
            <div className="h-blue">
              <p className="sr-only">{STATEMENT}</p>
              <ul className="sr-only" aria-label="How I work">
                {LIST.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <Piece id="h-stmt" name="Ribbon / Statement" kind="bubble" tone={HC.ink} order={0} at={0.1} className="h-ribslot h-ribslot-a">
                <div className="h-rib h-rib-a" data-speed="40" aria-hidden="true">
                  <div className="h-rib-rail">
                    {[0, 1].map((copy) => (
                      <div key={copy} className="h-rib-set">
                        {[0, 1].map((k) => (
                          <span key={k} className="h-rib-item">
                            <span className="h-rib-t">{STATEMENT}</span>
                            <RibIcon kind={k ? 'spark' : 'nib'} />
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </Piece>
              <Piece id="h-list" name="Ribbon / Process" kind="bubble" tone={HC.blue} order={1} at={0.22} className="h-ribslot h-ribslot-b">
                <div className="h-rib h-rib-b" data-speed="-52" aria-hidden="true">
                  <div className="h-rib-rail">
                    {[0, 1].map((copy) => (
                      <div key={copy} className="h-rib-set">
                        {LIST.map((t, k) => (
                          <span key={t} className="h-rib-item">
                            <span className="h-rib-t">{t}</span>
                            <RibIcon kind={RIB_ICONS[k]} />
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </Piece>
            </div>
          </div>

          <div className="h-cellsw">
            <ul className="h-cells" aria-label="Quick facts">
              <li className="h-cell">
                <span className="h-fghost" aria-hidden="true">
                  Years
                </span>
                <Piece id="h-n0" name="Numeral / Years" kind="hero" tone={HC.ink} travel="leap" order={1} at={0.3} dur={0.2} park="150,b-236" eyes={{ x: 50, y: -6, s: 18 }} className="h-numslot">
                  <span className="h-num">
                    <Odo value="8" suffix="+" />
                  </span>
                </Piece>
                <Reveal id="h-c0" mode="type" segs={['Years of taste']} className="h-cell-l" label="Label / Years" />
              </li>
              <li className="h-cell">
                <span className="h-fghost" aria-hidden="true">
                  Products
                </span>
                <Piece id="h-n1" name="Numeral / Products" kind="hero" tone={HC.ink} travel="leap" order={2} at={0.42} dur={0.2} park="420,b-214" eyes={{ x: 50, y: -6, s: 18 }} className="h-numslot">
                  <span className="h-num">
                    <Odo value="32" />
                  </span>
                </Piece>
                <Reveal id="h-c1" mode="type" segs={['Client products']} className="h-cell-l" label="Label / Products" />
              </li>
              <li className="h-cell">
                <span className="h-fghost" aria-hidden="true">
                  Now
                </span>
                <Piece id="h-n2" name="Numeral / Now" kind="hero" tone={HC.blue} travel="leap" order={3} at={0.54} dur={0.2} park="690,b-236" eyes={{ x: 50, y: -6, s: 18 }} className="h-numslot">
                  <span className="h-num h-num-now">
                    Now
                    <i className="h-live" aria-hidden="true" />
                  </span>
                </Piece>
                <Reveal id="h-c2" mode="type" segs={['Open to new work']} className="h-cell-l" label="Label / Status" />
              </li>
            </ul>
            <span className="hf-lines" aria-hidden="true">
              <i className="hf-line hf-h hf-bot" />
              <i className="hf-line hf-v hf-v1" />
              <i className="hf-line hf-v hf-v2" />
            </span>
          </div>

          <Piece id="h-ww" name="Worked with" kind="bubble" tone={HC.ink} order={4} at={0.68} className="h-wwslot">
            <div className="h-ww">
              <span className="h-ww-l" id="h-ww-l">
                Worked with
              </span>
              {/* a slow marquee (./wwMarquee.ts): the list twice for a seamless loop, the second copy hidden from AT */}
              <div className="h-ww-mq">
                <div className="h-ww-rail">
                  {[0, 1].map((copy) => (
                    <ul key={copy} className="h-ww-set" aria-labelledby={copy ? undefined : 'h-ww-l'} aria-hidden={copy ? true : undefined}>
                      {HELLO.workedWith.map((n) => (
                        <li key={n} className="h-ww-n">
                          <span className="sr-only">{n}</span>
                          <span className="h-ww-vis" aria-hidden="true">
                            {Array.from(n).map((c, j) => (
                              <span key={j} className="h-ch">
                                {c === ' ' ? '\u00a0' : c}
                              </span>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </div>
            </div>
          </Piece>

          <div className="h-close">
            <div className="h-base" aria-hidden="true" />
            <Piece id="h-hint" name="Closing line" kind="bubble" tone={HC.blue} order={6} at={1} className="h-hint-slot">
              {/* the letters play what the line says (./closeFx.ts) */}
              <p className="h-hint-p">
                <span className="sr-only">
                  {HELLO.hint[0]} {HELLO.hint[1]}
                </span>
                <span className="h-hint-a" aria-hidden="true">
                  <CloseLetters text={HELLO.hint[0]} />
                </span>{' '}
                <span className="h-hint-b" aria-hidden="true">
                  <CloseLetters text={HELLO.hint[1]} />
                </span>
              </p>
            </Piece>
          </div>
        </div>
      </Region>
    </Artboard>
  )
}
