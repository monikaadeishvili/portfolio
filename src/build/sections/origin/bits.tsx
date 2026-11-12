import type { Ref } from 'react'

/** deterministic barcode */
const BARS = Array.from({ length: 34 }, (_, i) => 1 + ((i * 7919) % 5 === 0 ? 3 : (i * 31) % 3))

export function BoardingPass() {
  return (
    <article className="bp" aria-label="Boarding pass: Tbilisi to Alicante. Passenger Monika Adeishvili, seat UX 01, class Product Design.">
      <div className="bp-main">
        <header className="bp-head">
          <span className="bp-brand">momo air</span>
          <span className="bp-kind">Boarding pass</span>
        </header>
        <div className="bp-route">
          <span className="bp-city">
            <b>TBS</b>
            <i>Tbilisi</i>
          </span>
          <svg className="bp-arc" viewBox="0 0 120 40" aria-hidden="true">
            <path d="M4 34 Q60 -6 116 34" />
            <path className="bp-jet" d="M56 9 l10 4 -10 4 2 -4 z" />
          </svg>
          <span className="bp-city is-to">
            <b>ALC</b>
            <i>Alicante</i>
          </span>
        </div>
        <dl className="bp-meta">
          <div className="is-wide">
            <dt>Passenger</dt>
            <dd>Monika Adeishvili</dd>
          </div>
          <div>
            <dt>Seat</dt>
            <dd>UX 01</dd>
          </div>
          <div>
            <dt>Class</dt>
            <dd>Product Design</dd>
          </div>
          <div>
            <dt>Departed</dt>
            <dd>2020</dd>
          </div>
        </dl>
      </div>
      <div className="bp-stub" aria-hidden="true">
        <span className="bp-stub-l">Gate</span>
        <b>06</b>
        <span className="bp-bars">
          {BARS.map((w, i) => (
            <i key={i} style={{ height: `${w}px` }} />
          ))}
        </span>
      </div>
    </article>
  )
}

export function Pin({ city, when, tone }: { city: string; when: string; tone: string }) {
  return (
    <span className={`pin pin-${tone}`}>
      <span className="pin-card">
        <b>{city}</b>
        <i>· {when}</i>
      </span>
      <svg className="pin-mark" viewBox="0 0 40 52" aria-hidden="true">
        <path d="M20 50 C20 50 4 31 4 19 a16 16 0 0 1 32 0 C36 31 20 50 20 50 Z" />
        <circle cx="20" cy="19" r="6" />
      </svg>
      <i className="pin-tip" aria-hidden="true" />
    </span>
  )
}

export type StampShape = 'round' | 'oval' | 'rect'

export function Stamp({ year, name, what, shape, tone }: { year: string; name: string; what: string; shape: StampShape; tone: string }) {
  return (
    <span className={`stamp stamp-${shape} st-${tone}`}>
      <span className="stamp-splat" aria-hidden="true" />
      <span className="stamp-ring" aria-hidden="true" />
      <span className="stamp-in">
        <span className="stamp-year">{year}</span>
        <b className="stamp-name">{name}</b>
        <span className="stamp-what">{what}</span>
      </span>
    </span>
  )
}

export function Odometer({ ref }: { ref?: Ref<HTMLDivElement> }) {
  const digits = [3, 9, 0, 0]
  return (
    <div className="odo" ref={ref} role="img" aria-label="Distance travelled: about 3,900 kilometres">
      <span className="odo-l">Distance travelled</span>
      <span className="odo-row" aria-hidden="true">
        <span className="odo-approx">≈</span>
        {digits.map((dg, i) => (
          <span key={i} className="odo-wheel-wrap">
            {i === 1 && <span className="odo-comma">,</span>}
            <span className="odo-wheel">
              <i style={{ transform: `translateY(${(-dg * 100) / 11}%)` }}>
                {Array.from({ length: 11 }, (_, k) => (
                  <span key={k}>{k % 10}</span>
                ))}
              </i>
            </span>
          </span>
        ))}
        <span className="odo-unit">km</span>
      </span>
    </div>
  )
}
