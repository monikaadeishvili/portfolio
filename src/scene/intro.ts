import { gsap } from './gsap'
import { bots } from '../canvas/Cursors'
import type { CreatureRuntime } from './creatures'
import { heroClip, type Geometry } from './timeline'
import { scene } from './store'
import { ripple } from './loop'

export interface IntroRefs {
  chrome: { top: HTMLElement | null; left: HTMLElement | null; right: HTMLElement | null; bottom: HTMLElement | null }
  frameBg: HTMLElement
  labelHero: HTMLElement
  introBadge: HTMLElement
  root: HTMLElement
  stickyWrap: HTMLElement
  scribblePaths: HTMLElement[]
  roleIn: HTMLElement
}

/** ~2.3s load choreography. Skippable: callers jump it to the end on scroll. */
export function playIntro(r: IntroRefs, g: Geometry, order: CreatureRuntime[]) {
  const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1
  const tl = gsap.timeline({
    defaults: { ease: 'expo.out' },
    onComplete: () => {
      scene.introDone = true
      bots.monika.override = null
      r.introBadge.style.opacity = '0'
    },
  })

  // chrome slides in from its edges
  const { top, left, right, bottom } = r.chrome
  if (top) tl.from(top, { y: -28, opacity: 0, duration: 0.8 }, 0)
  if (left) tl.from(left, { x: -32, opacity: 0, duration: 0.8 }, 0.06)
  if (right) tl.from(right, { x: 32, opacity: 0, duration: 0.8 }, 0.12)
  if (bottom) tl.from(bottom, { y: 32, opacity: 0, duration: 0.8 }, 0.18)

  // Monika's cursor draws the Hero frame from its top-left corner
  const f = scene.frame
  const draw = { k: 0 }
  const fromClip = `inset(0px ${g.fw.toFixed(1)}px ${g.bh.toFixed(1)}px 0px round 18px)`
  gsap.set(r.frameBg, { clipPath: fromClip })
  gsap.set(r.labelHero, { opacity: 0, y: 4 })
  bots.monika.override = { x: Math.max(14, f.x - 6), y: f.y - 6 }
  if (bots.monika.el) {
    bots.monika.x = Math.max(14, f.x - 30)
    bots.monika.y = Math.max(12, f.y - 30)
  }
  const badge = r.introBadge
  tl.to(
    draw,
    {
      k: 1,
      duration: 0.8,
      ease: 'power3.inOut',
      onStart: () => {
        badge.style.opacity = '1'
      },
      onUpdate: () => {
        const k = draw.k
        const w = g.fw * k
        const h = g.fh * k
        r.frameBg.style.clipPath = `inset(0px ${(g.fw - w).toFixed(1)}px ${(g.bh - h).toFixed(1)}px 0px round 18px)`
        badge.textContent = `${Math.round(g.fw * k)} × ${Math.round(g.fh * k)}`
        badge.style.transform = `translate3d(${w.toFixed(1)}px, ${(h + 10).toFixed(1)}px, 0) translateX(-50%)`
        if (bots.monika.override) {
          bots.monika.override.x = f.x + w - 4
          bots.monika.override.y = f.y + h - 4
        }
      },
      onComplete: () => {
        r.frameBg.style.clipPath = heroClip(g)
      },
    },
    0.2,
  )
  tl.to(r.labelHero, { opacity: 1, y: 0, duration: 0.5 }, 0.55)
  tl.to(badge, { opacity: 0, duration: 0.3, ease: 'power2.out' }, 1.05)
  tl.add(() => {
    if (bots.monika.override) {
      bots.monika.override.x = f.x + g.fw * 0.5
      bots.monika.override.y = f.y + g.fh * 0.79
    }
  }, 1.0)

  // name letters rise through their line masks
  const chars = r.root.querySelectorAll<HTMLElement>('.name .ch-in')
  tl.from(chars, { yPercent: 112, duration: 0.95, stagger: 0.032 }, 0.72)
  tl.from(r.roleIn, { y: 18, opacity: 0, duration: 0.8 }, 1.05)

  // sticky + scribble
  tl.from(r.stickyWrap, { y: -50 * u, rotation: -14, opacity: 0, duration: 0.9, ease: 'back.out(2)' }, 1.15)
  tl.fromTo(r.scribblePaths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut', stagger: 0.25 }, 1.3)

  // creatures drop in one by one with a springy landing
  const drops = [...order].sort((a, b) => a.def.x - b.def.x + (a.def.y - b.def.y) * 0.3)
  drops.forEach((c, i) => {
    const at = 1.0 + i * 0.06
    tl.from(c.wrap, { y: -90 * u, opacity: 0, duration: 0.85, ease: 'elastic.out(1, 0.55)' }, at)
    tl.from(c.jelly, { scaleY: 1.25, scaleX: 0.85, duration: 0.7, ease: 'elastic.out(1, 0.35)' }, at + 0.12)
    if (i === drops.length - 1) tl.add(() => ripple(c.id), at + 0.2)
  })

  return tl
}
