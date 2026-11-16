/**
 * 04 SAY HELLO — "The Daily Hello": the back page of a one-issue newspaper.
 * A blackletter masthead, a dateline, two columns of small classifieds (each a
 * true fact about her) and, in the middle, her display ad that refuses to behave
 * like newsprint: googly eyes that watch the reader, a yellow overprint, a red
 * pen circle and a HIRED? stamp. The site's alive pieces (badge, Say hello
 * button, email coupon, links) wait on the canvas and crawl onto the paper. The
 * reader answers with the button or by clipping the coupon. ./posterFx.ts
 * prints the page as you scroll and runs the interactions.
 */
import { useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import '@fontsource/unifrakturcook/700.css'
import '@fontsource/playfair-display/900.css'
import '@fontsource/playfair-display/900-italic.css'
import '@fontsource/old-standard-tt/400.css'
import '@fontsource/old-standard-tt/400-italic.css'
import '@fontsource/old-standard-tt/700.css'
import '@fontsource/caveat/700.css'
import { CHAPTERS, EMAIL, FOOTER, LINKS, PAPER } from '../../../content/story'
import { Badge, Button, LinkButton, TONE_HEX as T } from '../../../ui/components'
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
/** a seeded tilt per letter, so the drop never looks mechanical */
const tilt = (i: number) => (((i * 47) % 9) - 4) * 3.4

/** a hand-drawn red-pen loop; drawn by animating its dash */
const Circle = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d="M52 5C80 4 97 23 96 51C95 80 71 97 45 96C18 95 3 75 4 47C6 21 27 6 58 8" pathLength={1} />
  </svg>
)

/** where each column prints as the ink roller passes (top-region progress) */
const PRINT = { left: 0.24, ad: 0.4, right: 0.56 }

function SmallAd({ head, text, at, phone }: { head: string; text: string; at: number; phone: boolean }) {
  return (
    <div className="np-small" data-print={at.toFixed(3)} data-phone={phone ? '' : undefined} role="button" tabIndex={0} aria-label={`${head} ${text} (circle it)`}>
      <p>
        <b>{head}</b> {text}
      </p>
      <Circle className="np-circle" />
    </div>
  )
}

export function Contact({ lay, live }: SectionProps) {
  const narrow = lay === 'narrow'
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    // the interactions work on the still page too; the printing only when live
    return mountPoster(root, narrow, live)
  }, [live, narrow])

  // today's date, like a real dateline
  const today = useMemo(() => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), [])
  const sans = CHAPTERS[3].headline.filter((s): s is string => typeof s === 'string').join('').trim()
  const l1 = "Let's build"
  const l2 = sans.replace(`${l1} `, '')
  const col = (c: { ads: readonly (readonly [string, string])[] }, at: number) =>
    c.ads.map(([h, t], j) => <SmallAd key={h} head={h} text={t} at={at + j * 0.015} phone={(PAPER.phone as readonly string[]).includes(h)} />)

  return (
    <Artboard idx={3} live={live} lay={lay}>
      <div ref={rootRef} className="k-root np">
        <Region index={0} label="Front page" className="np-r0">
          <header className="np-mast">
            <div className="np-ear" data-print="0.02">
              <b>{PAPER.earL[0]}</b>
              <i>{PAPER.earL[1]}</i>
            </div>
            <Reveal id="k-mast" as="p" segs={[PAPER.title]} className="np-title" label="Masthead" />
            <div className="np-ear" data-print="0.04">
              <b>{PAPER.earR[0]}</b>
              <i>{PAPER.earR[1]}</i>
            </div>
          </header>
          <div className="np-date">
            <i className="np-rule np-rule-t" />
            <span>{PAPER.vol}</span>
            <span>
              {PAPER.place} — {today}
            </span>
            <span>{PAPER.section}</span>
            <i className="np-rule np-rule-b" />
          </div>

          <div className="np-grid">
            <i className="np-vr np-vr-l" />
            <i className="np-vr np-vr-r" />
            <section className="np-col np-col-l" aria-label={PAPER.left.head}>
              <h4 data-print={(PRINT.left - 0.02).toFixed(3)}>{PAPER.left.head}</h4>
              {col(PAPER.left, PRINT.left)}
            </section>

            <article className="np-lead">
              <span className="np-lead-frame" data-print={PRINT.ad.toFixed(3)} />
              <span className="np-badge">
                <Piece id="k-badge" name="Badge" kind="hero" travel="crawl" tone={T.mint} order={0} at={0.35} park="-300,40" parkN="40,-150" eyes={{ x: 50, y: -8, s: 16 }}>
                  <Badge tone="pink">Open to new work</Badge>
                </Piece>
              </span>
              <span className="np-eyes" data-print={PRINT.ad.toFixed(3)} aria-hidden="true">
                <i />
                <i />
              </span>
              <p className="np-over" data-print={(PRINT.ad + 0.02).toFixed(3)}>
                {PAPER.overline}
              </p>
              <h2 id="h-contact" className="k-title np-head" tabIndex={-1}>
                <Reveal id="k-title-1" as="span" segs={[l1]} className="np-hl" label="Heading" />
                <Reveal id="k-title-2" as="span" segs={[l2]} className="np-hl" order={1} label="Heading" />
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
              <Reveal id="k-para" mode="type" segs={[CHAPTERS[3].body]} className="np-body" order={2} />
              <p className="np-by" data-print={(PRINT.ad + 0.1).toFixed(3)}>
                {PAPER.byline}
              </p>
              <div className="k-pen">
                <Piece id="k-cta" name="Button / CTA" kind="hero" travel="crawl" tone={T.violet} order={1} at={0.92} park="1190,560" parkN="200,-120" className="k-cta" eyes={{ x: 6, y: 50, s: 24 }}>
                  <Button size="xl" href={`mailto:${EMAIL}`} icon="right" className="k-cta-btn">
                    Say hello
                  </Button>
                </Piece>
                <span className="k-confetti" aria-hidden="true">
                  {Array.from({ length: 16 }, (_, i) => (
                    <i key={i} style={{ '--c': ['#1c1917', '#e4352b', '#ffd84d'][i % 3] } as CSSProperties} />
                  ))}
                </span>
              </div>
              <p className="np-apply" data-print={(PRINT.ad + 0.12).toFixed(3)}>
                {PAPER.apply}
              </p>
              {/* the red pen and the stamp: someone has already found this ad */}
              <Circle className="np-circle np-lead-circle" />
              <span className="np-note" aria-hidden="true">
                {PAPER.note}
              </span>
              <button type="button" className="np-stamp" aria-label="Stamp it again">
                <span>{PAPER.stamps[0]}</span>
              </button>
            </article>

            <section className="np-col np-col-r" aria-label={PAPER.right.head}>
              <h4 data-print={(PRINT.right - 0.02).toFixed(3)}>{PAPER.right.head}</h4>
              {col(PAPER.right, PRINT.right)}
            </section>
          </div>
          {/* the ink roller that prints the columns as it passes */}
          <div className="np-clip" aria-hidden="true">
            <i className="np-roller" />
          </div>
        </Region>

        <Region index={1} label="Coupon & sign-off" className="np-r1">
          <Piece id="k-mail" name="Coupon / Email" kind="hero" travel="crawl" tone={T.violet} order={0} at={0.35} park="-360,30" parkN="10,b+40" eyes={{ x: 8, y: -8, s: 16 }}>
            <button type="button" className="k-mail np-coupon" aria-label="Copy email address">
              <span className="np-scissors" aria-hidden="true">
                ✂
              </span>
              <span className="np-chead">{PAPER.coupon.head}</span>
              <span className="np-cmail">{EMAIL}</span>
              <span className="np-cact">
                <span className="np-cact-a">{PAPER.coupon.act}</span>
                <span className="np-cact-b">{PAPER.coupon.done}</span>
              </span>
            </button>
          </Piece>
          <div className="np-links">
            <span className="np-else">{PAPER.elsewhere}</span>
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
          </div>
          <footer className="k-foot np-foot">
            <span>{FOOTER}</span>
            <i aria-hidden="true">·</i>
            <span>{PAPER.printed}</span>
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
              <span className="cw-stat">8+</span>
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
