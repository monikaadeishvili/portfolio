/**
 * Pages: the site's navigation, drawn like the Pages list of a Figma file.
 * Desktop: a list at the top of the left panel, above Layers. Tablet and
 * phone (no Layers panel): the file head opens the same list as a small menu.
 * Every row is a real link (#work …); a click cuts straight to that board
 * (../build/pages.ts).
 */
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { chapterCh } from '../build/bstore'
import { goPage, PAGES, pageOfHash } from '../build/pages'
import { SEC_ID } from '../build/worlds'
import { MomoMark } from './Icons'


/** the page in view: the board the camera is on (the still page follows clicks and the hash) */
function usePage() {
  const [cur, setCur] = useState(() => chapterCh.get() || pageOfHash(location.hash))
  useEffect(() => {
    const off = chapterCh.sub(setCur)
    const onGo = (e: Event) => setCur((e as CustomEvent<number>).detail)
    const onHash = () => setCur(pageOfHash(location.hash))
    window.addEventListener('pg:go', onGo)
    window.addEventListener('popstate', onHash)
    return () => {
      off()
      window.removeEventListener('pg:go', onGo)
      window.removeEventListener('popstate', onHash)
    }
  }, [])
  return cur
}

/** a plain click opens the page in place; ⌘/ctrl/shift-click keeps the browser's own behaviour */
function open(e: MouseEvent, i: number, then?: () => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  goPage(i)
  then?.()
}

function Rows({ cur, hint, onPick }: { cur: number; hint?: boolean; onPick?: () => void }) {
  return (
    <ul className="pg-list">
      {PAGES.map((p, i) => {
        const on = i === cur
        const work = p.sec === SEC_ID.proof
        return (
          <li key={p.id}>
            <a className={`pg-row${on ? ' is-on' : ''}${hint && work && !on ? ' is-hint' : ''}`} href={`#${p.hash}`} aria-current={on ? 'page' : undefined} onClick={(e) => open(e, i, onPick)}>
              <i className="pg-sq" style={{ background: p.color }} aria-hidden="true" />
              <span className="pg-name">{p.label}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** one soft pulse on the Work row, once per visit, after the intro settles */
function useFirstHint() {
  const [hint, setHint] = useState(false)
  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem('pg-hint') === '1'
    } catch {
      seen = true
    }
    if (seen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => {
      try {
        sessionStorage.setItem('pg-hint', '1')
      } catch {
        /* private mode: just play it */
      }
      setHint(true)
    }, 2600)
    const t2 = window.setTimeout(() => setHint(false), 2600 + 1000)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(t2)
    }
  }, [])
  return hint
}

/** desktop: the Pages list at the top of the left panel */
export function PagesNav() {
  const cur = usePage()
  const hint = useFirstHint()
  return (
    <nav className="pg" aria-label="Pages">
      <div className="pg-head">Pages</div>
      <Rows cur={cur} hint={hint} />
    </nav>
  )
}

/**
 * tablet and phone: the file head opens the page list as a small menu (like
 * Figma mobile's file name). `bar`: inside the phone's file bar; `card`: under
 * the tablet's file card.
 */
export function PagePicker({ variant }: { variant: 'bar' | 'card' }) {
  const cur = usePage()
  const [isOpen, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!isOpen) return
    // first item focused, so the keyboard lands in the list
    menuRef.current?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true })
    const close = (back?: boolean) => {
      setOpen(false)
      if (back) btnRef.current?.focus({ preventScroll: true })
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true)
    const onScroll = () => close()
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [isOpen])

  const page = PAGES[cur] ?? PAGES[0]
  return (
    <>
      <button ref={btnRef} type="button" className={`pg-pick pg-pick-${variant}`} aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {variant === 'bar' && <MomoMark />}
        <span className="pg-pick-t">
          {variant === 'bar' && <span className="pg-pick-file">Monika.Adeishvili</span>}
          <span className="pg-pick-page">
            <span className="sr-only">Page: </span>
            {page.label}
            <svg className="pg-chev" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 3.5 5 6.5 8 3.5" />
            </svg>
          </span>
        </span>
      </button>
      <div ref={menuRef} id={id} className={`pg-menu pg-menu-${variant}${isOpen ? ' is-open' : ''}`} hidden={!isOpen}>
        <nav className="pg" aria-label="Pages">
          <div className="pg-head">Pages</div>
          <Rows cur={cur} onPick={() => setOpen(false)} />
            </nav>
      </div>
    </>
  )
}
