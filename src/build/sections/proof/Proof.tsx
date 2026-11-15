/**
 * 03 PROOF — the work. The headline, then the running total (Region 1, ./Tally:
 * all 32 client products add up and fold into one designer), then one long
 * sideways strip of her projects (Region 2 pans: the camera holds flat and
 * ./workFx.ts slides the track with the scroll). Each project is a text column
 * (name, what it is, year / role / platforms, a link) followed by its screens in
 * a browser window, a TV or phones; a thin timeline along the bottom keeps your
 * place and the strip washes faintly in each project's colour.
 */
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { CHAPTERS, TALLY, WORK, type WorkMedia } from '../../../content/story'
import { Region, Reveal } from '../../parts'
import { Artboard, type SectionProps } from '../Artboard'
import { Tally } from './Tally'
import { mountTally } from './tallyFx'
import { mountWork } from './workFx'
import './proof.css'
import './tally.css'

const pad = (n: number) => String(n).padStart(2, '0')

/** one device frame; with several screens it changes page in turn, and with a
 *  recording it plays while in view (./workFx.ts) */
function Screen({ m }: { m: WorkMedia }) {
  const many = m.files.length > 1
  return (
    <figure className={`pw-m pw-${m.kind}${many ? ' is-deck' : ''}`} style={{ '--r': (m.w / m.h).toFixed(4) } as CSSProperties}>
      <div className="pw-frame">
        {m.kind === 'web' && (
          <span className="pw-bar" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        <div
          className="pw-shot"
          data-nav={m.nav ?? (m.kind === 'phone' ? 'tab' : 'rise')}
          style={m.origin ? ({ '--ox': `${(m.origin[0] * 100).toFixed(1)}%`, '--oy': `${(m.origin[1] * 100).toFixed(1)}%` } as CSSProperties) : undefined}
        >
          {m.video ? (
            <video
              src={`/work/${m.video}.mp4`}
              poster={`/work/${m.files[0]}.webp`}
              aria-label={m.alts[0]}
              width={m.w}
              height={m.h}
              muted
              loop
              playsInline
              preload="metadata"
            />
          ) : (
            m.files.map((f, i) => (
              <img key={i} src={`/work/${f}.webp`} alt={m.alts[i]} width={m.w} height={m.h} decoding="async" fetchPriority="low" data-s={i === 0 ? 'on' : 'park'} />
            ))
          )}
        </div>
      </div>
    </figure>
  )
}

export function Proof({ lay, live }: SectionProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!live || !root) return
    const a = mountTally(root, 1)
    const b = mountWork(root, 2)
    return () => {
      a()
      b()
    }
  }, [live, lay])

  return (
    <Artboard idx={2} live={live} lay={lay}>
      <div ref={rootRef} className="pw-root">
        <Region index={0} label="Intro" className="pw-r0">
          <p className="pw-kick">{TALLY.kicker}</p>
          <Reveal id="p-title" as="h2" hid="h-proof" segs={CHAPTERS[2].headline} className="rv-title pw-title" />
        </Region>

        <Region index={1} label="Running total" className="pt-r" weight={4} pan>
          <Tally />
        </Region>

        <Region index={2} label="Work" className="pw-r1" weight={9} pan hold="0.69,0.46,0.93">
          <div className="pw-pin">
            <div className="pw-clip">
              <div className="pw-wash" aria-hidden="true">
                {WORK.map((p) => (
                  <i key={p.id} style={{ '--t': p.tint } as CSSProperties} />
                ))}
              </div>
              <ol className="pw-track" aria-label="Selected work">
                {WORK.map((p, i) => (
                  <li key={p.id} className="pw-proj" data-k={i}>
                    <div className="pw-txt">
                      <span className="pw-idx" aria-hidden="true">
                        {pad(i + 1)} <i>/ {pad(WORK.length)}</i>
                      </span>
                      <h3 className="pw-name">
                        <span>{p.name}</span>
                      </h3>
                      <p className="pw-body">{p.body}</p>
                      <dl className="pw-meta">
                        {p.meta.map(([k, v]) => (
                          <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                      {p.link && (
                        <a className="pw-link" href={p.link.href} target="_blank" rel="noreferrer">
                          {p.link.label} <span aria-hidden="true">↗</span>
                        </a>
                      )}
                    </div>
                    <div className="pw-shots">
                      {p.media.map((m) => (
                        <Screen key={m.files[0]} m={m} />
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="pw-rule" aria-hidden="true">
              <span className="pw-now">
                <b>01</b> <i>/ {pad(WORK.length)}</i>{' '}
                <em>
                  <span className="is-on">{WORK[0].name}</span>
                  <span />
                </em>
              </span>
              <span className="pw-line">
                <span className="pw-fill" />
                {WORK.map((p) => (
                  <i key={p.id} className="pw-tick" />
                ))}
                <b className="pw-dot" />
              </span>
            </div>
          </div>
        </Region>
      </div>
    </Artboard>
  )
}
