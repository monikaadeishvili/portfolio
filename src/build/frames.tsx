/**
 * The five frames of Page 2. Every visible piece is a real component wrapped
 * in <Alive>; its slot is its final layout box, so the finished frame is plain
 * semantic markup and every word of the story is always in the DOM.
 */
import { useMemo, type ReactNode } from 'react'
import { Alive, LifeContext, type LifeCtx } from '../ui/Alive'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  CompanyCard,
  Footer,
  Heading,
  Input,
  LinkButton,
  NavBar,
  Paragraph,
  QuoteCard,
  MapCard,
  StatCard,
  SwatchRow,
  Tabs,
  TimelineNode,
  Toggle,
  Tooltip,
  TypeScale,
  CheckRow,
  Mascot,
  TONE_HEX as T,
} from '../ui/components'
import { CHAPTERS, COMPANIES, EMAIL, FOOTER, LINKS, PRINCIPLES, QUOTE, STATS, TIMELINE } from '../content/story'
import { FrameIcon } from '../canvas/Stage'
import { PortraitDeck } from '../ui/PortraitDeck'
import { scene, tool } from '../scene/store'
import { comps } from './runtime'
import { segAt } from './timeline'

export type Lay = 'wide' | 'tall' | 'narrow'

export interface FrameProps {
  lay: Lay
  register: LifeCtx['register'] | null
  onNav: (to: 'work' | 'about' | 'contact') => void
  onJump: (chapter: number) => void
}

function Frame({ idx, register, children, className = '' }: { idx: number; register: LifeCtx['register'] | null; children: ReactNode; className?: string }) {
  const ctx = useMemo(() => (register ? { chapter: idx, register } : null), [idx, register])
  const ch = CHAPTERS[idx]
  return (
    <section className={`bf bf-${ch.id} ${className}`} data-frame={idx} id={`ch-${ch.id}`} aria-labelledby={`h-${ch.id}`}>
      <div className="bf-glow" aria-hidden="true" />
      <div className="bf-bg" aria-hidden="true" />
      <div className="bf-label" aria-hidden="true">
        <FrameIcon /> {ch.num} {ch.frame} <i>·</i> <b className="bf-size">—</b>
      </div>
      <div className="bf-sheets" aria-hidden="true">
        <div className="bf-sheet s-grid" data-sheet="0">
          <span className="bf-sheet-cols">
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <span className="bf-sheet-lbl">Layout grid</span>
          <i className="bf-sheet-flash" />
        </div>
        <div className="bf-sheet s-content" data-sheet="1">
          <span className="bf-sheet-lines">
            <i />
            <i />
            <i />
          </span>
          <span className="bf-sheet-lbl">Content</span>
          <i className="bf-sheet-flash" />
        </div>
        <div className="bf-sheet s-comp" data-sheet="2">
          <span className="bf-sheet-lbl">Components</span>
          <i className="bf-sheet-flash" />
        </div>
      </div>
      <LifeContext.Provider value={ctx}>
        <div className="bf-body">{children}</div>
      </LifeContext.Provider>
    </section>
  )
}

const STEP_TONES = ['yellow', 'coral', 'lime', 'sky', 'pink', 'mint', 'violet'] as const
const H = (i: number) => CHAPTERS[i].headline
const B = (i: number) => CHAPTERS[i].body
const mail = `mailto:${EMAIL}`

/* -------------------------------------------------------------- 01 Hello */
/** the portrait deck plays only while it is placed and frame 01 sits flat */
function portraitCanDrag() {
  if (scene.reduced) return true
  if (tool.get() === 'hand') return false
  const c = comps.get('f1-portrait')
  if (!c || c.pose.state !== 'placed' || c.pose.op < 1) return false
  return scene.p >= segAt(0, 0.6) && scene.p <= segAt(0, 0.8)
}

function Hello({ lay, register, onNav, onJump }: FrameProps) {
  const narrow = lay === 'narrow'
  return (
    <Frame idx={0} register={register}>
      <Alive id="f1-nav" name="NavBar" tone={T.violet} travel="drop" order={0} className="a-nav" eyes={{ x: 50, y: 0, s: 16 }}>
        <NavBar compact={narrow} onNav={onNav} />
      </Alive>
      <div className="f1-main">
        <div className="f1-copy">
          <Alive id="f1-badge" name="Badge" tone={T.mint} travel="scurry" order={2} eyes={{ x: 72, y: 0, s: 12 }}>
            <Badge>Open to new work</Badge>
          </Alive>
          <Alive id="f1-head" name="Heading" tone={T.violet} travel="drop" order={1} className="a-head" eyes={{ x: 6, y: 2, s: 22 }}>
            <Heading segs={H(0)} level={1} size="xl" id="h-hello" />
          </Alive>
          <Alive id="f1-para" name="Paragraph" tone={T.sky} travel="drop" order={3} eyes={{ x: 12, y: 0, s: 14 }}>
            <Paragraph size="lg">{B(0)}</Paragraph>
          </Alive>
          <div className="row f1-ctas">
            <Alive id="f1-btn" name="Button/Primary" tone={T.violet} travel="leap" order={9} hero eyes={{ x: 0, y: 50, s: 13 }}>
              <Button icon="down" onClick={() => onJump(1)}>
                See how I work
              </Button>
            </Alive>
            {!narrow && (
              <Alive id="f1-ghost" name="Button/Ghost" tone={T.yellow} travel="scurry" order={7} eyes={{ x: 100, y: 50, s: 13 }}>
                <Button variant="ghost" href={mail}>
                  Say hello
                </Button>
              </Alive>
            )}
          </div>
        </div>
        <div className="f1-art" data-deck-scope="">
          <Alive id="f1-portrait" name="PortraitCard" tone={T.coral} travel="leap" order={5} className="a-portrait" eyes={{ x: 72, y: 0, s: 22 }}>
            <PortraitDeck name="Monika" note="Alicante" canDrag={portraitCanDrag} />
          </Alive>
          {!narrow && (
            <Alive id="f1-tip" name="Tooltip" tone={T.ink} travel="leap" order={6} className="a-tip" eyes={{ x: 88, y: 0, s: 12 }}>
              <Tooltip>
                <span className="u-tip-swap">
                  <span>that's me</span>
                  <span aria-hidden="true">drag me</span>
                </span>
              </Tooltip>
            </Alive>
          )}
        </div>
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------- 02 Origin */
function Origin({ lay, register, onNav, onJump }: FrameProps) {
  const narrow = lay === 'narrow'
  const nodes = narrow ? TIMELINE.filter((_, i) => i === 0 || i >= 4) : TIMELINE
  return (
    <Frame idx={1} register={register}>
      <Alive id="f2-nav" name="NavBar" tone={T.violet} travel="drop" order={0} from="f1-nav" className="a-nav" eyes={{ x: 50, y: 0, s: 16 }}>
        <NavBar compact={narrow} onNav={onNav} />
      </Alive>
      <div className="f2-main">
        <div className="f2-copy">
          <Alive id="f2-badge" name="Badge" tone={T.mint} travel="scurry" order={2} from="f1-badge" eyes={{ x: 72, y: 0, s: 12 }} pre={<Badge>Open to new work</Badge>}>
            <Badge tone="coral">Chapter 02 · Origin</Badge>
          </Alive>
          <Alive id="f2-head" name="Heading" tone={T.violet} travel="drop" order={1} className="a-head" eyes={{ x: 5, y: 2, s: 20 }}>
            <Heading segs={H(1)} id="h-origin" />
          </Alive>
          <Alive id="f2-para" name="Paragraph" tone={T.sky} travel="drop" order={3} eyes={{ x: 12, y: 0, s: 14 }}>
            <Paragraph>{B(1)}</Paragraph>
          </Alive>
          <div className="row f2-who">
            <Alive id="f2-avatar" name="Avatar" tone={T.coral} travel="scurry" order={5} eyes={{ x: 78, y: 0, s: 12 }}>
              <Avatar name="Monika Adeishvili" role="Tbilisi → Alicante" />
            </Alive>
            {!narrow && (
              <Alive id="f2-btn" name="Button/Primary" tone={T.violet} travel="leap" order={20} hero from="f1-btn" eyes={{ x: 0, y: 50, s: 13 }} pre={<Button icon="down">See how I work</Button>}>
                <Button icon="down" onClick={() => onJump(2)}>
                  How I think
                </Button>
              </Alive>
            )}
          </div>
        </div>
        <Alive id="f2-route" name="Card/Map" tone={T.coral} travel="leap" order={4} className="a-map fill" eyes={{ x: 88, y: 0, s: 18 }}>
          <MapCard />
        </Alive>
      </div>
      <div className="f2-time">
        <Alive id="f2-line" name="Timeline" tone={T.yellow} travel="drop" order={6} className="a-line" eyes={{ x: 3, y: 0, s: 12 }} legs={false}>
          <div className="u-timeline-line">
            <span>2020</span>
            <i />
            <span>2024</span>
          </div>
        </Alive>
        <ol className="f2-nodes" aria-label="Where I've worked, in order">
          {nodes.map((n, i) => (
            <li key={n.name}>
              <Alive id={`f2-n${i}`} name={`Step/${n.name}`} tone={T.yellow} travel="scurry" order={7 + i} eyes={{ x: 100, y: 46, s: 11 }}>
                <TimelineNode year={n.year} name={n.name} last={i === nodes.length - 1} tone={STEP_TONES[i % STEP_TONES.length]} />
              </Alive>
            </li>
          ))}
        </ol>
      </div>
    </Frame>
  )
}

/* -------------------------------------------------------------- 03 Craft */
function Craft({ lay, register, onNav }: FrameProps) {
  const narrow = lay === 'narrow'
  return (
    <Frame idx={2} register={register}>
      <Alive id="f3-nav" name="NavBar" tone={T.violet} travel="drop" order={0} from="f2-nav" className="a-nav" eyes={{ x: 50, y: 0, s: 16 }}>
        <NavBar compact={narrow} onNav={onNav} />
      </Alive>
      <div className="f3-main">
        <div className="f3-copy">
          <Alive id="f3-badge" name="Badge" tone={T.mint} travel="scurry" order={2} from="f2-badge" eyes={{ x: 72, y: 0, s: 12 }} pre={<Badge tone="coral">Chapter 02 · Origin</Badge>}>
            <Badge tone="lime">Chapter 03 · Craft</Badge>
          </Alive>
          <Alive id="f3-head" name="Heading" tone={T.violet} travel="drop" order={1} className="a-head" eyes={{ x: 5, y: 2, s: 20 }}>
            <Heading segs={H(2)} id="h-craft" />
          </Alive>
          <Alive id="f3-para" name="Paragraph" tone={T.sky} travel="drop" order={3} eyes={{ x: 12, y: 0, s: 14 }}>
            <Paragraph>{B(2)}</Paragraph>
          </Alive>
          <ul className="f3-checks" aria-label="Principles">
            {PRINCIPLES.map((p, i) => (
              <li key={p}>
                <Alive id={`f3-c${i}`} name="Checklist/Row" tone={T.lime} travel="scurry" order={14 + i} className="a-check" eyes={{ x: 94, y: 0, s: 12 }}>
                  <CheckRow n={i}>{p}</CheckRow>
                </Alive>
              </li>
            ))}
          </ul>
        </div>
        <div className="f3-side">
          <div className="ds">
            <Alive id="f3-panel" name="Card/System" tone={T.violet} travel="drop" order={4} className="a-panel fill" eyes={{ x: 86, y: 0, s: 20 }}>
              <Card title="momo / design-system.momo" tone="lime" />
            </Alive>
            <Alive id="f3-avatar" name="Avatar" tone={T.coral} travel="scurry" order={5} from="f2-avatar" className="a-owner" eyes={{ x: 78, y: 0, s: 11 }}>
              <Avatar name="Monika" role="owner" size={28} />
            </Alive>
            <div className="ds-parts">
              <div className="ds-col">
                <Alive id="f3-sw" name="Swatch row" tone={T.pink} travel="drop" order={6} eyes={{ x: 50, y: 0, s: 12 }}>
                  <SwatchRow />
                </Alive>
                {!narrow && (
                  <Alive id="f3-type" name="Type scale" tone={T.ink} travel="drop" order={7} eyes={{ x: 50, y: 0, s: 12 }}>
                    <TypeScale />
                  </Alive>
                )}
                <div className="row ds-btns">
                  <Alive id="f3-btn" name="Button/Primary" tone={T.violet} travel="leap" order={8} from="f2-btn" eyes={{ x: 0, y: 50, s: 12 }} pre={<Button icon="down">How I think</Button>}>
                    <Button>Button</Button>
                  </Alive>
                  <Alive id="f3-ghost" name="Button/Ghost" tone={T.yellow} travel="scurry" order={9} eyes={{ x: 100, y: 50, s: 12 }}>
                    <Button variant="ghost" state="pressed">
                      Pressed
                    </Button>
                  </Alive>
                </div>
              </div>
              <div className="ds-col">
                {!narrow && (
                  <Alive id="f3-tabs" name="Tabs" tone={T.sky} travel="drop" order={10} eyes={{ x: 50, y: 0, s: 12 }}>
                    <Tabs items={['Design', 'Prototype', 'Inspect']} />
                  </Alive>
                )}
                {!narrow && (
                  <Alive id="f3-input" name="Input" tone={T.mint} travel="leap" order={11} eyes={{ x: 92, y: 32, s: 12 }}>
                    <Input label="Component name" value="Button/Primary" />
                  </Alive>
                )}
                <Alive id="f3-t1" name="Toggle row" tone={T.mint} travel="scurry" order={12} eyes={{ x: 88, y: 0, s: 11 }}>
                  <Toggle label="Auto layout" />
                </Alive>
                <Alive id="f3-t2" name="Toggle row" tone={T.coral} travel="scurry" order={13} eyes={{ x: 88, y: 0, s: 11 }}>
                  <Toggle label="Snap to grid" tone="coral" />
                </Alive>
              </div>
            </div>
          </div>
          {!narrow && (
            <Alive id="f3-quote" name="QuoteCard" tone={T.yellow} travel="leap" order={17} eyes={{ x: 90, y: 0, s: 18 }}>
              <QuoteCard text={QUOTE.text} by={QUOTE.by} />
            </Alive>
          )}
        </div>
      </div>
    </Frame>
  )
}

/* -------------------------------------------------------------- 04 Proof */
function Proof({ lay, register, onNav, onJump }: FrameProps) {
  const narrow = lay === 'narrow'
  const companies = narrow ? COMPANIES.slice(0, 2) : COMPANIES
  return (
    <Frame idx={3} register={register}>
      <Alive id="f4-nav" name="NavBar" tone={T.violet} travel="drop" order={0} from="f3-nav" className="a-nav" eyes={{ x: 50, y: 0, s: 16 }}>
        <NavBar compact={narrow} onNav={onNav} />
      </Alive>
      <div className="f4-top">
        <div className="f4-copy">
          <Alive id="f4-badge" name="Badge" tone={T.mint} travel="scurry" order={2} from="f3-badge" eyes={{ x: 72, y: 0, s: 12 }} pre={<Badge tone="lime">Chapter 03 · Craft</Badge>}>
            <Badge tone="sky">Chapter 04 · Proof</Badge>
          </Alive>
          <Alive id="f4-head" name="Heading" tone={T.violet} travel="drop" order={1} className="a-head" eyes={{ x: 5, y: 2, s: 20 }}>
            <Heading segs={H(3)} id="h-proof" />
          </Alive>
        </div>
        <Alive id="f4-para" name="Paragraph" tone={T.sky} travel="drop" order={3} className="a-para4" eyes={{ x: 12, y: 0, s: 14 }}>
          <Paragraph>{B(3)}</Paragraph>
        </Alive>
      </div>
      <ul className="f4-stats" aria-label="In numbers">
        {STATS.map((s, i) => (
          <li key={s.label}>
            <Alive id={`f4-s${i}`} name="StatCard" tone={T[s.tone]} travel={i === 1 ? 'drop' : 'leap'} order={4 + i} className="fill" eyes={{ x: 80, y: 0, s: 16 }}>
              <StatCard n={s.n} suf={s.suf} label={s.label} tone={s.tone} />
            </Alive>
          </li>
        ))}
      </ul>
      <ul className="f4-cos" aria-label="Where I've worked">
        {companies.map((c, i) => (
          <li key={c.name}>
            <Alive id={`f4-co${i}`} name="CompanyCard" tone={T[c.tone]} travel="leap" order={7 + i} className="fill" eyes={{ x: 86, y: 0, s: 14 }}>
              <CompanyCard name={c.name} role={c.role} mark={c.mark} tone={c.tone} />
            </Alive>
          </li>
        ))}
      </ul>
      <div className="row f4-foot">
        <Alive id="f4-chip" name="Chip" tone={T.lime} travel="scurry" order={11} eyes={{ x: 84, y: 0, s: 11 }}>
          <Chip tone="lime" lead={<span aria-hidden="true">✦</span>}>
            Also: UX/UI lecturer
          </Chip>
        </Alive>
        <Alive id="f4-avatar" name="Avatar" tone={T.coral} travel="scurry" order={12} from="f3-avatar" eyes={{ x: 78, y: 0, s: 12 }} pre={<Avatar name="Monika" role="owner" size={28} />}>
          <Avatar name="Monika Adeishvili" role="UX lecturer · mentor" />
        </Alive>
        {!narrow && (
          <Alive id="f4-btn" name="Button/Primary" tone={T.violet} travel="leap" order={20} hero from="f3-btn" className="a-push" eyes={{ x: 0, y: 50, s: 13 }} pre={<Button>Button</Button>}>
            <Button icon="down" onClick={() => onJump(4)}>
              Let's talk
            </Button>
          </Alive>
        )}
      </div>
    </Frame>
  )
}

/* ------------------------------------------------------------ 05 Contact */
function Contact({ lay, register, onNav }: FrameProps) {
  const narrow = lay === 'narrow'
  return (
    <Frame idx={4} register={register}>
      <Alive id="f5-nav" name="NavBar" tone={T.violet} travel="drop" order={0} from="f4-nav" className="a-nav" eyes={{ x: 50, y: 0, s: 16 }}>
        <NavBar compact={narrow} onNav={onNav} />
      </Alive>
      <div className="f5-main">
        <Alive id="f5-badge" name="Badge" tone={T.mint} travel="scurry" order={2} from="f4-badge" eyes={{ x: 72, y: 0, s: 12 }} pre={<Badge tone="sky">Chapter 04 · Proof</Badge>}>
          <Badge tone="pink">Open to new work</Badge>
        </Alive>
        <Alive id="f5-head" name="Heading" tone={T.violet} travel="drop" order={1} className="a-head" eyes={{ x: 5, y: 2, s: 24 }}>
          <Heading segs={H(4)} size="giant" id="h-contact" />
        </Alive>
        <Alive id="f5-para" name="Paragraph" tone={T.sky} travel="drop" order={3} eyes={{ x: 12, y: 0, s: 14 }}>
          <Paragraph size="lg">{B(4)}</Paragraph>
        </Alive>
        <div className="row f5-cta">
          <div className="f5-cta-main">
            <Alive id="f5-cta" name="Button/CTA" tone={T.violet} travel="leap" order={30} hero from="f4-btn" eyes={{ x: 0, y: 50, s: 16 }} pre={<Button icon="down">Let's talk</Button>}>
              <Button size="xl" href={mail} icon="right">
                Say hello
              </Button>
            </Alive>
            <div className="f5-mascot" aria-hidden="true">
              <Mascot />
            </div>
          </div>
          <ul className="f5-links" aria-label="Elsewhere">
            {LINKS.map((l, i) => (
              <li key={l.label}>
                <Alive id={`f5-l${i}`} name="LinkButton" tone={T.ink} travel="scurry" order={6 + i} eyes={{ x: 100, y: 30, s: 10 }}>
                  <LinkButton href={l.href}>{l.label}</LinkButton>
                </Alive>
              </li>
            ))}
          </ul>
        </div>
        <div className="row f5-who">
          <Alive id="f5-avatar" name="Avatar" tone={T.coral} travel="scurry" order={4} from="f4-avatar" eyes={{ x: 78, y: 0, s: 12 }} pre={<Avatar name="Monika Adeishvili" role="UX lecturer · mentor" />}>
            <Avatar name="Monika Adeishvili" role="Product designer · Alicante" />
          </Alive>
          {!narrow && (
            <>
              <Alive id="f5-chip0" name="Chip" tone={T.lime} travel="scurry" order={9} from="f4-chip" eyes={{ x: 84, y: 0, s: 11 }} pre={<Chip tone="lime" lead={<span aria-hidden="true">✦</span>}>Also: UX/UI lecturer</Chip>}>
                <Chip tone="lime">Product design</Chip>
              </Alive>
              <Alive id="f5-chip1" name="Chip" tone={T.pink} travel="scurry" order={10} eyes={{ x: 84, y: 0, s: 11 }}>
                <Chip tone="pink">Design systems</Chip>
              </Alive>
              <Alive id="f5-chip2" name="Chip" tone={T.sky} travel="scurry" order={11} eyes={{ x: 84, y: 0, s: 11 }}>
                <Chip tone="sky">Teams that care</Chip>
              </Alive>
            </>
          )}
        </div>
      </div>
      <Alive id="f5-foot" name="Footer" tone={T.ink} travel="drop" order={12} className="a-foot" eyes={{ x: 50, y: 0, s: 12 }} legs={false}>
        <Footer text={FOOTER} />
      </Alive>
    </Frame>
  )
}

export function Frames(props: FrameProps) {
  return (
    <>
      <Hello {...props} />
      <Origin {...props} />
      <Craft {...props} />
      <Proof {...props} />
      <Contact {...props} />
    </>
  )
}
