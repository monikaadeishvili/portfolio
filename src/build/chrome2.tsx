/** Page 2 chrome: Layers (current frame tree), Inspector (live travel), Dock */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { hover, tool, type Breakpoint, type Tool } from '../scene/store'
import { Chevron, LayerIcon, ToolIcon } from '../chrome/Icons'
import { PageSwitch } from '../chrome/PageSwitch'
import { ChapterRuler, type RulerChapter } from '../chrome/ChapterRuler'
import { CHAPTERS } from '../content/story'
import { comps, type Comp } from './runtime'
import { bsinks, chapterCh, inspSel, inspState, placedVer } from './bstore'
import { holdOf, SEG } from './timeline'

type Icon = keyof typeof LayerIcon
const iconFor = (c: Comp): Icon => {
  if (c.name === 'Heading' || c.name === 'Paragraph' || c.name === 'Footer') return 'text'
  if (c.name === 'PortraitCard') return 'image'
  if (c.name.startsWith('Card') || c.name === 'Timeline') return 'auto'
  return 'component'
}

function useChannels() {
  const [ch, setCh] = useState(chapterCh.get())
  const [, setV] = useState(0)
  const [hov, setHov] = useState<string | null>(hover.get())
  useEffect(() => {
    const a = chapterCh.sub(setCh)
    const b = placedVer.sub(setV)
    const c = hover.sub(setHov)
    return () => {
      a()
      b()
      c()
    }
  }, [])
  return { ch, hov }
}

export function LayersPanel2() {
  const { ch, hov } = useChannels()
  const list = [...comps.values()].filter((c) => c.chapter === ch).sort((a, b) => a.land - b.land || a.order - b.order)
  const placed = list.filter((c) => c.pose.state === 'placed' && c.pose.op > 0).length
  const inside = [...comps.values()].filter((c) => c.pose.inside).length
  const chap = CHAPTERS[ch]
  return (
    <aside className="layers chrome layers2" aria-label="Layers">
      <div className="panel-head">
        <span className="panel-tab is-active">Layers</span>
        <span className="panel-tab">Assets</span>
        <PageSwitch current={2} />
      </div>
      <div className="l2-list" role="tree" aria-label={`Frame ${chap.num} ${chap.frame}`}>
        <div className="layer-row d0 l2-row" role="treeitem" aria-level={1} aria-expanded="true" key={`f-${ch}`}>
          <Chevron open />
          <span className="layer-ico i-frame">{LayerIcon.frame()}</span>
          <span className="layer-name">
            {chap.num} {chap.frame}
          </span>
          <span className="layer-tag">
            {placed}/{list.length}
          </span>
        </div>
        <div className="l2-rows" key={ch}>
          {list.map((c, i) => {
            const st = c.pose.state
            const isPlaced = st === 'placed' && c.pose.op > 0
            return (
              <div
                key={c.id}
                role="treeitem"
                aria-level={2}
                className={`layer-row d1 l2-row${isPlaced ? ' is-placed' : ''}${hov === c.id ? ' is-hover' : ''}`}
                style={{ '--i': i } as CSSProperties}
                onPointerEnter={() => hover.set(c.id)}
                onPointerLeave={() => hover.get() === c.id && hover.set(null)}
              >
                <span className="chev-pad" />
                <span className={`layer-ico i-${iconFor(c)}`}>{LayerIcon[iconFor(c)]()}</span>
                <span className="layer-name">{c.name}</span>
                <span className={`l2-state s-${isPlaced ? 'placed' : st}`} aria-label={isPlaced ? 'placed' : st}>
                  {isPlaced ? (
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M2.5 6.3 5 8.6 9.6 3.6" />
                    </svg>
                  ) : st === 'inside' ? (
                    'in bubble'
                  ) : (
                    <i aria-hidden="true" />
                  )}
                </span>
              </div>
            )
          })}
        </div>
        <div className="layer-row d1 l2-row l2-bubble" role="treeitem" aria-level={2}>
          <span className="chev-pad" />
          <span className="layer-ico i-organism">{LayerIcon.organism()}</span>
          <span className="layer-name">Bubble</span>
          <span className="layer-tag">{ch === 4 && placed === list.length ? 'home' : `${inside} inside`}</span>
        </div>
      </div>
      <div className="panel-foot">
        <span className="dot-live" aria-hidden="true" /> 3 people editing
      </div>
    </aside>
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

const STATES = ['roaming', 'leaping', 'placed'] as const

export function Inspector2() {
  const [id, setId] = useState(inspSel.get())
  const [st, setSt] = useState(inspState.get())
  const [ch, setCh] = useState(chapterCh.get())
  useEffect(() => {
    const a = inspSel.sub(setId)
    const b = inspState.sub(setSt)
    const c = chapterCh.sub(setCh)
    return () => {
      a()
      b()
      c()
    }
  }, [])
  const c = id ? comps.get(id) : null
  const chap = CHAPTERS[c?.chapter ?? ch]
  return (
    <aside className="inspector chrome inspector2" aria-label="Design inspector (live values)">
      <div className="panel-head">
        <span className="panel-tab is-active">Design</span>
        <span className="panel-tab">Prototype</span>
      </div>
      <div className="insp-sel">
        <span className="layer-ico i-component">{LayerIcon.component()}</span>
        <span className="insp-name" key={id ?? 'none'}>
          {c?.name ?? `${chap.num} ${chap.frame}`}
        </span>
        <span className="insp-kind">{c ? 'Component' : 'Frame'}</span>
      </div>
      <section className="insp-sec">
        <h3 className="sec-h">
          Position <span className="sec-sub">in {chap.num} {chap.frame}</span>
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
      <section className="insp-sec">
        <h3 className="sec-h">State</h3>
        <div className="moods" role="list">
          {STATES.map((v) => (
            <span key={v} role="listitem" className={`mood st-${v}${v === st ? ' is-on' : ''}`} aria-current={v === st ? 'true' : undefined}>
              {v}
            </span>
          ))}
        </div>
      </section>
      <section className="insp-sec">
        <h3 className="sec-h">Fill</h3>
        <div className="fill-row">
          <span className="swatch" style={{ background: c?.tone ?? '#FFFDF8' }} />
          <span className="hex">{(c?.tone ?? '#FFFDF8').replace('#', '').toUpperCase()}</span>
          <span className="op">100%</span>
        </div>
      </section>
    </aside>
  )
}

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'move', label: 'Move', key: 'V' },
  { id: 'hand', label: 'Hand — drag to scrub', key: 'H' },
]

const RULER: RulerChapter[] = CHAPTERS.map((c, i) => ({ label: c.ruler, at: SEG[i], jump: holdOf(i) }))

export function Dock({ bp }: { bp: Breakpoint }) {
  const [active, setActive] = useState<Tool>(tool.get())
  useEffect(() => {
    const a = tool.sub(setActive)
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
      if (t) tool.set(t.id)
      if (e.key === 'Escape') tool.set('move')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      a()
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  useEffect(() => () => tool.set('move'), [])
  return (
    <div className={`dock chrome${bp === 'mob' ? ' is-compact' : ''}`}>
      {bp !== 'mob' && (
        <>
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
        </>
      )}
      <ChapterRuler chapters={RULER} variant="dock" label="Story chapters" />
    </div>
  )
}
