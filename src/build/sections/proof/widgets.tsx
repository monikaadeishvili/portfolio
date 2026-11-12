import type { CSSProperties } from 'react'

export function StatTile({ n, suf, label, tone }: { n: number; suf: string; label: string; tone: string }) {
  const digits = String(n).split('').map(Number)
  return (
    <div className={`stat st-${tone}`}>
      <span className="stat-top" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="stat-n">
        <span className="sr-only">{`${n}${suf}`}</span>
        <span className="stat-wheels" aria-hidden="true">
          {digits.map((d, i) => (
            <span key={i} className="odw">
              <i style={{ transform: `translateY(${(-d * 100) / 11}%)` }}>
                {Array.from({ length: 11 }, (_, k) => (
                  <span key={k}>{k % 10}</span>
                ))}
              </i>
            </span>
          ))}
          {suf && <span className="stat-suf">{suf}</span>}
        </span>
      </span>
      <span className="stat-l">{label}</span>
      <svg className="stat-spark" viewBox="0 0 120 34" aria-hidden="true">
        <path d="M2 30 L20 24 L36 27 L52 16 L70 19 L88 8 L104 11 L118 3" />
      </svg>
    </div>
  )
}

const Y0 = 2020
const Y1 = 2026.5
const ym = (y: number, m: number) => y + (m - 1) / 12
const ROWS = [
  { name: 'Dinespace', role: 'Food-tech startup', from: ym(2020, 5), to: ym(2020, 10), dates: 'May – Sep 2020', tone: 'coral' },
  { name: 'Burq', role: 'Delivery platform', from: ym(2020, 10), to: ym(2021, 4), dates: 'Oct 2020 – Mar 2021', tone: 'yellow' },
  { name: '4twiggers', role: 'Product studio', from: ym(2021, 3), to: ym(2022, 9), dates: 'Mar 2021 – Aug 2022', tone: 'mint' },
  { name: 'Forcoda', role: 'Lead UX/UI Designer', from: ym(2021, 10), to: ym(2024, 6), dates: 'Oct 2021 – May 2024', tone: 'pink' },
  { name: 'NOTA by M&T Bank', role: 'Senior UX/UI Designer', from: ym(2021, 10), to: ym(2023, 12), dates: 'Oct 2021 – Nov 2023', tone: 'sky' },
  { name: 'Qwerty', role: 'UX/UI lecturer', from: ym(2022, 10), to: ym(2023, 4), dates: 'Oct 2022 – Mar 2023', tone: 'lime' },
  { name: 'DAZN', role: 'Senior UX Designer', from: ym(2024, 7), to: ym(2025, 1), dates: 'Jul – Dec 2024', tone: 'yellow' },
  { name: 'Contrast', role: 'Product Designer', from: ym(2024, 5), to: ym(2026, 6), dates: 'May 2024 – May 2026', tone: 'violet' },
]
const pct = (y: number) => ((y - Y0) / (Y1 - Y0)) * 100

export function Gantt() {
  return (
    <section className="gantt" aria-labelledby="gantt-h">
      <header className="gantt-head">
        <h3 id="gantt-h">Career timeline</h3>
        <span className="gantt-legend" aria-hidden="true">
          2020 → 2026 · hover a bar
        </span>
      </header>
      <div className="gantt-body">
        <div className="gantt-axis" aria-hidden="true">
          {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
            <span key={y} style={{ left: `${pct(y)}%` }}>
              {y}
            </span>
          ))}
          <i className="gantt-now" style={{ left: `${pct(2026.42)}%` }} />
        </div>
        <ol className="gantt-rows">
          {ROWS.map((r, k) => (
            <li key={r.name} className="g-row" tabIndex={0} style={{ '--k': k } as CSSProperties}>
              <span className="g-name">{r.name}</span>
              <span className="g-track">
                <span className={`g-bar gb-${r.tone}`} style={{ left: `${pct(r.from)}%`, width: `${pct(r.to) - pct(r.from)}%` }}>
                  <span className="g-tip" role="tooltip">
                    <b>{r.role}</b> {r.dates}
                  </span>
                </span>
              </span>
              <span className="sr-only">
                {r.role}, {r.dates}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Screen({ kind }: { kind: 'tv' | 'laptop' | 'phone' }) {
  return (
    <span className={`dv-screen dv-${kind}-s`}>
      <span className="dv-hero">
        <i className="dv-live">LIVE</i>
        <i className="dv-play" />
      </span>
      <span className="dv-rail">
        <i />
        <i />
        <i />
        {kind !== 'phone' && <i />}
      </span>
      <span className="dv-lines">
        <i />
        <i />
      </span>
    </span>
  )
}

export function DeviceTrio() {
  return (
    <figure className="dv">
      <figcaption className="dv-cap">
        <span className="dv-k">DAZN</span>
        <b>One product, three screens</b>
      </figcaption>
      <div className="dv-stage" aria-hidden="true">
        <span className="dv-tv">
          <span className="dv-bezel">
            <Screen kind="tv" />
          </span>
          <span className="dv-stand" />
        </span>
        <span className="dv-laptop">
          <span className="dv-lid">
            <Screen kind="laptop" />
          </span>
          <span className="dv-base" />
        </span>
        <span className="dv-phone">
          <Screen kind="phone" />
        </span>
      </div>
    </figure>
  )
}
