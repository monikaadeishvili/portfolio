import sharp from '/Users/mono/Desktop/momo design/website/node_modules/sharp/lib/index.js'
const PUB = '/Users/mono/Desktop/momo design/website/public'
// 1) the photo: cut-out, 1800px tall, WebP with alpha
const meta = await sharp('cut-clean.png').metadata()
const H = 1800, W = Math.round(meta.width * H / meta.height)
await sharp('cut-clean.png').resize(W, H, { kernel: 'lanczos3' }).webp({ quality: 90, alphaQuality: 95, effort: 6, smartSubsample: true }).toFile(`${PUB}/monika-new.webp`)
// 2) depth: normalise over the figure, fill the background from the figure, soften
const DW = 600, DH = Math.round(DW * meta.height / meta.width)
const depth = await sharp('depth-raw.png').resize(DW, DH).greyscale().raw().toBuffer()
const alpha = await sharp('cut-clean.png').resize(DW, DH).extractChannel(3).raw().toBuffer()
const N = DW * DH
const inside = new Uint8Array(N); const vals = []
for (let i = 0; i < N; i++) if (alpha[i] > 128) { inside[i] = 1; vals.push(depth[i]) }
vals.sort((a, b) => a - b)
const lo = vals[Math.floor(vals.length * 0.02)], hi = vals[Math.floor(vals.length * 0.995)]
const d = new Float32Array(N).fill(-1)
for (let i = 0; i < N; i++) if (inside[i]) d[i] = Math.min(1, Math.max(0, (depth[i] - lo) / (hi - lo)))
// distance-to-edge (chamfer) inside the figure, for a rounded rim
const dist = new Float32Array(N).fill(1e9)
for (let i = 0; i < N; i++) if (!inside[i]) dist[i] = 0
for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { const i = y * DW + x; if (x) dist[i] = Math.min(dist[i], dist[i - 1] + 1); if (y) dist[i] = Math.min(dist[i], dist[i - DW] + 1) }
for (let y = DH - 1; y >= 0; y--) for (let x = DW - 1; x >= 0; x--) { const i = y * DW + x; if (x < DW - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1); if (y < DH - 1) dist[i] = Math.min(dist[i], dist[i + DW] + 1) }
// fill outside by repeated dilation of the nearest figure depth
let filled = d.slice(); let todo = true; let it = 0
while (todo && it < 400) { todo = false; it++; const nx = filled.slice()
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { const i = y * DW + x; if (filled[i] >= 0) continue; let s = 0, c = 0
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= DW || yy >= DH) continue; const v = filled[yy * DW + xx]; if (v >= 0) { s += v; c++ } }
    if (c) nx[i] = s / c; else todo = true }
  filled = nx }
for (let i = 0; i < N; i++) { if (filled[i] < 0) filled[i] = 0
  // rounded rim: the outer ~10px fall back a little, like a sculpted edge
  if (inside[i]) { const t = Math.min(1, dist[i] / 10); filled[i] = filled[i] * (0.86 + 0.14 * t * (2 - t)) } }
const out = Buffer.alloc(N); for (let i = 0; i < N; i++) out[i] = Math.round(filled[i] * 255)
await sharp(out, { raw: { width: DW, height: DH, channels: 1 } }).blur(1.4).png({ compressionLevel: 9 }).toFile(`${PUB}/monika-new-depth.png`)
console.log('photo', W, H, 'depth', DW, DH, 'lo/hi', lo, hi, 'fill iters', it)
