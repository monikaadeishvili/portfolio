/**
 * Screen-records toeicpal.com for the toeic.pal frames in Proof (no ffmpeg here):
 *   web   — the dark hero story in one continuous scroll (1440×900 → 1280×800)
 *   phone — the app screen inside the sticky "Speak English with Confidence" phone
 * Frames come from a CDP screencast in real Chrome, are resampled to a steady
 * 30 fps and cropped with sharp, then ./encode.swift writes the H.264 MP4.
 * usage: node scripts/work/video/record.cjs web|phone <tmp-dir> <encoder-binary>
 *   (build the encoder: swiftc -O scripts/work/video/encode.swift -o <encoder-binary>)
 */
const path = require('path')
const fs = require('fs')
const { execFileSync } = require('child_process')
const sharp = require(path.resolve(__dirname, '../../../node_modules/sharp'))
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright')

const [, , which, tmp, encoder] = process.argv
const OUT = path.resolve(__dirname, '../../../public/work')
const FPS = 30

/** stops: [scrollY, glide seconds to get there, hold seconds once there] */
const JOBS = {
  web: {
    dpr: 1,
    size: [1280, 800],
    bitrate: 2_400_000,
    file: 'toeic-web',
    poster: 'toeic-0',
    // one steady glide through the whole story: no stops, a soft start and end
    stops: [[0, 0, 1.2], [7900, 17, 1.0]],
    ease: 'cruise',
    crop: async () => null,
  },
  phone: {
    dpr: 2,
    size: [640, 1386],
    bitrate: 1_600_000,
    file: 'toeic-phone',
    poster: 'toeic-1',
    // the screen's own rounded corners show the page behind: fill them with the
    // screen's grey so nothing light or dark peeks past the frame's radius
    round: { r: 44 / 334, bg: '#f4f5f6' },
    stops: [[8900, 0, 1.8], [9700, 1.2, 0.2], [10150, 1.6, 0.6], [10700, 1.2, 1.2], [11350, 1.1, 1.4], [12200, 1.3, 0.1], [12600, 1.5, 1.4]],
    // the rounded screen inside the phone's black body
    crop: (page) =>
      page.evaluate(() => {
        const el = [...document.querySelectorAll('div')].find((d) => /overflow-hidden rounded-\[44px\]/.test(d.className) && d.getBoundingClientRect().width > 200)
        const r = el.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      }),
  },
}

;(async () => {
  const job = JOBS[which]
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  const browser = await chromium.launch({ channel: 'chrome', headless: false })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: job.dpr })
  await page.goto('https://toeicpal.com/', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  // load everything once, then park at the first stop
  for (let y = 0; y <= 14000; y += 600) {
    await page.evaluate((y) => window.scrollTo(0, y), y)
    await page.waitForTimeout(90)
  }
  await page.evaluate((y) => window.scrollTo(0, y), job.stops[0][0])
  await page.waitForTimeout(2500)
  const crop = await job.crop(page)

  const cdp = await page.context().newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', (f) => {
    // the frame's own timestamp, and when it arrived here (the clocks can differ)
    frames.push({ t: f.metadata.timestamp, at: Date.now() / 1000, b: Buffer.from(f.data, 'base64') })
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 })
  await page.waitForTimeout(300)
  const t0 = Date.now() / 1000
  // the tour runs inside the page: eased glides between stops, holds on each
  await page.evaluate(
    ([stops, kind]) =>
      new Promise((done) => {
        const plan = []
        let at = 0
        stops.forEach(([y, g, h], i) => {
          if (i) plan.push({ a: at, b: (at += g), from: stops[i - 1][0], to: y })
          at += h
        })
        const end = at
        // glide: ease in and out between stops; cruise: speed up over the first
        // tenth, hold a constant speed, slow down over the last tenth
        const A = 0.1
        const cruise = (k) => {
          const v = 1 / (1 - A) // top speed, so the distance still sums to 1
          if (k < A) return (v * k * k) / (2 * A)
          if (k > 1 - A) return 1 - (v * (1 - k) * (1 - k)) / (2 * A)
          return (v * A) / 2 + v * (k - A)
        }
        const ease = kind === 'cruise' ? cruise : (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
        // the site's smooth scroll (Lenis) undoes small scrollTo steps, so a
        // continuous cruise is fed to it as wheel events, like a trackpad
        let last = stops[0][0]
        const go = (y) => {
          if (kind !== 'cruise') return window.scrollTo(0, y)
          const d = y - last
          last = y
          if (d) document.documentElement.dispatchEvent(new WheelEvent('wheel', { deltaY: d, deltaMode: 0, bubbles: true, cancelable: true }))
        }
        const s = performance.now()
        const tick = (now) => {
          const t = (now - s) / 1000
          const seg = plan.find((p) => t >= p.a && t < p.b)
          if (seg) go(seg.from + (seg.to - seg.from) * ease((t - seg.a) / (seg.b - seg.a)))
          else if (kind === 'cruise' && t >= plan[plan.length - 1].b) go(plan[plan.length - 1].to)
          if (t < end) requestAnimationFrame(tick)
          else done()
        }
        requestAnimationFrame(tick)
      }),
    [job.stops, job.ease || 'glide'],
  )
  const dur = Date.now() / 1000 - t0
  await cdp.send('Page.stopScreencast')
  await browser.close()

  // a steady 30 fps: each output frame shows the newest screencast frame at that moment
  // map the tour's start onto the frames' clock (the median arrival lag), and
  // before the first change the first frame stands (a still page sends none)
  const lags = frames.map((f) => f.at - f.t).sort((a, b) => a - b)
  const start = t0 - lags[Math.floor(lags.length / 2)]
  const n = Math.floor(dur * FPS)
  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t)
  console.log(`${frames.length} frames over ${dur.toFixed(1)}s, longest gap ${(Math.max(...gaps) * 1000).toFixed(0)}ms`)
  const [W, H] = job.size
  const mask = job.round && Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${Math.round(job.round.r * W)}" fill="#fff"/></svg>`)
  let k = 0
  for (let i = 0; i < n; i++) {
    const t = start + i / FPS
    while (k + 1 < frames.length && frames[k + 1].t <= t) k++
    let img = sharp(frames[k].b)
    if (crop) {
      const d = job.dpr
      img = img.extract({ left: Math.round(crop.x * d), top: Math.round(crop.y * d), width: Math.round(crop.w * d), height: Math.round(crop.h * d) })
    }
    img = img.resize(W, H, { fit: 'cover', position: 'top' })
    if (mask) img = sharp(await img.ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()).flatten({ background: job.round.bg })
    await img.jpeg({ quality: 93 }).toFile(path.join(tmp, `f${String(i).padStart(5, '0')}.jpg`))
  }
  const mp4 = path.join(OUT, `${job.file}.mp4`)
  console.log(execFileSync(encoder, [tmp, mp4, String(FPS), String(job.bitrate)]).toString().trim())
  // the poster is the video's first frame, so nothing jumps when it starts playing
  await sharp(path.join(tmp, 'f00000.jpg')).webp({ quality: 82 }).toFile(path.join(OUT, `${job.poster}.webp`))
  console.log(mp4, (fs.statSync(mp4).size / 1e6).toFixed(2) + ' MB')
})()
