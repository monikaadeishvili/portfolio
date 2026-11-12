import { useEffect, useState, type CSSProperties } from 'react'
import { CREATURES } from '../scene/creatures'
import { hover, landedCount, phase, storySel, type Phase } from '../scene/store'
import { Chevron, LayerIcon } from './Icons'
import { PageSwitch } from './PageSwitch'

type Icon = keyof typeof LayerIcon
type Group = 'heroFrame' | 'aboutFrame' | 'name' | 'hero' | 'org' | 'about' | 'momo'

interface Row {
  key: string
  label: string
  icon: Icon
  depth: number
  group: Group
  layer?: string
  /** for about children: revealed once this many pieces landed */
  need?: number
}

const ROWS: Row[] = [
  { key: 'f-hero', label: 'Hero', icon: 'frame', depth: 0, group: 'heroFrame' },
  { key: 'f-about', label: 'About — Auto layout', icon: 'auto', depth: 0, group: 'aboutFrame' },
  { key: 'name', label: 'Monika Adeishvili', icon: 'text', depth: 1, group: 'name', layer: 'name' },
  { key: 'role', label: 'Product Designer', icon: 'text', depth: 1, group: 'hero', layer: 'role' },
  { key: 'org', label: 'Organism', icon: 'organism', depth: 1, group: 'org', layer: 'organism' },
  ...CREATURES.map((c) => ({ key: c.id, label: c.name, icon: 'component' as Icon, depth: 1, group: 'hero' as Group, layer: c.id })),
  { key: 'sticky', label: 'Sticky note', icon: 'note', depth: 1, group: 'hero', layer: 'sticky' },
  { key: 'portrait', label: 'Portrait', icon: 'image', depth: 1, group: 'about', layer: 'portrait', need: 1 },
  { key: 'headline', label: 'Headline', icon: 'text', depth: 1, group: 'about', layer: 'headline', need: 2 },
  { key: 'bio', label: 'Bio', icon: 'text', depth: 1, group: 'about', layer: 'bio', need: 3 },
  { key: 'stats', label: 'Stats', icon: 'auto', depth: 1, group: 'about', layer: 'stats', need: 4 },
  { key: 'chips', label: 'Chips', icon: 'auto', depth: 1, group: 'about', layer: 'chips', need: 5 },
  { key: 'cta', label: 'CTA', icon: 'component', depth: 1, group: 'about', layer: 'cta', need: 6 },
  { key: 'momo', label: 'momo', icon: 'component', depth: 2, group: 'momo', need: 6 },
]

const ROW_H = 28

function visible(r: Row, ph: Phase, landed: number) {
  switch (r.group) {
    case 'heroFrame':
      return ph !== 'about'
    case 'aboutFrame':
      return ph === 'about'
    case 'name':
      return true
    case 'hero':
      return ph === 'hero'
    case 'org':
      return ph === 'organism' || (ph === 'about' && landed < 6)
    case 'about':
    case 'momo':
      return ph === 'about' && landed >= (r.need ?? 0)
  }
}

export function LayersPanel() {
  const [ph, setPh] = useState<Phase>(phase.get())
  const [landed, setLanded] = useState(landedCount.get())
  const [hov, setHov] = useState<string | null>(hover.get())
  const [sel, setSel] = useState(storySel.get())

  useEffect(() => {
    const a = phase.sub(setPh)
    const b = landedCount.sub(setLanded)
    const c = hover.sub(setHov)
    const d = storySel.sub(setSel)
    return () => {
      a()
      b()
      c()
      d()
    }
  }, [])

  // layout: visible rows stack; hidden rows slide into the row they merge with
  const vis = ROWS.map((r) => visible(r, ph, landed))
  const yOf: Record<string, number> = {}
  let n = 0
  ROWS.forEach((r, i) => {
    if (vis[i]) yOf[r.key] = n++ * ROW_H
  })
  const target = (r: Row) => {
    if (r.group === 'hero') return yOf.org ?? yOf['f-about'] ?? yOf.name ?? 0
    if (r.group === 'org') return yOf['c-star'] ?? yOf['f-about'] ?? ROW_H * 2
    if (r.group === 'about' || r.group === 'momo') return yOf.org ?? yOf['f-about'] ?? 0
    if (r.group === 'heroFrame') return yOf['f-about'] ?? 0
    if (r.group === 'aboutFrame') return yOf['f-hero'] ?? 0
    return 0
  }
  const frameOpen = true

  return (
    <aside className="layers chrome" aria-label="Layers">
      <div className="panel-head">
        <span className="panel-tab is-active">Layers</span>
        <span className="panel-tab">Assets</span>
        <PageSwitch current={1} />
      </div>
      <div className="layer-list" style={{ height: n * ROW_H } as CSSProperties} role="tree">
        {ROWS.map((r, i) => {
          const on = vis[i]
          const y = on ? yOf[r.key] : target(r)
          const active = r.layer && (hov === r.layer || (!hov && sel === r.layer))
          return (
            <div
              key={r.key}
              role="treeitem"
              aria-hidden={!on}
              aria-level={r.depth + 1}
              className={`layer-row d${r.depth} g-${r.group}${on ? '' : ' is-gone'}${active ? (hov === r.layer ? ' is-hover' : ' is-sel') : ''}`}
              style={{ transform: `translate3d(0, ${y}px, 0)`, transitionDelay: `${on ? i * 14 : (ROWS.length - i) * 10}ms` } as CSSProperties}
              onPointerEnter={() => r.layer && hover.set(r.layer)}
              onPointerLeave={() => r.layer && hover.get() === r.layer && hover.set(null)}
            >
              {r.depth === 0 ? <Chevron open={frameOpen} /> : <span className="chev-pad" />}
              <span className={`layer-ico i-${r.icon}`}>{LayerIcon[r.icon]()}</span>
              <span className="layer-name">{r.label}</span>
              {r.group === 'org' && <span className="layer-tag">{Math.max(0, 12 - landed * 2)} merged</span>}
            </div>
          )
        })}
      </div>
      <div className="panel-foot">
        <span className="dot-live" aria-hidden="true" /> 3 people editing
      </div>
    </aside>
  )
}
