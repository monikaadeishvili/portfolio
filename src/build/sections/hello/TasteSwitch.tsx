/**
 * The Taste switch: a refined inline pill docked in the headline. A real
 * `<button role="switch">` — on the live canvas its checked state is written
 * by the taste engine (scroll + clicks); on the static page it is controlled.
 */
export function TasteSwitch({ checked, onToggle }: { checked?: boolean; onToggle: () => void }) {
  const on = checked ?? true
  return (
    <span className="h-sw-wrap" data-nag="0">
      <button type="button" role="switch" aria-checked={on} aria-label="Taste" className="h-sw" data-on={on ? '1' : '0'} onClick={onToggle}>
        <span className="h-sw-knob" aria-hidden="true" />
      </button>
      <span className="h-try" aria-hidden="true">
        try me
      </span>
      <span className="h-sw-state" aria-hidden="true">
        taste: off
      </span>
    </span>
  )
}
