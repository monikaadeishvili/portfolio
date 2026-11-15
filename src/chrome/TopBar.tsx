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
  { i: 'M', c: 'var(--violet)', n: 'Monika (owner)' },
  { i: 'P', c: 'var(--mint)', n: 'PM' },
  { i: 'D', c: 'var(--sky)', n: 'Dev' },
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
export function ShareHead({ people = true }: { people?: boolean }) {
  return (
    <div className="shead">
      {people && (
        <ul className="avatars" aria-label="People in this file">
          {PEOPLE.map((p) => (
            <li key={p.i} className="avatar" style={{ background: p.c }} title={p.n}>
              <span aria-hidden="true">{p.i}</span>
              <span className="sr-only">{p.n}</span>
            </li>
          ))}
        </ul>
      )}
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
      <ShareHead people={false} />
    </div>
  )
}
