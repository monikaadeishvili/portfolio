import { useLayoutEffect, useRef } from 'react'
import { MomoMark } from './Icons'
import { ui } from '../scene/store'
import { EMAIL } from '../content/story'

const PEOPLE = [
  { i: 'M', c: 'var(--violet)', n: 'Monika (owner)' },
  { i: 'P', c: 'var(--mint)', n: 'PM' },
  { i: 'D', c: 'var(--sky)', n: 'Dev' },
]

export function TopBar() {
  const zoomRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    ui.zoom = zoomRef.current
    return () => {
      ui.zoom = null
    }
  }, [])

  return (
    <header className="topbar chrome">
      <div className="tb-left">
        <MomoMark />
        <nav className="crumbs" aria-label="File">
          <span className="crumb-dim">Portfolio</span>
          <span className="crumb-sep" aria-hidden="true">
            /
          </span>
          <span className="crumb-file">Monika.Adeishvili</span>
        </nav>
      </div>

      <div className="tb-right">
        <ul className="avatars" aria-label="People in this file">
          {PEOPLE.map((p) => (
            <li key={p.i} className="avatar" style={{ background: p.c }} title={p.n}>
              <span aria-hidden="true">{p.i}</span>
              <span className="sr-only">{p.n}</span>
            </li>
          ))}
        </ul>
        <span className="zoom" aria-label="Zoom level">
          <span ref={zoomRef}>100%</span>
        </span>
        <a className="btn-primary" href={`mailto:${EMAIL}`}>
          Say hello
        </a>
      </div>
    </header>
  )
}
