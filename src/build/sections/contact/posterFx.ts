/**
 * 04 Say Hello — The Daily Hello comes off the press (./Contact.tsx).
 *   · scroll (top region q): the dateline rules draw, the column rules drop,
 *     an ink roller crosses the page and each column prints as it passes
 *     (`data-print` = where it prints); "won't ignore." drops in letter by
 *     letter like metal type and the yellow overprint lands under it;
 *   · once the headline has landed: a red pen circles her ad and notes
 *     "this one!", then a HIRED? stamp hits it (a beat apart, on a clock); the crowd queues up for the paper at the end;
 *   · the ad's googly eyes follow the reader's pointer (a tap: look and blink);
 *   · click a small ad and the reader's own red pen circles it (two at most);
 *   · click the stamp and it stamps again, at a new angle, with a new word;
 *   · the coupon clips (copies the email); the Say hello button splats ink;
 *   · left alone at the end, the ad glances at its button and the pen circles
 *     it again (three times at most).
 * Scroll writes are transforms and opacity only; layout is read on pointer/click.
 */
import { EMAIL, PAPER } from '../../../content/story'
import { clamp01, outBack, range, registerFx, smooth } from '../../runtime'

export function mountPoster(root: HTMLElement, narrow: boolean, live = true) {
  const board = root.closest<HTMLElement>('.bf')
  const q1 = <E extends HTMLElement = HTMLElement>(s: string) => root.querySelector<E>(s)
  const em = q1('.k-em')
  const ad = q1('.np-ad')
  const pen = q1('.k-pen')
  if (!board || !em || !ad || !pen) return () => {}
  const letters = Array.from(root.querySelectorAll<HTMLElement>('.k-l')).map((el) => ({ el, key: '' }))
  const prints = Array.from(root.querySelectorAll<HTMLElement>('[data-print]')).map((el) => ({ el, at: Number(el.dataset.print) || 0, key: '' }))
  const ruleT = q1('.np-rule-t')
  const ruleB = q1('.np-rule-b')
  const vrs = Array.from(root.querySelectorAll<HTMLElement>('.np-vr'))
  const clip = q1('.np-clip')
  const roller = q1('.np-roller')
  const eyes = q1('.np-eyes')
  const stamp = q1<HTMLButtonElement>('.np-stamp')
  const stampText = stamp?.querySelector<HTMLElement>('span') ?? null
  const smalls = Array.from(root.querySelectorAll<HTMLElement>('.np-small'))
  const cta = q1('.k-cta-btn')
  const chips = Array.from(root.querySelectorAll<HTMLElement>('.k-confetti i'))
  const mail = q1<HTMLButtonElement>('.np-coupon')
  const crowd = Array.from(board.querySelectorAll<HTMLElement>('.cw'))

  // the still page (reduced motion) never runs the scroll driver: know it up front
  let reduced = !live || !!root.closest('.is-static') || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const off: (() => void)[] = []
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget | null, ev: K, fn: (e: HTMLElementEventMap[K]) => void, opt?: AddEventListenerOptions) => {
    if (!el) return
    el.addEventListener(ev, fn as EventListener, opt)
    off.push(() => el.removeEventListener(ev, fn as EventListener, opt))
  }
  /** restart a CSS animation class */
  const replay = (el: HTMLElement, cls: string) => {
    el.classList.remove(cls)
    void el.offsetWidth
    el.classList.add(cls)
  }

  /* ----------------------------------------- the eyes watch the reader */
  const lookAt = (px: number, py: number) => {
    if (!eyes || reduced) return
    const r = eyes.getBoundingClientRect()
    if (!r.width) return
    const dx = px - (r.left + r.width / 2)
    const dy = py - (r.top + r.height / 2)
    const m = Math.hypot(dx, dy) || 1
    // pupils travel up to 9px of the 84px eye (scaled on the small phone eyes)
    const k = Math.min(1, m / 160) * 9 * (r.width / 84)
    eyes.style.setProperty('--lx', `${((dx / m) * k).toFixed(1)}px`)
    eyes.style.setProperty('--ly', `${((dy / m) * k).toFixed(1)}px`)
  }
  let moved = false
  on(
    window,
    'pointermove',
    (e) => {
      moved = true
      if (e.pointerType === 'mouse' && board.dataset.near === '1') lookAt(e.clientX, e.clientY)
    },
    { passive: true },
  )
  on(
    window,
    'pointerdown',
    (e) => {
      if (e.pointerType === 'mouse' || board.dataset.near !== '1' || !eyes) return
      lookAt(e.clientX, e.clientY)
      if (!reduced) replay(eyes, 'is-blink')
    },
    { passive: true },
  )

  /* ------------------------------------ the reader's own red pen (2 max) */
  const circled: HTMLElement[] = []
  const circle = (el: HTMLElement) => {
    const at = circled.indexOf(el)
    if (at >= 0) {
      el.classList.remove('is-circled')
      circled.splice(at, 1)
      return
    }
    el.classList.add('is-circled')
    circled.push(el)
    if (circled.length > 2) circled.shift()?.classList.remove('is-circled')
  }
  smalls.forEach((el) => {
    on(el, 'click', () => circle(el))
    on(el, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        circle(el)
      }
    })
  })

  /* ----------------------------------------------- the stamp, again */
  let stampN = 0
  on(stamp, 'click', () => {
    if (!stamp || !stampText) return
    stampN = (stampN + 1) % PAPER.stamps.length
    stampText.textContent = PAPER.stamps[stampN]
    stamp.style.setProperty('--sa', `${-12 + (stampN % 2 ? 6 : -6) + stampN * 2}deg`)
    if (!reduced) {
      replay(stamp, 'is-hit')
      replay(ad, 'is-jolt')
    }
  })

  /* --------------------------------- the Say hello button splats ink */
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
      const d = 110 + ((i * 53) % 130)
      const r = (((i * 71) % 11) - 5) * 90
      c.style.left = `${x}px`
      c.style.top = `${y}px`
      c.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1 },
          { transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(0)}px), calc(-50% + ${(Math.sin(a) * d * 0.75).toFixed(0)}px)) scale(1) rotate(${r * 0.6}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${(Math.cos(a) * d * 1.1).toFixed(0)}px), calc(-50% + ${(Math.sin(a) * d * 0.75 + 70).toFixed(0)}px)) scale(0.9) rotate(${r}deg)`, opacity: 0 },
        ],
        { duration: 850 + (i % 4) * 60, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'none' },
      )
    })
  }
  on(cta, 'click', () => burst(cta))

  /* --------------------------------------------- clip the coupon */
  let okT = 0
  on(mail, 'click', () => {
    if (!mail) return
    const done = () => {
      mail.classList.add('is-ok')
      if (!reduced) replay(mail, 'is-clip')
      window.clearTimeout(okT)
      okT = window.setTimeout(() => mail.classList.remove('is-ok', 'is-clip'), 1600)
    }
    if (navigator.clipboard) navigator.clipboard.writeText(EMAIL).then(done, () => (window.location.href = `mailto:${EMAIL}`))
    else window.location.href = `mailto:${EMAIL}`
  })

  /* ------------------------------------------------- poke the crowd */
  crowd.forEach((el, i) => {
    const body = el.querySelector<HTMLElement>('.cw-body')
    on(body, 'pointerdown', () => {
      if (reduced) return
      if (body) {
        body.style.animationDelay = ''
        replay(body, 'is-jump')
      }
      crowd.forEach((o, j) => {
        if (j === i || Math.abs(j - i) > 2) return
        const b = o.querySelector<HTMLElement>('.cw-body')
        if (!b) return
        b.style.animationDelay = `${Math.abs(j - i) * 70}ms`
        replay(b, 'is-jump-s')
      })
    })
  })

  /* ----------------------------------------------- printing on scroll */
  let lastMove = 0
  /** when the headline landed (the pen and the stamp follow on a clock) */
  let landedAt = -1
  let lastIdle = -1e9
  let idles = 0
  const cache = { rule: '', vr: '', roll: '', st: '', crowd: '' }
  const offFx = !live
    ? () => {}
    : registerFx({
        id: 'contact-paper',
        section: 3,
        update: (e) => {
          if (!e.near) return
          reduced = e.reduced
          const q = e.reduced ? 1 : (e.reg[0] ?? 0)
          const qs = e.reduced ? 1 : (e.reg[1] ?? 0)

          // the dateline rules draw from the left, the column rules from the top
          const rk = smooth(0, 0.12, q).toFixed(3)
          if (rk !== cache.rule) {
            cache.rule = rk
            ;[ruleT, ruleB].forEach((r) => r && (r.style.transform = rk === '1.000' ? '' : `scaleX(${rk})`))
          }
          const vk = smooth(0.12, 0.3, q).toFixed(3)
          if (vk !== cache.vr) {
            cache.vr = vk
            vrs.forEach((r) => (r.style.transform = vk === '1.000' ? '' : `scaleY(${vk})`))
          }
          // the ink roller crosses the page left to right
          const t = range(0.2, 0.6, q)
          const rok = t <= 0 || t >= 1 ? '' : t.toFixed(4)
          if (rok !== cache.roll && roller && clip) {
            cache.roll = rok
            roller.style.opacity = rok ? '1' : '0'
            if (rok) roller.style.transform = `translate3d(${(t * (clip.offsetWidth + 72) - 36).toFixed(1)}px, 0, 0)`
          }
          // each thing prints as the roller passes it
          prints.forEach((p) => {
            const v = clamp01((q - p.at) / 0.05)
            const k = v >= 1 ? '' : v.toFixed(3)
            if (k === p.key) return
            p.key = k
            p.el.style.opacity = k
            p.el.style.translate = k ? `0 ${((1 - v) * 6).toFixed(1)}px` : ''
          })

          // "won't ignore." drops in letter by letter, like metal type
          letters.forEach((l, i) => {
            const s = 0.55 + i * 0.018
            const lt = clamp01((q - s) / 0.1)
            let key = ''
            if (lt <= 0) key = 'hide'
            else if (lt < 1) {
              const u = 1 - outBack(lt, 1.6)
              key = `translate3d(0, ${(u * -120).toFixed(1)}px, 0) rotate(calc(var(--r) * ${(u * 4).toFixed(3)})) scale(${(1 + 0.25 * u).toFixed(3)})|${Math.min(1, lt / 0.3).toFixed(2)}`
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

          // the overprint, then (as the page settles) the red pen and the stamp
          // once "won't ignore." has landed, the pen circles the ad half a second
          // later and the stamp hits 1.3 s later, on a clock, not on more scroll:
          // a reader who stops to read the finished page still sees them land
          // (scrolling back above the headline takes them off again)
          const landed = q >= 0.86 || qs > 0
          if (!landed) landedAt = -1
          else if (landedAt < 0) landedAt = qs > 0 ? e.t - 2 : e.t
          const since = landed ? e.t - landedAt : -1
          const st = `${landed ? 1 : 0}${since >= 0.5 || e.reduced ? 1 : 0}${since >= 1.3 || e.reduced ? 1 : 0}`
          if (st !== cache.st) {
            const was = cache.st
            cache.st = st
            em.classList.toggle('is-mark', st[0] === '1')
            ad.classList.toggle('is-circle', st[1] === '1')
            ad.classList.toggle('is-stamp', st[2] === '1')
            if (st[2] === '1' && was && was[2] !== '1' && !e.reduced) replay(ad, 'is-jolt')
          }

          // the crowd queues for the paper: in from beyond the screen edges
          const g = range(0.84, 0.95, e.u)
          const ck = g.toFixed(3) + (e.u > 0.95 ? Math.floor(e.t * 20) : '')
          if (ck !== cache.crowd) {
            cache.crowd = ck
            crowd.forEach((el, i) => {
              const side = i % 2 ? 1 : -1
              const delay = (i % 3) * 0.08
              const a = e.reduced ? 1 : smooth(delay, delay + 0.8, g)
              const x = (1 - a) * side * (narrow ? 900 : 2200)
              const walking = a > 0.02 && a < 0.98
              const bob = walking ? Math.abs(Math.sin((e.t * 9 + i) * 1.4)) * -14 : Math.sin(e.t * 2.4 + i) * -4 * (a >= 1 ? 1 : 0)
              el.style.transform = `translate3d(${x.toFixed(1)}px, ${bob.toFixed(1)}px, 0)`
              el.style.opacity = a <= 0 ? '0' : '1'
              el.dataset.walk = walking ? '1' : '0'
            })
          }

          // left alone at the end: the ad glances at its button, the pen circles again
          if (moved) {
            moved = false
            lastMove = e.t
          }
          if (!e.reduced && e.u > 0.9 && e.t - lastMove > 6 && idles < 3 && e.t - lastIdle > 12) {
            lastIdle = e.t
            idles++
            if (eyes) replay(eyes, 'is-glance')
            replay(ad, 'is-redraw')
          }
          if (e.u < 0.5) idles = 0
        },
      })

  return () => {
    offFx()
    off.forEach((f) => f())
    window.clearTimeout(okT)
    letters.forEach((l) => (l.el.style.transform = l.el.style.opacity = ''))
    prints.forEach((p) => {
      p.el.style.opacity = ''
      p.el.style.translate = ''
    })
    ;[ruleT, ruleB, ...vrs].forEach((r) => r && (r.style.transform = ''))
    if (roller) roller.style.opacity = '0'
    em.classList.remove('is-mark')
    ad.classList.remove('is-circle', 'is-stamp', 'is-jolt', 'is-redraw')
    crowd.forEach((el) => (el.style.transform = el.style.opacity = ''))
  }
}
