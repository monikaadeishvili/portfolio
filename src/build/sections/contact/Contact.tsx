/** 05 CONTACT — "The conversation": a chat that types itself, then the ask */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { CHAPTERS, EMAIL, FOOTER, LINKS } from '../../../content/story'
import { Arrow, Badge, Button, LinkButton, MomoGlyph, TONE_HEX as T } from '../../../ui/components'
import { Piece, Region, Reveal } from '../../parts'
import { clamp01, pieces, range, registerFx, smooth } from '../../runtime'
import { Artboard, type SectionProps } from '../Artboard'
import { Sticker } from '../hello/Sticker'
import './contact.css'

function Msg({ who, children }: { who: 'you' | 'me'; children: ReactNode }) {
  return (
    <div className={`msg msg-${who}`}>
      <span className="msg-av" aria-hidden="true">
        {who === 'me' ? <img src="/monika.jpg" alt="" width={44} height={44} decoding="async" /> : 'You'}
      </span>
      <p className="msg-b">
        <span className="sr-only">{who === 'me' ? 'Monika: ' : 'You: '}</span>
        {children}
      </p>
    </div>
  )
}
const words = (s: string) =>
  s.split(' ').flatMap((w, i, a) => [
    <span key={i} className="mw">
      {w}
    </span>,
    i < a.length - 1 ? ' ' : null,
  ])

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

export function Contact({ lay, live }: SectionProps) {
  const narrow = lay === 'narrow'
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!live || !root) return
    const msgs = ['k-m0', 'k-m1', 'k-m2', 'k-m3'].map((id) => ({ id, words: Array.from(root.querySelectorAll<HTMLElement>(`[data-cid="${id}"] .mw`)), last: -1 }))
    const typing = root.querySelector<HTMLElement>('[data-cid="k-typing"] .alive')
    const crowd = Array.from(root.closest('.bf')!.querySelectorAll<HTMLElement>('.cw'))
    let lastTy = ''
    let lastCrowd = ''
    return registerFx({
      id: 'contact-chat',
      section: 4,
      update: (e) => {
        if (!e.near) return
        // each bubble types its words after it lands
        msgs.forEach((m) => {
          const c = pieces.get(m.id)
          // heroes wait with their real words; only spat bubbles type themselves
          if (!c || c.kind === 'hero') return
          const d = (c.p1 - c.p0) * 2.6
          const q = e.reduced ? 1 : range(c.p1, c.p1 + d, e.p)
          const n = m.words.length
          const shown = Math.round(q * n * 10)
          if (shown === m.last) return
          m.last = shown
          m.words.forEach((w, j) => {
            const v = clamp01(q * n - j)
            w.style.opacity = v >= 1 ? '' : v.toFixed(2)
          })
        })
        // typing dots wait, then make room for Monika's first answer
        const reply = pieces.get('k-m1')
        if (typing && reply) {
          const out = smooth(reply.p0 + (reply.p1 - reply.p0) * 0.6, reply.p1, e.p)
          const k = out.toFixed(2)
          if (k !== lastTy) {
            lastTy = k
            typing.style.setProperty('--out', k)
          }
        }
        // the crowd wanders in from both edges for the family photo
        const g = range(0.84, 0.95, e.u)
        const key = g.toFixed(3) + (e.u > 0.95 ? Math.floor(e.t * 20) : '')
        if (key === lastCrowd) return
        lastCrowd = key
        crowd.forEach((el, i) => {
          const side = i % 2 ? 1 : -1
          const delay = (i % 3) * 0.08
          const a = e.reduced ? 1 : smooth(delay, delay + 0.8, g)
          const x = (1 - a) * side * 900
          const walking = a > 0.02 && a < 0.98
          const hop = walking ? Math.abs(Math.sin((e.t * 9 + i) * 1.4)) * -14 : Math.sin(e.t * 2.4 + i) * -4 * (a >= 1 ? 1 : 0)
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${hop.toFixed(1)}px, 0)`
          el.style.opacity = a < 0.01 ? '0' : '1'
          el.dataset.walk = walking ? '1' : '0'
        })
      },
    })
  }, [live])

  return (
    <Artboard idx={4} live={live} lay={lay}>
      <div ref={rootRef} className="k-root">
        <Region index={0} label="Conversation" className="k-r0" weight={1.4}>
          <div className="chat" role="log" aria-label="Conversation">
            <Piece id="k-head" name="Chat header" kind="bubble" travel="rain" tone={T.pink} order={0} className="chat-headslot">
              <header className="chat-head">
                <span className="chat-av">
                  <img src="/monika.jpg" alt="" width={48} height={48} decoding="async" />
                  <i aria-hidden="true" />
                </span>
                <span className="chat-who">
                  <b>Monika Adeishvili</b>
                  <span>online · usually replies within a day</span>
                </span>
                <span className="chat-tools" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </header>
            </Piece>
            <div className="chat-thread">
              <span className="chat-day" aria-hidden="true">
                Today
              </span>
              <Piece id="k-m0" name="Message / You" kind="bubble" travel="rain" tone={T.sky} order={1} at={0.16} className="m-you">
                <Msg who="you">{words('Hi Monika — are you taking on new work?')}</Msg>
              </Piece>
              <div className="m-pair">
                <Piece id="k-typing" name="Typing…" kind="bubble" travel="rain" tone={T.pink} order={2} at={0.3} className="m-typing">
                  <span className="typing" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </Piece>
                <Piece id="k-m1" name="Message / Monika" kind="hero" travel="leap" tone={T.violet} order={3} at={0.52} park="150,n+120" parkN="10,n+30" className="m-me" eyes={{ x: 8, y: 0, s: 20 }}>
                  <Msg who="me">{words('I am. Product design, design systems, and teams that care.')}</Msg>
                </Piece>
              </div>
              <Piece id="k-m2" name="Message / You" kind="bubble" travel="rain" tone={T.sky} order={4} at={0.68} className="m-you">
                <Msg who="you">{words('What would we build?')}</Msg>
              </Piece>
              <Piece id="k-m3" name="Message / Monika" kind="hero" travel="leap" tone={T.violet} order={5} at={0.94} park="150,n+320" className="m-me m-big" eyes={{ x: 8, y: 0, s: 20 }}>
                <Msg who="me">
                  {words('Something people')} <em className="mw">won't</em> <em className="mw">ignore.</em>
                </Msg>
              </Piece>
            </div>
            <Piece id="k-compose" name="Composer" kind="bubble" travel="rain" tone={T.violet} order={6} className="chat-composeslot">
              <div className="chat-compose" aria-hidden="true">
                <span>Write a message…</span>
                <i>
                  <Arrow />
                </i>
              </div>
            </Piece>
          </div>
        </Region>

        <Region index={1} label="Finale" className="k-r1">
          <Piece id="k-badge" name="Badge" kind="bubble" travel="rain" tone={T.mint} order={0}>
            <Badge tone="pink">Open to new work</Badge>
          </Piece>
          <Reveal id="k-title" as="h2" hid="h-contact" segs={CHAPTERS[4].headline} className="rv-title k-title" />
          <Reveal id="k-para" mode="type" segs={[CHAPTERS[4].body]} className="rv-para k-para" order={1} />
          <div className="k-cta-row">
            <Piece id="k-cta" name="Button / CTA" kind="hero" travel="leap" tone={T.violet} order={9} at={0.97} park="420,b+120" parkN="60,b+40" className="k-cta" eyes={{ x: 6, y: 50, s: 24 }}>
              <Button size="xl" href={`mailto:${EMAIL}`} icon="right" className="k-cta-btn">
                Say hello
              </Button>
            </Piece>
            <span className="f5-mascot-spot" aria-hidden="true" />
          </div>
          <ul className="k-links" aria-label="Elsewhere">
            {LINKS.map((l, i) => (
              <li key={l.label}>
                <Piece id={`k-l${i}`} name={`Link / ${l.label}`} kind="bubble" travel="rain" tone={T.ink} order={3 + i}>
                  <LinkButton href={l.href}>{l.label}</LinkButton>
                </Piece>
              </li>
            ))}
          </ul>
          <Piece id="k-foot" name="Footer" kind="bubble" travel="rain" tone={T.ink} order={7} className="k-footslot">
            <footer className="k-foot">
              <MomoGlyph size={20} />
              <span>{FOOTER}</span>
            </footer>
          </Piece>
        </Region>
      </div>
      {live && (
        <div className="crowd" aria-hidden="true">
          <Member k={0} look={1}>
            <Sticker ring="OPEN TO NEW WORK" tone="mint" glyph="arrow" size={120} />
          </Member>
          <Member k={1} look={1}>
            <span className="cw-pass">
              <b>TBS</b> → <b>ALC</b>
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
            <span className="cw-stamp">DAZN</span>
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
