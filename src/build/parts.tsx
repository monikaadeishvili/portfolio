/**
 * Building blocks for the /build artboards.
 *  <Piece>   a real UI component with a slot. Heroes get eyes, legs, a tag and
 *            a parking spot; bubble-born pieces are plain neat UI with a short
 *            coloured trail.
 *  <Reveal>  a text block revealed typographically (masked rise / typewriter).
 *  <Region>  a horizontal band of the artboard that builds as one beat.
 * Outside a live context (reduced motion / ?static) everything renders as
 * plain, finished, semantic markup.
 */
import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { Eyes } from '../scene/Eyes'
import type { Seg } from '../content/story'
import { registerPiece, registerRegion, registerText, type Kind, type Travel } from './runtime'

export interface BuildCtx {
  section: number
  live: boolean
  narrow: boolean
}
export const SectionCtx = createContext<BuildCtx>({ section: 0, live: false, narrow: false })
const RegionCtx = createContext(0)

export const useSection = () => useContext(SectionCtx)

/* --------------------------------------------------------------- Region */

export function Region({ index, label, className = '', children, as: Tag = 'div', style, weight = 1, hold }: { index: number; label: string; className?: string; children: ReactNode; as?: ElementType; style?: CSSProperties; weight?: number; /** focus inside jumps to this hold: "u,min,max" (section-local) */ hold?: string }) {
  const ctx = useSection()
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (!ctx.live || !ref.current) return
    return registerRegion({ section: ctx.section, index, label, el: ref.current })
  }, [ctx.live, ctx.section, index, label])
  return (
    <RegionCtx.Provider value={index}>
      <Tag ref={ref} className={`rg ${className}`} data-region={index} data-weight={weight} data-hold={hold} style={style}>
        {children}
      </Tag>
    </RegionCtx.Provider>
  )
}

/* ---------------------------------------------------------------- Piece */

interface PieceProps {
  id: string
  name: string
  kind: Kind
  tone?: string
  travel?: Travel
  order: number
  /** landing time within the region window, 0..1 */
  at?: number
  /** hero travel length, fraction of the region window */
  dur?: number
  /** parking spot for heroes, artboard px of the box' top-left: "x,y" */
  park?: string
  /** on narrow layouts: becomes bubble-born unless this is set */
  parkN?: string
  eyes?: { x: number; y: number; s?: number } | false
  legs?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export function Piece({ id, name, kind, tone = '#5B4BFF', travel, order, at, dur, park, parkN, eyes = { x: 50, y: 0, s: 16 }, legs = true, className = '', style, children }: PieceProps) {
  const ctx = useSection()
  const region = useContext(RegionCtx)
  const ref = useRef<HTMLDivElement>(null)
  // narrow layouts keep only a few heroes: the rest come out of the bubble
  const k: Kind = kind === 'hero' && ctx.narrow && !parkN ? 'bubble' : kind
  const tr: Travel = k === 'bubble' ? (travel === 'rain' || travel === 'slide' ? travel : 'spit') : (travel ?? 'leap')
  const hero = k === 'hero'

  useLayoutEffect(() => {
    const slot = ref.current
    if (!slot || !ctx.live) return
    const alive = slot.querySelector(':scope > .alive') as HTMLElement
    return registerPiece({
      id,
      name,
      kind: k,
      tone,
      section: ctx.section,
      region,
      order,
      travel: tr,
      at,
      dur,
      park: ctx.narrow ? parkN : park,
      slot,
      alive,
      inner: alive.querySelector('.alive-in') as HTMLElement,
      shadow: slot.querySelector(':scope > .alive-shadow') as HTMLElement,
      trail: Array.from(slot.querySelectorAll<HTMLElement>(':scope > .trail > i')),
    })
  }, [ctx.live, ctx.section, ctx.narrow, id, name, k, tone, region, order, tr, at, dur, park, parkN])

  if (!ctx.live)
    return (
      <div className={`slot is-static ${className}`} data-cid={id} data-st="placed" style={style}>
        <div className="alive">
          <div className="alive-in">{children}</div>
        </div>
      </div>
    )

  return (
    <div ref={ref} className={`slot k-${k} ${className}`} data-cid={id} data-st={hero ? 'roaming' : 'inside'} style={{ ...style, '--tone-c': tone } as CSSProperties}>
      <div className="slot-ph" aria-hidden="true">
        {hero && <span className="slot-lbl">{name}</span>}
      </div>
      {hero ? (
        <div className="alive-shadow" aria-hidden="true" />
      ) : (
        <>
          <div className="alive-shadow" aria-hidden="true" />
          <div className="trail" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </>
      )}
      <div className="alive">
        <div className="alive-in">
          {children}
          {hero && (
            <div className="alive-outline" aria-hidden="true">
              <span className="alive-tag">
                <i className="tag-hero" aria-hidden="true" /> {name}
              </span>
            </div>
          )}
          {hero && eyes && <Eyes x={eyes.x} y={eyes.y} size={eyes.s ?? 16} className="alive-eyes" />}
          {hero && legs && (
            <span className="alive-legs" aria-hidden="true">
              <i />
              <i />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Reveal */

function splitWords(segs: Seg[]) {
  const out: { w: string; em: boolean }[] = []
  segs.forEach((s) => {
    const em = typeof s !== 'string'
    const text = typeof s === 'string' ? s : s.em
    text.split(/\s+/).forEach((w) => w && out.push({ w, em }))
  })
  return out
}

interface RevealProps {
  id: string
  segs: Seg[]
  as?: ElementType
  mode?: 'rise' | 'type' | 'pre'
  order?: number
  className?: string
  hid?: string
  label?: string
}

/** text revealed word by word; the full string is always in the DOM */
export function Reveal({ id, segs, as: Tag = 'p', mode = 'rise', order = 0, className = '', hid, label }: RevealProps) {
  const ctx = useSection()
  const region = useContext(RegionCtx)
  const ref = useRef<HTMLElement>(null)
  const words = splitWords(segs)
  const plain = segs.map((s) => (typeof s === 'string' ? s : s.em)).join('')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !ctx.live) return
    return registerText({
      id,
      section: ctx.section,
      region,
      order,
      mode,
      el,
      words: Array.from(el.querySelectorAll<HTMLElement>('.rw-in')),
      label: label ?? (Tag === 'p' ? 'Paragraph' : 'Heading'),
    })
  }, [ctx.live, ctx.section, region, id, order, mode, label, Tag])

  return (
    <Tag ref={ref} className={`rv rv-${mode} ${className}`} id={hid} data-rv={id} tabIndex={hid ? -1 : undefined}>
      <span className="sr-only">{plain}</span>
      <span className="rv-vis" aria-hidden="true">
        {words.flatMap((w, i) => [
          <span key={i} className={`rw${w.em ? ' rw-em' : ''}`}>
            <span className="rw-in">{w.w}</span>
          </span>,
          i < words.length - 1 ? ' ' : null,
        ])}
      </span>
    </Tag>
  )
}
