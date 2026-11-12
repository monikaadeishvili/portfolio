/** 04 PROOF — "The control room": a dense, orderly bento dashboard */
import { useLayoutEffect, useRef } from 'react'
import { CHAPTERS, COMPANIES } from '../../../content/story'
import { MomoGlyph, TONE_HEX as T } from '../../../ui/components'
import { Piece, Region, Reveal } from '../../parts'
import { outCubic, pieces, range, registerFx } from '../../runtime'
import { Artboard, type SectionProps } from '../Artboard'
import { DeviceTrio, Gantt, StatTile } from './widgets'
import './proof.css'

const STATS = [
  { id: 'p-st0', n: 7, suf: '+', label: 'years designing', tone: 'yellow', park: '60,-390' },
  { id: 'p-st1', n: 18, suf: '', label: 'client products at one agency', tone: 'lime', park: '-305,560' },
  { id: 'p-st2', n: 9, suf: '', label: 'industries', tone: 'sky', park: '975,560' },
] as const

const INDUSTRIES = ['Banking', 'FinTech', 'Healthcare', 'EdTech', 'PropTech', 'Construction', 'Wellness', 'Marketplace', 'Investing']
const PILL_TONES = ['sky', 'yellow', 'pink', 'lime', 'mint', 'coral', 'sky', 'yellow', 'pink'] as const

export function Proof({ lay, live, onNav }: SectionProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  // stat tiles roll their digits as they land
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!live || !root) return
    const tiles = STATS.map((s) => ({ s, wheels: Array.from(root.querySelectorAll<HTMLElement>(`[data-cid="${s.id}"] .odw i`)) }))
    const cache = ['', '', '']
    return registerFx({
      id: 'proof-stats',
      section: 3,
      update: (e) => {
        if (!e.near) return
        tiles.forEach(({ s, wheels }, k) => {
          const c = pieces.get(s.id)
          if (!c) return
          // waiting tiles show their real number; on landing the digits spin
          // a few turns like a slot machine and settle on it again
          const d = c.p1 - c.p0
          const q = e.reduced ? 1 : outCubic(range(c.p1 - d * 0.1, c.p1 + d * 0.9, e.p))
          const v = s.n
          const key = v.toFixed(2)
          if (key === cache[k]) return
          cache[k] = key
          const n = wheels.length
          wheels.forEach((wh, i) => {
            const pow = Math.pow(10, n - 1 - i)
            // spin a few extra turns on the way for the slot-machine feel
            const turns = (1 - q) * (3 + i)
            const dgt = ((v / pow) % 10) + turns * 10
            wh.style.transform = `translateY(${((-(dgt % 10) * 100) / 11).toFixed(2)}%)`
          })
        })
      },
    })
  }, [live])

  return (
    <Artboard idx={3} live={live} lay={lay}>
      <div ref={rootRef} className="p-root">
        <Region index={0} label="Numbers" className="p-r0">
          <Piece id="p-nav" name="Dashboard bar" kind="bubble" tone={T.sky} order={0} className="p-navslot">
            <nav className="p-nav" aria-label="Dashboard">
              <span className="p-nav-brand">
                <MomoGlyph size={22} /> proof<span>.dashboard</span>
              </span>
              <span className="p-nav-tabs" role="list">
                <a role="listitem" href="#ch-proof" className="is-on" onClick={(e) => (e.preventDefault(), onNav('work'))}>
                  Overview
                </a>
                <a role="listitem" href="#ch-origin" onClick={(e) => (e.preventDefault(), onNav('about'))}>
                  History
                </a>
                <a role="listitem" href="#ch-contact" onClick={(e) => (e.preventDefault(), onNav('contact'))}>
                  Contact
                </a>
              </span>
              <span className="p-nav-live">
                <i aria-hidden="true" /> Live · 2026
              </span>
            </nav>
          </Piece>
          <div className="p-top">
            <Reveal id="p-title" as="h2" hid="h-proof" segs={CHAPTERS[3].headline} className="rv-title p-title" />
            <Reveal id="p-para" mode="type" segs={[CHAPTERS[3].body]} className="rv-para p-para" order={1} />
          </div>
          <ul className="p-stats" aria-label="In numbers">
            {STATS.map((s, i) => (
              <li key={s.id}>
                <Piece id={s.id} name={`Stat / ${s.label.split(' ')[0]}`} kind="hero" tone={T[s.tone]} travel={i === 1 ? 'crawl' : 'leap'} order={i + 1} park={s.park} className="fill" eyes={{ x: 82, y: 0, s: 22 }}>
                  <StatTile n={s.n} suf={s.suf} label={s.label} tone={s.tone} />
                </Piece>
              </li>
            ))}
          </ul>
        </Region>

        <Region index={1} label="Timeline" className="p-r1" weight={1.25}>
          <Piece id="p-gantt" name="Career Gantt" kind="hero" tone={T.sky} travel="leap" order={1} park="40,n+30" className="p-ganttslot" eyes={{ x: 94, y: 0, s: 24 }}>
            <Gantt />
          </Piece>
        </Region>

        <Region index={2} label="Work" className="p-r2">
          <div className="p-bento">
            <Piece id="p-devices" name="Device trio" kind="hero" tone={T.yellow} travel="leap" order={1} park="300,b+70" className="p-devslot fill" eyes={{ x: 90, y: 0, s: 24 }}>
              <DeviceTrio />
            </Piece>
            <div className="p-side">
              <section className="p-card p-ind" aria-labelledby="p-ind-h">
                <h3 id="p-ind-h" className="p-card-h">
                  Industries <span>9</span>
                </h3>
                <ul className="p-pills">
                  {INDUSTRIES.map((n, i) => (
                    <li key={n} style={{ ['--k' as string]: i }}>
                      <Piece id={`p-ind${i}`} name={`Pill / ${n}`} kind="bubble" tone={T[PILL_TONES[i]]} order={2 + i}>
                        <span className={`p-pill pt-${PILL_TONES[i]}`}>{n}</span>
                      </Piece>
                    </li>
                  ))}
                </ul>
              </section>
              <Piece id="p-chalk" name="Chalkboard" kind="bubble" tone={T.mint} order={12} className="p-chalkslot">
                <div className="p-chalk">
                  <span className="p-chalk-k">Also</span>
                  <b>UX/UI lecturer</b>
                  <span className="p-chalk-s" aria-hidden="true">
                    ✎ explaining design makes you better at it
                  </span>
                </div>
              </Piece>
            </div>
            <ul className="p-tickets" aria-label="Where I've worked">
              {COMPANIES.map((c, i) => (
                <li key={c.name}>
                  <Piece id={`p-co${i}`} name={`Ticket / ${c.name.split(' ')[0]}`} kind="bubble" tone={T[c.tone]} order={13 + i} className="fill">
                    <div className={`p-ticket tk-${c.tone}`}>
                      <span className="p-ticket-mark" aria-hidden="true">
                        {c.mark}
                      </span>
                      <span className="p-ticket-txt">
                        <b>{c.name}</b>
                        <span>{c.role}</span>
                      </span>
                    </div>
                  </Piece>
                </li>
              ))}
            </ul>
          </div>
        </Region>
      </div>
    </Artboard>
  )
}
