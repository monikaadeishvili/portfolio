/**
 * The dock's Color picker: while it is the active tool, the colour under the
 * pointer is sampled every frame (see ./colorSample.ts) and written into the
 * cursor's chip (swatch + hex). A click copies the hex to the clipboard and
 * the chip says so for a moment. Renders nothing itself.
 */
import { useEffect } from 'react'
import { pointer, tool } from '../scene/store'
import { hex, sampleAt } from './colorSample'

export function ColorPicker() {
  useEffect(() => {
    let raf = 0
    let on = tool.get() === 'picker'
    let last = ''
    let copiedUntil = 0
    const chip = () => document.querySelector<HTMLElement>('.cur-you .cur-pick')

    const frame = (now: number) => {
      raf = 0
      if (!on) return
      const el = chip()
      if (el && pointer.inCanvas) {
        const h = hex(sampleAt(pointer.x, pointer.y))
        const copied = now < copiedUntil
        const key = `${h}|${copied}`
        if (key !== last) {
          last = key
          el.querySelector<HTMLElement>('.cur-pick-sw')!.style.background = h
          el.querySelector<HTMLElement>('.cur-pick-hex')!.textContent = copied ? `Copied ${h}` : h
          el.classList.toggle('is-copied', copied)
        }
      }
      // keep sampling: the portrait's grains and the page under a resting cursor still move
      raf = requestAnimationFrame(frame)
    }
    const start = () => {
      if (on && !raf) raf = requestAnimationFrame(frame)
    }
    const unTool = tool.sub((v) => {
      on = v === 'picker'
      last = ''
      start()
    })
    const onDown = (e: PointerEvent) => {
      if (!on || e.button !== 0 || e.pointerType !== 'mouse') return
      const h = hex(sampleAt(e.clientX, e.clientY))
      navigator.clipboard?.writeText(h).catch(() => {})
      copiedUntil = performance.now() + 1100
      last = ''
    }
    window.addEventListener('pointerdown', onDown)
    start()
    return () => {
      cancelAnimationFrame(raf)
      unTool()
      window.removeEventListener('pointerdown', onDown)
    }
  }, [])
  return null
}
