/**
 * 03 Proof — the work strip's images. Renders each project's screens from the
 * designer's source files (Figma SVG exports, JPGs, website captures) into
 * public/work/<id>-<n>.webp.
 *
 *   node scripts/work/build.mjs [id…]      (from the website folder; ids limit it)
 *
 * Sources: ../Projects/<Project>/… (the momo design folder). toeic.pal's frames
 * are screen recordings of toeicpal.com: ./video/record.cjs writes those videos
 * and their posters (toeic-0, toeic-1).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const P = path.resolve(here, '../../../Projects')
const OUT = path.resolve(here, '../../public/work')
fs.mkdirSync(OUT, { recursive: true })

/** target pixel width per frame kind */
const W = { web: 1600, tv: 1600, phone: 640 }
/** frame aspect (w / h): screens are cropped from the top to fit */
const A = { web: 16 / 10, tv: 16 / 9, phone: 9 / 19.5 }

const MEDIA = {
  // DAZN: the TV export has 1-3 px transparent edges (trimmed); the phone
  // screens have transparent rounded corners (filled dark, never white)
  dazn: [
    ['tv', `${P}/DAZN/TV.svg`, { trim: 0.004, bg: '#0b1220' }],
    // the phone, in nav-bar order: Home, Scores, Schedule, Search, then Profile
    ['phone', `${P}/DAZN/Mobile Screens Main Page.svg`, { bg: '#0a0e13' }],
    ['phone', `${P}/DAZN/Mobile Screens-2.svg`, { bg: '#0a0e13' }],
    ['phone', `${P}/DAZN/Mobile Screens-3.svg`, { bg: '#0a0e13' }],
    ['phone', `${P}/DAZN/Mobile Screens-1.svg`, { bg: '#0a0e13' }],
    ['phone', `${P}/DAZN/Mobile Screens.svg`, { bg: '#0a0e13' }],
  ],
  nota: [
    ['web', `${P}/Nota/Dashboard 2.jpg`],
    ['phone', `${P}/Nota/Scores - With 5 icons 1.jpg`],
  ],
  roomistry: [
    // the phone, in the order of the flow: splash, welcome, questionnaire,
    // passions, matches, a profile, then the chat
    ...['1.svg', '2.svg', '3.svg', '4.svg', '5.svg', '6.jpg', '7.svg'].map((f) => ['phone', `${P}/Roomistry/${f}`]),
  ],
  'hello-audio': [
    ['web', `${P}/Hello Audio/List of Episodes - Episodessas 2.jpg`],
    ['phone', `${P}/Hello Audio/List of Episodes - Episodess 1.jpg`],
  ],
  studious: [
    ['web', `${P}/Studious/Dashboard - with icons.svg`],
    // the phone, in the order of the flow: splash, welcome, then create account
    ['phone', `${P}/Studious/1.svg`],
    ['phone', `${P}/Studious/Onboarding/Welcome Page.svg`],
    ['phone', `${P}/Studious/3.svg`],
  ],
  growthoptix: [
    // the whole screen (1440×1024), not cropped to the usual 16:10
    ['web', `${P}/GrowthOptix /Overview.svg`, { a: 1440 / 1024 }],
    ['web', `${P}/GrowthOptix /Overview Dark.svg`, { a: 1440 / 1024 }],
  ],
  wedo: [
    // the phone, in the order of the flow: three onboarding pages, sign-in, no
    // list yet, a new list, then the shared lists (corners filled like the frame)
    ...['1', '2', '3', '4', '5', '6', '7'].map((n) => ['phone', `${P}/Wedo/${n}.svg`, { bg: '#101010' }]),
  ],
}

/**
 * render any source to an RGB buffer exactly `w` wide, cropped from the top to
 * aspect `a` (an entry's own `a` overrides its kind's). `trim` cuts that fraction
 * of the width off every side first (a built-in bezel); `bg` fills any
 * transparency (rounded corners) instead of white.
 */
async function render(file, w, a, { trim = 0, bg = '#ffffff' } = {}) {
  let img
  const big = Math.round(w / (1 - 2 * trim))
  if (file.endsWith('.svg')) {
    const vb = await sharp(file, { limitInputPixels: false }).metadata()
    const density = Math.min(2400, (72 * big * 1.05) / vb.width)
    img = sharp(file, { density, limitInputPixels: false })
  } else img = sharp(file, { limitInputPixels: false })
  let src = await img.flatten({ background: bg }).resize({ width: big }).toBuffer({ resolveWithObject: true })
  if (trim > 0) {
    const t = Math.round(big * trim)
    const cut = await sharp(src.data).extract({ left: t, top: t, width: big - 2 * t, height: src.info.height - 2 * t }).toBuffer()
    src = await sharp(cut).resize({ width: w }).toBuffer({ resolveWithObject: true })
  }
  const flat = src
  const h = Math.round(w / a)
  const cut = Math.min(h, flat.info.height)
  return sharp(flat.data).extract({ left: 0, top: 0, width: w, height: cut }).toBuffer()
}

const report = []
const only = process.argv.slice(2)
for (const [id, list] of Object.entries(MEDIA)) {
  if (only.length && !only.includes(id)) continue
  for (let k = 0; k < list.length; k++) {
    const [kind, file, opt] = list[k]
    const buf = await render(file, W[kind], opt?.a ?? A[kind], opt)
    const base = path.join(OUT, `${id}-${k}`)
    await sharp(buf).webp({ quality: 84, effort: 5 }).toFile(`${base}.webp`)
    const m = await sharp(`${base}.webp`).metadata()
    report.push(`${id}-${k} ${kind} ${m.width}x${m.height} ${Math.round(fs.statSync(`${base}.webp`).size / 1024)}k`)
  }
}
console.log(report.join('\n'))
