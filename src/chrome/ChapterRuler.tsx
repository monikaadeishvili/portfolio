/**
 * Chapter ruler — the tool's prototype timeline: fine ticks, chapter marks at
 * their scroll positions, a moving playhead. Clicking a mark smooth-scrolls
 * there. The ticker loop calls updateRuler(p); no React re-render per frame.
 */
import { useLayoutEffect, useRef } from 'react'
import { ui } from '../scene/store'

export interface RulerChapter {
  label: string
  /** where the chapter starts, 0..1 of the scroll */
  at: number
  /** where a click lands, 0..1 */
  jump: number
}

const sink = {
  head: null as HTMLElement | null,
  fill: null as HTMLElement | null,
  time: null as HTMLElement | null,
  now: null as HTMLElement | null,
  marks: [] as HTMLElement[],
  chapters: [] as RulerChapter[],
  last: -1,
  active: -1,
}

export function updateRuler(p: number) {
  const k = Math.round(p * 2000)
  if (k === sink.last) return
  sink.last = k
  if (sink.head) sink.head.style.transform = `translate3d(${(p * 100).toFixed(2)}cqw, 0, 0)`
  if (sink.fill) sink.fill.style.transform = `scaleX(${p.toFixed(4)})`
  let a = 0
  sink.chapters.forEach((c, i) => {
    if (p >= c.at - 0.0005) a = i
  })
  if (a !== sink.active) {
    sink.active = a
    sink.marks.forEach((m, i) => {
      m.classList.toggle('is-on', i === a)
      m.classList.toggle('is-past', i < a)
      if (i === a) m.setAttribute('aria-current', 'step')
      else m.removeAttribute('aria-current')
    })
    if (sink.now) sink.now.textContent = sink.chapters[a]?.label ?? ''
  }
  if (sink.time) sink.time.textContent = `${String(a + 1).padStart(2, '0')}`
}

export function jumpTo(p: number, duration = 1.6) {
  const max = document.documentElement.scrollHeight - window.innerHeight
  ui.scrollTo?.(Math.max(0, Math.min(max, p * max)), duration)
}

export function ChapterRuler({ chapters, variant = 'dock', label = 'Chapters', subs }: { chapters: RulerChapter[]; variant?: 'dock' | 'slim'; label?: string; /** optional sub-ticks (0..1), e.g. where each region starts */ subs?: number[] }) {
  const rootRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    sink.head = root.querySelector('.ruler-head')
    sink.fill = root.querySelector('.ruler-fill')
    sink.time = root.querySelector('.ruler-time b')
    sink.now = root.querySelector('.ruler-now')
    sink.marks = Array.from(root.querySelectorAll<HTMLElement>('.ruler-mark'))
    sink.chapters = chapters
    sink.last = -1
    sink.active = -1
    updateRuler(0)
    return () => {
      sink.head = sink.fill = sink.time = sink.now = null
      sink.marks = []
    }
  }, [chapters])

  return (
    <nav className={`ruler ruler-${variant}`} ref={rootRef} aria-label={label}>
      <span className="ruler-time" aria-hidden="true">
        <b>01</b>
        <i>/{String(chapters.length).padStart(2, '0')}</i>
        <span className="ruler-now" />
      </span>
      <div className="ruler-track">
        <div className="ruler-ticks" aria-hidden="true" />
        {subs && subs.length > 0 && (
          <div className="ruler-subs" aria-hidden="true">
            {subs.map((s) => (
              <i key={s.toFixed(4)} style={{ left: `${(s * 100).toFixed(3)}%` }} />
            ))}
          </div>
        )}
        <div className="ruler-fill" aria-hidden="true" />
        <ol className="ruler-marks">
          {chapters.map((c, i) => {
            const next = chapters[i + 1]?.at ?? 1
            return (
              <li key={c.label} style={{ left: `${c.at * 100}%`, width: `${(next - c.at) * 100}%` }}>
                <button type="button" className="ruler-mark" onClick={() => jumpTo(c.jump)}>
                  <span className="ruler-num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="ruler-label">{c.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="ruler-head" aria-hidden="true">
          <i />
        </div>
      </div>
    </nav>
  )
}
