import BuildApp from './build/BuildApp'
import { applyLayout, breakpointFor } from './scene/layout'
import { scene } from './scene/store'

const reducedQuery = '(prefers-reduced-motion: reduce)'
const fineQuery = '(hover: hover) and (pointer: fine)'

export default function App() {
  return <BuildApp />
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
