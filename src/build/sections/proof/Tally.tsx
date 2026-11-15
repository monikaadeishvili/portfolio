/**
 * 03 Proof, part one — the running total. On grid paper, thirteen stickers land
 * one by one (six client products, seven facts about her), the other 26 client
 * products follow as chips, and the counters add up to 32 products and 10
 * industries. Then everything folds into
 * one orbit around "your product", and a single card drops out below it: one
 * designer, all of the above. Everything is spat out by the bubble, which then
 * shrinks and hops in the middle of the orbit. ./tallyFx.ts drives it from the
 * region's progress.
 */
import type { CSSProperties } from 'react'
import { TALLY } from '../../../content/story'

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
        {TALLY.cards.map((c, i) => (
          <span
            key={c.id}
            className="pt-fly pt-cardslot"
            style={{ '--cw': c.at[0], '--rw': c.at[1], '--cn': i % 3, '--rn': Math.floor(i / 3), '--rest': `${(((i * 37) % 5) - 2) * 1.2}deg`, '--i': i } as CSSProperties}
          >
            <span className="pt-arc">
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
            </span>
          </span>
        ))}
        <span className="pt-chips">
          {TALLY.chips.map((c, i) => (
            <span key={c} className="pt-fly pt-chipslot" data-w={Math.floor((i * 4) / TALLY.chips.length)} style={{ '--k': i % 7 } as CSSProperties}>
              <span className="pt-chip">{c}</span>
            </span>
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
        <span className="pt-drop" />
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
