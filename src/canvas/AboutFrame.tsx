import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Eyes } from '../scene/Eyes'
import { Shape } from '../scene/creatures'
import { offsetIn } from '../scene/layout'
import { hover, register } from '../scene/store'
import { StatusPill } from './HeroFrame'
import { Tooltip } from '../ui/components'

export const EMAIL = 'monikaadeishvili@gmail.com'
export const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/monika-adeishvili-5a84b11b6' },
  { label: 'Behance', href: 'https://www.behance.net/monikaadeishv' },
  { label: 'Dribbble', href: 'https://dribbble.com/monikaadeishvili' },
]

export interface PieceDef {
  id: string
  name: string
  color: string
}

export const PIECES: PieceDef[] = [
  { id: 'portrait', name: 'Portrait', color: '#FF5C39' },
  { id: 'headline', name: 'Headline', color: '#5B4BFF' },
  { id: 'bio', name: 'Bio', color: '#2DB8FF' },
  { id: 'stats', name: 'Stats', color: '#FFC629' },
  { id: 'chips', name: 'Chips', color: '#B6F03A' },
  { id: 'cta', name: 'CTA', color: '#FF7AD1' },
]

const STATS = [
  { n: 6, suf: '+', label: 'years designing', c: 'var(--yellow)' },
  { n: 18, suf: '', label: 'client products at one agency', c: 'var(--lime)' },
  { n: 9, suf: '', label: 'industries', c: 'var(--sky)' },
]
const CHIPS = ['DAZN', 'NOTA by M&T Bank', 'Contrast', 'Forcoda', 'Burq']

function Piece({ def, className = '', children }: { def: PieceDef; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const un = register({ id: def.id, name: def.name, kind: 'piece', color: def.color, el, hoverEl: el, liftEl: el })
    const enter = () => hover.set(def.id)
    const leave = () => hover.get() === def.id && hover.set(null)
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointerleave', leave)
    return () => {
      un()
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointerleave', leave)
    }
  }, [def])
  return (
    <div ref={ref} className={`piece piece-${def.id} ${className}`} data-piece={def.id} data-layer={def.id}>
      <div className="piece-in">{children}</div>
      <div className="piece-alive" aria-hidden="true">
        <span className="alive-tag">◆ {def.name}</span>
        <Eyes x={def.id === 'portrait' ? 24 : 82} y={0} size={def.id === 'headline' ? 18 : 14} />
      </div>
      <div className="sel-box piece-sel" aria-hidden="true">
        <span className="sel-label">{def.name}</span>
        <span className="size-badge piece-badge" />
      </div>
    </div>
  )
}

interface Guide {
  k: number
  x: number
  y: number
  len: number
  dir: 'v' | 'h'
  label: string
}

const P = Object.fromEntries(PIECES.map((p) => [p.id, p])) as Record<string, PieceDef>

export function AboutFrame() {
  const layerRef = useRef<HTMLDivElement>(null)
  const [guides, setGuides] = useState<Guide[]>([])

  useLayoutEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const measure = () => {
      const get = (id: string) => {
        const el = layer.querySelector<HTMLElement>(`[data-piece="${id}"]`)
        return el ? offsetIn(el, layer) : null
      }
      const order = ['headline', 'bio', 'stats', 'chips', 'cta']
      const out: Guide[] = []
      const portrait = get('portrait')
      const head = get('headline')
      if (portrait && head && head.x > portrait.x + portrait.w + 4) {
        const gap = head.x - (portrait.x + portrait.w)
        out.push({ k: 0, dir: 'h', x: portrait.x + portrait.w, y: Math.min(portrait.y + portrait.h * 0.3, head.y + head.h / 2), len: gap, label: `${Math.round(gap)}` })
      } else if (portrait && head) {
        const gap = head.y - (portrait.y + portrait.h)
        out.push({ k: 0, dir: 'v', x: head.x + head.w * 0.7, y: portrait.y + portrait.h, len: gap, label: `${Math.round(gap)}` })
      }
      for (let i = 0; i < order.length - 1; i++) {
        const a = get(order[i])
        const b = get(order[i + 1])
        if (!a || !b) continue
        const gap = b.y - (a.y + a.h)
        if (gap < 4) continue
        out.push({ k: i + 1, dir: 'v', x: a.x + Math.min(a.w, b.w) * (0.62 + (i % 2) * 0.14), y: a.y + a.h, len: gap, label: `${Math.round(gap)}` })
      }
      setGuides(out)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(layer)
    document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="about-layer" ref={layerRef} data-section="about">
      <div className="about-grid">
        <Piece def={P.portrait}>
          <figure className="portrait">
            <div className="portrait-back" aria-hidden="true">
              <span className="portrait-sun" />
              <span className="portrait-wave" />
            </div>
            <div className="peek-chip" aria-hidden="true">
              <div className="cr-lib">
                <Tooltip>that's me</Tooltip>
                <Eyes x={84} y={4} size={11} gap={0.45} />
              </div>
            </div>
            <div className="portrait-card">
              <img src="/monika.jpg" alt="Portrait of Monika Adeishvili" width={1200} height={1200} decoding="async" />
            </div>
            <figcaption className="name-tag">
              Monika <span aria-hidden="true">◆</span>
            </figcaption>
          </figure>
        </Piece>

          <Piece def={P.headline}>
            <p className="eyebrow">Product Designer · Alicante, Spain</p>
            <h2 className="headline" id="about-headline" tabIndex={-1}>
              Hi, I'm <em>Monika</em>.<span className="headline-2">I design products that <em>don't ignore</em> people.</span>
            </h2>
          </Piece>

          <Piece def={P.bio}>
            <p className="bio">
              Six years of turning messy problems into calm products — sports streaming at DAZN, business banking at NOTA by M&amp;T Bank,
              eighteen client products at Forcoda. I think in components: small, honest pieces that add up to something people can trust.
            </p>
          </Piece>

          <Piece def={P.stats}>
            <ul className="stats">
              {STATS.map((s) => (
                <li key={s.label} className="stat" style={{ '--c': s.c } as CSSProperties}>
                  <span className="stat-n">
                    <span className="stat-count" data-count={s.n}>
                      {s.n}
                    </span>
                    {s.suf}
                  </span>
                  <span className="stat-l">{s.label}</span>
                </li>
              ))}
            </ul>
          </Piece>

          <Piece def={P.chips}>
            <div className="chips">
              <span className="chips-label">Worked with</span>
              <ul>
                {CHIPS.map((c) => (
                  <li key={c} className="chip">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </Piece>

          <Piece def={P.cta}>
            <div className="cta">
              <div className="cta-main">
                <a className="btn-primary btn-xl" href={`mailto:${EMAIL}`}>
                  Say hello
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
                  </svg>
                </a>
                <div className="momo-home" aria-hidden="true">
                  <div className="momo-body">
                    <Shape kind="blob" color="#5B4BFF" />
                    <Eyes x={50} y={46} size={12} />
                  </div>
                </div>
              </div>
              <ul className="socials">
                {LINKS.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} target="_blank" rel="noreferrer">
                      {l.label}
                      <svg viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M3.5 8.5l5-5M4.5 3.5h4v4" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
              <StatusPill />
            </div>
          </Piece>
      </div>

      <div className="org-park" aria-hidden="true" />
      <div className="guides" aria-hidden="true">
        {guides.map((g) => (
          <div
            key={`${g.k}-${g.dir}`}
            className={`guide guide-${g.dir}`}
            data-k={g.k}
            style={{ left: g.x, top: g.y, [g.dir === 'v' ? 'height' : 'width']: g.len } as CSSProperties}
          >
            <span>{g.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
