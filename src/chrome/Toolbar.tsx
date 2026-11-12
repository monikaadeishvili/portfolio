import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { hint, scene, showHint, tool, ui, type Breakpoint, type Tool } from '../scene/store'
import { ToolIcon } from './Icons'
import { ChapterRuler, type RulerChapter } from './ChapterRuler'

const V1_CHAPTERS: RulerChapter[] = [
  { label: 'FILE', at: 0, jump: 0 },
  { label: 'LIFT', at: 0.08, jump: 0.2 },
  { label: 'MERGE', at: 0.3, jump: 0.44 },
  { label: 'BUILD', at: 0.55, jump: 0.8 },
  { label: 'HOME', at: 0.82, jump: 1 },
]

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'move', label: 'Move', key: 'V' },
  { id: 'frame', label: 'Frame', key: 'F' },
  { id: 'shape', label: 'Shape', key: 'O' },
  { id: 'pen', label: 'Pen', key: 'P' },
  { id: 'text', label: 'Text', key: 'T' },
  { id: 'hand', label: 'Hand', key: 'H' },
  { id: 'comment', label: 'Comment', key: 'C' },
]
const MOBILE_TOOLS: Tool[] = ['move', 'shape', 'comment']

const TOOL_HINT: Partial<Record<Tool, string>> = {
  shape: 'Click the canvas to hatch a creature',
  comment: 'Click anywhere to leave a note',
  hand: 'Drag to scrub through the story',
}

export function Toolbar({ bp }: { bp: Breakpoint }) {
  const [active, setActive] = useState<Tool>(tool.get())
  const [toast, setToast] = useState(hint.get())
  const [playing, setPlaying] = useState(false)
  const ringRef = useRef<SVGCircleElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    ui.ring = ringRef.current
    ui.playPct = pctRef.current
    return () => {
      ui.ring = null
      ui.playPct = null
    }
  }, [])

  useEffect(() => {
    const a = tool.sub(setActive)
    const b = hint.sub(setToast)
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable]')) return
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
      if (t) tool.set(t.id)
      if (e.key === 'Escape') tool.set('move')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      a()
      b()
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // stop "playing" as soon as the visitor scrolls themselves
  useEffect(() => {
    if (!playing) return
    const stop = () => setPlaying(false)
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    const id = window.setInterval(() => {
      if (scene.p > 0.995) setPlaying(false)
    }, 300)
    return () => {
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.clearInterval(id)
    }
  }, [playing])

  const play = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (playing) {
      ui.scrollTo?.(window.scrollY, 0)
      setPlaying(false)
      return
    }
    if (scene.p > 0.98) {
      ui.scrollTo?.(0, 2.4)
      return
    }
    const remaining = 1 - window.scrollY / Math.max(1, max)
    ui.scrollTo?.(max, Math.max(3, 16 * remaining))
    setPlaying(true)
  }

  const list = bp === 'mob' ? TOOLS.filter((t) => MOBILE_TOOLS.includes(t.id)) : TOOLS
  const pick = (t: Tool) => {
    tool.set(t)
    const h = TOOL_HINT[t]
    if (h) showHint(h)
  }

  return (
    <div className="toolbar-wrap">
      <div className={`toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite">
        {toast?.text}
      </div>
      <div className="toolbar chrome tb-unit">
        <div className="tb-ruler">
          <ChapterRuler chapters={V1_CHAPTERS} variant="slim" label="Story chapters" />
        </div>
        <div className="tb-row" role="toolbar" aria-label="Tools">
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tool${active === t.id ? ' is-active' : ''}`}
            aria-pressed={active === t.id}
            aria-label={`${t.label} (${t.key})`}
            onClick={() => pick(t.id)}
          >
            {ToolIcon[t.id]()}
            <span className="tool-tip" aria-hidden="true">
              {t.label} <kbd>{t.key}</kbd>
            </span>
          </button>
        ))}
        <span className="tb-div" aria-hidden="true" />
        <button type="button" className={`play${playing ? ' is-playing' : ''}`} onClick={play} aria-label={playing ? 'Pause story' : 'Play the story'}>
          <svg viewBox="0 0 28 28" className="play-ring" aria-hidden="true">
            <circle cx="14" cy="14" r="11" className="ring-bg" />
            <circle cx="14" cy="14" r="11" className="ring-fg" ref={ringRef} pathLength={1} />
            {playing ? <path d="M11 9.5v9M17 9.5v9" className="play-glyph" /> : <path d="M11.5 9.2v9.6l7.6-4.8Z" className="play-glyph fill" />}
          </svg>
          <span className="play-label">
            {playing ? 'Playing' : 'Play'} <span className="play-pct" ref={pctRef}>0</span>
            <span className="play-pct-u">%</span>
          </span>
        </button>
        </div>
      </div>
    </div>
  )
}
