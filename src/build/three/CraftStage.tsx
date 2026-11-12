/**
 * Host for the 3-D exploded interface. three.js is loaded in its own chunk
 * only when section 03 approaches; it renders only while visible. Reduced
 * motion, narrow screens and no-WebGL get the CSS 3-D slabs instead.
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { pointer } from '../../scene/store'
import { useSection } from '../parts'
import { clamp01, registerFx, smooth } from '../runtime'
import { SEC } from '../worlds'

const NAMES = ['Background', 'Layout grid', 'Content', 'Components', 'Interactions']

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

export function CraftStage() {
  const { live, narrow } = useSection()
  const [mode] = useState<'three' | 'css'>(() => (live && !narrow && hasWebGL() ? 'three' : 'css'))
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box || !live) return
    const labels = Array.from(box.querySelectorAll<HTMLElement>('.cs-label'))
    const lines = Array.from(box.querySelectorAll<SVGLineElement>('.cs-lines line'))
    const slabs = Array.from(box.querySelectorAll<HTMLElement>('.cs-slab'))
    let scene: import('./CraftScene').CraftScene | null = null
    let loading = false
    let dead = false
    let lastQ = -1
    let w = 0
    let h = 0
    const pt = { x: 0, y: 0 }
    const sizeIt = () => {
      w = box.offsetWidth
      h = box.offsetHeight
      // the artboard is shown at ≈0.5–0.9 zoom: no need for more than 1.5× pixels
      if (scene) scene.resize(w, h, Math.min(2, window.devicePixelRatio || 1) * 0.8)
    }
    const load = () => {
      if (loading || mode !== 'three') return
      loading = true
      import('./CraftScene')
        .then(({ CraftScene }) => {
          if (dead || !canvasRef.current) return
          scene = new CraftScene(canvasRef.current)
          sizeIt()
          lastQ = -1
        })
        .catch(() => {
          box.dataset.mode = 'css'
        })
    }
    let win: [number, number] = [0, 1]
    const unFx = registerFx({
      id: 'craft-3d',
      section: 2,
      measure: (g) => {
        win = g.wins[2]?.[1] ?? [0, 1]
        sizeIt()
      },
      update: (e) => {
        // start loading during the previous section's hold
        if (!loading && e.p > SEC[1][0] + (SEC[1][1] - SEC[1][0]) * 0.55) load()
        const span = win[1] - win[0]
        const q = e.reduced ? 0.55 : clamp01((e.p - win[0]) / (span * 1.12))
        const visible = e.near && e.u > 0.2 && e.u < 1.05
        box.classList.toggle('is-on', visible)
        if (!visible) return
        // labels: shown while the stack is exploded
        const lab = smooth(0.15, 0.24, q) * (1 - smooth(0.8, 0.86, q))
        if (scene) {
          scene.setProgress(q)
          scene.setPointer((pointer.x / window.innerWidth) * 2 - 1, (pointer.y / window.innerHeight) * 2 - 1)
          scene.render(e.t, e.dt)
          // labels live in a clean column right of the stack, spaced apart
          const ys: { i: number; x: number; y: number }[] = []
          for (let i = 0; i < 5; i++) {
            scene.anchorPx(i, pt)
            ys.push({ i, x: pt.x, y: pt.y })
          }
          ys.sort((a, b) => a.y - b.y)
          for (let k = 1; k < ys.length; k++) ys[k].y = Math.max(ys[k].y, ys[k - 1].y + 52)
          const lw = Math.max(...labels.map((l) => l.offsetWidth))
          const colX = w - lw - 22
          for (const a of ys) {
            const i = a.i
            scene.anchorPx(i, pt)
            const lx = colX
            const ly = a.y
            labels[i].style.transform = `translate3d(${lx.toFixed(1)}px, ${(ly - 16).toFixed(1)}px, 0)`
            labels[i].style.opacity = lab.toFixed(2)
            const ln = lines[i]
            ln.setAttribute('x1', pt.x.toFixed(1))
            ln.setAttribute('y1', pt.y.toFixed(1))
            ln.setAttribute('x2', lx.toFixed(1))
            ln.setAttribute('y2', ly.toFixed(1))
            ln.style.opacity = lab.toFixed(2)
          }
        } else if (Math.abs(q - lastQ) > 0.001) {
          // CSS fallback: the same beats with CSS 3-D
          lastQ = q
          const fly = smooth(0, 0.16, q)
          const press = smooth(0.84, 0.98, q)
          const gap = (1 - press) * (narrow ? 40 : 70)
          slabs.forEach((s, i) => {
            const off = (1 - fly) * (i % 2 ? 1 : -1) * 120
            s.style.transform = `translate3d(${off.toFixed(1)}px, ${(-i * gap).toFixed(1)}px, 0)`
            s.style.opacity = (0.25 + 0.75 * fly).toFixed(2)
          })
          box.style.setProperty('--tilt', String(1 - press))
          labels.forEach((l) => (l.style.opacity = lab.toFixed(2)))
        }
      },
    })
    return () => {
      dead = true
      unFx()
      scene?.dispose()
      scene = null
    }
  }, [live, mode, narrow])

  return (
    <div ref={boxRef} className={`cs cs-${mode}`} data-mode={mode} role="img" aria-label="An interface exploded into five layers — background, layout grid, content, components and interactions — that compress into one finished card.">
      {mode === 'three' ? (
        <canvas ref={canvasRef} className="cs-canvas" aria-hidden="true" />
      ) : (
        <div className="cs-css" aria-hidden="true">
          <div className="cs-stack">
            {NAMES.map((n, i) => (
              <div key={n} className={`cs-slab cs-s${i}`} style={{ '--i': i } as CSSProperties}>
                {i === 1 && (
                  <span className="cs-cols">
                    {Array.from({ length: 6 }, (_, k) => (
                      <i key={k} />
                    ))}
                  </span>
                )}
                {i === 2 && (
                  <span className="cs-skel">
                    <i />
                    <i />
                    <i />
                    <b />
                  </span>
                )}
                {i === 3 && (
                  <span className="cs-comp">
                    <i className="b1">Button</i>
                    <i className="b2" />
                  </span>
                )}
                {i === 4 && <span className="cs-cursor" />}
              </div>
            ))}
          </div>
        </div>
      )}
      <svg className="cs-lines" aria-hidden="true">
        {NAMES.map((n) => (
          <line key={n} />
        ))}
      </svg>
      <div className="cs-labels" aria-hidden="true">
        {NAMES.map((n, i) => (
          <span key={n} className={`cs-label l${i}`}>
            <b>{String(i + 1).padStart(2, '0')}</b> {n}
          </span>
        ))}
      </div>
    </div>
  )
}
