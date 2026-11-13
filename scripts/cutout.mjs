#!/usr/bin/env node
/**
 * Build-time cut-out of the Hello portrait.
 *
 *   node scripts/cutout.mjs [source.jpg]
 *
 * The source is a clean photo of Monika on pure white. We:
 *  1. resize to ~1600px tall (Lanczos),
 *  2. flood-fill the near-white pixels connected to the image border (the
 *     background) — interior whites (glasses highlights, earring, light hair
 *     strands that are enclosed) are never touched,
 *  3. in a thin band along that boundary estimate the true foreground colour
 *     from nearby solid pixels and un-mix the white (alpha + colour), which
 *     de-fringes hair strands instead of leaving a white halo,
 *  4. feather the alpha ~1px and write public/monika-cut.webp,
 *  5. bake public/monika-field.webp, the construct field for the shader (below).
 *
 * Needs `sharp` (devDependency). Run once; the outputs are committed.
 */
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2] ?? '/Users/mono/Desktop/CV/Photos/Monika:nobg.jpg'
const OUT_H = 1600
const PREVIEW = process.env.PREVIEW // optional dir: writes the cut-out over electric blue

/* thresholds (0..255) */
const BG_MIN = 232 // a background pixel: every channel at least this bright…
const BG_CHROMA = 24 // …and nearly neutral
const BAND = 7 // px around the background where alpha is un-mixed (the source has a soft light halo)
const FG_R = 10 // radius for the foreground-colour estimate

const { data: rgb, info } = await sharp(SRC).rotate().resize({ height: OUT_H, kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width
const H = info.height
const N = W * H

/* 1. background flood fill from the border */
const isBgish = (i) => {
  const r = rgb[i * 3]
  const g = rgb[i * 3 + 1]
  const b = rgb[i * 3 + 2]
  const mn = Math.min(r, g, b)
  const mx = Math.max(r, g, b)
  return mn >= BG_MIN && mx - mn <= BG_CHROMA
}
const bg = new Uint8Array(N)
const stack = new Int32Array(N)
let sp = 0
const seed = (i) => {
  if (!bg[i] && isBgish(i)) {
    bg[i] = 1
    stack[sp++] = i
  }
}
for (let x = 0; x < W; x++) {
  seed(x)
  seed((H - 1) * W + x)
}
for (let y = 0; y < H; y++) {
  seed(y * W)
  seed(y * W + W - 1)
}
while (sp > 0) {
  const i = stack[--sp]
  const x = i % W
  const y = (i - x) / W
  if (x > 0) seed(i - 1)
  if (x < W - 1) seed(i + 1)
  if (y > 0) seed(i - W)
  if (y < H - 1) seed(i + W)
}

/* distance (chebyshev, capped) from the background, for the edge band */
const dist = new Uint8Array(N).fill(255)
for (let i = 0; i < N; i++) if (bg[i]) dist[i] = 0
for (let pass = 1; pass <= BAND + FG_R + 2; pass++) {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (dist[i] !== 255) continue
      let near = false
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
          if (dist[yy * W + xx] === pass - 1) {
            near = true
            break
          }
        }
      if (near) dist[i] = pass
    }
}

/* 2. foreground colour estimate: mean of solid pixels (beyond the band) nearby */
const solid = new Float32Array(N)
for (let i = 0; i < N; i++) solid[i] = dist[i] > BAND ? 1 : 0
function boxBlur(src, r) {
  const tmp = new Float32Array(N)
  const out = new Float32Array(N)
  for (let y = 0; y < H; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * W + Math.min(W - 1, Math.max(0, x))]
    for (let x = 0; x < W; x++) {
      tmp[y * W + x] = acc
      const a = Math.min(W - 1, x + r + 1)
      const b = Math.max(0, x - r)
      acc += src[y * W + a] - src[y * W + b]
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x]
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc
      const a = Math.min(H - 1, y + r + 1)
      const b = Math.max(0, y - r)
      acc += tmp[a * W + x] - tmp[b * W + x]
    }
  }
  return out
}
const wsum = boxBlur(solid, FG_R)
const fg = [0, 1, 2].map((c) => {
  const ch = new Float32Array(N)
  for (let i = 0; i < N; i++) ch[i] = solid[i] * rgb[i * 3 + c]
  return boxBlur(ch, FG_R)
})

/* 3. alpha + de-fringed colour */
const alpha = new Float32Array(N)
const out = new Uint8ClampedArray(N * 4)
for (let i = 0; i < N; i++) {
  const o = [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]
  if (bg[i]) {
    alpha[i] = 0
    continue
  }
  if (dist[i] > BAND) {
    alpha[i] = 1
    out[i * 4] = o[0]
    out[i * 4 + 1] = o[1]
    out[i * 4 + 2] = o[2]
    continue
  }
  // estimated foreground behind the mix (fallback: the darkened observation)
  const w = wsum[i]
  const F = w > 0.5 ? [fg[0][i] / w, fg[1][i] / w, fg[2][i] / w] : o.map((v) => v * 0.6)
  const lo = 0.299 * o[0] + 0.587 * o[1] + 0.114 * o[2]
  const lf = 0.299 * F[0] + 0.587 * F[1] + 0.114 * F[2]
  let a = (255 - lo) / Math.max(48, 255 - lf)
  a = Math.min(1, Math.max(0, a))
  // the first ring next to the background never stays fully opaque (kills the white line)
  if (dist[i] === 1) a = Math.min(a, 0.92)
  alpha[i] = a
  // un-mix the white: c = (o - (1-a)·255) / a, blended toward F for thin coverage
  const k = Math.min(1, Math.max(0, (a - 0.15) / 0.55))
  for (let c = 0; c < 3; c++) {
    const un = a > 0.02 ? (o[c] - (1 - a) * 255) / a : F[c]
    const v = k * Math.min(255, Math.max(0, un)) + (1 - k) * F[c]
    // never lighter than what we observed (no glow), never lighter than F + a margin
    out[i * 4 + c] = Math.min(o[c], v, F[c] + 40)
  }
}

/* 4. feather: a 3×3 weighted blur of the alpha along the edge only */
const feath = new Float32Array(N)
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = y * W + x
    if (dist[i] > BAND + 1) {
      feath[i] = alpha[i]
      continue
    }
    let s = 0
    let ws = 0
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = Math.min(W - 1, Math.max(0, x + dx))
        const yy = Math.min(H - 1, Math.max(0, y + dy))
        const wt = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1
        s += alpha[yy * W + xx] * wt
        ws += wt
      }
    feath[i] = s / ws
  }
for (let i = 0; i < N; i++) {
  out[i * 4 + 3] = Math.round(feath[i] * 255)
  // transparent pixels carry the nearby foreground colour (clean bilinear sampling on the GPU)
  if (feath[i] < 1 && wsum[i] > 0.5 && out[i * 4 + 3] < 8) {
    out[i * 4] = fg[0][i] / wsum[i]
    out[i * 4 + 1] = fg[1][i] / wsum[i]
    out[i * 4 + 2] = fg[2][i] / wsum[i]
  }
}

const img = sharp(Buffer.from(out.buffer), { raw: { width: W, height: H, channels: 4 } })
await img.clone().webp({ quality: 86, alphaQuality: 100, smartSubsample: true, effort: 6 }).toFile(path.join(root, 'public/monika-cut.webp'))
console.log(`monika-cut: ${W}×${H}`)

if (PREVIEW) {
  const blue = { r: 10, g: 75, b: 255 }
  await sharp(Buffer.from(out.buffer), { raw: { width: W, height: H, channels: 4 } }).flatten({ background: blue }).jpeg({ quality: 92 }).toFile(path.join(PREVIEW, 'cut-on-blue.jpg'))
  await sharp(Buffer.from(out.buffer), { raw: { width: W, height: H, channels: 4 } }).flatten({ background: { r: 11, g: 11, b: 12 } }).jpeg({ quality: 92 }).toFile(path.join(PREVIEW, 'cut-on-ink.jpg'))
  const mask = Buffer.alloc(N)
  for (let i = 0; i < N; i++) mask[i] = bg[i] ? 0 : 255
  await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).png().toFile(path.join(PREVIEW, 'mask.png'))
}

/* 5. the construct field (for the shader's line drawing), half resolution:
 *    R,G = a calm luminance field, 16-bit (hi, lo) — detailed on the face,
 *          heavily smoothed where the photo is busy (the dreadlocks), so its
 *          isolines read as clean topography instead of noise;
 *    B   = pen ink: a difference-of-gaussians sketch of the features (eyes,
 *          brows, mouth, lapels), quiet in the hair.
 *    Weighted by alpha, so the silhouette never pulls the field dark. */
{
  const FW = Math.round(W / 2)
  const FH = Math.round(H / 2)
  const { data: small } = await sharp(Buffer.from(out.buffer), { raw: { width: W, height: H, channels: 4 } }).resize(FW, FH, { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true })
  const M = FW * FH
  const Lum = new Float32Array(M)
  const A = new Float32Array(M)
  for (let i = 0; i < M; i++) {
    A[i] = small[i * 4 + 3] / 255
    Lum[i] = (0.299 * small[i * 4] + 0.587 * small[i * 4 + 1] + 0.114 * small[i * 4 + 2]) / 255
  }
  const gauss = (src, sigma) => {
    const r = Math.max(1, Math.ceil(sigma * 3))
    const k = new Float32Array(r * 2 + 1)
    let ks = 0
    for (let i = -r; i <= r; i++) ks += k[i + r] = Math.exp((-i * i) / (2 * sigma * sigma))
    for (let i = 0; i < k.length; i++) k[i] /= ks
    const tmp = new Float32Array(M)
    const res = new Float32Array(M)
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        let s = 0
        for (let j = -r; j <= r; j++) s += src[y * FW + Math.min(FW - 1, Math.max(0, x + j))] * k[j + r]
        tmp[y * FW + x] = s
      }
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        let s = 0
        for (let j = -r; j <= r; j++) s += tmp[Math.min(FH - 1, Math.max(0, y + j)) * FW + x] * k[j + r]
        res[y * FW + x] = s
      }
    return res
  }
  // alpha-normalised blur
  const blurN = (src, sigma) => {
    const wa = new Float32Array(M)
    for (let i = 0; i < M; i++) wa[i] = src[i] * A[i]
    const n = gauss(wa, sigma)
    const d = gauss(A, sigma)
    for (let i = 0; i < M; i++) n[i] = d[i] > 1e-3 ? n[i] / d[i] : src[i]
    return n
  }
  const sstep = (a, b, v) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const L1 = blurN(Lum, 1.2)
  const det = new Float32Array(M)
  for (let i = 0; i < M; i++) det[i] = Math.abs(Lum[i] - L1[i])
  const energy = blurN(det, 7)
  const busy = new Float32Array(M)
  for (let i = 0; i < M; i++) busy[i] = sstep(0.022, 0.05, energy[i])
  const busyS = gauss(busy, 4)
  const Lf = blurN(Lum, 2.6)
  const Lc = blurN(Lum, 11)
  const F0 = new Float32Array(M)
  for (let i = 0; i < M; i++) F0[i] = Lf[i] + (Lc[i] - Lf[i]) * busyS[i]
  const Fld = blurN(F0, 1.6)
  const Dn = blurN(Lum, 0.7)
  const Dw = blurN(Lum, 2.2)
  const ink = new Float32Array(M)
  for (let i = 0; i < M; i++) ink[i] = Math.max(sstep(0.028, 0.085, Dw[i] - Dn[i]), 0.55 * sstep(0.05, 0.12, Dn[i] - Dw[i])) * (1 - busyS[i]) * sstep(0.2, 0.6, A[i])
  const inkS = gauss(ink, 0.6)
  const px = Buffer.alloc(M * 3)
  for (let i = 0; i < M; i++) {
    // 12 bits are plenty (and compress far better than 16)
    const v = Math.round(Math.min(1, Math.max(0, Fld[i])) * 4095) << 4
    px[i * 3] = v >> 8
    px[i * 3 + 1] = v & 255
    px[i * 3 + 2] = Math.round(Math.min(1, inkS[i]) * 255)
  }
  await sharp(px, { raw: { width: FW, height: FH, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(path.join(root, 'public/monika-field.webp'))
  console.log(`monika-field: ${FW}×${FH}`)
  if (PREVIEW) {
    const g = Buffer.alloc(M)
    for (let i = 0; i < M; i++) g[i] = Math.round(Fld[i] * 255)
    await sharp(g, { raw: { width: FW, height: FH, channels: 1 } }).png().toFile(path.join(PREVIEW, 'field.png'))
    for (let i = 0; i < M; i++) g[i] = 255 - Math.round(inkS[i] * 255)
    await sharp(g, { raw: { width: FW, height: FH, channels: 1 } }).png().toFile(path.join(PREVIEW, 'ink.png'))
  }
}
