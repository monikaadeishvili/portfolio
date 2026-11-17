/**
 * 03 Proof, part one — the running total. Six cards about her land on the grid
 * paper; beside them a counter rolls up to 32 products and 10 industries as the
 * client names fill in beneath. Everything is still once it has landed.
 * ./tallyFx.ts drives the names and the counts.
 */
import type { CSSProperties } from 'react'
import { TALLY } from '../../../content/story'
import { Piece } from '../../parts'

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

/** the top of a card about her: a big word or number and a small still doodle */
function Fact({ id, big }: { id: string; big: string }) {
  if (id === 'home')
    return (
      <span className="pt-sun">
        <span className="pt-eyes" aria-hidden="true">
          <i />
          <i />
        </span>
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
      {id === 'teach' && <span className="pt-dd pt-dd-pill">101</span>}
      {id === 'ai' && <span className="pt-dd pt-dd-pill">PRO</span>}
      {id === 'hello' && <span className="pt-dd pt-dd-wave">გა!</span>}
    </>
  )
}

export function Tally() {
  return (
    <div className="pt-stage">
      <p className="sr-only">
        {TALLY.chips.length} client products across {TALLY.industries} industries: {TALLY.chips.join(', ')}. About her:{' '}
        {TALLY.cards.map((c) => `${c.big} ${c.name}, ${c.line}`.trim()).join('; ')}.
      </p>
      <div className="pt-board" aria-hidden="true">
        <div className="pt-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={`v${i}`} className="pt-v" style={{ '--i': i } as CSSProperties} />
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            <i key={`h${i}`} className="pt-h" style={{ '--i': i } as CSSProperties} />
          ))}
        </div>

        {TALLY.cards.map((c, i) => (
          <div
            key={c.id}
            className="pt-cardslot"
            style={
              {
                '--cw': c.at[0],
                '--rw': c.at[1],
                '--cn': i % 3,
                '--rn': Math.floor(i / 3),
                '--rest': `${(((i * 37) % 5) - 2) * 1.2}deg`,
              } as CSSProperties
            }
          >
            <Piece id={`t-${c.id}`} name={`Card / ${c.name}`} kind="bubble" tone={c.mk} order={i} at={0.12 + i * 0.06} eyes={false} className="fill">
              <span className="pt-card" data-id={c.id} style={{ '--bg': c.bg, '--fg': c.fg, '--mk': c.mk } as CSSProperties}>
                <span className="pt-top">
                  <Fact id={c.id} big={c.big} />
                </span>
                <b className="pt-cname">{c.name}</b>
                <span className="pt-cline">{c.line}</span>
              </span>
            </Piece>
          </div>
        ))}

        <span className="pt-counts">
          <span className="pt-count pt-c0">
            <Roll digits={2} />
            <span className="pt-clab">products</span>
          </span>
          <span className="pt-count pt-c1">
            <Roll digits={2} />
            <span className="pt-clab">industries</span>
          </span>
          <span className="pt-typed">{TALLY.typed}</span>
        </span>

        {/* the client products: a strip of names that fills in as you scroll */}
        <span className="pt-chips">
          <span className="pt-more">Client products</span>
          {TALLY.chips.map((c) => (
            <span key={c} className="pt-chip">
              {c}
            </span>
          ))}
        </span>
      </div>
    </div>
  )
}
