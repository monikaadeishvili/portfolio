/**
 * 04 SAY HELLO — one poster: a huge headline whose last words drop in letter by
 * letter over a marker stroke, and one big Say hello button that bursts
 * confetti. When the balloon pops on the way in, its pieces (badge, button,
 * email chip, links) are thrown onto the canvas around the board and crawl to
 * their places as you scroll. The letters hop under the cursor, the email copies
 * with a click, and the crowd walks in from the screen edges and jumps when
 * poked. ./posterFx.ts drives it all.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CHAPTERS, EMAIL, FOOTER, LINKS } from '../../../content/story'
import { Badge, Button, LinkButton, MomoGlyph, TONE_HEX as T } from '../../../ui/components'
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
          <Piece id="k-badge" name="Badge" kind="hero" travel="crawl" tone={T.mint} order={0} at={0.35} park="-300,40" parkN="40,-150" eyes={{ x: 50, y: -8, s: 16 }}>
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
            <Piece id="k-cta" name="Button / CTA" kind="hero" travel="crawl" tone={T.violet} order={1} at={0.92} park="1190,560" parkN="200,-120" className="k-cta" eyes={{ x: 6, y: 50, s: 24 }}>
              <Button size="xl" href={`mailto:${EMAIL}`} icon="right" className="k-cta-btn">
                Say hello
              </Button>
            </Piece>
            <span className="k-confetti" aria-hidden="true">
              {Array.from({ length: 16 }, (_, i) => (
                <i key={i} style={{ '--c': ['#ff7ad1', '#8b5cff', '#ffd84d', '#2db8ff', '#b6f03a'][i % 5] } as CSSProperties} />
              ))}
            </span>
          </div>
        </Region>

        <Region index={1} label="Sign-off" className="k-r1">
          <Piece id="k-mail" name="Chip / Email" kind="hero" travel="crawl" tone={T.violet} order={0} at={0.35} park="-360,30" parkN="10,b+40" eyes={{ x: 8, y: -8, s: 16 }}>
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
                <Piece
                  id={`k-l${i}`}
                  name={`Link / ${l.label}`}
                  kind="hero"
                  travel="crawl"
                  tone={T.ink}
                  order={1 + i}
                  at={0.6 + i * 0.2}
                  park={i ? '1200,150' : '1180,20'}
                  parkN={i ? '210,b+130' : '40,b+150'}
                  eyes={{ x: 50, y: -10, s: 14 }}
                >
                  <LinkButton href={l.href}>{l.label}</LinkButton>
                </Piece>
              </li>
            ))}
          </ul>
          <footer className="k-foot">
            <MomoGlyph size={20} />
            <span>{FOOTER}</span>
          </footer>
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
