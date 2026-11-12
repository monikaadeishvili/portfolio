/**
 * The story, told chapter by chapter. Headlines are arrays of segments so the
 * emphasis words can be set in Instrument Serif italic violet.
 */

export type Seg = string | { em: string }

export interface Chapter {
  id: 'hello' | 'origin' | 'craft' | 'proof' | 'contact'
  num: string
  frame: string
  ruler: string
  headline: Seg[]
  body: string
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'hello',
    num: '01',
    frame: 'Hello',
    ruler: 'HELLO',
    headline: ["Hi, I'm ", { em: 'Monika.' }],
    body: "Product designer. Six years of turning messy problems into calm products. Keep scrolling — I'll build this page in front of you.",
  },
  {
    id: 'origin',
    num: '02',
    frame: 'Origin',
    ruler: 'TBILISI → ALICANTE',
    headline: ['It started in Tbilisi, with ', { em: 'one landing page.' }],
    body: 'A food-tech startup, 2020. Then a delivery platform, an agency, a bank, a sports-streaming giant. Today I design from Alicante — the curiosity is the same, the canvas got bigger.',
  },
  {
    id: 'craft',
    num: '03',
    frame: 'Craft',
    ruler: 'HOW I THINK',
    headline: ['I think in ', { em: 'components.' }],
    body: 'Small, honest pieces. A button that knows its job. A card that respects your time. Put together with care, they become something people can trust.',
  },
  {
    id: 'proof',
    num: '04',
    frame: 'Proof',
    ruler: 'PROOF',
    headline: ['Six years, one question: ', { em: 'who is this for?' }],
    body: 'Sports streaming across TV, phone and desktop at DAZN. Business banking for law firms at NOTA by M&T Bank. Eighteen client products at Forcoda. And classrooms, too — I teach UX, because explaining design makes you better at it.',
  },
  {
    id: 'contact',
    num: '05',
    frame: 'Contact',
    ruler: 'SAY HELLO',
    headline: ["Let's build something people ", { em: "won't ignore." }],
    body: 'Open to new work — product design, design systems, and teams that care.',
  },
]

export const PRINCIPLES = ['Research first, pixels second.', 'Systems over screens.', 'Calm beats clever.']

export const QUOTE = { text: 'People ignore design that ignores people.', by: 'Frank Chimero' }

export const STATS = [
  { n: 6, suf: '+', label: 'years designing', tone: 'yellow' },
  { n: 18, suf: '', label: 'client products at one agency', tone: 'lime' },
  { n: 9, suf: '', label: 'industries', tone: 'sky' },
] as const

export const COMPANIES = [
  { name: 'DAZN', role: 'Senior UX Designer', tone: 'yellow', mark: 'DA' },
  { name: 'NOTA by M&T Bank', role: 'Senior UX/UI Designer', tone: 'mint', mark: 'NO' },
  { name: 'Contrast', role: 'Product Designer', tone: 'pink', mark: 'Co' },
  { name: 'Forcoda', role: 'Lead UX/UI Designer', tone: 'sky', mark: 'Fo' },
] as const

export const TIMELINE = [
  { year: '2020', name: 'Dinespace' },
  { year: '2020', name: 'Burq' },
  { year: '2021', name: '4twiggers' },
  { year: '2021', name: 'Forcoda' },
  { year: '2021', name: 'NOTA' },
  { year: '2024', name: 'DAZN' },
  { year: '2024', name: 'Contrast' },
] as const

export const EMAIL = 'monikaadeishvili@gmail.com'
export const LINKS = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/monika-adeishvili-5a84b11b6' },
  { label: 'Behance', href: 'https://www.behance.net/monikaadeishv' },
  { label: 'Dribbble', href: 'https://dribbble.com/monikaadeishvili' },
]
export const FOOTER = 'Designed in momo. Built from components. Alicante, 2026.'

export const segText = (segs: Seg[]) => segs.map((s) => (typeof s === 'string' ? s : s.em)).join('')
