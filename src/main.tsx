import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque/standard.css'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import '@fontsource/anton/latin-400.css'
import '@fontsource-variable/big-shoulders-display'
import './styles/tokens.css'
import './styles/base.css'
import './styles/chrome.css'
import './styles/canvas.css'
import './styles/creatures.css'
import './styles/about.css'
import './ui/ui.css'
import './styles/ruler.css'
import './styles/build.css'
import App, { bootLayout } from './App'

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
bootLayout()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
