/**
 * The first-load cover (#boot in index.html): a calm canvas-coloured screen
 * with the eyes logo, painted with the very first byte of HTML. It stays until
 * the page is fully set up (camera measured, fonts in, first frame drawn), then
 * fades away as the intro starts, so a visitor never sees the half-built page
 * or a jump.
 */
let done = false
export function bootReady() {
  if (done) return
  done = true
  document.documentElement.classList.remove('is-booting')
  const el = document.getElementById('boot')
  if (!el) return
  el.classList.add('is-out')
  const remove = () => el.remove()
  el.addEventListener('transitionend', remove, { once: true })
  window.setTimeout(remove, 1000)
}
