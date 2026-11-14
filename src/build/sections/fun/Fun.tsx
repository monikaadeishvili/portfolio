/**
 * 06 AFTER HOURS. Below the contact section the page keeps going, and the
 * design file gives way: momo's eye on the page opens into a portal, the
 * Figma panels slide off, and three nested dreams play on scroll
 * (../../three/TripScene.ts, driven by ./funFx.ts). It ends where it started:
 * a rewind to the top, or a hello.
 *
 * Lives inside the stage (above the canvas, below the cursors) and hangs off
 * its own spacer below the story's, so nothing in the five sections changes.
 */
import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { AFTER, EMAIL } from '../../../content/story'
import { mountFun } from './funFx'
import './fun.css'

export const FUN_VH = 400

const INKS = ['#FF7AD1', '#C6F135', '#2DB8FF', '#FFD23F', '#FF5C39', '#B9A8FF', '#ffffff']

/** a line set letter by letter, every letter its own colour and wobble */
function Wavy({ text, k }: { text: string; k: number }) {
  let n = 0
  return (
    <>
      {text.split(' ').map((w, wi) => (
        <span key={wi} className="fun-w">
          {Array.from(w).map((c) => {
            const i = n++
            const r = ((i * 37 + k * 11) % 9) - 4
            return (
              <span key={i} className="fun-l" style={{ '--i': i, '--r': r * 9, '--c': INKS[(i + k * 3) % INKS.length] } as CSSProperties}>
                <span className="fun-li">{c}</span>
              </span>
            )
          })}
        </span>
      ))}
    </>
  )
}

export function Fun({ narrow }: { narrow: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    return mountFun(el, narrow)
  }, [narrow])

  return (
    <div ref={ref} className="fun" id="after-hours">
      <canvas className="fun-cv" aria-hidden="true" />
      <p className="fun-hint" aria-hidden="true">
        {AFTER.hint} <span className="fun-hint-ar">↓</span>
      </p>
      {AFTER.caps.map((c, k) => (
        <p key={k} className={`fun-cap is-${c.pos}`} data-a={c.at[0]} data-b={c.at[1]}>
          <span className="sr-only">{c.text}</span>
          <span aria-hidden="true">
            <Wavy text={c.text} k={k} />
          </span>
        </p>
      ))}
      <p className="fun-poke" aria-hidden="true">
        <span className="fun-poke-m">{AFTER.poke}</span>
        <span className="fun-poke-t">{AFTER.pokeTouch}</span>
      </p>
      <div className="fun-end">
        <h2 className="fun-cap fun-end-h">
          <span className="sr-only">{AFTER.end}</span>
          <span aria-hidden="true">
            <Wavy text={AFTER.end} k={5} />
          </span>
        </h2>
        <div className="fun-ctas">
          <button type="button" className="fun-btn" data-act="top">
            <span aria-hidden="true">↺</span> {AFTER.top}
          </button>
          <a className="fun-btn is-lime" href={`mailto:${EMAIL}`}>
            {AFTER.hello} <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </div>
  )
}
