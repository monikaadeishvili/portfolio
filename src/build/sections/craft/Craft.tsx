/**
 * 03 HOW I THINK — "The Kit". One kit of 53 clay parts (./../../three/KitScene)
 * re-forms into five sculptures while the section pans sideways through her
 * process: a lens (research), a user flow, a knolled design-system shelf, an
 * exploded phone screen (handoff) and the finished phone (launch). Nothing is
 * added or removed, only rearranged: "I think in components", literally.
 *
 * Regions: 0 intro · 1 the pan (camera holds flat, ./kitFx.ts slides the
 * track) · 2 the three rules, carried in by the site's creatures.
 */
import { useLayoutEffect, useRef } from 'react'
import { CHAPTERS, PROCESS, RULES } from '../../../content/story'
import { TONE_HEX as T } from '../../../ui/components'
import { Piece, Region, Reveal } from '../../parts'
import { Artboard, type SectionProps } from '../Artboard'
import { KIT_COUNT } from '../../three/kitForms'
import { mountKit } from './kitFx'
import './craft.css'

const K = { lime: '#C6F135', sand: '#EBE2D4', orange: '#E8590C', ink: '#1E1712' }
const TRAY_AT = [0.05, 0.275, 0.5, 0.725, 0.95]
const TRAY_TONE = [K.sand, K.sand, K.lime, K.sand, K.orange]
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
    return mountKit(root, lay === 'narrow')
  }, [live, lay])

  return (
    <Artboard idx={2} live={live} lay={lay}>
      <div ref={rootRef} className="hk-root">
        {/* 0 · intro */}
        <Region index={0} label="Intro" className="hk-r0">
          <Piece id="c-chip" name="Chip / Section" kind="bubble" tone={K.lime} order={0}>
            <span className="hk-chip">
              <i aria-hidden="true" />
              How I think
            </span>
          </Piece>
          <Reveal id="c-title" as="h2" hid="h-craft" segs={CHAPTERS[2].headline} className="rv-title hk-title" />
          <Reveal id="c-para" mode="type" segs={[CHAPTERS[2].body]} className="rv-para hk-para" order={1} />
          <Piece id="c-count" name="Chip / Count" kind="bubble" tone={K.sand} order={1}>
            <span className="hk-count">
              <b>{KIT_COUNT}</b> parts. <b>5</b> shapes.
            </span>
          </Piece>
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
              <Piece id="hk-apart" name="Button / Take it apart" kind="bubble" tone={K.lime} order={2} at={0.1} className="hk-apartslot">
                <div className="hk-apart-w">
                  <button type="button" className="hk-apart" aria-pressed="false">
                    <span className="hk-apart-l">Take it apart</span>
                  </button>
                  <span className="hk-apart-hint">or press and hold the model</span>
                </div>
              </Piece>
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
              <div className="hk-tray">
                <span className="hk-tray-l">Made so far</span>
                <ul className="hk-tray-row" aria-label="Made so far">
                  {PROCESS.map((s, i) => (
                    <li key={s.tray}>
                      <Piece id={`hk-t${i}`} name={`Chip / ${s.tray}`} kind="bubble" tone={TRAY_TONE[i]} order={3 + i} at={TRAY_AT[i]}>
                        <span className={`hk-tchip${i === 4 ? ' is-live' : ''}`}>{s.tray}</span>
                      </Piece>
                    </li>
                  ))}
                </ul>
              </div>
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
