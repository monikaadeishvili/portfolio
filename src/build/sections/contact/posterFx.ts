/**
 * 04 Say hello — the poster's life (./Contact.tsx):
 *   · scroll: "won't ignore." drops in letter by letter (scrubbed) and the
 *     marker strokes in under it; the crowd walks in from beyond the screen
 *     edges for the family photo at the very end;
 *   · the Say hello button bursts confetti when clicked (the mail opens as usual);
 *   · the letters hop under the cursor (a tap sends a wave through them);
 *   · the email chip copies the address; a poked crowd member jumps, and its
 *     neighbours follow;
 *   · left alone at the end, a wave runs through the letters now and then.
 * Layout is read only on interaction; scroll writes are cached.
 */
import { EMAIL } from '../../../content/story'
import { clamp01, registerFx, smooth, range } from '../../runtime'

const outBack = (t: number) => {
  const c = 1.6
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

export function mountPoster(root: HTMLElement, narrow: boolean, live = true) {
  const board = root.closest<HTMLElement>('.bf')
  const q1 = <E extends HTMLElement = HTMLElement>(s: string) => root.querySelector<E>(s)
  const em = q1('.k-em')
  const letters = Array.from(root.querySelectorAll<HTMLElement>('.k-l')).map((el) => ({ el, inn: el.firstElementChild as HTMLElement, key: '' }))
  const pen = q1('.k-pen')
  const cta = q1('.k-cta-btn')
  const chips = Array.from(root.querySelectorAll<HTMLElement>('.k-confetti i'))
  const mail = q1<HTMLButtonElement>('.k-mail')
  const crowd = Array.from(board?.querySelectorAll<HTMLElement>('.cw') ?? [])
  if (!board || !em || !pen) return () => {}

  // the still page (reduced motion) never runs the scroll driver: know it up front
  let reduced = !live || !!root.closest('.is-static') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let landed = false
  const off: (() => void)[] = []
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => {
    if (!el) return
    el.addEventListener(ev, fn as EventListener, opt)
    off.push(() => el.removeEventListener(ev, fn as EventListener, opt))
  }
  /** restart a CSS animation class */
  const replay = (el: HTMLElement, cls: string, delay = 0) => {
    el.classList.remove(cls)
    el.style.animationDelay = delay ? `${delay}ms` : ''
    void el.offsetWidth
    el.classList.add(cls)
  }

  /* ------------------------------------------------ hoppy letters */
  const hop = (i: number) => {
    const l = letters[i]
    if (!l || !landed || reduced) return
    replay(l.inn, 'is-hop')
    ;[i - 1, i + 1].forEach((n) => letters[n] && replay(letters[n].inn, 'is-hop-s', 40))
  }
  const wave = () => {
    if (!landed || reduced) return
    letters.forEach((l, i) => replay(l.inn, 'is-hop', i * 35))
  }
  letters.forEach((l, i) => on(l.el, 'pointerenter', (e) => e.pointerType === 'mouse' && hop(i)))
  on(em, 'pointerdown', (e) => {
    if (e.pointerType !== 'mouse') wave()
  })

  /* ------------------------------- confetti when the button gives in */
  const burst = (from: HTMLElement | null) => {
    if (reduced || !from || !chips.length) return
    // the button's centre inside the pen (layout offsets, transforms don't count)
    let x = from.offsetWidth / 2
    let y = from.offsetHeight / 2
    for (let n: HTMLElement | null = from; n && n !== pen; n = n.offsetParent as HTMLElement | null) {
      x += n.offsetLeft
      y += n.offsetTop
    }
    chips.forEach((c, i) => {
      const a = (i / chips.length) * Math.PI * 2 + ((i * 37) % 7) * 0.09
      const d = 120 + ((i * 53) % 140)
      const r = (((i * 71) % 11) - 5) * 108
      c.style.left = `${x}px`
      c.style.top = `${y}px`
      c.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(0)}px), calc(-50% + ${(Math.sin(a) * d * 0.75).toFixed(0)}px)) scale(1) rotate(${r * 0.6}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${(Math.cos(a) * d * 1.12).toFixed(0)}px), calc(-50% + ${(Math.sin(a) * d * 0.75 + 80).toFixed(0)}px)) scale(0.9) rotate(${r}deg)`, opacity: 0 },
        ],
        { duration: 900 + (i % 4) * 60, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'none' },
      )
    })
  }
  on(cta, 'click', () => burst(cta))

  /* ------------------------------------------------- copy the email */
  let okT = 0
  on(mail, 'click', () => {
    if (!mail) return
    const done = () => {
      mail.classList.add('is-ok')
      replay(mail, 'is-squash')
      window.clearTimeout(okT)
      okT = window.setTimeout(() => mail.classList.remove('is-ok'), 1600)
    }
    navigator.clipboard?.writeText(EMAIL).then(done, () => (window.location.href = `mailto:${EMAIL}`))
  })

  /* ------------------------------------------------- poke the crowd */
  crowd.forEach((el, i) => {
    const body = el.querySelector<HTMLElement>('.cw-body')
    on(body, 'pointerdown', () => {
      if (reduced) return
      body && replay(body, 'is-jump')
      // the neighbours join in, like a small stadium wave
      crowd.forEach((o, j) => {
        if (j === i || Math.abs(j - i) > 2) return
        const b = o.querySelector<HTMLElement>('.cw-body')
        if (b) replay(b, 'is-jump-s', Math.abs(j - i) * 70)
      })
    })
  })

  /* --------------------------------------------- idle: a wave now and then */
  let moved = false
  on(window, 'pointermove', () => (moved = true), { passive: true })
  let lastMove = 0
  let lastWave = -1e9
  let waves = 0

  const cache = { mark: '', crowd: '' }
  const offFx = !live
    ? () => {}
    : registerFx({
        id: 'contact-poster',
        section: 3,
        update: (e) => {
          if (!e.near) return
          reduced = e.reduced
          const q = e.reduced ? 1 : (e.reg[0] ?? 0)

          // "won't ignore." drops in letter by letter
          letters.forEach((l, i) => {
            const s = 0.55 + i * 0.018
            const t = clamp01((q - s) / 0.1)
            let key = ''
            if (t <= 0) key = 'hide'
            else if (t < 1) {
              const v = outBack(t)
              const u = 1 - v
              key = `translate3d(0, ${(u * -120).toFixed(1)}px, 0) rotate(calc(var(--r) * ${(u * 4).toFixed(3)})) scale(${(1 + 0.25 * u).toFixed(3)})|${Math.min(1, t / 0.3).toFixed(2)}`
            }
            if (key === l.key) return
            l.key = key
            if (key === 'hide') {
              l.el.style.transform = 'translate3d(0, -120px, 0)'
              l.el.style.opacity = '0'
            } else if (!key) {
              l.el.style.transform = ''
              l.el.style.opacity = ''
            } else {
              const [tr, op] = key.split('|')
              l.el.style.transform = tr
              l.el.style.opacity = op
            }
          })
          landed = q >= 0.55 + letters.length * 0.018 + 0.1
          const mk = q >= 0.86 ? '1' : ''
          if (mk !== cache.mark) {
            cache.mark = mk
            em.classList.toggle('is-mark', !!mk)
          }

          // the crowd wanders in from both edges for the family photo
          const g = range(0.84, 0.95, e.u)
          const ck = g.toFixed(3) + (e.u > 0.95 ? Math.floor(e.t * 20) : '')
          if (ck !== cache.crowd) {
            cache.crowd = ck
            crowd.forEach((el, i) => {
              const side = i % 2 ? 1 : -1
              const delay = (i % 3) * 0.08
              const a = e.reduced ? 1 : smooth(delay, delay + 0.8, g)
              // from beyond the screen's edges: nobody pops into view
              const x = (1 - a) * side * (narrow ? 900 : 2200)
              const walking = a > 0.02 && a < 0.98
              const bob = walking ? Math.abs(Math.sin((e.t * 9 + i) * 1.4)) * -14 : Math.sin(e.t * 2.4 + i) * -4 * (a >= 1 ? 1 : 0)
              el.style.transform = `translate3d(${x.toFixed(1)}px, ${bob.toFixed(1)}px, 0)`
              el.style.opacity = a <= 0 ? '0' : '1'
              el.dataset.walk = walking ? '1' : '0'
            })
          }

          // left alone at the end: a wave through the letters
          if (moved) {
            moved = false
            lastMove = e.t
          }
          if (!e.reduced && e.u > 0.9 && e.t - lastMove > 6 && waves < 3 && e.t - lastWave > 12) {
            lastWave = e.t
            waves++
            wave()
          }
          if (e.u < 0.5) waves = 0
        },
      })

  return () => {
    offFx()
    off.forEach((f) => f())
    window.clearTimeout(okT)
    letters.forEach((l) => (l.el.style.transform = l.el.style.opacity = ''))
    em.classList.remove('is-mark')
    crowd.forEach((el) => (el.style.transform = el.style.opacity = ''))
  }
}
