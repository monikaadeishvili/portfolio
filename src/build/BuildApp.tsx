import { useEffect, useState } from 'react'
import { TopBar } from '../chrome/TopBar'
import { breakpointFor } from '../scene/layout'
import { scene, type Breakpoint } from '../scene/store'
import { Stage2 } from './Stage2'
import { viewFor } from './camera'
import { Dock, Inspector2, LayersPanel2 } from './chrome2'

const reducedQuery = '(prefers-reduced-motion: reduce)'

/** Page 2 — Assembly */
export default function BuildApp() {
  const [bp, setBp] = useState<Breakpoint>(scene.bp)
  const [reduced, setReduced] = useState(scene.reduced)
  const [lay, setLay] = useState(() => viewFor(scene.bp).lay)

  useEffect(() => {
    document.documentElement.classList.add('is-build')
    const mq = window.matchMedia(reducedQuery)
    const onMq = () => {
      scene.reduced = mq.matches
      document.documentElement.classList.toggle('is-static', mq.matches)
      setReduced(mq.matches)
    }
    mq.addEventListener('change', onMq)
    const onResize = () => {
      const next = breakpointFor(window.innerWidth)
      scene.bp = next
      setBp(next)
      setLay(viewFor(next).lay)
    }
    window.addEventListener('resize', onResize)
    return () => {
      document.documentElement.classList.remove('is-build')
      mq.removeEventListener('change', onMq)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const key = `${bp}-${lay}-${reduced ? 'r' : 'm'}`
  return (
    <div className="app app-build" id="top">
      <a className="skip-link" href="#ch-contact">
        Skip to contact
      </a>
      <TopBar />
      {bp === 'desk' && !reduced && <LayersPanel2 key={`l-${key}`} />}
      {bp !== 'mob' && !reduced && <Inspector2 />}
      <Stage2 key={key} bp={bp} reduced={reduced} />
      {!reduced && <Dock bp={bp} />}
    </div>
  )
}
