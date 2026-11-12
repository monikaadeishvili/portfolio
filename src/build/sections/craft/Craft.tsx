/** 03 CRAFT — "The workbench": a drafting table, an exploded UI in real 3-D */
import { CHAPTERS, PRINCIPLES, QUOTE } from '../../../content/story'
import { Input, SwatchRow, Tabs, TypeScale, TONE_HEX as T } from '../../../ui/components'
import { Piece, Region, Reveal } from '../../parts'
import { CraftStage } from '../../three/CraftStage'
import { Artboard, type SectionProps } from '../Artboard'
import './craft.css'

const SW = [
  { id: 'c-sw0', short: 'Research', tone: 'lime', park: '-240,20' },
  { id: 'c-sw1', short: 'Systems', tone: 'pink', park: '-240,330' },
  { id: 'c-sw2', short: 'Calm', tone: 'sky', park: '1130,340' },
] as const

function Switch({ text, tone, n }: { text: string; tone: string; n: number }) {
  return (
    <span className={`tgl tgl-${tone}`}>
      <span className="tgl-plate" aria-hidden="true">
        <i className="tgl-screw a" />
        <i className="tgl-screw b" />
        <span className="tgl-led" />
        <span className="tgl-track">
          <span className="tgl-lever" />
        </span>
        <span className="tgl-onoff">
          <b>ON</b>
          <b>OFF</b>
        </span>
      </span>
      <span className="tgl-n" aria-hidden="true">
        P{n + 1}
      </span>
      <span className="tgl-text">{text}</span>
    </span>
  )
}

export function Craft({ lay, live }: SectionProps) {
  return (
    <Artboard idx={2} live={live} lay={lay}>
      <Region index={0} label="Intro" className="c-r0">
        <div className="c-head">
          <Piece id="c-chip" name="Chip / Spec" kind="bubble" tone={T.lime} order={0}>
            <span className="c-spec">
              <i aria-hidden="true" />
              spec 03 · how I think
            </span>
          </Piece>
          <Reveal id="c-title" as="h2" hid="h-craft" segs={CHAPTERS[2].headline} className="rv-title c-title" />
        </div>
        <div className="c-side">
          <Reveal id="c-para" mode="type" segs={[CHAPTERS[2].body]} className="rv-para c-para" order={1} />
          <Piece id="c-ruler" name="Ruler" kind="bubble" tone={T.ink} order={1} className="c-rulerslot">
            <span className="c-ruler" aria-hidden="true">
              {Array.from({ length: 21 }, (_, i) => (
                <i key={i} className={i % 5 === 0 ? 'big' : ''} />
              ))}
            </span>
          </Piece>
        </div>
      </Region>

      <Region index={1} label="Exploded view" className="c-r1" weight={4}>
        <div className="c-stage-wrap">
          <CraftStage />
        </div>
      </Region>

      <Region index={2} label="Switchboard" className="c-r2">
        <div className="c-board">
          <div className="c-panel">
            <Reveal id="c-p-h" as="h3" segs={['Three ', { em: 'principles.' }]} className="rv-kicker c-kicker" label="Heading / H3" />
            <ul className="c-switches" aria-label="Principles">
              {SW.map((s, i) => (
                <li key={s.id}>
                  <Piece id={s.id} name={`Switch / ${s.short}`} kind="hero" tone={T[s.tone]} travel="crawl" order={i + 1} park={s.park} eyes={{ x: 50, y: 10, s: 22 }}>
                    <Switch text={PRINCIPLES[i]} tone={s.tone} n={i} />
                  </Piece>
                </li>
              ))}
            </ul>
          </div>
          <div className="c-kit" aria-label="Design system parts">
            <Piece id="c-swatch" name="Swatch row" kind="bubble" tone={T.pink} order={4}>
              <SwatchRow />
            </Piece>
            <Piece id="c-type" name="Type scale" kind="bubble" tone={T.ink} order={5}>
              <TypeScale />
            </Piece>
            <Piece id="c-tabs" name="Tabs" kind="bubble" tone={T.sky} order={6}>
              <Tabs items={['Design', 'Prototype', 'Inspect']} />
            </Piece>
            <Piece id="c-input" name="Input" kind="bubble" tone={T.mint} order={7}>
              <Input label="Component name" value="Switch / Principle" />
            </Piece>
          </div>
        </div>
      </Region>

      <Region index={3} label="Quote" className="c-r3">
        <Piece id="c-quote" name="Quote card" kind="hero" tone={T.yellow} travel="leap" order={1} park="150,b+64" parkN="10,b+30" className="c-quote" eyes={{ x: 90, y: 0, s: 26 }}>
          <figure className="lp">
            <span className="lp-mark" aria-hidden="true">
              “
            </span>
            <blockquote className="lp-q">{QUOTE.text}</blockquote>
            <figcaption className="lp-by">— {QUOTE.by}</figcaption>
          </figure>
        </Piece>
      </Region>
    </Artboard>
  )
}
