import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { gsap, Draggable, InertiaPlugin } from './gsap'
import { Eyes } from './Eyes'
import { hover, register, scene } from './store'
import { Badge, CheckRow, Input, Tooltip } from '../ui/components'

/* ------------------------------------------------------------------ data */

export type CreatureKind =
  | 'blob'
  | 'star'
  | 'pill'
  | 'squircle'
  | 'half'
  | 'drop'
  | 'toggle'
  | 'button'
  | 'slider'
  | 'swatches'
  | 'avatar'
  | 'autolayout'
  | 'pen'
  | 'badge'
  | 'input'
  | 'card'
  | 'tooltip'
  | 'check'

export interface CreatureDef {
  id: string
  name: string
  kind: CreatureKind
  color: string
  /** top-left in % of the Hero frame */
  x: number
  y: number
  /** box size in px, multiplied by --u */
  w: number
  h: number
  /** mobile position, or null to hide on phones */
  m: { x: number; y: number } | null
  /** elevation in Act 1 */
  z: number
  rot?: number
}

export const C = {
  yellow: '#FFC629',
  coral: '#FF5C39',
  lime: '#B6F03A',
  sky: '#2DB8FF',
  pink: '#FF7AD1',
  violet: '#5B4BFF',
  mint: '#19D3A2',
  ink: '#16131D',
}

export const CREATURES: CreatureDef[] = [
  { id: 'c-star', name: 'Badge', kind: 'badge', color: C.coral, x: 3.5, y: 5, w: 150, h: 36, m: { x: 4, y: 4 }, z: 210, rot: -6 },
  { id: 'c-pill', name: 'Input', kind: 'input', color: C.lime, x: 26, y: 5, w: 172, h: 66, m: { x: 40, y: 5 }, z: 150 },
  { id: 'c-toggle', name: 'Toggle', kind: 'toggle', color: C.sky, x: 52, y: 9, w: 88, h: 48, m: { x: 70, y: 21 }, z: 250 },
  { id: 'c-blob', name: 'Card', kind: 'card', color: C.yellow, x: 73.5, y: 3, w: 128, h: 104, m: { x: 66, y: 2 }, z: 300, rot: 4 },
  { id: 'c-pen', name: 'Pen path', kind: 'pen', color: C.sky, x: 75, y: 24, w: 120, h: 78, m: null, z: 170 },
  { id: 'c-swatch', name: 'Swatches', kind: 'swatches', color: C.pink, x: 90, y: 22, w: 64, h: 84, m: null, z: 230 },
  { id: 'c-squircle', name: 'Checkbox', kind: 'check', color: C.mint, x: 79, y: 42, w: 150, h: 52, m: { x: 58, y: 61 }, z: 280, rot: -3 },
  { id: 'c-half', name: 'Tooltip', kind: 'tooltip', color: C.pink, x: 63, y: 87, w: 124, h: 46, m: { x: 6, y: 69 }, z: 190 },
  { id: 'c-button', name: 'Button', kind: 'button', color: C.violet, x: 4, y: 85, w: 134, h: 50, m: { x: 8, y: 88 }, z: 140 },
  { id: 'c-slider', name: 'Slider', kind: 'slider', color: C.mint, x: 22, y: 89, w: 170, h: 40, m: null, z: 180 },
  { id: 'c-avatar', name: 'Avatar', kind: 'avatar', color: C.coral, x: 42.5, y: 85.5, w: 156, h: 46, m: null, z: 260 },
  { id: 'c-auto', name: 'Auto layout', kind: 'autolayout', color: C.violet, x: 82.5, y: 90, w: 122, h: 40, m: null, z: 160 },
]

/* --------------------------------------------------------------- runtime */

export interface CreatureRuntime {
  id: string
  def: CreatureDef
  wrap: HTMLElement
  lift: HTMLElement
  drag: HTMLElement
  body: HTMLElement
  jelly: HTMLElement
  shadow: HTMLElement
  phase: number
  speed: number
  fx: number
  fy: number
  fvx: number
  fvy: number
  /** screen centre cached during the read phase */
  cx: number
  cy: number
  r: number
  spawned: boolean
  owner: 'hero' | 'about'
  draggable: Draggable | null
}

export const creatures = new Map<string, CreatureRuntime>()
export const billboards = new Set<HTMLElement>()
export const dragInfo = { id: null as string | null }

export function hop(jelly: HTMLElement, power = 1) {
  if (gsap.isTweening(jelly) || scene.reduced) return
  const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1
  gsap
    .timeline()
    .to(jelly, { scaleX: 1.14, scaleY: 0.8, duration: 0.09, ease: 'power2.out' })
    .to(jelly, { y: -30 * u * power, scaleX: 0.88, scaleY: 1.14, duration: 0.22, ease: 'power3.out' })
    .to(jelly, { y: 0, scaleX: 0.96, scaleY: 1.04, duration: 0.17, ease: 'power2.in' })
    .to(jelly, { scaleX: 1.16, scaleY: 0.84, duration: 0.07, ease: 'power1.out' })
    .to(jelly, { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.32)' })
}

/* ---------------------------------------------------------------- shapes */

const STAR = (() => {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 === 0 ? 40 : 21
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)},${(53 + Math.sin(a) * r).toFixed(2)}`)
  }
  return pts.join(' ')
})()

function Hi({ d }: { d: string }) {
  return <path d={d} className="hi" fill="none" stroke="#fff" strokeOpacity=".55" strokeLinecap="round" strokeWidth="5" />
}

export function Shape({ kind, color }: { kind: CreatureKind; color: string }) {
  switch (kind) {
    case 'blob':
      return (
        <svg viewBox="0 0 100 94" className="shape">
          <path d="M50 4C75 3 96 20 95 47c-1 27-19 44-45 43C23 89 4 73 5 46 6 20 25 5 50 4Z" fill={color} stroke={C.ink} strokeWidth="3" />
          <Hi d="M22 26c5-8 13-12 22-13" />
        </svg>
      )
    case 'star':
      return (
        <svg viewBox="0 0 100 100" className="shape">
          <polygon points={STAR} fill={C.ink} stroke={C.ink} strokeWidth="15" strokeLinejoin="round" />
          <polygon points={STAR} fill={color} stroke={color} strokeWidth="9" strokeLinejoin="round" />
          <Hi d="M37 38l7-14" />
        </svg>
      )
    case 'pill':
      return (
        <svg viewBox="0 0 124 56" className="shape">
          <rect x="1.5" y="1.5" width="121" height="53" rx="26.5" fill={color} stroke={C.ink} strokeWidth="3" />
          <Hi d="M18 16h22" />
        </svg>
      )
    case 'squircle':
      return (
        <svg viewBox="0 0 100 100" className="shape">
          <path d="M50 3C88 3 97 12 97 50s-9 47-47 47S3 88 3 50 12 3 50 3Z" fill={color} stroke={C.ink} strokeWidth="3" />
          <Hi d="M18 30c2-8 6-12 14-14" />
        </svg>
      )
    case 'half':
      return (
        <svg viewBox="0 0 92 56" className="shape">
          <path d="M3 53C3 26 22 3 46 3s43 23 43 50Z" fill={color} stroke={C.ink} strokeWidth="3" strokeLinejoin="round" />
          <Hi d="M17 34c3-10 9-17 18-20" />
        </svg>
      )
    case 'drop':
      return (
        <svg viewBox="0 0 80 96" className="shape">
          <path d="M40 3c14 20 36 38 36 58a36 36 0 0 1-72 0C4 41 26 23 40 3Z" fill={color} stroke={C.ink} strokeWidth="3" />
          <Hi d="M19 56c0-8 4-15 9-21" />
        </svg>
      )
    default:
      return null
  }
}

/* --------------------------------------------------------- UI creatures */

function UiBody({ kind, color }: { kind: CreatureKind; color: string }): ReactNode {
  switch (kind) {
    case 'toggle':
      return (
        <div className="ui-toggle" style={{ '--c': color } as CSSProperties}>
          <span className="ui-toggle-knob">
            <Eyes x={50} y={46} size={9} gap={0.45} />
          </span>
        </div>
      )
    case 'button':
      return (
        <div className="ui-button" style={{ '--c': color } as CSSProperties}>
          <span className="ui-button-face">
            <span className="ui-button-eyes">
              <Eyes x={50} y={50} size={10} gap={0.4} />
            </span>
            Button
          </span>
        </div>
      )
    case 'slider':
      return (
        <div className="ui-slider" style={{ '--c': color } as CSSProperties}>
          <span className="ui-slider-track" />
          <span className="ui-slider-fill" />
          <span className="ui-slider-knob">
            <Eyes x={50} y={48} size={8} gap={0.45} />
          </span>
          <span className="ui-slider-val">64</span>
        </div>
      )
    case 'swatches':
      return (
        <div className="ui-swatches">
          <span className="sw sw-3" />
          <span className="sw sw-2" />
          <span className="sw sw-1">
            <Eyes x={50} y={44} size={11} gap={0.45} />
          </span>
        </div>
      )
    case 'avatar':
      return (
        <div className="ui-avatar">
          <span className="ui-avatar-face">
            <Eyes x={50} y={46} size={8} gap={0.45} />
          </span>
          <span className="ui-avatar-txt">
            <b>Monika</b>
            <i>Owner</i>
          </span>
        </div>
      )
    case 'autolayout':
      return (
        <div className="ui-auto">
          <span className="ui-auto-ico">
            <i />
            <i />
            <i />
          </span>
          <span className="ui-auto-txt">Auto layout</span>
          <span className="ui-auto-eyes">
            <Eyes x={50} y={50} size={8} gap={0.4} />
          </span>
        </div>
      )
    case 'pen':
      return (
        <div className="ui-pen">
          <svg viewBox="0 0 120 78" aria-hidden="true">
            <path className="pen-handle" d="M10 62 L34 20 M58 40 L84 70 M84 70 L110 30" />
            <path className="pen-path" pathLength={1} d="M10 62 C34 20 46 18 58 40 S 92 82 110 16" />
            <rect className="pen-anchor" x="6" y="58" width="8" height="8" />
            <rect className="pen-anchor" x="54" y="36" width="8" height="8" />
            <rect className="pen-anchor is-end" x="106" y="12" width="8" height="8" />
            <circle className="pen-dot" cx="34" cy="20" r="3" />
            <circle className="pen-dot" cx="84" cy="70" r="3" />
          </svg>
          <span className="ui-pen-nib">
            <Eyes x={50} y={50} size={7} gap={0.45} />
          </span>
        </div>
      )
    case 'badge':
      return (
        <UiLib w={150} h={36}>
          <Badge tone="coral">Open to work</Badge>
          <Eyes x={80} y={2} size={11} gap={0.45} />
        </UiLib>
      )
    case 'input':
      return (
        <UiLib w={172} h={66}>
          <Input label="Component name" value="Monika" />
          <Eyes x={86} y={58} size={11} gap={0.45} />
        </UiLib>
      )
    case 'card':
      return (
        <UiLib w={128} h={104}>
          <div className="mini-card">
            <span className="mini-card-dots" />
            <span className="mini-card-line" />
            <span className="mini-card-line s" />
            <span className="mini-card-heart">♥ 24</span>
          </div>
          <Eyes x={62} y={2} size={14} gap={0.45} />
        </UiLib>
      )
    case 'tooltip':
      return (
        <UiLib w={124} h={46}>
          <span className="cr-tip">
            <Tooltip>hi there!</Tooltip>
          </span>
          <Eyes x={84} y={4} size={11} gap={0.45} />
        </UiLib>
      )
    case 'check':
      return (
        <UiLib w={150} h={52}>
          <CheckRow n={0}>Ship it</CheckRow>
          <Eyes x={84} y={2} size={11} gap={0.45} />
        </UiLib>
      )
    default:
      return null
  }
}

/** a real src/ui component at design size, scaled to the frame unit */
function UiLib({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  return (
    <div className="cr-lib" style={{ width: w, height: h } as CSSProperties}>
      {children}
      <span className="alive-legs cr-legs" aria-hidden="true">
        <i />
        <i />
      </span>
    </div>
  )
}

const EYES: Partial<Record<CreatureKind, { x: number; y: number; s: number }>> = {
  blob: { x: 50, y: 45, s: 19 },
  star: { x: 50, y: 52, s: 13 },
  pill: { x: 50, y: 46, s: 15 },
  squircle: { x: 50, y: 44, s: 17 },
  half: { x: 50, y: 66, s: 14 },
  drop: { x: 50, y: 62, s: 15 },
}

/* ------------------------------------------------------------ component */

interface CreatureProps {
  def: CreatureDef
  /** px position inside the frame (spawned creatures) instead of % */
  px?: { x: number; y: number }
  spawned?: boolean
  owner?: 'hero' | 'about'
}

export function Creature({ def, px, spawned = false, owner = 'hero' }: CreatureProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const q = <T extends HTMLElement>(s: string) => wrap.querySelector(s) as T
    const rt: CreatureRuntime = {
      id: def.id,
      def,
      wrap,
      lift: q('.cr-lift'),
      drag: q('.cr-drag'),
      body: q('.cr-body'),
      jelly: q('.cr-jelly'),
      shadow: q('.cr-shadow'),
      phase: Math.random() * Math.PI * 2,
      speed: 0.85 + Math.random() * 0.4,
      fx: 0,
      fy: 0,
      fvx: 0,
      fvy: 0,
      cx: 0,
      cy: 0,
      r: 40,
      spawned,
      owner,
      draggable: null,
    }
    gsap.set(rt.lift, { transformOrigin: '50% 100%', force3D: true })
    gsap.set(rt.jelly, { transformOrigin: '50% 100%' })
    creatures.set(def.id, rt)
    billboards.add(rt.lift)

    const unregister = register({
      id: def.id,
      name: def.name,
      kind: 'component',
      color: def.color,
      el: rt.body,
      hoverEl: wrap,
      liftEl: rt.lift,
      baseRotation: def.rot ?? 0,
    })

    const onEnter = () => {
      hover.set(def.id)
      if (!dragInfo.id) hop(rt.jelly)
    }
    const onLeave = () => {
      if (hover.get() === def.id) hover.set(null)
    }
    rt.drag.addEventListener('pointerenter', onEnter)
    rt.drag.addEventListener('pointerleave', onLeave)

    if (scene.fine && !scene.reduced) {
      InertiaPlugin.track(rt.drag, 'x,y')
      const [d] = Draggable.create(rt.drag, {
        type: 'x,y',
        zIndexBoost: false,
        minimumMovement: 3,
        onPress() {
          gsap.killTweensOf(rt.drag)
        },
        onDragStart() {
          dragInfo.id = def.id
          wrap.classList.add('is-dragging')
          gsap.to(rt.jelly, { scale: 1.08, duration: 0.25, ease: 'back.out(2.5)', overwrite: 'auto' })
        },
        onRelease() {
          wrap.classList.remove('is-dragging')
          if (dragInfo.id !== def.id) return
          dragInfo.id = null
          const vx = gsap.utils.clamp(-2400, 2400, InertiaPlugin.getVelocity(rt.drag, 'x') as number)
          const vy = gsap.utils.clamp(-2400, 2400, InertiaPlugin.getVelocity(rt.drag, 'y') as number)
          gsap.to(rt.jelly, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' })
          gsap
            .timeline()
            .to(rt.drag, { x: `+=${vx * 0.09}`, y: `+=${vy * 0.09}`, duration: 0.28, ease: 'power3.out' })
            .to(rt.drag, { x: 0, y: 0, duration: 1.15, ease: 'elastic.out(1, 0.42)' })
            .add(() => hop(rt.jelly, 0.6), '-=0.95')
        },
      })
      rt.draggable = d
    }
    if (spawned) {
      gsap.from(rt.jelly, { scale: 0.35, opacity: 0, y: -24, duration: 0.9, ease: "elastic.out(1, 0.45)" })
    }

    return () => {
      unregister()
      rt.draggable?.kill()
      InertiaPlugin.untrack(rt.drag)
      gsap.killTweensOf(rt.drag)
      rt.drag.removeEventListener('pointerenter', onEnter)
      rt.drag.removeEventListener('pointerleave', onLeave)
      billboards.delete(rt.lift)
      if (creatures.get(def.id) === rt) creatures.delete(def.id)
    }
  }, [def, spawned, owner])

  const eyes = EYES[def.kind]
  const isShape = !!eyes
  const pos: CSSProperties = px
    ? { left: px.x, top: px.y }
    : ({ '--x': `${def.x}%`, '--y': `${def.y}%`, '--mx': `${def.m?.x ?? 0}%`, '--my': `${def.m?.y ?? 0}%` } as CSSProperties)

  return (
    <div
      ref={wrapRef}
      className={`cr cr-${def.kind}${def.m ? '' : ' cr-desk-only'}${spawned ? ' cr-spawned' : ''}`}
      data-layer={def.id}
      aria-hidden="true"
      style={{ ...pos, '--w': `calc(var(--u) * ${def.w}px)`, '--h': `calc(var(--u) * ${def.h}px)`, '--rot': `${def.rot ?? 0}deg` } as CSSProperties}
    >
      {!spawned && (
        <div className="cr-foot">
          <div className={`cr-foot-in foot-${def.kind}`}>
            {isShape ? <Shape kind={def.kind} color={def.color} /> : <span className="foot-ui" style={{ background: def.color }} />}
          </div>
        </div>
      )}
      <div className="cr-shadow" />
      <div className="cr-lift">
        <div className="cr-drag">
          <div className="cr-body">
            <div className="cr-jelly">
              {isShape ? (
                <>
                  <Shape kind={def.kind} color={def.color} />
                  <Eyes x={eyes.x} y={eyes.y} size={eyes.s} />
                </>
              ) : (
                <UiBody kind={def.kind} color={def.color} />
              )}
            </div>
          </div>
          <div className="sel-box cr-sel">
            <span className="sel-label">{def.name}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
