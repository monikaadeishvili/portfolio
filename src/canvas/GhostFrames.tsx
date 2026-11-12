import type { CSSProperties } from 'react'

function Sleeper({ color }: { color: string }) {
  return (
    <div className="sleeper">
      <div className="sleeper-body">
        <div className="sleeper-ui" style={{ '--c': color } as CSSProperties} />
        <svg className="sleeper-eyes" viewBox="0 0 40 12" aria-hidden="true">
          <path d="M4 4c3 4 7 4 10 0M26 4c3 4 7 4 10 0" />
        </svg>
      </div>
      <span className="zzz">
        <i>z</i>
        <i>z</i>
        <i>z</i>
      </span>
    </div>
  )
}

export function GhostFrames() {
  return (
    <div className="ghosts" aria-hidden="true">
      <div className="ghost ghost-work">
        <span className="ghost-label">Work · coming soon</span>
        <div className="ghost-body">
          <Sleeper color="#2DB8FF" />
        </div>
      </div>
      <div className="ghost ghost-contact">
        <span className="ghost-label">Contact · coming soon</span>
        <div className="ghost-body">
          <Sleeper color="#FF7AD1" />
        </div>
      </div>
    </div>
  )
}
