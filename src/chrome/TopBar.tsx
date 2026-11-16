/**
 * What used to be the top bar, split into the two side panels the way Figma
 * does it: the file (mark, name, project) heads the Layers panel on the left;
 * the people in the file and the Say hello button head the Design panel on the
 * right, with the zoom level next to the Design tab. Where a panel isn't shown
 * (tablet: no Layers; phone / reduced motion: no panels) the same heads stand
 * alone as small cards.
 */
import { useLayoutEffect, useRef } from 'react'
import { MomoMark } from './Icons'
import { ui } from '../scene/store'
import { EMAIL } from '../content/story'

const PEOPLE = [
  // the visitor first, in the same coral as their own "You" cursor on the canvas
  { i: 'Y', c: 'var(--coral)', n: 'You (viewing)' },
  { i: 'M', c: 'var(--violet)', n: 'Monika (owner)' },
]

/** the file: mark, name and project, like Figma's file menu */
export function FileHead() {
  return (
    <div className="fhead">
      <MomoMark />
      <nav className="fhead-t" aria-label="File">
        <span className="fhead-name">
          Monika.Adeishvili
        </span>
        <span className="fhead-sub">
          Portfolio <span className="fhead-badge">Open to work</span>
        </span>
      </nav>
    </div>
  )
}

/** the live zoom level (the scroll loop writes into it) */
export function Zoom() {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    ui.zoom = ref.current
    return () => {
      if (ui.zoom === ref.current) ui.zoom = null
    }
  }, [])
  return (
    <span className="zoom" aria-label="Zoom level">
      <span ref={ref}>100%</span>
    </span>
  )
}

/** who is in the file, and the one button that matters */
export function ShareHead() {
  return (
    <div className="shead">
      <ul className="avatars" aria-label="People in this file">
          {PEOPLE.map((p) => (
            <li key={p.i} className="avatar" style={{ background: p.c, color: '#fff' }}>
              <span aria-hidden="true">{p.i}</span>
              <span className="sr-only">{p.n}</span>
              {/* our own tooltip: shows the moment you hover (the native one waits) */}
              <span className="av-tip" aria-hidden="true">
                {p.n}
              </span>
            </li>
          ))}
      </ul>
      <a className="btn-primary" href={`mailto:${EMAIL}`}>
        Say hello
      </a>
    </div>
  )
}

/** the file head on its own, where there is no Layers panel */
export function FileCard() {
  return (
    <header className="layers chrome fcard">
      <FileHead />
    </header>
  )
}

/** the share head on its own, where there is no Design panel */
export function ShareCard() {
  return (
    <div className="inspector chrome scard">
      <ShareHead />
    </div>
  )
}

/**
 * Phones: one floating file bar, the twin of the dock at the bottom (same
 * insets, radius, padding and surface), so the canvas is framed like one
 * product. The file (tap: back to the start), who's in it (at a glance, not a
 * menu), and the one button that matters. It stays put while you scroll.
 */
export function FileBar() {
  const home = () => {
    if (ui.scrollTo) ui.scrollTo(0, 1.2)
    else window.scrollTo({ top: 0, behavior: 'auto' })
  }
  return (
    <header className="chrome filebar">
      <button type="button" className="fb-home" onClick={home} aria-label="Monika Adeishvili — back to start">
        <MomoMark />
        <span className="fb-name" aria-hidden="true">
          Monika.Adeishvili
        </span>
        <span className="fhead-badge fb-badge" aria-hidden="true">
          Open to work
        </span>
      </button>
      <ul className="avatars fb-ppl" aria-label={`${PEOPLE.length} people in this file: you and Monika`}>
        {PEOPLE.map((p) => (
          <li key={p.i} className="avatar" style={{ background: p.c, color: '#fff' }} aria-hidden="true">
            {p.i}
          </li>
        ))}
      </ul>
      <a className="btn-primary fb-cta" href={`mailto:${EMAIL}`}>
        Say hello
      </a>
    </header>
  )
}
