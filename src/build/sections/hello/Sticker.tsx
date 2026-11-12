import { useId } from 'react'

/** scalloped sticker outline (computed once) */
function scallop(R: number, bumps: number, depth: number) {
  const pts: string[] = []
  const N = bumps * 10
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = R - depth * (0.5 - 0.5 * Math.cos(a * bumps))
    pts.push(`${(100 + Math.cos(a) * r).toFixed(2)},${(100 + Math.sin(a) * r).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}
const SHAPE = scallop(96, 16, 7)

export type StickerTone = 'mint' | 'yellow' | 'pink' | 'coral' | 'sky' | 'lime' | 'violet'

/** round scalloped sticker-badge with text running on a circle, slowly spinning;
 *  the centre holds a glyph or a big short text (`big`) */
export function Sticker({ ring, tone, glyph, big, size }: { ring: string; tone: StickerTone; glyph?: 'arrow' | 'sun'; big?: string; size?: number }) {
  const id = useId().replace(/:/g, '')
  const text = `${ring} • ${ring} • `
  return (
    <figure className={`stk stk-${tone}`} style={size ? { width: size, height: size } : undefined}>
      <span className="sr-only">{ring}</span>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path className="stk-shadow" d={SHAPE} transform="translate(5 7)" />
        <path className="stk-body" d={SHAPE} />
        <circle className="stk-inner" cx="100" cy="100" r="55" />
        <g className="stk-spin">
          <defs>
            <path id={`c-${id}`} d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
          </defs>
          <text className="stk-text">
            <textPath href={`#c-${id}`} textLength="448" lengthAdjust="spacing">
              {text}
            </textPath>
          </text>
        </g>
        {glyph === 'arrow' && <path className="stk-glyph" d="M80 120 L122 78 M90 76 H124 V110" />}
        {glyph === 'sun' && (
          <g className="stk-glyph">
            <circle cx="100" cy="100" r="17" />
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2
              return <path key={i} d={`M${100 + Math.cos(a) * 27} ${100 + Math.sin(a) * 27} L${100 + Math.cos(a) * 38} ${100 + Math.sin(a) * 38}`} />
            })}
          </g>
        )}
        {big && (
          <text className="stk-big" x="100" y="118" textAnchor="middle">
            {big}
          </text>
        )}
      </svg>
    </figure>
  )
}
