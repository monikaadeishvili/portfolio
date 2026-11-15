/**
 * 03 Proof, part one — the running total. Thirteen alive stickers (six client
 * products, seven facts about her) wait around the grid and walk or leap into
 * their cells as you scroll, the other 26 client products pop out of the bubble
 * as chips, and the counters roll up to 32 products and 10 industries. Then it
 * all folds into a slowly turning ring around "your product" (the bubble, hopping
 * in the middle), and a single card drops out below: one designer, all of the
 * above. ./tallyFx.ts drives the counts and the fold.
 */
import type { CSSProperties } from 'react'
import { TALLY } from '../../../content/story'
import { Piece } from '../../parts'
import type { Travel } from '../../runtime'

/**
 * Where each sticker waits and how it comes in, in landing order (k). Desktop
 * parks: artboard px of the box's top-left, y from the tally region's top —
 * a ledge right of the headline, the canvas gutters under the side panels, and
 * the still-empty chips column. Phones have no gutters: the six client products
 * wait on a bench at the foot of the board and crawl up; the facts (no parkN)
 * come out of the bubble.
 */
const WALK: Record<string, { k: number; park: string; parkN?: string; travel: Travel }> = {
  dazn: { k: 0, park: '566,-160', parkN: '29,552', travel: 'crawl' },
  certs: { k: 1, park: '-176,190', travel: 'crawl' },
  pronto: { k: 2, park: '1150,300', parkN: '29,658', travel: 'leap' },
  toeic: { k: 3, park: '690,-176', parkN: '245,552', travel: 'leap' },
  hello: { k: 4, park: '-176,500', travel: 'crawl' },
  years: { k: 5, park: '700,330', travel: 'crawl' },
  nota: { k: 6, park: '814,-156', parkN: '137,552', travel: 'crawl' },
  moneymarket: { k: 7, park: '1296,300', parkN: '245,658', travel: 'leap' },
  tools: { k: 8, park: '-176,345', travel: 'crawl' },
  ai: { k: 9, park: '676,150', travel: 'leap' },
  realoffer: { k: 10, park: '938,-172', parkN: '137,658', travel: 'crawl' },
  teach: { k: 11, park: '1150,452', travel: 'crawl' },
  home: { k: 12, park: '1296,452', travel: 'leap' },
}

/** a rolling number: each digit is a 0–9 column the driver slides into place */
function Roll({ digits, className = '' }: { digits: number; className?: string }) {
  return (
    <span className={`pt-roll ${className}`} aria-hidden="true">
      {Array.from({ length: digits }, (_, i) => (
        <span key={i} className="pt-col">
          <span className="pt-strip">
            {Array.from({ length: 10 }, (_, k) => (
              <span key={k}>{k}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}

/** the top of a card about her: a big word or number and a small doodle */
function Fact({ id, big }: { id: string; big: string }) {
  if (id === 'home')
    return (
      <span className="pt-sun">
        <Eyes />
      </span>
    )
  if (id === 'tools')
    return (
      <span className="pt-tools">
        <i>F</i>
        <i>Ai</i>
        <i>Xd</i>
      </span>
    )
  return (
    <>
      <span className="pt-big">{big}</span>
      {id === 'certs' && (
        <span className="pt-dd pt-dd-g">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {id === 'years' && <span className="pt-dd pt-dd-spark">✦</span>}
      {id === 'teach' && <span className="pt-dd pt-dd-pill">101</span>}
      {id === 'ai' && <span className="pt-dd pt-dd-pill pt-dd-pro">PRO</span>}
      {id === 'hello' && <span className="pt-dd pt-dd-wave">გა!</span>}
    </>
  )
}

const Eyes = () => (
  <span className="pt-eyes" aria-hidden="true">
    <i />
    <i />
  </span>
)

export function Tally() {
  const work = TALLY.cards.filter((c) => c.kind === 'work')
  const n = work.length + TALLY.chips.length
  return (
    <div className="pt-stage">
      <p className="sr-only">
        {n} client products across {TALLY.industries} industries: {work.map((c) => c.name).join(', ')}, {TALLY.chips.join(', ')}. About her:{' '}
        {TALLY.cards
          .filter((c) => c.kind === 'me')
          .map((c) => `${c.big} ${c.name}, ${c.line}`.trim())
          .join('; ')}
        . {TALLY.me.name}: {TALLY.me.line}.
      </p>
      <div className="pt-board" aria-hidden="true">
        <div className="pt-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={`v${i}`} className="pt-v" style={{ '--i': i } as CSSProperties} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <i key={`h${i}`} className="pt-h" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>

        {/* everything that later folds into the orbit flies in a .pt-fly wrapper */}
        {TALLY.cards.map((c, i) => {
          const w = WALK[c.id]
          return (
            <div
              key={c.id}
              className="pt-fly pt-cardslot"
              style={
                {
                  '--cw': c.at[0],
                  '--rw': c.at[1],
                  '--cn': i % 3,
                  '--rn': Math.floor(i / 3),
                  '--rest': `${(((i * 37) % 5) - 2) * 1.2}deg`,
                  '--pkr': `${(((w.k * 53) % 13) - 6) * 1.4}deg`,
                  '--i': i,
                } as CSSProperties
              }
            >
              {/* an alive sticker: it waits on the canvas or the board and walks in */}
              <Piece
                id={`t-${c.id}`}
                name={c.kind === 'work' ? `Card / ${c.name}` : `Card / ${c.id}`}
                kind="hero"
                travel={w.travel}
                tone={c.mk}
                order={w.k}
                at={0.09 + w.k * 0.031}
                dur={w.travel === 'crawl' ? 0.085 : 0.06}
                park={w.park}
                parkN={w.parkN}
                eyes={c.kind === 'work' || c.id === 'home' ? false : { x: 78, y: -9, s: 14 }}
                className="fill"
              >
                <span className={`pt-card pt-card-${c.kind}`} data-id={c.id} style={{ '--bg': c.bg, '--fg': c.fg, '--mk': c.mk } as CSSProperties}>
                  <span className="pt-top">
                    {c.kind === 'work' ? (
                      <>
                        <span className={`pt-mk pt-mk-${c.shape}`}>
                          <Eyes />
                        </span>
                        <span className="pt-tag">{c.tag}</span>
                      </>
                    ) : (
                      <Fact id={c.id} big={c.big} />
                    )}
                  </span>
                  <b className={`pt-cname${c.name.length > 12 && c.kind === 'work' ? ' is-long' : ''}`}>{c.name}</b>
                  <span className="pt-cline">{c.line}</span>
                  {c.kind === 'work' && <span className="pt-plus">+1</span>}
                </span>
              </Piece>
            </div>
          )
        })}
        <span className="pt-chips">
          {TALLY.chips.map((c, i) => (
            <div key={c} className="pt-fly pt-chipslot" style={{ '--k': i % 7 } as CSSProperties}>
              {/* popped out of the bubble one by one; the count ticks as each lands */}
              <Piece id={`t-chip-${i}`} name={`Chip / ${c}`} kind="bubble" tone="#ffffff" order={i} at={0.48 + i * 0.0056} layer={false}>
                <span className="pt-chip">{c}</span>
              </Piece>
            </div>
          ))}
        </span>

        <span className="pt-counts">
          <span className="pt-count pt-c0">
            <Roll digits={2} />
            <span className="pt-clab">products</span>
          </span>
          <span className="pt-count pt-c1">
            <Roll digits={2} />
            <span className="pt-clab">industries</span>
          </span>
          <span className="pt-typed">
            <span>{TALLY.typed}</span>
          </span>
          <i className="pt-pin-dot" style={{ '--x': 0, '--y': 0 } as CSSProperties} />
          <i className="pt-pin-dot" style={{ '--x': 1, '--y': 1 } as CSSProperties} />
        </span>

        {/* the fold: one orbit, one product, one designer */}
        <span className="pt-orbit">
          <span className="pt-ring">
            {TALLY.orbit.map((l, i) => (
              <span key={l} className="pt-lab" style={{ '--a': `${i * 60 - 90}deg` } as CSSProperties}>
                <span>{l}</span>
              </span>
            ))}
          </span>
          <span className="pt-blob">
            <span className="pt-blob-eyes">
              <i />
              <i />
            </span>
          </span>
          <span className="pt-prod">{TALLY.centre}</span>
        </span>
        <span className="pt-me">
          <span className="pt-dot pt-medot">
            <Eyes />
          </span>
          <b className="pt-mename">{TALLY.me.name}</b>
          <span className="pt-meline">{TALLY.me.line}</span>
          <span className="pt-mebig">
            {TALLY.me.big}
            <small>{TALLY.me.unit}</small>
          </span>
        </span>
        <span className="pt-flank pt-fl">{TALLY.flank[0]}</span>
        <span className="pt-flank pt-fr">{TALLY.flank[1]}</span>
      </div>

    </div>
  )
}
