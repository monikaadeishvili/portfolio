import sharp from '/Users/mono/Desktop/momo design/website/node_modules/sharp/lib/index.js'
const { data, info } = await sharp('cut-full.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const W = info.width, H = info.height, N = W * H
// choke the soft fringe a little: alpha' = smoothstep(0.30, 0.92, a)
const a = new Float32Array(N)
for (let i = 0; i < N; i++) { const x = data[i * 4 + 3] / 255; const t = Math.min(1, Math.max(0, (x - 0.30) / 0.62)); a[i] = t * t * (3 - 2 * t) }
// colour bleed: blur premultiplied colour using only fully solid pixels, divide by blurred weight
const solid = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) { const s = a[i] > 0.97 ? 1 : 0; solid[i*4]=data[i*4]*s; solid[i*4+1]=data[i*4+1]*s; solid[i*4+2]=data[i*4+2]*s; solid[i*4+3]=255*s }
const bl = await sharp(solid, { raw: { width: W, height: H, channels: 4 } }).blur(6).raw().toBuffer()
const out = Buffer.alloc(N * 4)
for (let i = 0; i < N; i++) {
  const w = bl[i*4+3] / 255
  const keep = a[i] > 0.97
  for (let c = 0; c < 3; c++) out[i*4+c] = keep || w < 0.02 ? data[i*4+c] : bl[i*4+c]
  out[i*4+3] = Math.round(a[i] * 255)
}
await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile('cut-clean.png')
console.log('ok', W, H)
