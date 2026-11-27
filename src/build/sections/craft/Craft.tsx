/**
 * 02 HOW I THINK — "The Kit". One kit of 53 clay parts (./../../three/KitScene)
 * re-forms into five sculptures while the section pans sideways through her
 * process: a lens (research), a user flow, a knolled design-system shelf, an
 * exploded phone screen (handoff) and the finished phone (launch). Nothing is
 * added or removed, only rearranged: "I think in components", literally.
 *
 * Regions: 0 intro · 1 the pan (camera holds flat, ./kitFx.ts slides the
 * track) · 2 the three rules, carried in by the site's creatures.
 */
import { useLayoutEffect, useRef } from 'react'
import { CHAPTERS, PROCESS, QUOTE, RULES } from '../../../content/story'
import { TONE_HEX as T } from '../../../ui/components'
import { Piece, Region, Reveal } from '../../parts'
import { Artboard, type SectionProps } from '../Artboard'
import { KIT_COUNT } from '../../three/kitForms'
import { mountKit } from './kitFx'
import { mountQuote } from './quoteFx'
import './craft.css'
import { SEC_ID } from '../../worlds'

const K = { lime: '#C6F135', sand: '#EBE2D4', orange: '#E8590C', ink: '#1E1712' }
const STK_TONE = [K.sand, K.sand, K.lime, K.orange, K.lime, K.sand]
const RULE_TRAVEL = ['leap', 'slap', 'stamp'] as const
const RULE_PARK = ['-260,10', '1150,150', '-260,330']
const RULE_NAME = ['Rule / Research', 'Rule / Systems', 'Rule / Calm']

/** a verb set letter by letter (each rises through its own clip) */
function Verb({ text }: { text: string }) {
  return (
    <span className="hk-verb" aria-hidden="true">
      {Array.from(text).map((c, i) => (
        <span key={i} className="hk-vl">
          <span className="hk-vl-in">{c === ' ' ? ' ' : c}</span>
        </span>
      ))}
    </span>
  )
}

export function Craft({ lay, live }: SectionProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!live || !root) return
    const kit = mountKit(root, lay === 'narrow')
    const quote = mountQuote(root)
    return () => {
      quote()
      kit()
    }
  }, [live, lay])

  return (
    <Artboard idx={SEC_ID.craft} live={live} lay={lay}>
      <div ref={rootRef} className="hk-root">
        {/* 0 · intro */}
        <Region index={0} label="Intro" className="hk-r0">
          <Piece id="c-chip" name="Chip / Section" kind="bubble" tone={K.lime} order={0}>
            <span className="hk-chip">
              <i aria-hidden="true" />
              How I think
            </span>
          </Piece>
          <Reveal id="c-title" as="h2" hid="h-craft" segs={CHAPTERS[SEC_ID.craft].headline} className="rv-title hk-title" />
          <Reveal id="c-para" mode="type" segs={[CHAPTERS[SEC_ID.craft].body]} className="rv-para hk-para" order={1} />
          <Piece id="c-count" name="Chip / Count" kind="bubble" tone={K.sand} order={1}>
            <span className="hk-count">
              <b>{KIT_COUNT}</b> parts. <b>5</b> shapes.
            </span>
          </Piece>
          {/* the quote, one sticker per word: the bubble spits them out in order
              until the sentence stands (./quoteFx.ts: "ignores" ducks the cursor,
              the last "people." watches it) */}
          <figure className="hk-stk">
            <blockquote className="sr-only">
              {QUOTE.rows.flat().join(' ')} — {QUOTE.by}
            </blockquote>
            <div className="hk-stk-rows" aria-hidden="true">
              {QUOTE.rows.map((row, r) => (
                <div key={r} className="hk-stk-row">
                  {row.map((w, c) => {
                    const i = r * 2 + c
                    return (
                      <Piece key={i} id={`c-q${i}`} name={`Sticker / ${w.replace('.', '')}`} kind="bubble" tone={STK_TONE[i]} order={2 + i} className={i === 4 ? 'hk-st-dodge' : ''}>
                        <span className={`hk-st hk-st-${i}`}>
                          {w}
                          {i === 5 && (
                            <span className="hk-st-eyes">
                              <i>
                                <b />
                              </i>
                              <i>
                                <b />
                              </i>
                            </span>
                          )}
                        </span>
                      </Piece>
                    )
                  })}
                </div>
              ))}
              <Piece id="c-qby" name="Label / Chimero" kind="bubble" tone={K.sand} order={8}>
                <span className="hk-st-by">— {QUOTE.by}</span>
              </Piece>
            </div>
          </figure>
        </Region>

        {/* 1 · the pan: one kit, five shapes */}
        <Region index={1} label="Process" className="hk-r1" weight={9} pan>
          <div className="hk-pin">
            <div className="hk-back" aria-hidden="true">
              <div className="hk-back-track">
                {PROCESS.map((s) => (
                  <span key={s.back} className="hk-back-w">
                    {s.back}
                  </span>
                ))}
              </div>
            </div>
            <div className="hk-gl" role="img" aria-label="Fifty-three small 3-D parts rearrange into five shapes: a magnifying lens, a user flow, a tidy design-system shelf, an exploded phone screen, and the finished phone.">
              <canvas className="hk-cv" aria-hidden="true" />
              <span className="hk-redl hk-redl-0" aria-hidden="true">
                16
              </span>
              <span className="hk-redl hk-redl-1" aria-hidden="true">
                24
              </span>
              <span className="hk-redl hk-redl-2" aria-hidden="true">
                Button / Primary
              </span>
            </div>
            <div className="hk-clip">
              <ol className="hk-track" aria-label="How I work, in five steps">
                {PROCESS.map((s, i) => (
                  <li key={s.back} className="hk-panel" data-k={i}>
                    <h3 className="hk-h">
                      <span className="sr-only">
                        {s.verb} {s.sub}
                      </span>
                      <Verb text={s.verb} />
                      <span className="hk-sub" aria-hidden="true">
                        {s.sub}
                      </span>
                    </h3>
                    <p className="hk-body">{s.body}</p>
                    <ul className="hk-makes" aria-label="What it makes">
                      {s.makes.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
            <div className="hk-hit" aria-hidden="true" />
            <div className="hk-hud">
              <span className="hk-ovf" aria-hidden="true">
                Overflow: Horizontal <span className="hk-ovf-ar">⇆</span>
              </span>
              <Piece id="hk-rail" name="Rail / Process" kind="bubble" tone={K.sand} order={0} at={0.03} className="hk-railslot">
                <div className="hk-rail" aria-hidden="true">
                  <div className="hk-rail-ticks">
                    {PROCESS.map((s) => (
                      <span key={s.back} className="hk-tick">
                        {s.back}
                      </span>
                    ))}
                  </div>
                  <i className="hk-thumb" />
                </div>
              </Piece>
              {/* not a control: the model itself is what you press */}
              <p className="hk-hold" aria-hidden="true">
                <i className="hk-hold-ic" />
                <span className="hk-hold-a">
                  <span className="hk-hold-m">Press and hold the model</span>
                  <span className="hk-hold-t">Tap the model</span> to take it apart
                </span>
                <span className="hk-hold-b">Let go to put it back</span>
              </p>
            </div>
          </div>
        </Region>

        {/* 2 · the rules */}
        <Region index={2} label="Rules" className="hk-r2" weight={3}>
          <ul className="hk-rules" aria-label="Three rules I work by">
            {RULES.map((r, i) => (
              <li key={r.big} className={`hk-rule-li hk-rule-li-${i}`}>
                <Piece id={`c-rule${i}`} name={RULE_NAME[i]} kind="hero" tone={i === 2 ? K.lime : T.ink} travel={RULE_TRAVEL[i]} order={i} park={RULE_PARK[i]} parkN={i === 2 ? '10,b+30' : undefined} eyes={{ x: 88, y: -6, s: 22 }}>
                  <div className={`hk-rule${i === 2 ? ' is-lime' : ''}`}>
                    <h3 className="hk-rule-big">{r.big}</h3>
                    <p className="hk-rule-line">{r.line}</p>
                  </div>
                </Piece>
              </li>
            ))}
          </ul>
          <Reveal id="c-out" mode="type" segs={['That is how I think. Next, the proof.']} className="hk-out" order={3} label="Paragraph / Out" />
        </Region>
      </div>
    </Artboard>
  )
}
