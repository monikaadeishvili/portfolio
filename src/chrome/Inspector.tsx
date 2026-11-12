import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { hover, mood, registry, storySel, ui, type LayerKind } from '../scene/store'
import { LayerIcon } from './Icons'

const KIND_LABEL: Record<LayerKind, string> = {
  frame: 'Frame',
  text: 'Text',
  component: 'Component',
  organism: 'Organism',
  piece: 'Auto layout',
  note: 'Sticky',
}
const KIND_ICON: Record<LayerKind, keyof typeof LayerIcon> = {
  frame: 'frame',
  text: 'text',
  component: 'component',
  organism: 'organism',
  piece: 'auto',
  note: 'note',
}

function Field({ label, sinkKey, unit }: { label: string; sinkKey: keyof typeof ui.insp; unit?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    ui.insp[sinkKey] = ref.current
    return () => {
      ui.insp[sinkKey] = null
    }
  }, [sinkKey])
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

export function Inspector() {
  const [id, setId] = useState(hover.get() ?? storySel.get())
  const [m, setM] = useState(mood.get())
  const swatchRef = useRef<HTMLSpanElement>(null)
  const hexRef = useRef<HTMLSpanElement>(null)
  const opRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const update = () => setId(hover.get() ?? storySel.get())
    const a = hover.sub(update)
    const b = storySel.sub(update)
    const c = mood.sub(setM)
    return () => {
      a()
      b()
      c()
    }
  }, [])
  useLayoutEffect(() => {
    ui.insp.swatch = swatchRef.current
    ui.insp.hex = hexRef.current
    ui.insp.op = opRef.current
    return () => {
      ui.insp.swatch = null
      ui.insp.hex = null
      ui.insp.op = null
    }
  }, [])

  const info = registry.get(id)
  const kind: LayerKind = info?.kind ?? 'text'
  const alive = kind === 'component' || kind === 'organism'

  return (
    <aside className="inspector chrome" aria-label="Design inspector (live values)">
      <div className="panel-head">
        <span className="panel-tab is-active">Design</span>
        <span className="panel-tab">Prototype</span>
      </div>

      <div className="insp-sel">
        <span className={`layer-ico i-${KIND_ICON[kind]}`}>{LayerIcon[KIND_ICON[kind]]()}</span>
        <span className="insp-name" key={id}>
          {info?.name ?? 'Monika Adeishvili'}
        </span>
        <span className="insp-kind">{KIND_LABEL[kind]}</span>
      </div>

      <section className="insp-sec">
        <h3 className="sec-h">Position</h3>
        <div className="grid2">
          <Field label="X" sinkKey="x" />
          <Field label="Y" sinkKey="y" />
          <Field label="W" sinkKey="w" />
          <Field label="H" sinkKey="h" />
        </div>
        <div className="grid2">
          <Field label="↻" sinkKey="r" />
          <Field label="Z" sinkKey="z" unit="elev" />
        </div>
      </section>

      <section className="insp-sec">
        <h3 className="sec-h">Fill</h3>
        <div className="fill-row">
          <span className="swatch" ref={swatchRef} />
          <span className="hex" ref={hexRef}>
            16131D
          </span>
          <span className="op" ref={opRef}>
            100%
          </span>
        </div>
      </section>

      <section className={`insp-sec mood-sec${alive ? '' : ' is-muted'}`}>
        <h3 className="sec-h">Mood</h3>
        <div className="moods" role="list">
          {['curious', 'bouncy', 'merging…', 'home'].map((v) => (
            <span key={v} role="listitem" className={`mood${v === m ? ' is-on' : ''}`}>
              {v}
            </span>
          ))}
        </div>
      </section>
    </aside>
  )
}
