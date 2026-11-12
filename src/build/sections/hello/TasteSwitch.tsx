import { Tooltip } from '../../../ui/components'

/**
 * The Taste switch: a big tactile toggle in the momo chunky style. A real
 * `<button role="switch">` — on the live canvas its checked state is written
 * by the taste engine (scroll + clicks); on the static page it is controlled.
 */
export function TasteSwitch({ checked, onToggle }: { checked?: boolean; onToggle: () => void }) {
  const on = checked ?? true
  return (
    <span className="h-sw-wrap" data-nag="0">
      <button type="button" role="switch" aria-checked={on} aria-label="Taste" className="h-sw" data-on={on ? '1' : '0'} onClick={onToggle}>
        <span className="h-sw-lbl" aria-hidden="true">
          Taste
        </span>
        <span className="h-sw-track" aria-hidden="true">
          <span className="h-sw-knob" />
        </span>
        <span className="h-sw-st" aria-hidden="true">
          <span className="h-sw-off">off</span>
          <span className="h-sw-on">on</span>
        </span>
      </button>
      <span className="h-try" aria-hidden="true">
        <Tooltip>try me</Tooltip>
      </span>
    </span>
  )
}
