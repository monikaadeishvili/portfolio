/**
 * <Alive> turns a piece of real UI into a little creature: eyes, two ink legs,
 * a dashed component outline with a ◆ tag, and a contact shadow. Its life
 * state (roaming | leaping | placed) is written by the ticker loop as a
 * data attribute; CSS does the rest. When rendered outside a <LifeProvider>
 * it is simply placed, crisp UI.
 */
import { createContext, useContext, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Eyes } from '../scene/Eyes'

export type Travel = 'scurry' | 'leap' | 'drop'
export type LifeState = 'roaming' | 'leaping' | 'placed' | 'inside'

export interface EyeSpot {
  x: number
  y: number
  s?: number
}

export interface AliveMeta {
  id: string
  name: string
  tone: string
  travel: Travel
  /** assembly order inside its frame (lower lands first) */
  order: number
  /** id of the component in the previous frame this one is an instance of */
  from?: string
  /** CTA: lands last with the biggest bounce */
  hero?: boolean
  slot: HTMLElement
  alive: HTMLElement
  inner: HTMLElement
  shadow: HTMLElement
  sizeEl: HTMLElement | null
}

export interface LifeCtx {
  chapter: number
  register: (m: AliveMeta, chapter: number) => () => void
}

export const LifeContext = createContext<LifeCtx | null>(null)

interface AliveProps {
  id: string
  name: string
  tone?: string
  travel?: Travel
  order: number
  from?: string
  hero?: boolean
  eyes?: EyeSpot | false
  legs?: boolean
  className?: string
  style?: CSSProperties
  /** what this instance looked like in the previous frame (shown until it is inside the bubble) */
  pre?: ReactNode
  children: ReactNode
}

export function Alive({ id, name, tone = '#5B4BFF', travel = 'leap', order, from, hero, eyes = { x: 50, y: 0, s: 15 }, legs = true, className = '', style, pre, children }: AliveProps) {
  const ctx = useContext(LifeContext)
  const slotRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const slot = slotRef.current
    if (!slot || !ctx) return
    const q = (s: string) => slot.querySelector(`:scope > ${s}`) as HTMLElement
    const alive = q('.alive')
    return ctx.register(
      {
        id,
        name,
        tone,
        travel,
        order,
        from,
        hero,
        slot,
        alive,
        inner: alive.querySelector('.alive-in') as HTMLElement,
        shadow: q('.alive-shadow'),
        sizeEl: slot.querySelector('.alive-size'),
      },
      ctx.chapter,
    )
  }, [ctx, id, name, tone, travel, order, from, hero])

  return (
    <div ref={slotRef} className={`slot ${className}`} data-cid={id} data-st={ctx ? 'roaming' : 'placed'} style={style}>
      <div className="slot-ph" aria-hidden="true">
        <span className="slot-lbl">{name}</span>
      </div>
      <div className="alive-shadow" aria-hidden="true" />
      <div className="alive">
        <div className="alive-in">
          {pre ? (
            <>
              <div className="alive-pre" aria-hidden="true" inert>
                {pre}
              </div>
              <div className="alive-body">{children}</div>
            </>
          ) : (
            children
          )}
          <div className="alive-outline" aria-hidden="true">
            <span className="alive-tag">◆ {name}</span>
            <span className="alive-size" />
          </div>
          {eyes && <Eyes x={eyes.x} y={eyes.y} size={eyes.s ?? 15} className="alive-eyes" />}
          {legs && (
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
