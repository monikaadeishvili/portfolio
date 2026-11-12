import { useLayoutEffect, useRef } from 'react'
import { MomoMark } from './Icons'
import { ui } from '../scene/store'
import { EMAIL } from '../canvas/AboutFrame'

const TABS = ['About', 'Work', 'Process', 'Contact']
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
          <span className="crumb-file">
            monika-adeishvili<span className="crumb-ext">.momo</span>
          </span>
        </nav>
      </div>

      <nav className="tabs" aria-label="Pages">
        {TABS.map((t, i) =>
          i === 0 ? (
            <a key={t} className="tab is-active" href="#top" aria-current="page">
              {t}
            </a>
          ) : (
            <span key={t} className="tab is-soon" tabIndex={0} role="link" aria-disabled="true" aria-describedby={`soon-${t}`}>
              {t}
              <span className="tip" role="tooltip" id={`soon-${t}`}>
                soon
              </span>
            </span>
          ),
        )}
      </nav>

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
