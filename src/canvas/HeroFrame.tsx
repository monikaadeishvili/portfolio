import { useLayoutEffect, useRef, type RefObject } from "react"
import { CREATURES, Creature } from '../scene/creatures'
import { hover, register } from '../scene/store'

const L1 = 'Monika'.split('')
const L2 = 'Adeishvili'.split('')

export function StatusPill({ className = '' }: { className?: string }) {
  return (
    <span className={`status-pill ${className}`}>
      <span className="status-dot" aria-hidden="true" />
      Open to new work
    </span>
  )
}

function useLayer(ref: RefObject<HTMLElement | null>, id: string, name: string, kind: 'text' | 'note', color: string, liftSel?: string, rot = 0) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const lift = liftSel ? (el.querySelector(liftSel) as HTMLElement) : el
    const un = register({ id, name, kind, color, el: lift, hoverEl: el, liftEl: lift, baseRotation: rot })
    const enter = () => hover.set(id)
    const leave = () => hover.get() === id && hover.set(null)
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    return () => {
      un()
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
    }
  }, [ref, id, name, kind, color, liftSel, rot])
}

export function HeroFrame() {
  const nameRef = useRef<HTMLDivElement>(null)
  const roleRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  useLayer(nameRef, 'name', 'Monika Adeishvili', 'text', '#16131D')
  useLayer(roleRef, 'role', 'Product Designer', 'text', '#16131D')
  useLayer(stickyRef, 'sticky', 'Sticky note', 'note', '#FFC629', '.sticky-lift', -5)

  return (
    <div className="hero-layer" data-section="hero">
      <div className="name-block" ref={nameRef} data-layer="name">
        <h1 className="name">
          <span className="sr-only">Monika Adeishvili</span>
          <span className="name-line l1" aria-hidden="true">
            {L1.map((c, i) => (
              <span className="ch" key={i}>
                <span className="ch-in">{c}</span>
              </span>
            ))}
          </span>
          <span className="name-line l2" aria-hidden="true">
            {L2.map((c, i) => (
              <span className="ch" key={i}>
                <span className="ch-in">{c}</span>
              </span>
            ))}
          </span>
        </h1>
        <div className="sel-box name-sel" aria-hidden="true">
          <i className="h h-tl" />
          <i className="h h-t" />
          <i className="h h-tr" />
          <i className="h h-r" />
          <i className="h h-br" />
          <i className="h h-b" />
          <i className="h h-bl" />
          <i className="h h-l" />
          <span className="size-badge name-badge">1182 × 412</span>
        </div>
      </div>

      <div className="role-row" ref={roleRef} data-layer="role">
        <div className="role-in">
          <p className="role">
            Product Designer <span className="role-loc">· Alicante, Spain</span>
          </p>
          <StatusPill />
        </div>
      </div>

      <div className="scribble" aria-hidden="true">
        <svg viewBox="0 0 140 160">
          <path
            className="scribble-path"
            pathLength={1}
            d="M8 12c40-8 72 8 68 36-3 20-32 22-32 5 0-18 36-22 52-3 14 17 16 46 11 80"
          />
          <path className="scribble-head" pathLength={1} d="M96 118l11 13 9-15" />
        </svg>
      </div>

      <div className="sticky-wrap" ref={stickyRef} data-layer="sticky" aria-hidden="true">
        <div className="sticky-lift">
          <div className="sticky">
            <span className="sticky-tape" />
            <p>scroll — I'll build this page in front of you ↓</p>
            <span className="sticky-by">— Monika</span>
          </div>
          <div className="sel-box">
            <span className="sel-label">Sticky note</span>
          </div>
        </div>
      </div>

      {CREATURES.map((def) => (
        <Creature key={def.id} def={def} />
      ))}
    </div>
  )
}
