/**
 * 04 SAY HELLO — "Try to ignore it". One poster: a huge headline whose last
 * words drop in letter by letter over a marker stroke, and one button, Ignore,
 * that can never be pressed: it ducks away, talks back, and finally gives in as
 * "Fine, say hello", bursting confetti. The letters hop under the cursor, the
 * email copies with a click, and the crowd along the bottom jumps when poked.
 * ./posterFx.ts drives it all.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CHAPTERS, EMAIL, FOOTER, LINKS } from '../../../content/story'
import { Badge, LinkButton, MomoGlyph, TONE_HEX as T } from '../../../ui/components'
import { Piece, Region, Reveal } from '../../parts'
import { Artboard, type SectionProps } from '../Artboard'
import { Sticker } from '../hello/Sticker'
import { mountPoster } from './posterFx'
import './contact.css'

/** decorative crowd member: a tiny version of a hero, with eyes and legs */
function Member({ k, children, look = 1 }: { k: number; children: ReactNode; look?: number }) {
  return (
    <span className="cw" style={{ '--k': k, '--look': look } as CSSProperties}>
      <span className="cw-body">
        {children}
        <span className="cw-eyes">
          <i />
          <i />
        </span>
      </span>
      <span className="cw-legs">
        <i />
        <i />
      </span>
    </span>
  )
}

const EM = "won't ignore."
/** a seeded tilt per letter, so the drop and the hops never look mechanical */
const tilt = (i: number) => (((i * 47) % 9) - 4) * 3.4

export function Contact({ lay, live }: SectionProps) {
  const narrow = lay === 'narrow'
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    // the interactions work on the still page too; the scroll life only when live
    return mountPoster(root, narrow, live)
  }, [live, narrow])

  const sans = CHAPTERS[3].headline.filter((s): s is string => typeof s === 'string').join('').trim()
  // two sans lines: "Let's build" / "something people"
  const l1 = "Let's build"
  const l2 = sans.replace(`${l1} `, '')

  return (
    <Artboard idx={3} live={live} lay={lay}>
      <div ref={rootRef} className="k-root">
        <Region index={0} label="Poster" className="k-r0">
          <Piece id="k-badge" name="Badge" kind="bubble" travel="rain" tone={T.mint} order={0}>
            <Badge tone="pink">Open to new work</Badge>
          </Piece>

          <h2 id="h-contact" className="rv-title k-title" tabIndex={-1}>
            <Reveal id="k-title-1" as="span" segs={[l1]} className="rv-title k-sans" label="Heading" />
            <Reveal id="k-title-2" as="span" segs={[l2]} className="rv-title k-sans" order={1} label="Heading" />
            <span className="sr-only"> {EM}</span>
            <span className="k-em" aria-hidden="true">
              <span className="k-mark" />
              {EM.split('').map((ch, i) =>
                ch === ' ' ? (
                  <span key={i} className="k-sp" />
                ) : (
                  <span key={i} className="k-l" style={{ '--r': `${tilt(i)}deg` } as CSSProperties}>
                    <span className="k-li">{ch}</span>
                  </span>
                ),
              )}
            </span>
          </h2>

          <Reveal id="k-para" mode="type" segs={[CHAPTERS[3].body]} className="rv-para k-para" order={2} />

          <div className="k-pen">
            <div className="k-row">
              <span className="k-ig-home">
                <span className="k-ig-halo">
                  <button type="button" className="k-ig" data-step="0">
                    <span className="k-ig-in">Ignore</span>
                  </button>
                  <a className="k-ig k-ig-yes" href={`mailto:${EMAIL}`} tabIndex={-1}>
                    <span className="k-ig-in">Fine, say hello →</span>
                  </a>
                </span>
              </span>
            </div>
            <p className="k-count">
              Times ignored: <b>0</b>
            </p>
            <span className="k-live sr-only" aria-live="polite" />
            <span className="k-confetti" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} style={{ '--c': ['#ff7ad1', '#8b5cff', '#ffd84d', '#2db8ff', '#b6f03a'][i % 5] } as CSSProperties} />
              ))}
            </span>
          </div>
        </Region>

        <Region index={1} label="Sign-off" className="k-r1">
          <Piece id="k-mail" name="Chip / Email" kind="bubble" travel="rain" tone={T.violet} order={0}>
            <button type="button" className="k-mail" aria-label="Copy email address">
              <span className="k-mail-a">{EMAIL}</span>
              <span className="k-mail-b">
                <span className="k-mail-t">Copy</span>
                <span className="k-mail-t k-mail-ok">Copied ✓</span>
              </span>
            </button>
          </Piece>
          <ul className="k-links" aria-label="Elsewhere">
            {LINKS.map((l, i) => (
              <li key={l.label}>
                <Piece id={`k-l${i}`} name={`Link / ${l.label}`} kind="bubble" travel="rain" tone={T.ink} order={1 + i}>
                  <LinkButton href={l.href}>{l.label}</LinkButton>
                </Piece>
              </li>
            ))}
          </ul>
          <Piece id="k-foot" name="Footer" kind="bubble" travel="rain" tone={T.ink} order={5} className="k-footslot">
            <footer className="k-foot">
              <MomoGlyph size={20} />
              <span>{FOOTER}</span>
            </footer>
          </Piece>
        </Region>
      </div>
      {live && (
        <div className="crowd">
          <Member k={0} look={1}>
            <Sticker ring="OPEN TO NEW WORK" tone="mint" glyph="arrow" size={120} />
          </Member>
          <Member k={1} look={1}>
            <span className="cw-hi">
              <b>Hi!</b>
              <span lang="ka">გამარჯობა</span>
            </span>
          </Member>
          {!narrow && (
            <Member k={2} look={1}>
              <span className="cw-switch">
                <i />
              </span>
            </Member>
          )}
          {!narrow && (
            <Member k={3} look={-1}>
              <span className="cw-stat">7+</span>
            </Member>
          )}
          <Member k={4} look={-1}>
            <span className="cw-ai">
              AI<i>PRO</i>
            </span>
          </Member>
          {!narrow && (
            <Member k={5} look={-1}>
              <Sticker ring="BASED IN ALICANTE" tone="yellow" glyph="sun" size={110} />
            </Member>
          )}
        </div>
      )}
    </Artboard>
  )
}
