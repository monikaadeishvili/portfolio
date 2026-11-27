import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { CHAPTERS } from '../../content/story'
import { FrameIcon } from '../../chrome/Icons'
import { SectionCtx, type BuildCtx } from '../parts'
import { registerFx, smooth } from '../runtime'
import { phOf } from '../worlds'
import { DraftBg, DraftDef, mountDraft } from './Draft'

export type Lay = 'wide' | 'narrow'
export interface SectionProps {
  lay: Lay
  live: boolean
  onNav: (to: 'hello' | 'work' | 'about' | 'contact') => void
  onJump: (chapter: number) => void
}

/**
 * One tall artboard (a "frame" of the design file). The outline-only layer
 * sheets float above the top region in the exploded arrival view and fold
 * into the artboard as it flattens.
 */
export function Artboard({
  idx,
  live,
  lay,
  children,
  className = '',
  under,
  label,
}: {
  idx: number
  live: boolean
  lay: Lay
  children: ReactNode
  className?: string
  /** world-space layers painted beneath the artboard background */
  under?: ReactNode
  /** replaces "NN Name" in the frame label */
  label?: ReactNode
}) {
  const ctx = useMemo<BuildCtx>(() => ({ section: idx, live, narrow: lay === 'narrow' }), [idx, live, lay])
  const ch = CHAPTERS[idx]
  const ref = useRef<HTMLElement>(null)
  // every section after Hello arrives as a bland draft (Hello has its own, with the switch)
  const draft = live && idx > 0

  useLayoutEffect(() => {
    const el = ref.current
    if (!draft || !el) return
    return mountDraft(el, idx)
  }, [draft, idx, lay])

  useLayoutEffect(() => {
    const el = ref.current
    if (!live || !el) return
    const sheets = Array.from(el.querySelectorAll<HTMLElement>('.bf-sheet'))
    const narrow = lay === 'narrow'
    const zs = narrow ? [40, 80, 120] : [70, 140, 210]
    const PH = phOf(idx)
    const cache = ['', '', '']
    const sizeSheets = () => {
      const r0 = el.querySelector<HTMLElement>('.rg[data-region="0"]')
      if (r0) el.style.setProperty('--r0h', `${r0.offsetTop + r0.offsetHeight}px`)
    }
    return registerFx({
      id: `sheets-${idx}`,
      section: idx,
      measure: sizeSheets,
      update: (e) => {
        if (!e.near) return
        const u = e.u
        sheets.forEach((sh, k) => {
          const rise = idx === 0 ? 1 : smooth(-0.02 + k * 0.012, PH.arrive + k * 0.012, u)
          const out = PH.topEnd - 0.04 * k
          const fold = smooth(out, out + 0.07, u)
          const z = zs[k] * rise * (1 - fold)
          const op = rise * (1 - smooth(out, out + 0.05, u))
          const key = `${z.toFixed(1)}|${op.toFixed(2)}`
          if (key === cache[k]) return
          cache[k] = key
          sh.style.transform = `translate3d(0, 0, ${z.toFixed(1)}px)`
          sh.style.opacity = op.toFixed(2)
          // three artboard-sized layers: they only exist while they show
          sh.style.visibility = op < 0.01 ? 'hidden' : ''
        })
      },
    })
  }, [idx, live, lay])

  return (
    <SectionCtx.Provider value={ctx}>
      <section ref={ref} className={`bf bf-${ch.id} ${className}`} data-frame={idx} id={`ch-${ch.id}`} aria-labelledby={`h-${ch.id}`}>
        <div className="bf-world" aria-hidden="true" />
        {under}
        <div className="bf-bg" aria-hidden="true" />
        {draft && <DraftBg idx={idx} />}
        <div className="bf-label" aria-hidden="true">
          <FrameIcon /> {label ?? <span className="bf-lbl-t">{`${ch.num} ${ch.frame}`}</span>} <i>·</i> <b className="bf-size">—</b>
        </div>
        {live && (
          <div className="bf-sheets" aria-hidden="true">
            <div className="bf-sheet s-grid">
              <span className="bf-sheet-cols">
                {Array.from({ length: 12 }, (_, i) => (
                  <i key={i} />
                ))}
              </span>
              <span className="bf-sheet-lbl">Layout grid</span>
            </div>
            <div className="bf-sheet s-content">
              <span className="bf-sheet-lbl">Content</span>
            </div>
            <div className="bf-sheet s-comp">
              <span className="bf-sheet-lbl">Components</span>
            </div>
          </div>
        )}
        <div className="bf-body">{children}</div>
        {draft && <DraftDef idx={idx} />}
      </section>
    </SectionCtx.Provider>
  )
}
