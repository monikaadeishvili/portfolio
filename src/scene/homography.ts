/**
 * Maps a screen point back onto the (possibly tilted, perspective-projected)
 * frame plane. Four corner markers give the projective transform; we solve the
 * 3x3 homography screen→frame directly with an 8x8 Gaussian elimination.
 */
type Pt = [number, number]

function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r
    if (Math.abs(M[piv][c]) < 1e-10) return null
    ;[M[c], M[piv]] = [M[piv], M[c]]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / M[c][c]
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / row[i])
}

export function homography(src: Pt[], dst: Pt[]) {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]
    const [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const h = solve(A, b)
  if (!h) return null
  return (p: Pt): Pt => {
    const w = h[6] * p[0] + h[7] * p[1] + 1
    return [(h[0] * p[0] + h[1] * p[1] + h[2]) / w, (h[3] * p[0] + h[4] * p[1] + h[5]) / w]
  }
}

/** screen point → frame-local px using the 4 corner markers inside the frame */
export function screenToFrame(markers: HTMLElement[], fw: number, fh: number, sx: number, sy: number): Pt | null {
  if (markers.length < 4) return null
  const screen = markers.map((m) => {
    const r = m.getBoundingClientRect()
    return [r.left + r.width / 2, r.top + r.height / 2] as Pt
  })
  const frame: Pt[] = [
    [0, 0],
    [fw, 0],
    [fw, fh],
    [0, fh],
  ]
  const map = homography(screen, frame)
  return map ? map([sx, sy]) : null
}
