import { useEffect, useRef, useState } from 'react'
import { Chevron } from './Icons'

const PAGES = [
  { n: 1, href: '/', label: 'Page 1 — Organism' },
  { n: 2, href: '/build', label: 'Page 2 — Assembly' },
]

/** the Layers panel's page dropdown — a real switcher (plain links) */
export function PageSwitch({ current }: { current: 1 | 2 }) {
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
    <div className={`page-switch${open ? ' is-open' : ''}`} ref={ref}>
      <button type="button" className="page-switch-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        Page {current} <Chevron open={open} />
      </button>
      <ul className="page-switch-menu" hidden={!open}>
        {PAGES.map((p) => (
          <li key={p.n}>
            <a href={p.href} aria-current={p.n === current ? 'page' : undefined}>
              <span className="page-switch-check" aria-hidden="true">
                {p.n === current ? '✓' : ''}
              </span>
              {p.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
