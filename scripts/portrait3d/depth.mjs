import { pipeline, RawImage, env } from '@huggingface/transformers'
import sharp from '/Users/mono/Desktop/momo design/website/node_modules/sharp/lib/index.js'
env.cacheDir = './hf-cache'
const model = process.argv[2] || 'onnx-community/depth-anything-v2-small'
const est = await pipeline('depth-estimation', model, { dtype: 'fp32' })
// feed the cut-out on a neutral grey so the background reads as far away
const H = 1036
const buf = await sharp('cut-clean.png').resize({ height: H }).flatten({ background: '#808080' }).png().toBuffer()
const meta = await sharp(buf).metadata()
const img = await RawImage.fromBlob(new Blob([buf]))
const t0 = Date.now()
const { predicted_depth, depth } = await est(img)
console.log('model', model, 'ms', Date.now() - t0, 'dims', predicted_depth.dims, 'in', meta.width, meta.height)
await depth.save('depth-raw.png')
