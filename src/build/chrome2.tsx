/** Page 2 chrome: Layers (current section's regions), Inspector (live travel / bubble mood), Dock */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { hover, tool, ui, type Breakpoint, type Tool } from '../scene/store'
import { Chevron, LayerIcon, ToolIcon } from '../chrome/Icons'
import { ChapterRuler, type RulerChapter } from '../chrome/ChapterRuler'
import { CHAPTERS } from '../content/story'
import { pieces, regions, texts, type Piece, type TextBlock } from './runtime'
import { bsinks, chapterCh, helloName, helloTaste, inspSel, inspState, moodCh, placedVer, regionCh, rulerSubs } from './bstore'
import { holdOf, TRN } from './worlds'
import { scene } from '../scene/store'

function useChannels() {
  const [ch, setCh] = useState(chapterCh.get())
  const [reg, setReg] = useState(regionCh.get())
  const [, setV] = useState(0)
  const [hov, setHov] = useState<string | null>(hover.get())
  useEffect(() => {
    const a = chapterCh.sub(setCh)
    const b = placedVer.sub(setV)
    const c = hover.sub(setHov)
    const d = regionCh.sub(setReg)
    return () => {
      a()
      b()
      c()
      d()
    }
  }, [])
  return { ch, hov, reg }
}

/** tiny glyphs: hero (a creature with eyes), bubble-born (a dot leaving a bubble) */
function KindIcon({ kind }: { kind: 'hero' | 'bubble' | 'text' }) {
  if (kind === 'text') return <span className="layer-ico i-text">{LayerIcon.text()}</span>
  if (kind === 'hero')
    return (
      <span className="layer-ico l2-k k-hero" title="Hero — walks to its slot">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <rect x="2" y="3" width="12" height="9" rx="3" />
          <circle cx="6.2" cy="7.4" r="1.3" />
          <circle cx="9.8" cy="7.4" r="1.3" />
          <path d="M5.5 12v2.2M10.5 12v2.2" />
        </svg>
      </span>
    )
  return (
    <span className="layer-ico l2-k k-bubble" title="Bubble-born — spat out of the bubble">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="6" cy="9" r="4.6" />
        <circle cx="12.4" cy="4" r="1.8" />
      </svg>
    </span>
  )
}

type Row = { kind: 'piece'; c: Piece } | { kind: 'text'; t: TextBlock }

/** frame name + taste state of 01 Hello (renames with the Taste switch) */
function useHello() {
  const [name, setName] = useState(helloName.get())
  const [taste, setTaste] = useState(helloTaste.get())
  useEffect(() => {
    const a = helloName.sub(setName)
    const b = helloTaste.sub(setTaste)
    return () => {
      a()
      b()
    }
  }, [])
  return { name, taste }
}
const frameName = (ch: number, hello: string) => (ch === 0 ? hello : `${CHAPTERS[ch].num} ${CHAPTERS[ch].frame}`)

export function LayersPanel2() {
  const { ch, hov, reg } = useChannels()
  const hello = useHello()
  const p = scene.p
  const regs = [...regions.values()].filter((r) => r.section === ch).sort((a, b) => a.index - b.index)
  const all = [...pieces.values()].filter((c) => c.section === ch)
  const placedAll = all.filter((c) => c.pose.state === 'placed').length
  const listRef = useRef<HTMLDivElement>(null)

  // keep the building region in view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-rg="${reg}"]`)
    if (el && listRef.current) listRef.current.scrollTo({ top: el.offsetTop - 40, behavior: 'smooth' })
  }, [reg, ch])

  return (
    <aside className="layers chrome layers2" aria-label="Layers">
      <div className="panel-head">
        <span className="panel-tab is-active">Layers</span>
        <span className="panel-tab">Assets</span>
        <span className="page-switch-label">Page 1</span>
      </div>
      <div className="l2-list" role="tree" aria-label={`Frame ${frameName(ch, hello.name)}`} ref={listRef}>
        <div className="layer-row d0 l2-row l2-frame" role="treeitem" aria-level={1} aria-expanded="true" key={`f-${ch}`}>
          <Chevron open />
          <span className="layer-ico i-frame">{LayerIcon.frame()}</span>
          <span className={`layer-name${ch === 0 && !hello.taste ? ' is-untitled' : ''}`}>
            {frameName(ch, hello.name)}
          </span>
          <span className="layer-tag">
            {placedAll}/{all.length}
          </span>
        </div>
        <div className="l2-rows" key={ch}>
          {regs.map((r) => {
            const rows: Row[] = [
              ...[...texts.values()].filter((t) => t.section === ch && t.region === r.index).map((t) => ({ kind: 'text' as const, t })),
              ...all.filter((c) => c.region === r.index).map((c) => ({ kind: 'piece' as const, c })),
            ].sort((a, b) => (a.kind === 'piece' ? a.c.p1 : a.t.p0) - (b.kind === 'piece' ? b.c.p1 : b.t.p0))
            const done = rows.filter((x) => (x.kind === 'piece' ? x.c.pose.state === 'placed' : p >= x.t.p1)).length
            return (
              <div key={r.index} className={`l2-group${r.index === reg ? ' is-active' : ''}`} data-rg={r.index}>
                <div className="layer-row d1 l2-row l2-region" role="treeitem" aria-level={2} aria-expanded="true">
                  <Chevron open />
                  <span className="layer-ico i-auto">{LayerIcon.auto()}</span>
                  <span className="layer-name">{r.label}</span>
                  <span className="layer-tag">
                    {done}/{rows.length}
                  </span>
                </div>
                {rows.map((x, i) => {
                  if (x.kind === 'text') {
                    const on = p >= x.t.p1
                    return (
                      <div key={x.t.id} role="treeitem" aria-level={3} className={`layer-row d2 l2-row${on ? ' is-placed' : ''}`} style={{ '--i': i } as CSSProperties}>
                        <span className="chev-pad" />
                        <KindIcon kind="text" />
                        <span className="layer-name">{x.t.label}</span>
                        <State on={on} st={p >= x.t.p0 ? 'leaping' : 'waiting'} />
                      </div>
                    )
                  }
                  const c = x.c
                  const st = c.pose.state
                  const on = st === 'placed'
                  return (
                    <div
                      key={c.id}
                      role="treeitem"
                      aria-level={3}
                      className={`layer-row d2 l2-row${on ? ' is-placed' : ''}${hov === c.id ? ' is-hover' : ''}`}
                      style={{ '--i': i } as CSSProperties}
                      onPointerEnter={() => hover.set(c.id)}
                      onPointerLeave={() => hover.get() === c.id && hover.set(null)}
                    >
                      <span className="chev-pad" />
                      <KindIcon kind={c.kind} />
                      <span className="layer-name">{c.name}</span>
                      <State on={on} st={st === 'leaping' ? 'leaping' : st === 'inside' ? 'inside' : 'waiting'} />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="layer-row d1 l2-row l2-bubble" role="treeitem" aria-level={2}>
          <span className="chev-pad" />
          <span className="layer-ico i-organism">{LayerIcon.organism()}</span>
          <span className="layer-name">{ch === 4 ? 'momo (mascot)' : 'Bubble'}</span>
          <span className="layer-tag">{ch === 4 ? 'home' : `${all.filter((c) => c.kind === 'bubble' && c.pose.state === 'inside').length} inside`}</span>
        </div>
      </div>
      <div className="panel-foot">
        <span className="dot-live" aria-hidden="true" /> 3 people editing
      </div>
    </aside>
  )
}

function State({ on, st }: { on: boolean; st: 'leaping' | 'waiting' | 'inside' }) {
  return (
    <span className={`l2-state s-${on ? 'placed' : st}`} aria-label={on ? 'placed' : st}>
      {on ? (
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 6.3 5 8.6 9.6 3.6" />
        </svg>
      ) : (
        <i aria-hidden="true" />
      )}
    </span>
  )
}

function Field({ label, k, unit }: { label: string; k: keyof typeof bsinks; unit?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    bsinks[k] = ref.current
    return () => {
      bsinks[k] = null
    }
  }, [k])
  return (
    <div className="field">
      <span className="field-l">{label}</span>
      <span className="field-v" ref={ref}>
        0
      </span>
      {unit && <span className="field-u">{unit}</span>}
    </div>
  )
}

const STATES = ['waiting', 'flying', 'placed'] as const
const MOODS = ['charging', 'rolling', 'stretching', 'splitting', 'floating'] as const
const moodKey = (m: string | null) => (m === 'racing' ? 'splitting' : m === 'popped' ? 'floating' : m)

export function Inspector2() {
  const [id, setId] = useState(inspSel.get())
  const [st, setSt] = useState(inspState.get())
  const [ch, setCh] = useState(chapterCh.get())
  const [mood, setMood] = useState(moodCh.get())
  useEffect(() => {
    const a = inspSel.sub(setId)
    const b = inspState.sub(setSt)
    const c = chapterCh.sub(setCh)
    const d = moodCh.sub(setMood)
    return () => {
      a()
      b()
      c()
      d()
    }
  }, [])
  const hello = useHello()
  const isBub = id === 'bubble'
  const c = id && !isBub ? pieces.get(id) : null
  const sec = c?.section ?? ch
  const fname = frameName(sec, hello.name)
  // 01 Hello's frame reads as an untouched default until taste is applied
  const frameFill = sec === 0 ? (hello.taste ? '#F3ECE1' : '#FFFFFF') : '#FFFDF8'
  const fill = c?.tone ?? frameFill
  const fillRef = useRef<HTMLSpanElement>(null)
  const hexRef = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    bsinks.fill = isBub ? fillRef.current : null
    bsinks.hex = isBub ? hexRef.current : null
  }, [isBub])
  const mk = moodKey(mood)
  return (
    <aside className="inspector chrome inspector2" aria-label="Design inspector (live values)">
      <div className="panel-head">
        <span className="panel-tab is-active">Design</span>
        <span className="panel-tab">Prototype</span>
      </div>
      <div className="insp-sel">
        {isBub ? <span className="layer-ico i-organism">{LayerIcon.organism()}</span> : c ? <KindIcon kind={c.kind} /> : <span className="layer-ico i-frame">{LayerIcon.frame()}</span>}
        <span className="insp-name">
          {isBub ? 'Bubble' : (c?.name ?? fname)}
        </span>
        <span className="insp-kind">{isBub ? 'Organism' : c ? (c.kind === 'hero' ? 'Hero' : 'Bubble-born') : 'Frame'}</span>
      </div>
      <section className="insp-sec">
        <h3 className="sec-h">
          Position <span className="sec-sub">{isBub ? 'on canvas' : `in ${fname}`}</span>
        </h3>
        <div className="grid2">
          <Field label="X" k="x" />
          <Field label="Y" k="y" />
          <Field label="W" k="w" />
          <Field label="H" k="h" />
        </div>
        <div className="grid2">
          <Field label="Z" k="z" unit="elev" />
          <Field label="↻" k="r" />
        </div>
      </section>
      {isBub ? (
        <section className="insp-sec">
          <h3 className="sec-h">Mood</h3>
          <div className="moods" role="list">
            {MOODS.map((v) => (
              <span key={v} role="listitem" className={`mood md-${v}${v === mk ? ' is-on' : ''}`} aria-current={v === mk ? 'true' : undefined}>
                {v}
              </span>
            ))}
          </div>
        </section>
      ) : (
        <section className="insp-sec">
          <h3 className="sec-h">State</h3>
          <div className="moods" role="list">
            {STATES.map((v) => (
              <span key={v} role="listitem" className={`mood st-${v}${v === st || (v === 'waiting' && st === 'inside') ? ' is-on' : ''}`}>
                {v === 'waiting' && st === 'inside' ? 'in bubble' : v}
              </span>
            ))}
          </div>
        </section>
      )}
      <section className="insp-sec">
        <h3 className="sec-h">Fill</h3>
        <div className="fill-row">
          <span className="swatch" ref={fillRef} style={{ background: fill }} />
          <span className="hex" ref={hexRef}>
            {fill.replace('#', '').toUpperCase()}
          </span>
          <span className="op">100%</span>
        </div>
      </section>
      {sec === 0 && !isBub && (
        <section className="insp-sec insp-type">
          <h3 className="sec-h">
            Text <span className="sec-sub">H1</span>
          </h3>
          <div className={`type-row${hello.taste ? ' is-taste' : ''}`} key={hello.taste ? 'on' : 'off'}>
            {hello.taste ? (
              <>
                <span className="type-face">Big Shoulders</span>
                <span className="type-meta">Black · 94 / 90% · Uppercase</span>
              </>
            ) : (
              <>
                <span className="type-face">Inter</span>
                <span className="type-meta">Regular · 40 · #3A3A3A</span>
              </>
            )}
          </div>
        </section>
      )}
    </aside>
  )
}

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'move', label: 'Move', key: 'V' },
  { id: 'hand', label: 'Hand — drag to scrub', key: 'H' },
  { id: 'pen', label: 'Pen — draw a path', key: 'P' },
  { id: 'picker', label: 'Color picker — click to copy', key: 'I' },
]

const RULER: RulerChapter[] = CHAPTERS.map((c, i) => ({ label: c.ruler, at: i === 0 ? 0 : (TRN[i - 1][0] + TRN[i - 1][1]) / 2, jump: holdOf(i) }))

/** seconds the Play button takes for the whole story (scaled by what is left) */
const PLAY_SECONDS = 75

/** the story's Play button: plays the scroll at a steady pace; ring + % follow the scroll */
function PlayButton() {
  const [playing, setPlaying] = useState(false)
  const ringRef = useRef<SVGCircleElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const playingRef = useRef(false)
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  // the ring and the percentage follow the page's scroll progress
  useEffect(() => {
    let raf = 0
    let last = -1
    const paint = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, max)))
      const pct = Math.round(p * 100)
      ringRef.current?.style.setProperty('stroke-dashoffset', (1 - p).toFixed(4))
      if (pct !== last && pctRef.current) {
        last = pct
        pctRef.current.textContent = String(pct)
      }
      if (playingRef.current && p > 0.997) setPlaying(false)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint)
    }
    paint()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // stop as soon as the visitor scrolls (or scrubs) themselves
  useEffect(() => {
    if (!playing) return
    const stop = () => {
      ui.scrollTo?.(window.scrollY, 0)
      setPlaying(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) stop()
    }
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element && e.target.closest('.play'))) stop()
    }
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [playing])

  const play = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    if (playing) {
      ui.scrollTo?.(window.scrollY, 0)
      setPlaying(false)
      return
    }
    // at the end: back to the start
    if (window.scrollY / Math.max(1, max) > 0.99) {
      ui.scrollTo?.(0, 2.4)
      return
    }
    const remaining = 1 - window.scrollY / Math.max(1, max)
    ui.scrollTo?.(max, Math.max(3, PLAY_SECONDS * remaining), true)
    setPlaying(true)
  }

  return (
    <button type="button" className={`play${playing ? ' is-playing' : ''}`} onClick={play} aria-label={playing ? 'Pause the story' : 'Play the story'}>
      <svg viewBox="0 0 28 28" className="play-ring" aria-hidden="true">
        <circle cx="14" cy="14" r="11" className="ring-bg" />
        <circle cx="14" cy="14" r="11" className="ring-fg" ref={ringRef} pathLength={1} />
        {playing ? <path d="M11 9.5v9M17 9.5v9" className="play-glyph" /> : <path d="M11.5 9.2v9.6l7.6-4.8Z" className="play-glyph fill" />}
      </svg>
      <span className="play-label">
        <span className="play-word">{playing ? 'Pause' : 'Play'}</span> <span className="play-pct" ref={pctRef}>0</span>
        <span className="play-pct-u">%</span>
      </span>
    </button>
  )
}

export function Dock({ bp }: { bp: Breakpoint }) {
  const [active, setActive] = useState<Tool>(tool.get())
  const [subs, setSubs] = useState(rulerSubs.get())
  useEffect(() => {
    const a = tool.sub(setActive)
    const b = rulerSubs.sub(setSubs)
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return
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
  useEffect(() => () => tool.set('move'), [])
  const compact = bp === 'mob'
  return (
    <div className={`dock chrome tb-unit${compact ? ' is-compact' : ''}`}>
      <div className="tb-ruler">
        <ChapterRuler chapters={RULER} variant="dock" label="Story chapters" subs={subs} />
        {compact && <PlayButton />}
      </div>
      {!compact && (
        <div className="tb-row">
          <div className="dock-tools" role="toolbar" aria-label="Tools">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tool${active === t.id ? ' is-active' : ''}`}
                aria-pressed={active === t.id}
                aria-label={`${t.label} (${t.key})`}
                onClick={() => tool.set(t.id)}
              >
                {ToolIcon[t.id]()}
                <span className="tool-tip" aria-hidden="true">
                  {t.label} <kbd>{t.key}</kbd>
                </span>
              </button>
            ))}
          </div>
          <span className="tb-div" aria-hidden="true" />
          <PlayButton />
        </div>
      )}
    </div>
  )
}
