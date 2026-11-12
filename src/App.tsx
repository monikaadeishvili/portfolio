import { lazy, Suspense, useEffect, useState } from 'react'
import { TopBar } from './chrome/TopBar'
import { LayersPanel } from './chrome/LayersPanel'
import { Inspector } from './chrome/Inspector'
import { Toolbar } from './chrome/Toolbar'
import { Stage } from './canvas/Stage'
import { applyLayout, breakpointFor } from './scene/layout'
import { scene, type Breakpoint } from './scene/store'
const BuildApp = lazy(() => import('./build/BuildApp'))

const reducedQuery = '(prefers-reduced-motion: reduce)'
const fineQuery = '(hover: hover) and (pointer: fine)'

const isBuild = () => /^\/build\/?$/.test(window.location.pathname)

export default function App() {
  return isBuild() ? (
    <Suspense fallback={null}>
      <BuildApp />
    </Suspense>
  ) : (
    <OrganismApp />
  )
}

/** Page 1 — Organism */
function OrganismApp() {
  const [bp, setBp] = useState<Breakpoint>(scene.bp)
  const [reduced, setReduced] = useState(scene.reduced)

  useEffect(() => {
    const mq = window.matchMedia(reducedQuery)
    const onMq = () => {
      scene.reduced = mq.matches
      document.documentElement.classList.toggle('is-static', mq.matches)
      setReduced(mq.matches)
    }
    mq.addEventListener('change', onMq)
    const onResize = () => {
      const next = breakpointFor(window.innerWidth)
      if (next !== scene.bp) {
        scene.bp = next
        applyLayout(next)
        setBp(next)
      }
    }
    window.addEventListener('resize', onResize)
    return () => {
      mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const key = `${bp}-${reduced ? 'r' : 'm'}`
  return (
    <div className="app" id="top">
      <a className="skip-link" href="#about-headline">
        Skip to About
      </a>
      <TopBar />
      {bp === 'desk' && <LayersPanel />}
      {bp !== 'mob' && <Inspector />}
      <Stage key={key} bp={bp} reduced={reduced} />
      <Toolbar bp={bp} />
    </div>
  )
}

/** called once before the first render so CSS vars exist for measurements */
export function bootLayout() {
  scene.bp = breakpointFor(window.innerWidth)
  // ?static previews the reduced-motion version without changing OS settings
  scene.reduced = window.matchMedia(reducedQuery).matches || new URLSearchParams(window.location.search).has('static')
  scene.fine = window.matchMedia(fineQuery).matches
  document.documentElement.classList.toggle('is-static', scene.reduced)
  document.documentElement.classList.toggle('is-coarse', !scene.fine)
  applyLayout(scene.bp)
}
