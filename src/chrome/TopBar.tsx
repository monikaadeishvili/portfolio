/**
 * What used to be the top bar, split into the two side panels the way Figma
 * does it: the file (mark, name, project) heads the Layers panel on the left;
 * the people in the file and the Say hello button head the Design panel on the
 * right, with the zoom level next to the Design tab. Where a panel isn't shown
 * (tablet: no Layers; phone / reduced motion: no panels) the same heads stand
 * alone as small cards.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MomoMark } from './Icons'
import { ui } from '../scene/store'
import { EMAIL } from '../content/story'

const PEOPLE = [
  // the visitor first, in the same coral as their own "You" cursor on the canvas
  { i: 'Y', c: 'var(--coral)', n: 'You (viewing)' },
  { i: 'M', c: 'var(--violet)', n: 'Monika (owner)' },
  { i: 'P', c: 'var(--mint)', n: 'PM', ink: true },
  { i: 'D', c: 'var(--sky)', n: 'Dev', ink: true },
]
const YOU = PEOPLE[0]
const fg = (p: (typeof PEOPLE)[number]) => ('ink' in p ? 'var(--ink)' : '#fff')

function Avatar({ p }: { p: (typeof PEOPLE)[number] }) {
  return (
    <span className="avatar" style={{ background: p.c, color: fg(p) }} aria-hidden="true">
      {p.i}
    </span>
  )
}

/** phones: the visitor's own avatar and a chevron, like Figma's mobile app; it
 *  opens the list of everyone in the file */
function People() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="ppl" ref={ref}>
      <button type="button" className="ppl-btn" aria-expanded={open} aria-haspopup="true" aria-label={`${PEOPLE.length} people in this file`} onClick={() => setOpen((v) => !v)}>
        <Avatar p={YOU} />
        <span className="ppl-chev" aria-hidden="true">
          <svg viewBox="0 0 12 12">
            <path d="M3 4.5 6 7.5 9 4.5" />
          </svg>
        </span>
      </button>
      {open && (
        <ul className="ppl-list chrome" aria-label="People in this file">
          {PEOPLE.map((p) => (
            <li key={p.i}>
              <Avatar p={p} />
              <span>{p.n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

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
export function ShareHead({ compact = false }: { compact?: boolean }) {
  return (
    <div className="shead">
      {compact ? (
        <People />
      ) : (
        <ul className="avatars" aria-label="People in this file">
          {PEOPLE.map((p) => (
            <li key={p.i} className="avatar" style={{ background: p.c, color: fg(p) }}>
              <span aria-hidden="true">{p.i}</span>
              <span className="sr-only">{p.n}</span>
              {/* our own tooltip: shows the moment you hover (the native one waits) */}
              <span className="av-tip" aria-hidden="true">
                {p.n}
              </span>
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
      {/* who's in the file (your avatar + a chevron, like Figma's mobile app), then the button */}
      <ShareHead compact />
    </div>
  )
}
