/**
 * The living component library, in the momo visual system: paper, ink, violet
 * and the pastel accents, chunky ink outlines with hard offset shadows.
 * Everything here is plain, presentational, accessible UI. Life (eyes, legs,
 * travel) is added by <Alive>.
 */
import { useId, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import type { Seg } from '../content/story'

export type Tone = 'violet' | 'yellow' | 'coral' | 'lime' | 'sky' | 'pink' | 'mint' | 'ink' | 'paper'

export const TONE_HEX: Record<Tone, string> = {
  violet: '#5B4BFF',
  yellow: '#FFC629',
  coral: '#FF5C39',
  lime: '#B6F03A',
  sky: '#2DB8FF',
  pink: '#FF7AD1',
  mint: '#19D3A2',
  ink: '#16131D',
  paper: '#F3EFE6',
}

const tv = (t: Tone) => ({ '--tone': `var(--${t === 'paper' ? 'paper' : t === 'ink' ? 'ink' : t})` }) as CSSProperties

/* ----------------------------------------------------------------- icons */

export function Arrow({ dir = 'right' }: { dir?: 'right' | 'down' | 'up-right' }) {
  const d = dir === 'down' ? 'M8 3v9M4.5 8.5 8 12l3.5-3.5' : dir === 'up-right' ? 'M4.5 11.5l7-7M5.5 4.5h6v6' : 'M3 8h9M8.5 4.5 12 8l-3.5 3.5'
  return (
    <svg viewBox="0 0 16 16" className="u-ico" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export function MomoGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 94" width={size} height={size * 0.94} className="u-momo" aria-hidden="true">
      <path d="M50 4C75 3 96 20 95 47c-1 27-19 44-45 43C23 89 4 73 5 46 6 20 25 5 50 4Z" fill="#5B4BFF" stroke="#16131D" strokeWidth="7" />
      <ellipse cx="38" cy="44" rx="7" ry="9" fill="#fff" stroke="#16131D" strokeWidth="4" />
      <ellipse cx="62" cy="44" rx="7" ry="9" fill="#fff" stroke="#16131D" strokeWidth="4" />
      <circle cx="39" cy="46" r="3.6" fill="#16131D" />
      <circle cx="63" cy="46" r="3.6" fill="#16131D" />
    </svg>
  )
}

/* --------------------------------------------------------------- buttons */

interface BtnProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md' | 'xl'
  icon?: 'right' | 'down' | 'up-right' | null
  className?: string
  external?: boolean
  state?: 'hover' | 'pressed' | 'disabled'
}

export function Button({ children, href, onClick, variant = 'primary', size = 'md', icon = null, className = '', external, state }: BtnProps) {
  const cls = `u-btn u-btn-${variant} u-btn-${size}${state ? ` is-${state}` : ''} ${className}`
  const inner = (
    <>
      <span className="u-btn-label">{children}</span>
      {icon && <Arrow dir={icon} />}
    </>
  )
  if (href)
    return (
      <a className={cls} href={href} onClick={onClick} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
        {inner}
      </a>
    )
  return (
    <button type="button" className={cls} onClick={onClick} disabled={state === 'disabled'} tabIndex={state ? -1 : undefined}>
      {inner}
    </button>
  )
}

export function IconButton({ label, children, tone = 'paper' }: { label: string; children: ReactNode; tone?: Tone }) {
  return (
    <button type="button" className="u-iconbtn" aria-label={label} style={tv(tone)}>
      {children}
    </button>
  )
}

export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="u-link" href={href} target="_blank" rel="noreferrer">
      <span>{children}</span>
      <Arrow dir="up-right" />
    </a>
  )
}

/* ------------------------------------------------------- badges + chips */

export function Badge({ children, dot = true, tone = 'mint' }: { children: ReactNode; dot?: boolean; tone?: Tone }) {
  return (
    <span className="u-badge" style={tv(tone)}>
      {dot && <span className="u-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Chip({ children, tone = 'lime', lead }: { children: ReactNode; tone?: Tone; lead?: ReactNode }) {
  return (
    <span className="u-chip" style={tv(tone)}>
      {lead}
      {children}
    </span>
  )
}

/* ------------------------------------------------------------- avatar */

export function Avatar({ name, role, src = '/monika.jpg', size = 44 }: { name: string; role?: string; src?: string; size?: number }) {
  return (
    <span className="u-avatar">
      <span className="u-avatar-img" style={{ width: size, height: size }}>
        <img src={src} alt="" width={size} height={size} decoding="async" />
        <i className="u-avatar-on" aria-hidden="true" />
      </span>
      <span className="u-avatar-txt">
        <b>{name}</b>
        {role && <span>{role}</span>}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------ nav bar */

export function NavBar({ compact = false, onNav }: { compact?: boolean; onNav?: (to: 'work' | 'about' | 'contact') => void }) {
  const go = (to: 'work' | 'about' | 'contact') => (e: MouseEvent) => {
    if (!onNav) return
    e.preventDefault()
    onNav(to)
  }
  return (
    <nav className={`u-nav${compact ? ' is-compact' : ''}`} aria-label="Site">
      <a className="u-nav-brand" href="#ch-hello" onClick={go('about')}>
        <span className="u-nav-logo" aria-hidden="true">
          <MomoGlyph size={22} />
        </span>
        <span>
          Monika<span className="u-nav-dim"> Adeishvili</span>
        </span>
      </a>
      {!compact && (
        <ul className="u-nav-links">
          <li>
            <a href="#ch-proof" onClick={go('work')}>
              Work
            </a>
          </li>
          <li>
            <a href="#ch-origin" onClick={go('about')}>
              About
            </a>
          </li>
          <li>
            <a href="#ch-contact" onClick={go('contact')}>
              Contact
            </a>
          </li>
        </ul>
      )}
      <Button href="mailto:monikaadeishvili@gmail.com" size="sm">
        Say hello
      </Button>
    </nav>
  )
}

/* ----------------------------------------------------- text components */

function Words({ segs }: { segs: Seg[] }) {
  const out: ReactNode[] = []
  let k = 0
  segs.forEach((s) => {
    const em = typeof s !== 'string'
    const text = typeof s === 'string' ? s : s.em
    text.split(/(\s+)/).forEach((w) => {
      if (!w) return
      if (/^\s+$/.test(w)) {
        out.push(' ')
        return
      }
      out.push(
        <span className={`w${em ? ' w-em' : ''}`} key={k++}>
          <span className="w-in">{w}</span>
        </span>,
      )
    })
  })
  return <>{out}</>
}

export function Heading({ segs, level = 2, size = 'lg', id }: { segs: Seg[]; level?: 1 | 2; size?: 'xl' | 'lg' | 'giant'; id?: string }) {
  const Tag = level === 1 ? 'h1' : 'h2'
  const plain = segs.map((s) => (typeof s === 'string' ? s : s.em)).join('')
  return (
    <div className={`u-heading u-heading-${size}`}>
      <Tag className="u-h" id={id} tabIndex={-1}>
        <span className="sr-only">{plain}</span>
        <span className="u-h-vis" aria-hidden="true">
          <Words segs={segs} />
        </span>
      </Tag>
      <span className="u-h-skel" aria-hidden="true">
        <i />
        <i />
      </span>
    </div>
  )
}

export function Paragraph({ children, size = 'md' }: { children: ReactNode; size?: 'md' | 'lg' }) {
  return <p className={`u-para u-para-${size}`}>{children}</p>
}

/* -------------------------------------------------------------- cards */

export function PortraitCard({ name = 'Monika', note }: { name?: string; note?: string }) {
  return (
    <figure className="u-portrait">
      <div className="u-portrait-back" aria-hidden="true">
        <span className="u-portrait-sun" />
        <span className="u-portrait-wave" />
      </div>
      <div className="u-portrait-card">
        <img src="/monika.jpg" alt="Portrait of Monika Adeishvili" width={1200} height={1200} decoding="async" />
      </div>
      <figcaption className="u-portrait-tag">
        {name} <span aria-hidden="true">◆</span>
        {note && <em>{note}</em>}
      </figcaption>
    </figure>
  )
}

export function StatCard({ n, suf, label, tone }: { n: number; suf: string; label: string; tone: Tone }) {
  return (
    <div className="u-stat" style={tv(tone)}>
      <span className="u-stat-n">
        <span className="u-count" data-count={n}>
          {n}
        </span>
        {suf}
      </span>
      <span className="u-stat-l">{label}</span>
    </div>
  )
}

export function CompanyCard({ name, role, mark, tone }: { name: string; role: string; mark: string; tone: Tone }) {
  return (
    <div className="u-company" style={tv(tone)}>
      <span className="u-company-mark" style={tv(tone)} aria-hidden="true">
        {mark}
      </span>
      <span className="u-company-txt">
        <b>{name}</b>
        <span>{role}</span>
      </span>
    </div>
  )
}

export function QuoteCard({ text, by }: { text: string; by: string }) {
  return (
    <figure className="u-quote">
      <span className="u-quote-mark" aria-hidden="true">
        “
      </span>
      <blockquote>{text}</blockquote>
      <figcaption>— {by}</figcaption>
    </figure>
  )
}

export function Card({ title, children, tone = 'paper', aside }: { title?: string; children?: ReactNode; tone?: Tone; aside?: ReactNode }) {
  return (
    <div className="u-card" style={tv(tone)}>
      {title && (
        <div className="u-card-head">
          <span className="u-card-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="u-card-title">{title}</span>
          {aside}
        </div>
      )}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------ controls */

export function Toggle({ on = true, label, tone = 'mint' }: { on?: boolean; label: string; tone?: Tone }) {
  return (
    <span className="u-togglerow">
      <span className="u-togglerow-l">{label}</span>
      <span className={`u-toggle${on ? ' is-on' : ''}`} role="img" aria-label={on ? 'on' : 'off'} style={tv(tone)}>
        <i />
      </span>
    </span>
  )
}

export function CheckRow({ children, n }: { children: ReactNode; n: number }) {
  return (
    <div className="u-check" data-n={n}>
      <span className="u-check-box" aria-hidden="true">
        <span className="u-check-fill" />
        <svg viewBox="0 0 16 16">
          <path className="u-check-tick" pathLength={1} d="M3.5 8.5 6.6 11.4 12.5 4.8" />
        </svg>
      </span>
      <span className="u-check-txt">{children}</span>
    </div>
  )
}

export function SwatchRow() {
  const sw: Tone[] = ['violet', 'yellow', 'coral', 'lime', 'sky', 'pink', 'mint']
  return (
    <div className="u-swatches" role="list" aria-label="Colour tokens">
      {sw.map((t) => (
        <span key={t} role="listitem" className="u-swatch" style={tv(t)} title={TONE_HEX[t]}>
          <span className="sr-only">{t}</span>
        </span>
      ))}
    </div>
  )
}

export function TypeScale() {
  return (
    <div className="u-type" aria-label="Type scale">
      <span className="u-type-a">Aa</span>
      <span className="u-type-b">Aa</span>
      <span className="u-type-meta">
        <b>Bricolage 800</b>
        <span>Instrument Serif · Inter</span>
      </span>
    </div>
  )
}

export function Tabs({ items, active = 0 }: { items: string[]; active?: number }) {
  return (
    <div className="u-tabs" role="list" aria-label="Example tabs">
      {items.map((t, i) => (
        <span key={t} role="listitem" aria-current={i === active ? 'true' : undefined} className={`u-tab${i === active ? ' is-on' : ''}`}>
          {t}
        </span>
      ))}
    </div>
  )
}

export function Input({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return (
    <label className="u-input">
      <span className="u-input-l">{label}</span>
      <span className="u-input-f">
        <input type="text" defaultValue={value} placeholder={placeholder} readOnly tabIndex={-1} aria-label={label} />
        <i className="u-caret" aria-hidden="true" />
      </span>
    </label>
  )
}

export function Tooltip({ children, side = 'bottom' }: { children: ReactNode; side?: 'bottom' | 'left' | 'right' }) {
  return (
    <span className={`u-tip u-tip-${side}`} role="note">
      {children}
    </span>
  )
}

/* ----------------------------------------------------------- timeline */

export function TimelineNode({ year, name, last, tone = 'yellow' }: { year: string; name: string; last?: boolean; tone?: Tone }) {
  return (
    <span className={`u-tnode${last ? ' is-last' : ''}`} style={tv(tone)}>
      <i className="u-tnode-dot" aria-hidden="true" />
      <b>{name}</b>
      {year && <span>{year}</span>}
    </span>
  )
}

export function MapCard() {
  const mid = useId().replace(/:/g, '')
  const d = 'M262 66 C 214 4, 112 6, 58 126'
  return (
    <div className="u-map">
      <div className="u-map-head">
        <span className="u-card-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="u-card-title">route.map</span>
        <span className="u-map-years">2020 → today</span>
      </div>
      <div className="u-map-body">
        <svg viewBox="0 0 320 190" className="u-map-svg" role="img" aria-label="Flight path from Tbilisi, 2020, to Alicante, today">
          <defs>
            <mask id={`m-${mid}`} maskUnits="userSpaceOnUse" x="0" y="0" width="320" height="190">
              <path className="u-map-draw" d={d} pathLength={1} />
            </mask>
          </defs>
          <path className="u-map-land a" d="M196 30c30-14 74-10 98 10s22 56-4 72-70 12-92-6-32-62-2-76Z" />
          <path className="u-map-land b" d="M18 96c14-26 60-34 86-18s30 52 6 68-62 20-82 6-22-34-10-56Z" />
          <path className="u-map-route" d={d} mask={`url(#m-${mid})`} />
          <path className="u-map-ghost" d={d} />
          <g className="u-map-pin a" transform="translate(262 66)">
            <circle r="9" />
          </g>
          <g className="u-map-pin b" transform="translate(58 126)">
            <circle r="9" />
          </g>
          <g className="u-map-plane" transform="translate(58 126)">
            <circle r="7" />
            <path d="M-3.5 -2.5 L4 0 L-3.5 2.5 Z" />
          </g>
        </svg>
        <span className="u-map-label a">
          <b>Tbilisi</b> 2020
        </span>
        <span className="u-map-label b">
          <b>Alicante</b> today
        </span>
      </div>
      <span className="u-route-chip">
        Tbilisi <Arrow /> Alicante
      </span>
    </div>
  )
}

export function Footer({ text }: { text: string }) {
  return (
    <footer className="u-footer">
      <MomoGlyph size={18} />
      <span>{text}</span>
    </footer>
  )
}

export function Mascot() {
  return (
    <span className="u-mascot" aria-hidden="true">
      <span className="u-mascot-body">
        <MomoGlyph size={52} />
      </span>
    </span>
  )
}
