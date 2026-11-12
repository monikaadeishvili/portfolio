/**
 * 01 HELLO — "Everyone has the same tools now. Not the same taste."
 * The section proves its own headline: it opens as the default anyone gets
 * from the same tools, and scrolling applies taste (see ./taste.ts).
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Arrow, Badge, Button, NavBar, Tooltip, TONE_HEX as T } from '../../../ui/components'
import { PortraitDeck } from '../../../ui/PortraitDeck'
import { EMAIL, HELLO } from '../../../content/story'
import { scene, tool } from '../../../scene/store'
import { Piece, Region, Reveal, useSection } from '../../parts'
import { pieces, registerFx, registerText } from '../../runtime'
import { phOf, secP } from '../../worlds'
import { Artboard, type SectionProps } from '../Artboard'
import { Sticker } from './Sticker'
import { TasteSwitch } from './TasteSwitch'
import { mountTaste, taste } from './taste'
import './hello.css'

const MQ = HELLO.marquee
const MQ_LABEL = 'From a blank Figma file to a product people use'

/** the portrait deck plays only once it is placed, frame 01 sits flat and taste is on */
function portraitCanDrag() {
  if (scene.reduced) return true
  if (tool.get() === 'hand') return false
  const c = pieces.get('h-deck')
  if (!c || c.pose.state !== 'placed') return false
  if (taste.target < 0.5) return false
  return scene.p >= secP(0, phOf(0).flat) && scene.p <= secP(0, 1)
}

/** a designed text block listed in the Layers panel (the taste engine moves it) */
function useLayerText(ref: RefObject<HTMLElement | null>, id: string, label: string) {
  const ctx = useSection()
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ctx.live) return
    return registerText({ id, section: 0, region: 0, order: 0, mode: 'pre', el, words: [], label })
  }, [ctx.live, ref, id, label])
}

function Words({ text, em }: { text: string; em?: boolean }) {
  const ws = text.split(' ')
  return (
    <>
      {ws.flatMap((w, i) => [
        <span key={i} className={`rw${em ? ' rw-em' : ''}`}>
          <span className="rw-in">{w}</span>
        </span>,
        i < ws.length - 1 ? ' ' : null,
      ])}
    </>
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

function Ticket({ name }: { name: string }) {
  return (
    <span className="h-tk">
      <span className="h-tk-stub">
        Worked
        <br />
        with
      </span>
      <span className="h-tk-name">{name}</span>
    </span>
  )
}

function Intro({ narrow, live, onNav, onJump, plain, onToggle }: { narrow: boolean; live: boolean; onNav: SectionProps['onNav']; onJump: SectionProps['onJump']; plain: boolean; onToggle: () => void }) {
  const h1Ref = useRef<HTMLHeadingElement>(null)
  const leadRef = useRef<HTMLParagraphElement>(null)
  const introRef = useRef<HTMLParagraphElement>(null)
  useLayerText(h1Ref, 'h-title', 'Heading / H1')
  useLayerText(leadRef, 'h-lead', 'Paragraph / Lead')
  useLayerText(introRef, 'h-intro', 'Caption / Intro')
  const [s0, s1, s2] = HELLO.support

  return (
    <Region index={0} label="Intro" className={`h-r0${plain ? ' is-plain' : ''}`} hold="0.52,0.36,0.64">
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
            {s0}
            {s1}
            {s2}
          </p>
          <div className="hd-ctas">
            <span className="hd-btn" data-tw="btn">
              {HELLO.primary}
            </span>
            <span className="hd-btn2" data-tw="ghost">
              {HELLO.ghost}
            </span>
          </div>
          <span className="hd-img" data-tw="img">
            <ImageIcon />
          </span>
          <span className="hd-cap" data-tw="intro">
            {HELLO.intro}
          </span>
        </div>
      </div>
      {live && (
        <div className="h-shards" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={`hd-shard s${i}`} />
          ))}
        </div>
      )}

      {/* the designed layer */}
      <div className="h-top">
        <Piece id="h-nav" name="NavBar" kind="bubble" tone={T.violet} order={0} at={0.42} className="h-nav">
          <div className="h-swap">
            <NavBar compact={narrow} onNav={onNav} />
          </div>
        </Piece>
        <Piece id="h-switch" name="Taste switch" kind="hero" tone={T.violet} travel="leap" order={0} at={0.18} dur={0.17} park="40,-182" parkN="16,-138" className="h-swslot" eyes={{ x: 24, y: 2, s: 18 }}>
          <TasteSwitch checked={live ? undefined : !plain} onToggle={onToggle} />
        </Piece>
      </div>
      <div className="h-main">
        <div className="h-copy">
          <Piece id="h-badge" name="Badge" kind="bubble" tone={T.mint} order={1} at={0.5}>
            <div className="h-swap">
              <Badge>{HELLO.badge}</Badge>
            </div>
          </Piece>
          <h1 className="rv-title h-title" id="h-hello" tabIndex={-1} ref={h1Ref}>
            <span className="sr-only">
              {HELLO.line1} {HELLO.line2}
            </span>
            <span className="h-vis" aria-hidden="true">
              <span className="h-l1">
                <Words text={HELLO.line1} />
              </span>
              <span className="h-l2">
                <Words text={HELLO.line2} em />
              </span>
            </span>
          </h1>
          <p className="h-lead" ref={leadRef}>
            {s0}
            <strong className="h-mark">
              {s1}
              <svg viewBox="0 0 120 14" preserveAspectRatio="none" aria-hidden="true">
                <path pathLength={1} d="M2 9.5C22 6 44 5.2 63 6.4c17 1 36 2.6 55-1.6" />
              </svg>
            </strong>
            {s2}
          </p>
          <div className="row h-ctas">
            <Piece id="h-btn" name="Button / Primary" kind="hero" tone={T.violet} travel="leap" order={3} at={0.8} dur={0.28} park="930,690" eyes={{ x: 8, y: 50, s: 18 }}>
              <div className="h-swap">
                <Button icon="down" size="xl" onClick={() => onJump(1)}>
                  {HELLO.primary}
                </Button>
              </div>
            </Piece>
            <Piece id="h-ghost" name="Button / Ghost" kind="bubble" tone={T.yellow} order={4} at={0.7}>
              <div className="h-swap">
                <Button variant="ghost" size="xl" href={`mailto:${EMAIL}`}>
                  {HELLO.ghost}
                </Button>
              </div>
            </Piece>
          </div>
        </div>
        <div className="h-art" data-deck-scope="">
          <Piece id="h-deck" name="Portrait deck" kind="hero" tone={T.coral} travel="leap" order={2} at={0.58} dur={0.3} park="-150,214" className="h-deck" eyes={{ x: 72, y: 0, s: 26 }}>
            <div className="h-swap">
              <PortraitDeck name="Product designer" note="Alicante" canDrag={portraitCanDrag} />
            </div>
          </Piece>
          <Piece id="h-tip" name="Tooltip" kind="bubble" tone={T.ink} order={5} at={0.92} className="h-tip">
            <div className="h-swap">
              <Tooltip>
                <span className="u-tip-swap">
                  <span>Hi, I&rsquo;m Monika</span>
                  <span aria-hidden="true">drag me</span>
                </span>
              </Tooltip>
            </div>
          </Piece>
          <p className="h-intro" ref={introRef}>
            {HELLO.intro}
          </p>
        </div>
      </div>
    </Region>
  )
}

export function Hello({ lay, live, onNav, onJump }: SectionProps) {
  const narrow = lay === 'narrow'
  const boardRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  // static / reduced motion: the switch is an instant crossfade
  const [plain, setPlain] = useState(false)
  const onToggle = () => {
    if (live) taste.toggle()
    else setPlain((v) => !v)
  }

  // the taste engine
  useLayoutEffect(() => {
    const board = boardRef.current?.closest<HTMLElement>('.bf')
    if (!live || !board) return
    return mountTaste(board)
  }, [live, lay])

  // the marquee drifts with the scroll
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!live || !el) return
    let last = ''
    return registerFx({
      id: 'hello-marquee',
      section: 0,
      update: (e) => {
        if (!e.near) return
        const x = -((e.p * 9000) % (el.scrollWidth / 2))
        const k = x.toFixed(1)
        if (k === last) return
        last = k
        el.style.transform = `translate3d(${k}px, 0, 0)`
      },
    })
  }, [live])

  const mq = (
    <span>
      <span className="mq-o">{MQ.lead}</span>
      <span className="mq-o mq-empty">{MQ.empty}</span>
      <span className="mq-o">{MQ.mid}</span>
      <span className="mq-f">{MQ.full}</span>
      <span className="mq-f">{MQ.tail}</span>
    </span>
  )

  return (
    <Artboard
      idx={0}
      live={live}
      lay={lay}
      under={
        <>
          {live && <div className="h-cv" aria-hidden="true" />}
          <div className="h-plainbg" aria-hidden="true" />
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
      <Intro narrow={narrow} live={live} onNav={onNav} onJump={onJump} plain={plain} onToggle={onToggle} />

      <Region index={1} label="Facts" className="h-r1">
        <Piece id="h-marquee" name="Marquee" kind="bubble" tone={T.coral} order={0} className="h-marquee">
          <div className="h-mq" role="img" aria-label={MQ_LABEL}>
            <div className="h-mq-track" ref={trackRef} aria-hidden="true">
              {mq}
              {mq}
            </div>
          </div>
        </Piece>
        <div className="h-facts">
          <div className="h-facts-l">
            <Reveal id="h-facts-l" as="p" mode="rise" segs={['A few facts, ', { em: 'slapped on.' }]} className="rv-kicker h-kicker" label="Kicker" />
            <ul className="h-tickets" aria-label="Worked with">
              {HELLO.workedWith.map((n, i) => (
                <li key={n}>
                  <Piece id={`h-tk${i}`} name={`Ticket / ${n}`} kind="bubble" tone={i ? T.mint : T.yellow} order={i + 1}>
                    <Ticket name={n} />
                  </Piece>
                </li>
              ))}
            </ul>
          </div>
          <ul className="h-stickers" aria-label="Quick facts">
            <li>
              <Piece id="h-st0" name="Sticker / Years" kind="hero" tone={T.pink} travel="slap" order={1} park="-250,40" parkN="210,590" eyes={{ x: 50, y: 70, s: 22 }} legs={false}>
                <Sticker ring="7+ YEARS OF TASTE" tone="pink" big="7+" />
              </Piece>
            </li>
            <li>
              <Piece id="h-st1" name="Sticker / Products" kind="hero" tone={T.yellow} travel="slap" order={2} park="1130,400" eyes={{ x: 50, y: 70, s: 22 }} legs={false}>
                <Sticker ring="18 CLIENT PRODUCTS" tone="yellow" big="18" />
              </Piece>
            </li>
            <li>
              <Piece id="h-st2" name="Sticker / Open" kind="hero" tone={T.mint} travel="slap" order={3} park="460,b+70" eyes={{ x: 50, y: 64, s: 22 }} legs={false}>
                <Sticker ring="OPEN TO NEW WORK" tone="mint" glyph="arrow" />
              </Piece>
            </li>
          </ul>
        </div>
        <Piece id="h-hint" name="Scroll hint" kind="bubble" tone={T.violet} order={5} at={1} className="h-hint">
          <p className="h-hint-p">
            <span className="h-hint-a">{HELLO.hint[0]}</span> <em className="h-hint-b">{HELLO.hint[1]}</em>
            <span className="h-hint-ar" aria-hidden="true">
              <Arrow dir="down" />
            </span>
          </p>
        </Piece>
      </Region>
    </Artboard>
  )
}
